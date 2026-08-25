package tn.sageindex.portal.dashboard;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import tn.sageindex.portal.account.UserAccount;
import java.sql.*;
import java.time.Instant;
import java.util.*;

@Service
public class OperationalDataService {
    private static final Logger log = LoggerFactory.getLogger(OperationalDataService.class);
    private static final int QUERY_TIMEOUT_SECONDS = 10;
    @Value("${portal.sources.traceability.url}") private String traceUrl;
    @Value("${portal.sources.traceability.username}") private String traceUser;
    @Value("${portal.sources.traceability.password}") private String tracePassword;
    @Value("${portal.sources.hr.url}") private String hrUrl;
    @Value("${portal.sources.hr.username}") private String hrUser;
    @Value("${portal.sources.hr.password}") private String hrPassword;
    @Value("${portal.sources.planning.url}") private String planningDbUrl;
    @Value("${portal.sources.planning.username}") private String planningDbUser;
    @Value("${portal.sources.planning.password}") private String planningDbPassword;
    @Value("${portal.applications.planning-url:http://localhost:3000/}") private String planningUrl;
    @Value("${portal.applications.traceability-url:http://localhost:5173/}") private String traceabilityUrl;
    @Value("${portal.applications.hr-url:http://localhost:5170/}") private String hrApplicationUrl;

    public Map<String,Boolean> applicationAccess(UserAccount account) {
        return Map.of(
                "TRACEABILITY", accountExists(traceUrl, traceUser, tracePassword,
                        "select 1 from users where matricule=? limit 1", account.getMatricule()),
                "HR", accountExists(hrUrl, hrUser, hrPassword,
                        "select 1 from employee where matricule=? and not deleted and not has_left_company limit 1", account.getMatricule()),
                "PLANNING", accountExists(planningDbUrl, planningDbUser, planningDbPassword,
                        "select 1 from app_user where matricule=? limit 1", account.getMatricule()));
    }

    public Optional<EmployeeProfile> findActiveEmployee(String matricule) {
        String sql = """
                select e.id, e.full_name, e.email, d.name department, j.title job_title,
                       et.type work_type, s.full_name supervisor
                from employee e
                left join department d on d.id=e.department_id
                left join job_title j on j.id=e.job_title_id
                left join employment_type et on et.id=e.employment_type_id
                left join employee s on s.id=e.supervisor_id
                where e.matricule=? and not e.deleted and not coalesce(e.has_left_company,false)
                limit 1
                """;
        try (Connection connection = DriverManager.getConnection(hrUrl, hrUser, hrPassword);
             PreparedStatement statement = connection.prepareStatement(sql)) {
            statement.setQueryTimeout(QUERY_TIMEOUT_SECONDS);
            statement.setString(1, matricule);
            try (ResultSet result = statement.executeQuery()) {
                if (!result.next()) return Optional.empty();
                return Optional.of(new EmployeeProfile(result.getLong("id"), result.getString("full_name"),
                        result.getString("email"), result.getString("department"),
                        result.getString("job_title"), result.getString("work_type"),
                        result.getString("supervisor")));
            }
        } catch (SQLException exception) {
            log.warn("Recherche RH indisponible pour le matricule {}: {}", matricule, exception.getMessage());
            throw new IllegalStateException("La base des employés est temporairement indisponible", exception);
        }
    }

    public record EmployeeProfile(long employeeId, String fullName, String email, String department,
                                  String jobTitle, String workType, String supervisor) {}

    private boolean accountExists(String url, String username, String password, String sql, String matricule) {
        try (Connection connection = DriverManager.getConnection(url, username, password);
             PreparedStatement statement = connection.prepareStatement(sql)) {
            statement.setQueryTimeout(QUERY_TIMEOUT_SECONDS);
            statement.setString(1, matricule);
            try (ResultSet result = statement.executeQuery()) { return result.next(); }
        } catch (SQLException exception) {
            log.warn("Vérification d'application indisponible pour le matricule {}: {}", matricule, exception.getMessage());
            return false;
        }
    }

