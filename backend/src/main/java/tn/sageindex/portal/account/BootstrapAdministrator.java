package tn.sageindex.portal.account;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

/** Dedicated administrator, independent of imported employee identifiers. */
@Component
public class BootstrapAdministrator implements CommandLineRunner {
    private final UserAccountRepository repository;
    private final PasswordEncoder encoder;
    private final String username;
    private final String password;

    public BootstrapAdministrator(UserAccountRepository repository, PasswordEncoder encoder,
            @Value("${portal.admin.username}") String username,
            @Value("${portal.admin.password}") String password) {
        if (username.isBlank() || username.length() > 40 || !username.equals(username.trim()) || username.matches("[0-9]+") || password.isBlank()
                || password.length() < 12 || password.getBytes(java.nio.charset.StandardCharsets.UTF_8).length > 72 || username.equals(password)) {
            throw new IllegalArgumentException("Configure an explicit non-numeric administrator username and a distinct password of 12 to 72 characters");
        }
        this.repository = repository;
        this.encoder = encoder;
        this.username = username;
        this.password = password;
    }

    @Override
    @Transactional
    public void run(String... args) {
        UserAccount account = repository.findByEmployeeId(-1L).orElseGet(UserAccount::new);
        repository.findByUsername(username).ifPresent(existing -> {
            if (!Long.valueOf(-1L).equals(existing.getEmployeeId())) {
                throw new IllegalStateException("Bootstrap administrator username already belongs to an employee");
            }
        });
        account.setEmployeeId(-1L);
        account.setMatricule(username);
        account.setUsername(username);
        account.setFullName("Administrateur du portail");
        account.setEmail("portal-administrator@invalid.local");
        account.setWorkType("PORTAL");
        account.setRoles("ADMIN");
        if (account.getPasswordHash() == null || !encoder.matches(password, account.getPasswordHash())) {
            account.setPasswordHash(encoder.encode(password));
        }
        account.setAccountStatus(AccountStatus.ACTIVE);
        repository.save(account);
    }
}
