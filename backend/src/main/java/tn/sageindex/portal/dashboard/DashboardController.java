package tn.sageindex.portal.dashboard;

import org.springframework.http.HttpStatus;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;
import tn.sageindex.portal.account.UserAccount;
import tn.sageindex.portal.account.UserAccountRepository;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/dashboard")
public class DashboardController {
    private final UserAccountRepository repository;
    private final OperationalDataService operationalDataService;

    @Value("${portal.applications.planning-url:http://localhost:3000/}")
    private String planningUrl;

    public DashboardController(UserAccountRepository repository, OperationalDataService operationalDataService) {
        this.repository = repository;
        this.operationalDataService = operationalDataService;
    }

    @GetMapping("/operational")
    public Map<String, Object> operational() {
        return operationalDataService.load();
    }

    @GetMapping("/me")
    public Map<String, Object> dashboard(Authentication authentication) {
        if ("admin".equals(authentication.getName())) {
            return adminDashboard();
        }

        UserAccount account = repository.findByUsername(authentication.getName())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Compte utilisateur introuvable"));
        return operationalDataService.loadFor(account);
    }

    private Map<String, Object> adminDashboard() {
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("user", Map.of("name", "Administrateur SAGE INDEX", "department", "Administration",
                "jobTitle", "Administrateur du portail", "username", "admin", "matricule", "admin", "manager", true));
        response.put("applications", applications(planningUrl));
        response.put("metrics", Map.of());
        response.put("traceability", Map.of());
        response.put("hr", Map.of());
        response.put("planning", Map.of());
        response.put("priorities", List.of());
        response.put("recentActivity", List.of());
        return response;
    }

    static List<Map<String, Object>> applications(String planningUrl) {
        return List.of(
                Map.of("code", "TRACEABILITY", "label", "Traçabilité", "hasAccount", true, "url", "http://localhost:5173/"),
                Map.of("code", "HR", "label", "Ressources Humaines", "hasAccount", true, "url", "http://localhost:5170/"),
                Map.of("code", "PLANNING", "label", "Gestion des plannings", "hasAccount", true, "url", planningUrl));
    }
}