    public Map<String,Object> loadFor(UserAccount account) {
        Map<String,Object> trace = personalTraceability(account.getMatricule());
        Map<String,Object> hr = personalHr(account);
        Map<String,Object> planning = personalPlanning(account.getMatricule());
        boolean traceAccess = number(trace.get("usermatches")) > 0;
        boolean hrAccess = number(hr.get("usermatches")) > 0;
        boolean planningAccess = number(planning.get("usermatches")) > 0;
        // Enforce module isolation in the API, not only in the user interface.
        if (!traceAccess) trace = new LinkedHashMap<>();
        if (!hrAccess) hr = new LinkedHashMap<>();
        if (!planningAccess) planning = new LinkedHashMap<>();
        boolean manager = isManager(account.getJobTitle());

        Map<String,Object> user = new LinkedHashMap<>();
        user.put("name", account.getFullName());
        user.put("department", account.getDepartment());
        user.put("jobTitle", account.getJobTitle());
        user.put("username", account.getUsername());
        user.put("matricule", account.getMatricule());
        user.put("manager", manager);
        user.put("admin", Arrays.asList(account.getRoles().split(",")).contains("ADMIN"));

        long lotsToday = number(trace.get("lotstoday"));
        long openIssues = number(trace.get("openissues"));
        long pendingRequests = number(hr.get("pendingrequests"));
        Map<String,Object> response = new LinkedHashMap<>();
        response.put("user", user);
        response.put("applications", List.of(
                application("TRACEABILITY", "Traçabilité", traceAccess,
                        traceabilityUrl, account.getMatricule(), text(trace.get("accountrole")), "",
                        false),
                application("HR", "Ressources Humaines", hrAccess,
                        hrApplicationUrl, account.getMatricule(), "", text(hr.get("accountemail")),
                        false),
                application("PLANNING", "Gestion des plannings", planningAccess,
                        planningUrl, firstText(planning.get("accountusername"), account.getMatricule()),
                        text(planning.get("accountrole")), text(planning.get("accountemail")),
                        false)));
        response.put("metrics", map(
                "lotsProcessed", lotsToday,
                "attendanceRate", hr.get("attendancerate"),
                "attentionPoints", openIssues + pendingRequests,
                "completedActions", number(trace.get("completedactions")) + number(hr.get("completedrequests"))
                        + number(planning.get("completedactions"))));
        response.put("traceability", map(
                "lotsToday", lotsToday,
                "pendingControls", openIssues,
                "nonConformities", openIssues,
                "shipmentsReady", null,
                "lastUpdate", trace.get("lastupdate"),
                "dailyEvents", trace.get("dailyEvents"),
                "eventTypes", trace.get("eventTypes"),
                "topParts", trace.get("topParts"),
                "projects", trace.get("projects"),
                "dailyQuantities", trace.get("dailyQuantities"),
                "available", trace.get("available")));
        response.put("hr", map(
                "presenceStatus", hr.get("presencestatus"),
                "leaveBalance", null,
                "pendingRequests", pendingRequests,
                "teamAbsences", hr.get("teamabsences"),
                "nextEvent", pendingRequests > 0 ? pendingRequests + " demande(s) en attente" : "Aucune demande en attente",
                "dailyPresence", hr.get("dailyPresence"),
                "requestTypes", hr.get("requestTypes"),
                "requestStatus", hr.get("requestStatus"),
                "attendanceHours", hr.get("attendanceHours"),
                "available", hr.get("available")));
        response.put("planning", map(
                "totalActions", planning.get("totalactions"),
                "openActions", planning.get("openactions"),
                "lateActions", planning.get("lateactions"),
                "completedActions", planning.get("completedactions"),
                "activeProjects", planning.get("activeprojects"),
                "completionRate", planning.get("completionrate"),
                "status", planning.get("status"),
                "projects", planning.get("projects"),
                "deadlines", planning.get("deadlines"),
                "stages", planning.get("stages"),
                "criticality", planning.get("criticality"),
                "available", planning.get("available")));
        response.put("priorities", priorities(openIssues, pendingRequests, number(planning.get("lateactions"))));
        response.put("recentActivity", mergeActivity(trace, hr, planning));
        response.put("generatedAt", Instant.now().toString());
        return response;
    }

