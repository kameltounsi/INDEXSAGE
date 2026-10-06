package tn.sageindex.portal.account;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;
import tn.sageindex.portal.dashboard.OperationalDataService;

@RestController
@RequestMapping("/api/accounts")
public class AccountController {
    private final UserAccountRepository repository;
    private final PasswordEncoder passwordEncoder;
    private final OperationalDataService operationalDataService;

    public AccountController(UserAccountRepository repository, PasswordEncoder passwordEncoder,
                             OperationalDataService operationalDataService) {
        this.repository = repository;
        this.passwordEncoder = passwordEncoder;
        this.operationalDataService = operationalDataService;
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
        return repository.findAll(PageRequest.of(page, Math.min(size, 100))).map(this::view);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public AccountView create(@Valid @RequestBody CreateAccountRequest request) {
        String matricule = request.matricule().trim();
        OperationalDataService.EmployeeProfile employee;
        try {
            employee = operationalDataService.findActiveEmployee(matricule)
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                            "Cet employé n'existe pas dans la base des employés"));
        } catch (IllegalStateException exception) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, exception.getMessage());
        }
        if (repository.findByMatricule(matricule).isPresent()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Ce compte existe déjà");
        }
        UserAccount account = new UserAccount();
        account.setEmployeeId(employee.employeeId());
        account.setMatricule(matricule);
        account.setUsername(matricule);
        account.setFullName(employee.fullName());
        account.setDepartment(employee.department());
        account.setJobTitle(employee.jobTitle());
        account.setWorkType(employee.workType());
        account.setSupervisor(employee.supervisor());
        account.setEmail(employee.email() == null || employee.email().isBlank()
                ? matricule + "@sage-index.local" : employee.email());
        account.setEmployeeStatus("Employé actuel");
        account.setPasswordHash(null);
        account.setAccountStatus(AccountStatus.ACTIVATION_REQUIRED);
        account.setRoles("USER");
        return view(repository.save(account));
    }

    private AccountView view(UserAccount account) {
        Map<String, Boolean> access = operationalDataService.applicationAccess(account);
        List<String> applications = access.entrySet().stream()
                .filter(Map.Entry::getValue).map(Map.Entry::getKey).sorted().toList();
        return AccountView.from(account, applications);
    }

    @org.springframework.transaction.annotation.Transactional
    @PostMapping("/{username}/activate")
    public ResponseEntity<ActivationView> activate(@PathVariable String username) {
        return repository.findForActivationByUsername(username)
                .map(account -> {
                    if (account.getAccountStatus() != AccountStatus.ACTIVATION_REQUIRED) {
                        throw new ResponseStatusException(HttpStatus.CONFLICT, "Ce compte n'est pas en attente d'activation");
                    }
                    byte[] bytes = new byte[24];
                    new java.security.SecureRandom().nextBytes(bytes);
                    String temporaryPassword = java.util.Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
                    account.setPasswordHash(passwordEncoder.encode(temporaryPassword));
                    account.setAccountStatus(AccountStatus.PASSWORD_CHANGE_REQUIRED);
                    return ResponseEntity.ok().cacheControl(org.springframework.http.CacheControl.noStore())
                            .body(new ActivationView(view(repository.save(account)), temporaryPassword));
                })
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    public record ActivationView(AccountView account, String temporaryPassword) {}
    public record CreateAccountRequest(@NotBlank @Pattern(regexp = "[0-9]+", message = "Le matricule doit contenir uniquement des chiffres") String matricule) {}

    public record AccountView(Long id, String username, String matricule, String fullName,
                              String department, String jobTitle, String workType, String email,
                              String employeeStatus, AccountStatus accountStatus, List<String> applications) {
        static AccountView from(UserAccount account, List<String> applications) {
            return new AccountView(account.getId(), account.getUsername(), account.getMatricule(),
                    account.getFullName(), account.getDepartment(), account.getJobTitle(),
                    account.getWorkType(), account.getEmail(), account.getEmployeeStatus(),
                    account.getAccountStatus(), applications);
        }
    }
}
