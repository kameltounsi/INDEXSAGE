package tn.sageindex.portal.account;

import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.ObjectMapper;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Locale;

@Component
public class AccountImporter implements CommandLineRunner {
    private final UserAccountRepository repository;
    private final ObjectMapper objectMapper;

    public AccountImporter(UserAccountRepository repository, ObjectMapper objectMapper) {
        this.repository = repository;
        this.objectMapper = objectMapper;
    }

    @Override
    @Transactional
    public void run(String... args) throws Exception {
        List<SeedAccount> source = objectMapper.readValue(
                new ClassPathResource("data/users.json").getInputStream(),
                new TypeReference<>() {});

        for (SeedAccount item : source) {
            String normalizedType = item.workType() == null ? "" : item.workType().trim().toUpperCase(Locale.ROOT);
            if (normalizedType.startsWith("DIRECT") || repository.existsByEmployeeId(item.employeeId())) {
                continue;
            }
            UserAccount account = new UserAccount();
            account.setEmployeeId(item.employeeId());
            account.setMatricule(item.matricule());
            account.setUsername(item.username());
            account.setFullName(item.fullName());
            account.setDepartment(item.department());
            account.setJobTitle(item.jobTitle());
            account.setWorkType(normalizedType);
            account.setSupervisor(item.supervisor());
            account.setEmail(item.email());
            account.setEmployeeStatus(item.employeeStatus());
            account.setAccountStatus(AccountStatus.ACTIVATION_REQUIRED);
            account.setRoles(String.join(",", item.roles()));
            repository.save(account);
        }
    }
}