    private Map<String,Object> personalTraceability(String matricule) {
        Map<String,Object> data = new LinkedHashMap<>();
        try (Connection c = DriverManager.getConnection(traceUrl, traceUser, tracePassword)) {
            Map<String,Object> totals = preparedOne(c, """
                    select count(distinct u.id) userMatches,
                           max(u.role) accountRole,
                           count(*) filter (where t.created_at::date=current_date) eventsToday,
                           count(distinct t.batch_sage) filter (where t.created_at::date=current_date) lotsToday,
                           count(*) filter (where t.event_type like 'CONSUME%') completedActions,
                           max(t.created_at) lastUpdate
                    from users u left join traceability_logs t on t.actor_id=u.id
                    where u.matricule=?
                    """, matricule);
            Map<String,Object> issues = preparedOne(c, """
                    select count(*) openIssues from users u
                    left join consumption_issues i on i.reported_by_id=u.id and i.status<>'RESOLVED'
                    where u.matricule=?
                    """, matricule);
            data.putAll(totals);
            data.putAll(issues);
            data.put("recentActivity", preparedRows(c, """
                    select 'Traçabilité' source,
                           concat(event_type, ' · ', coalesce(batch_sage, part_number)) title,
                           to_char(created_at,'DD/MM/YYYY HH24:MI') time
                    from traceability_logs t join users u on u.id=t.actor_id
                    where u.matricule=? order by created_at desc limit 5
                    """, matricule));
            data.put("dailyEvents", preparedRows(c, """
                    select to_char(x::date,'DD/MM') label,
                           count(t.id) filter(where u.id is not null and t.event_type='RECEPTION') receptions,
                           count(t.id) filter(where u.id is not null and t.event_type like 'CONSUME%') consumptions
                    from generate_series(current_date-13,current_date,'1 day') x
                    left join traceability_logs t on t.created_at::date=x::date
                    left join users u on u.id=t.actor_id and u.matricule=?
                    group by x order by x
                    """, matricule));
            data.put("eventTypes", preparedRows(c, """
                    select t.event_type label,count(*) value from traceability_logs t
                    join users u on u.id=t.actor_id where u.matricule=?
                    group by t.event_type order by value desc
                    """, matricule));
            data.put("topParts", preparedRows(c, """
                    select s.part_number label,round(sum(s.remaining_qty)::numeric,2) remaining
                    from stock_items s join users u on u.id=s.created_by_id where u.matricule=?
                    group by s.part_number order by remaining desc limit 8
                    """, matricule));
            data.put("projects", preparedRows(c, """
                    select coalesce(nullif(t.project,''),'Sans projet') label,count(*) value
                    from traceability_logs t join users u on u.id=t.actor_id where u.matricule=?
                    group by t.project order by value desc limit 8
                    """, matricule));
            data.put("dailyQuantities", preparedRows(c, """
                    select to_char(x::date,'DD/MM') label,
                           round(coalesce(sum(abs(t.delta_qty)) filter(where u.id is not null and t.event_type='RECEPTION'),0)::numeric,2) received,
                           round(coalesce(sum(abs(t.delta_qty)) filter(where u.id is not null and t.event_type like 'CONSUME%'),0)::numeric,2) consumed
                    from generate_series(current_date-13,current_date,'1 day') x
                    left join traceability_logs t on t.created_at::date=x::date
                    left join users u on u.id=t.actor_id and u.matricule=?
                    group by x order by x
                    """, matricule));
            data.put("available", true);
        } catch (SQLException e) {
            log.warn("Extraction Traçabilité indisponible pour le matricule {}: {}", matricule, e.getMessage());
            data.put("available", false);
            data.put("recentActivity", List.of());
        }
        return data;
    }

