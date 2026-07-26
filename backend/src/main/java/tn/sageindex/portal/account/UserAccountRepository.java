package tn.sageindex.portal.account;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;

public interface UserAccountRepository extends JpaRepository<UserAccount, Long> {
    Optional<UserAccount> findByUsername(String username);
    Optional<UserAccount> findByEmployeeId(Long employeeId);
    boolean existsByEmployeeId(Long employeeId);
    long countByAccountStatus(AccountStatus status);
}
