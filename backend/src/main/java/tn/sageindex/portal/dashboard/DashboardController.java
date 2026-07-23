package tn.sageindex.portal.dashboard;

import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import tn.sageindex.portal.account.UserAccount;
import tn.sageindex.portal.account.UserAccountRepository;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/dashboard")
public class DashboardController {
    private final UserAccountRepository repository;

    public DashboardController(UserAccountRepository repository) {
        this.repository = repository;
    }

    @GetMapping("/me")
    public Map<String, Object> dashboard(Authentication authentication) {
        UserAccount account = repository.findByUsername(authentication.getName()).orElse(null);
        String name = account == null ? "Administrateur SAGE INDEX" : account.getFullName();
        String department = account == null ? "Administration" : account.getDepartment();
        String jobTitle = account == null ? "Administrateur du portail" : account.getJobTitle();
        return Map.of(
                "user", Map.of("name", name, "department", department,
                        "jobTitle", jobTitle, "username", authentication.getName()),
                "applications", List.of(
                        Map.of("code", "TRACEABILITY", "label", "Traçabilité", "hasAccount", true, "url", "/tracabilite"),
                        Map.of("code", "HR", "label", "Ressources Humaines", "hasAccount", true, "url", "/rh")),
                "metrics", Map.of("lotsProcessed", 1284, "attendanceRate", 94.7,
                        "attentionPoints", 7, "completedActions", 36));
    }
}