    private Map<String,Object> personalHr(UserAccount account) {
        Map<String,Object> data = new LinkedHashMap<>();
        try (Connection c = DriverManager.getConnection(hrUrl, hrUser, hrPassword)) {
            Map<String,Object> values = preparedOne(c, """
                    with selected_employee as (
                      select id,email from employee where matricule=? and not deleted and not has_left_company
                    ), attendance_stats as (
                      select count(*) records,
                             count(*) filter(where a.clock_in is not null) present_records
                      from attendance a join selected_employee e on e.id=a.employee_id
                      where a.date>=current_date-30
                    ), request_stats as (
                      select count(*) filter(where upper(coalesce(r.status,'')) not in ('APPROVED','REJECTED','CANCELLED','VALIDATED')) pending,
                             count(*) filter(where upper(coalesce(r.status,'')) in ('APPROVED','VALIDATED')) completed
                      from request r join selected_employee e on e.id=r.employee_id
                    ), today_status as (
                      select bool_or(a.clock_in is not null) present, count(*) records
                      from attendance a join selected_employee e on e.id=a.employee_id where a.date=current_date
                    )
                    select (select count(*) from selected_employee) userMatches,
                           (select max(email) from selected_employee) accountEmail,
                           case when coalesce((select present from today_status),false) then 'Présent'
                                when coalesce((select records from today_status),0)>0 then 'Absent' else 'Non renseigné' end presenceStatus,
                           round(100.0*(select present_records from attendance_stats)
                                 / nullif((select records from attendance_stats),0),1) attendanceRate,
                           coalesce((select pending from request_stats),0) pendingRequests,
                           coalesce((select completed from request_stats),0) completedRequests
                    """, account.getMatricule());
            data.putAll(values);
            long teamAbsences = 0;
            if (isManager(account.getJobTitle())) {
                teamAbsences = number(preparedOne(c, """
                        select count(*) teamAbsences from employee member
                        join employee supervisor on supervisor.id=member.supervisor_id
                        left join attendance a on a.employee_id=member.id and a.date=current_date
                        where supervisor.matricule=? and (a.id is null or a.clock_in is null)
                        """, account.getMatricule()).get("teamabsences"));
            }
            data.put("teamAbsences", teamAbsences);
            data.put("recentActivity", preparedRows(c, """
                    select 'RH' source,
                           case when clock_in is null then 'Absence enregistrée'
                                else concat('Pointage ', to_char(clock_in,'HH24:MI')) end title,
                           to_char(date,'DD/MM/YYYY') time
                    from attendance a join employee e on e.id=a.employee_id
                    where e.matricule=? order by date desc limit 5
                    """, account.getMatricule()));
            data.put("dailyPresence", preparedRows(c, """
                    select to_char(x::date,'DD/MM') label,
                           count(a.id) filter(where a.clock_in is not null) present,
                           count(a.id) filter(where a.id is not null and a.clock_in is null) absent
                    from generate_series(current_date-13,current_date,'1 day') x
                    left join employee e on e.matricule=?
                    left join attendance a on a.employee_id=e.id and a.date=x::date
                    group by x order by x
                    """, account.getMatricule()));
            data.put("requestTypes", preparedRows(c, """
                    select coalesce(r.request_type,'Non renseigné') label,count(*) value
                    from request r join employee e on e.id=r.employee_id where e.matricule=?
                    group by r.request_type order by value desc
                    """, account.getMatricule()));
            data.put("requestStatus", preparedRows(c, """
                    select coalesce(r.status,'Non renseigné') label,count(*) value
                    from request r join employee e on e.id=r.employee_id where e.matricule=?
                    group by r.status order by value desc
                    """, account.getMatricule()));
            data.put("attendanceHours", preparedRows(c, """
                    select to_char(a.date,'DD/MM') label,
                           round((coalesce(a.total_attendance,0)/3600000000000)::numeric,1) value
                    from attendance a join employee e on e.id=a.employee_id
                    where e.matricule=? and a.date>=current_date-13 order by a.date
                    """, account.getMatricule()));
            data.put("available", true);
        } catch (SQLException e) {
            log.warn("Extraction RH indisponible pour le matricule {}: {}", account.getMatricule(), e.getMessage());
            data.put("available", false);
            data.put("presencestatus", "Indisponible");
            data.put("recentActivity", List.of());
        }
        return data;
    }

