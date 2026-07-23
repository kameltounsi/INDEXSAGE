package tn.sageindex.portal.account;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Size;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/accounts")
public class AccountController {
    private final UserAccountRepository repository;
    private final PasswordEncoder passwordEncoder;

    public AccountController(UserAccountRepository repository, PasswordEncoder passwordEncoder) {
        this.repository = repository;
        this.passwordEncoder = passwordEncoder;
    }

    @GetMapping("/stats")
    public Map<String, Long> stats() {
        return Map.of(
                "total", repository.count(),
                "activationRequired", repository.countByAccountStatus(AccountStatus.ACTIVATION_REQUIRED),
                "active", repository.countByAccountStatus(AccountStatus.ACTIVE));
    }

    @GetMapping
    public Page<AccountView> list(@RequestParam(defaultValue = "0") int page,
                                  @RequestParam(defaultValue = "25") int size) {
        return repository.findAll(PageRequest.of(page, Math.min(size, 100))).map(AccountView::from);
    }

    @PostMapping("/{username}/activate")
    public ResponseEntity<AccountView> activate(@PathVariable String username,
                                                 @Valid @RequestBody ActivateAccountRequest request) {
        return repository.findByUsername(username)
                .map(account -> {
                    account.setPasswordHash(passwordEncoder.encode(request.password()));
                    account.setAccountStatus(AccountStatus.ACTIVE);
                    return ResponseEntity.ok(AccountView.from(repository.save(account)));
                })
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    public record ActivateAccountRequest(@Size(min = 12, max = 128) String password) {}

    public record AccountView(Long id, String username, String matricule, String fullName,
                              String department, String jobTitle, String workType, String email,
                              String employeeStatus, AccountStatus accountStatus) {
        static AccountView from(UserAccount account) {
            return new AccountView(account.getId(), account.getUsername(), account.getMatricule(),
                    account.getFullName(), account.getDepartment(), account.getJobTitle(),
                    account.getWorkType(), account.getEmail(), account.getEmployeeStatus(),
                    account.getAccountStatus());
        }
    }
}
