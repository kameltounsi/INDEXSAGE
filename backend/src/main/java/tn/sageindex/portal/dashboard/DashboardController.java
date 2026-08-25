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
        UserAccount account = repository.findByUsername(authentication.getName())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Compte utilisateur introuvable"));
        return operationalDataService.loadFor(account);
    }

}