    private Map<String,Object> personalPlanning(String matricule) {
        Map<String,Object> data = new LinkedHashMap<>();
        try (Connection c = DriverManager.getConnection(planningDbUrl, planningDbUser, planningDbPassword)) {
            data.putAll(preparedOne(c, """
                    with selected_user as (select * from app_user where matricule=?)
                    select count(*) userMatches, max(username) accountUsername, max(email) accountEmail,
                           max(role) accountRole,
                           (select count(*) from ecr_action a, selected_user u
                            where lower(a.responsible) in (lower(u.full_name),lower(coalesce(u.username,'')))) totalActions,
                           (select count(*) from ecr_action a, selected_user u
                            where lower(a.responsible) in (lower(u.full_name),lower(coalesce(u.username,'')))
                              and a.status in ('TODO','IN_PROGRESS','LATE')) openActions,
                           (select count(*) from ecr_action a, selected_user u
                            where lower(a.responsible) in (lower(u.full_name),lower(coalesce(u.username,'')))
                              and (a.status='LATE' or (a.deadline<current_date and a.status not in ('DONE','CANCELLED')))) lateActions,
                           (select count(*) from ecr_action a, selected_user u
                            where lower(a.responsible) in (lower(u.full_name),lower(coalesce(u.username,'')))
                              and a.status='DONE') completedActions,
                           (select count(distinct a.ecr_id) from ecr_action a, selected_user u
                            where lower(a.responsible) in (lower(u.full_name),lower(coalesce(u.username,'')))
                              and a.status not in ('DONE','CANCELLED')) activeProjects,
                           (select round(100.0*count(*) filter(where a.status='DONE')/nullif(count(*),0),1)
                            from ecr_action a, selected_user u
                            where lower(a.responsible) in (lower(u.full_name),lower(coalesce(u.username,'')))) completionRate
                    from selected_user
                    """, matricule));
            data.put("recentActivity", preparedRows(c, """
                    select 'Plannings' source, concat(a.title, ' · ', coalesce(a.status,'TODO')) title,
                           to_char(coalesce(a.closed_date,a.created_at),'DD/MM/YYYY HH24:MI') time
                    from ecr_action a join app_user u
                      on lower(a.responsible) in (lower(u.full_name),lower(coalesce(u.username,'')))
                    where u.matricule=? order by coalesce(a.closed_date,a.created_at) desc limit 5
                    """, matricule));
            data.put("status", preparedRows(c, """
                    select coalesce(a.status,'TODO') label,count(*) value from ecr_action a join app_user u
                      on lower(a.responsible) in (lower(u.full_name),lower(coalesce(u.username,'')))
                    where u.matricule=? group by a.status order by value desc
                    """, matricule));
            data.put("projects", preparedRows(c, """
                    select concat(r.modification_number,' · ',r.modification_project) label,
                           round(100.0*count(*) filter(where a.status='DONE')/nullif(count(*),0),1) value
                    from ecr_action a join ecr_request r on r.id=a.ecr_id join app_user u
                      on lower(a.responsible) in (lower(u.full_name),lower(coalesce(u.username,'')))
                    where u.matricule=? group by r.id,r.modification_number,r.modification_project order by count(*) desc limit 8
                    """, matricule));
            data.put("deadlines", preparedRows(c, """
                    select a.title label,to_char(a.deadline,'DD/MM/YYYY') deadline,
                           (a.deadline-current_date) days from ecr_action a join app_user u
                      on lower(a.responsible) in (lower(u.full_name),lower(coalesce(u.username,'')))
                    where u.matricule=? and a.deadline is not null and a.status not in ('DONE','CANCELLED')
                    order by a.deadline limit 5
                    """, matricule));
            data.put("stages", preparedRows(c, """
                    select coalesce(a.stage,'Non définie') label,count(*) value from ecr_action a join app_user u
                      on lower(a.responsible) in (lower(u.full_name),lower(coalesce(u.username,'')))
                    where u.matricule=? group by a.stage order by value desc
                    """, matricule));
            data.put("criticality", preparedRows(c, """
                    select coalesce(a.criticality,'Non définie') label,count(*) value from ecr_action a join app_user u
                      on lower(a.responsible) in (lower(u.full_name),lower(coalesce(u.username,'')))
                    where u.matricule=? group by a.criticality order by value desc
                    """, matricule));
            data.put("available", true);
        } catch (SQLException e) {
            log.warn("Extraction Planning indisponible pour le matricule {}: {}", matricule, e.getMessage());
            data.clear();
            data.put("usermatches", 0L);
            data.put("available", false);
            data.put("recentActivity", List.of());
        }
        return data;
    }

