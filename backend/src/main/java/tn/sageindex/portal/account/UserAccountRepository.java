package tn.sageindex.portal.account;

import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;

public interface UserAccountRepository extends JpaRepository<UserAccount, Long> {
    Optional<UserAccount> findByUsername(String username);
    @org.springframework.data.jpa.repository.Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
    @org.springframework.data.jpa.repository.Query("select a from UserAccount a where a.username = :username")
    Optional<UserAccount> findForActivationByUsername(@org.springframework.data.repository.query.Param("username") String username);
    Optional<UserAccount> findByMatricule(String matricule);
    Optional<UserAccount> findByEmployeeId(Long employeeId);
    boolean existsByEmployeeId(Long employeeId);
    long countByAccountStatus(AccountStatus status);
}
