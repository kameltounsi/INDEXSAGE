package tn.sageindex.portal.auth;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import tn.sageindex.portal.account.UserAccount;
import tn.sageindex.portal.account.UserAccountRepository;
import tn.sageindex.portal.dashboard.OperationalDataService;

import java.time.Instant;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

@RestController
@RequestMapping("/api/sso")
public class SsoController {
    private final UserAccountRepository repository;
    private final OperationalDataService dataService;
    private final Map<String, Ticket> tickets = new ConcurrentHashMap<>();

    @Value("${portal.applications.traceability-url:http://localhost:5173/}") private String traceabilityUrl;
    @Value("${portal.applications.hr-url:http://localhost:5170/}") private String hrUrl;
    @Value("${portal.applications.planning-url:http://localhost:3000/}") private String planningUrl;

    public SsoController(UserAccountRepository repository, OperationalDataService dataService) {
        this.repository = repository;
        this.dataService = dataService;
    }

    @PostMapping("/launch")
    public Map<String,Object> launch(Authentication authentication) {
        UserAccount account = repository.findByUsername(authentication.getName())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED));
        if (Long.valueOf(-1L).equals(account.getEmployeeId())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Le compte administrateur du portail n'est pas un compte métier");
        }
        Map<String,Boolean> access = dataService.applicationAccess(account);
        List<Map<String,String>> launches = new ArrayList<>();
        addLaunch(launches, access, "TRACEABILITY", traceabilityUrl, account.getMatricule());
        addLaunch(launches, access, "HR", hrUrl, account.getMatricule());
        addLaunch(launches, access, "PLANNING", planningUrl, account.getMatricule());
        return Map.of("applications", launches, "expiresInSeconds", 180);
    }

    @PostMapping("/exchange")
    public Map<String,String> exchange(@RequestBody ExchangeRequest request) {
        Ticket ticket = tickets.remove(request.ticket());
        if (ticket == null || ticket.expiresAt().isBefore(Instant.now()) || !ticket.application().equals(request.application())) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Ticket SSO invalide ou expiré");
        }
        repository.findByMatricule(ticket.matricule())
                .filter(account -> account.getAccountStatus() == tn.sageindex.portal.account.AccountStatus.ACTIVE)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Compte SSO indisponible"));
        return Map.of("matricule", ticket.matricule());
    }

    private void addLaunch(List<Map<String,String>> launches, Map<String,Boolean> access, String app, String baseUrl, String matricule) {
        if (!access.getOrDefault(app, false)) return;
        String ticket = UUID.randomUUID().toString();
        tickets.put(ticket, new Ticket(app, matricule, Instant.now().plusSeconds(180)));
        launches.add(Map.of("code", app, "url", baseUrl.replaceAll("/+$", "") + "/sso?ticket=" + ticket));
    }

    public record ExchangeRequest(String application, String ticket) {}
    private record Ticket(String application, String matricule, Instant expiresAt) {}
}