    private Map<String,Object> application(String code, String label, boolean hasAccount, String url,
                                           String identifier, String role, String email, boolean fullDataAccess) {
        Map<String,Object> result = new LinkedHashMap<>();
        result.put("code", code);
        result.put("label", label);
        result.put("hasAccount", hasAccount);
        result.put("url", url);
        result.put("identifier", identifier);
        result.put("role", role(role, fullDataAccess));
        result.put("email", email);
        return result;
    }

    private String text(Object value) { return value == null ? "" : value.toString(); }

    private String role(Object role, boolean fullAccess) {
        String value = text(role).trim();
        return fullAccess ? "Accès complet aux données" : value;
    }

    private String firstText(Object preferred, String fallback) {
        String value = text(preferred).trim();
        return value.isEmpty() ? fallback : value;
    }

    private List<Map<String,Object>> priorities(long openIssues, long pendingRequests, long lateActions) {
        List<Map<String,Object>> result = new ArrayList<>();
        if (openIssues > 0) result.add(Map.of("source", "Traçabilité", "level", "urgent",
                "title", openIssues + " non-conformité(s) à traiter", "detail", "Données de votre compte", "url", traceabilityUrl));
        if (pendingRequests > 0) result.add(Map.of("source", "RH", "level", "warning",
                "title", pendingRequests + " demande(s) RH en attente", "detail", "Données de votre dossier", "url", hrApplicationUrl));
        if (lateActions > 0) result.add(Map.of("source", "Plannings", "level", "urgent",
                "title", lateActions + " action(s) en retard", "detail", "Planning ECR personnel", "url", planningUrl));
        return result;
    }

    @SuppressWarnings("unchecked")
    private List<Map<String,Object>> mergeActivity(Map<String,Object> trace, Map<String,Object> hr, Map<String,Object> planning) {
        List<Map<String,Object>> result = new ArrayList<>();
        result.addAll((List<Map<String,Object>>) trace.getOrDefault("recentActivity", List.of()));
        result.addAll((List<Map<String,Object>>) hr.getOrDefault("recentActivity", List.of()));
        result.addAll((List<Map<String,Object>>) planning.getOrDefault("recentActivity", List.of()));
        return result.stream().limit(8).toList();
    }

    private boolean isManager(String title) {
        String value = title == null ? "" : title.toUpperCase(Locale.ROOT);
        return value.contains("MANAGER") || value.contains("SUPERVISEUR") || value.contains("DIRECTEUR") || value.contains("TEAM LEADER");
    }

    private long number(Object value) { return value instanceof Number n ? n.longValue() : 0; }

    private Map<String,Object> map(Object... values) {
        Map<String,Object> result = new LinkedHashMap<>();
        for (int i=0;i<values.length;i+=2) result.put((String) values[i], values[i+1]);
        return result;
    }

    private Map<String,Object> preparedOne(Connection c,String sql,Object parameter)throws SQLException {
        List<Map<String,Object>> all=preparedRows(c,sql,parameter);return all.isEmpty()?Map.of():all.getFirst();
    }

    private List<Map<String,Object>> preparedRows(Connection c,String sql,Object parameter)throws SQLException {
        try(PreparedStatement s=c.prepareStatement(sql)){
            s.setQueryTimeout(QUERY_TIMEOUT_SECONDS);
            s.setObject(1,parameter);
            try(ResultSet rs=s.executeQuery()) { return readRows(rs); }
        }
    }

    public Map<String,Object> load() {
        Map<String,Object> out=new LinkedHashMap<>();
        out.put("generatedAt", Instant.now().toString());
        out.put("traceability", traceability());
        out.put("hr", hr());
        out.put("planning", planning());
        return out;
    }


