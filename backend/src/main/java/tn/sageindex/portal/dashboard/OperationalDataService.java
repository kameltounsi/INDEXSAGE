package tn.sageindex.portal.dashboard;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import tn.sageindex.portal.account.UserAccount;
import java.sql.*;
import java.time.Instant;
import java.util.*;

@Service
public class OperationalDataService {
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

    public Map<String,Boolean> applicationAccess(UserAccount account) {
        Map<String,Object> trace = personalTraceability(account.getMatricule());
        Map<String,Object> hr = personalHr(account);
        Map<String,Object> planning = personalPlanning(account.getMatricule());
        return Map.of(
                "TRACEABILITY", number(trace.get("usermatches")) > 0,
                "HR", number(hr.get("usermatches")) > 0,
                "PLANNING", number(planning.get("usermatches")) > 0);
    }

    public Map<String,Object> loadFor(UserAccount account) {
        Map<String,Object> trace = personalTraceability(account.getMatricule());
        Map<String,Object> hr = personalHr(account);
        Map<String,Object> planning = personalPlanning(account.getMatricule());
        boolean manager = isManager(account.getJobTitle());

        Map<String,Object> user = new LinkedHashMap<>();
        user.put("name", account.getFullName());
        user.put("department", account.getDepartment());
        user.put("jobTitle", account.getJobTitle());
        user.put("username", account.getUsername());
        user.put("matricule", account.getMatricule());
        user.put("manager", manager);

        long lotsToday = number(trace.get("lotstoday"));
        long openIssues = number(trace.get("openissues"));
        long pendingRequests = number(hr.get("pendingrequests"));
        Map<String,Object> response = new LinkedHashMap<>();
        response.put("user", user);
        response.put("applications", List.of(
                application("TRACEABILITY", "Traçabilité", number(trace.get("usermatches")) > 0,
                        "http://localhost:5173/", account.getMatricule(), text(trace.get("accountrole")), ""),
                application("HR", "Ressources Humaines", number(hr.get("usermatches")) > 0,
                        "http://localhost:5170/", account.getMatricule(), "", text(hr.get("accountemail"))),
                application("PLANNING", "Gestion des plannings", number(planning.get("usermatches")) > 0,
                        planningUrl, firstText(planning.get("accountusername"), account.getMatricule()),
                        text(planning.get("accountrole")), text(planning.get("accountemail")))));
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
                "available", trace.get("available")));
        response.put("hr", map(
                "presenceStatus", hr.get("presencestatus"),
                "leaveBalance", null,
                "pendingRequests", pendingRequests,
                "teamAbsences", hr.get("teamabsences"),
                "nextEvent", pendingRequests > 0 ? pendingRequests + " demande(s) en attente" : "Aucune demande en attente",
                "available", hr.get("available")));
        response.put("planning", map(
                "totalActions", planning.get("totalactions"),
                "openActions", planning.get("openactions"),
                "lateActions", planning.get("lateactions"),
                "completedActions", planning.get("completedactions"),
                "activeProjects", planning.get("activeprojects"),
                "completionRate", planning.get("completionrate"),
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
            data.put("available", true);
        } catch (SQLException e) {
            data.put("available", false);
            data.put("recentActivity", List.of());
        }
        return data;
    }

    private Map<String,Object> personalHr(UserAccount account) {
        Map<String,Object> data = new LinkedHashMap<>();
        try (Connection c = DriverManager.getConnection(hrUrl, hrUser, hrPassword)) {
            Map<String,Object> values = preparedOne(c, """
                    select count(distinct e.id) userMatches,
                           max(e.email) accountEmail,
                           case when today.clock_in is not null then 'Présent'
                                when today.id is not null then 'Absent' else 'Non renseigné' end presenceStatus,
                           round(100.0*count(a.id) filter(where a.clock_in is not null)
                                 / nullif(count(a.id),0),1) attendanceRate,
                           count(distinct r.id) filter(where upper(coalesce(r.status,'')) not in ('APPROVED','REJECTED','CANCELLED','VALIDATED')) pendingRequests,
                           count(distinct r.id) filter(where upper(coalesce(r.status,'')) in ('APPROVED','VALIDATED')) completedRequests
                    from employee e
                    left join attendance today on today.employee_id=e.id and today.date=current_date
                    left join attendance a on a.employee_id=e.id and a.date>=current_date-30
                    left join request r on r.employee_id=e.id
                    where e.matricule=? group by today.id,today.clock_in
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
            data.put("available", true);
        } catch (SQLException e) {
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
            data.put("available", true);
        } catch (SQLException e) {
            data.clear();
            data.put("usermatches", 0L);
            data.put("available", false);
            data.put("recentActivity", List.of());
        }
        return data;
    }

    private Map<String,Object> application(String code, String label, boolean hasAccount, String url,
                                           String identifier, String role, String email) {
        Map<String,Object> result = new LinkedHashMap<>();
        result.put("code", code);
        result.put("label", label);
        result.put("hasAccount", hasAccount);
        result.put("url", url);
        result.put("identifier", identifier);
        result.put("role", role);
        result.put("email", email);
        return result;
    }

    private String text(Object value) { return value == null ? "" : value.toString(); }

    private String firstText(Object preferred, String fallback) {
        String value = text(preferred).trim();
        return value.isEmpty() ? fallback : value;
    }

    private List<Map<String,Object>> priorities(long openIssues, long pendingRequests, long lateActions) {
        List<Map<String,Object>> result = new ArrayList<>();
        if (openIssues > 0) result.add(Map.of("source", "Traçabilité", "level", "urgent",
                "title", openIssues + " non-conformité(s) à traiter", "detail", "Données de votre compte", "url", "http://localhost:5173/"));
        if (pendingRequests > 0) result.add(Map.of("source", "RH", "level", "warning",
                "title", pendingRequests + " demande(s) RH en attente", "detail", "Données de votre dossier", "url", "http://localhost:5170/"));
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
        }catch(SQLException e){d.put("connected",false);d.put("error","Source Traçabilité indisponible");}
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
        }catch(SQLException e){d.put("connected",false);d.put("error","Source RH indisponible");}
        return d;
    }

    private Map<String,Object> planning() {
        Map<String,Object> d=new LinkedHashMap<>();
        try(Connection c=DriverManager.getConnection(planningDbUrl,planningDbUser,planningDbPassword)){
            d.put("connected",true);
            d.put("totals",one(c,"""
              select (select count(*) from app_user where enabled) users,
              (select count(*) from ecr_request where not archived) projects,
              (select count(*) from ecr_action) actions,
              (select count(*) from ecr_action where status='LATE' or (deadline<current_date and status not in ('DONE','CANCELLED'))) lateActions,
              (select count(*) from ecr_action where status='DONE') completedActions
              """));
            d.put("status",rows(c,"select coalesce(status,'TODO') label,count(*) value from ecr_action group by status order by value desc"));
            d.put("stages",rows(c,"select coalesce(current_stage,'NON_DEFINI') label,count(*) value from ecr_request where not archived group by current_stage order by value desc"));
        }catch(SQLException e){d.put("connected",false);d.put("error","Source Plannings indisponible");}
        return d;
    }

    private Map<String,Object> one(Connection c,String sql)throws SQLException{
        List<Map<String,Object>> all=rows(c,sql);return all.isEmpty()?Map.of():all.getFirst();
    }
    private List<Map<String,Object>> rows(Connection c,String sql)throws SQLException{
        try(Statement s=c.createStatement();ResultSet rs=s.executeQuery(sql)){
            return readRows(rs);
        }
    }

    private List<Map<String,Object>> readRows(ResultSet rs)throws SQLException {
        List<Map<String,Object>> out=new ArrayList<>();ResultSetMetaData m=rs.getMetaData();
        while(rs.next()){Map<String,Object> row=new LinkedHashMap<>();for(int i=1;i<=m.getColumnCount();i++)row.put(m.getColumnLabel(i),rs.getObject(i));out.add(row);}
        return out;
    }
}