    private Map<String,Object> traceability() {
        Map<String,Object> d=new LinkedHashMap<>();
        try(Connection c=DriverManager.getConnection(traceUrl,traceUser,tracePassword)){
            d.put("connected",true);
            d.put("totals",one(c,"""
              select (select count(*) from batches) batches,(select count(*) from stock_items) stockItems,
              (select count(*) from traceability_logs) events,(select count(*) from batch_consumptions) consumptions,
              (select count(*) from consumption_issues where status<>'RESOLVED') openIssues,
              (select round(coalesce(sum(received_qty),0)::numeric,2) from stock_items) receivedQuantity,
              (select round(coalesce(sum(remaining_qty),0)::numeric,2) from stock_items) remainingQuantity
              """));
            d.put("dailyEvents",rows(c,"""
              select to_char(x::date,'DD/MM') label,count(t.id) events,
              count(t.id) filter(where t.event_type='RECEPTION') receptions,
              count(t.id) filter(where t.event_type like 'CONSUME%') consumptions
              from generate_series(current_date-13,current_date,'1 day') x
              left join traceability_logs t on t.created_at::date=x::date group by x order by x
              """));
            d.put("eventTypes",rows(c,"select event_type label,count(*) value from traceability_logs group by event_type order by value desc"));
            d.put("projects",rows(c,"select coalesce(nullif(project,''),'Sans projet') label,count(*) value from traceability_logs group by 1 order by value desc limit 8"));
            d.put("stockByStatus",rows(c,"select status label,count(*) value,round(sum(remaining_qty)::numeric,2) quantity from stock_items group by status order by value desc"));
            d.put("topParts",rows(c,"select part_number label,count(*) batches,round(sum(received_qty)::numeric,2) received,round(sum(remaining_qty)::numeric,2) remaining from stock_items group by part_number order by received desc limit 8"));
            d.put("recentActivity",rows(c,"select event_type type,coalesce(part_number,'—') part,coalesce(batch_sage,'—') batch,to_char(created_at,'DD/MM HH24:MI') time from traceability_logs order by created_at desc limit 8"));
        }catch(SQLException e){log.warn("Extraction globale Traçabilité impossible: {}",e.getMessage());d.put("connected",false);d.put("error","Source Traçabilité indisponible");}
        return d;
    }

    private Map<String,Object> hr() {
        Map<String,Object> d=new LinkedHashMap<>();
        try(Connection c=DriverManager.getConnection(hrUrl,hrUser,hrPassword)){
            d.put("connected",true);
            d.put("totals",one(c,"""
              select (select count(*) from employee where not deleted and not has_left_company) employees,
              (select count(*) from department) departments,(select count(*) from attendance) attendanceRecords,
              (select count(*) from free_operators where status='ACTIVE') freeOperators,
              (select count(*) from attendance where date=current_date and clock_in is not null) presentToday,
              greatest((select count(*) from employee where not deleted and not has_left_company)-(select count(*) from attendance where date=current_date and clock_in is not null),0) absentToday,
              (select round((coalesce(sum(overtime),0)/3600000000000)::numeric,1) from attendance where date>=date_trunc('month',current_date)) monthlyOvertime
              """));
            d.put("dailyPresence",rows(c,"""
              select to_char(x::date,'DD/MM') label,count(a.id) filter(where a.clock_in is not null) present,
              greatest(active.total-count(a.id) filter(where a.clock_in is not null),0) absent,
              round((coalesce(sum(a.total_attendance),0)/3600000000000)::numeric,1) hours
              from generate_series(current_date-13,current_date,'1 day') x
              cross join (select count(*) total from employee where not deleted and not has_left_company) active
              left join attendance a on a.date=x::date group by x,active.total order by x
              """));
            d.put("departments",rows(c,"""
              with last_day as(select max(date) d from attendance)
              select coalesce(d.name,'Non affecté') label,count(distinct e.id) total,
              count(distinct e.id) filter(where a.clock_in is not null) present
              from employee e left join department d on d.id=e.department_id cross join last_day ld
              left join attendance a on a.employee_id=e.id and a.date=ld.d
              where not e.deleted and not e.has_left_company group by d.name order by total desc
              """));
            d.put("shifts",rows(c,"select coalesce(s.name,'Non affecté') label,count(*) value from employee e left join shift s on s.id=e.shift_id where not e.deleted and not e.has_left_company group by s.name order by value desc"));
            d.put("productionLines",rows(c,"select coalesce(p.name,'Non affectée') label,count(*) value from employee e left join production_line p on p.id=e.production_line_id where not e.deleted and not e.has_left_company group by p.name order by value desc limit 10"));
            d.put("overtime",rows(c,"select to_char(date,'DD/MM') label,round((coalesce(sum(overtime),0)/3600000000000)::numeric,1) value from attendance where date>=current_date-13 group by date order by date"));
            d.put("absenceReasons",rows(c,"select coalesce(r.reason,'Non renseignée') label,count(*) value from attendance a left join absence_reason r on r.id=a.absence_reason_id where a.date>=current_date-30 and a.clock_in is null group by r.reason order by value desc"));
        }catch(SQLException e){log.warn("Extraction globale RH impossible: {}",e.getMessage());d.put("connected",false);d.put("error","Source RH indisponible");}
        return d;
    }

    private Map<String,Object> planning() {
        Map<String,Object> d=new LinkedHashMap<>();
        try(Connection c=DriverManager.getConnection(planningDbUrl,planningDbUser,planningDbPassword)){
            d.put("connected",true);
            d.put("totals",one(c,"""
              select (select count(*) from app_user where enabled) users,
              (select count(*) from ecr_request where not archived) projects,
              (select count(*) from ecr_request where not archived and current_stage not in ('CLOSED','CANCELLED')) activeRequests,
              (select count(*) from ecr_request where not archived and current_stage='CLOSED') closedRequests,
              (select count(*) from ecr_request where not archived and current_stage='CANCELLED') cancelledRequests,
              (select count(*) from ecr_action) actions,
              (select count(*) from ecr_action where status='LATE' or (deadline<current_date and status not in ('DONE','CANCELLED'))) lateActions,
              (select count(*) from ecr_action where status='DONE') completedActions
              """));
            d.put("status",rows(c,"select coalesce(status,'TODO') label,count(*) value from ecr_action group by status order by value desc"));
            d.put("stages",rows(c,"select coalesce(current_stage,'NON_DEFINI') label,count(*) value from ecr_request where not archived group by current_stage order by value desc"));
            d.put("projects",rows(c,"select coalesce(modification_project,'Non renseigné') label,count(*) value from ecr_request where not archived group by modification_project order by value desc limit 8"));
            d.put("clients",rows(c,"select coalesce(client,'Non renseigné') label,count(*) value from ecr_request where not archived group by client order by value desc limit 8"));
            d.put("changeTypes",rows(c,"""
              select label,sum(value) value from (
                select 'Nouveau projet' label,count(*) filter(where new_version) value from ecr_request where not archived
                union all select 'Digit change',count(*) filter(where digit_change) from ecr_request where not archived
                union all select 'Component change',count(*) filter(where component_change) from ecr_request where not archived
                union all select 'Process change',count(*) filter(where process_change) from ecr_request where not archived
                union all select 'Supplier change',count(*) filter(where supplier_change) from ecr_request where not archived
              ) x group by label order by value desc
              """));
        }catch(SQLException e){log.warn("Extraction globale Planning impossible: {}",e.getMessage());d.put("connected",false);d.put("error","Source Plannings indisponible");}
        return d;
    }

    private Map<String,Object> one(Connection c,String sql)throws SQLException{
        List<Map<String,Object>> all=rows(c,sql);return all.isEmpty()?Map.of():all.getFirst();
    }
    private List<Map<String,Object>> rows(Connection c,String sql)throws SQLException{
        try(Statement s=c.createStatement()){
            s.setQueryTimeout(QUERY_TIMEOUT_SECONDS);
            try(ResultSet rs=s.executeQuery(sql)){
            return readRows(rs);
            }
        }
    }

    private List<Map<String,Object>> readRows(ResultSet rs)throws SQLException {
        List<Map<String,Object>> out=new ArrayList<>();ResultSetMetaData m=rs.getMetaData();
        while(rs.next()){Map<String,Object> row=new LinkedHashMap<>();for(int i=1;i<=m.getColumnCount();i++)row.put(m.getColumnLabel(i),rs.getObject(i));out.add(row);}
        return out;
    }
}
