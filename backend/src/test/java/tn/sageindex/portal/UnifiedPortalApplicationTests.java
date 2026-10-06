package tn.sageindex.portal;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import tn.sageindex.portal.account.UserAccountRepository;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest(properties = {
		"portal.admin.username=test-bootstrap",
        "portal.admin.password=test-password-not-for-production",
        "portal.jwt.secret=test-jwt-key-with-at-least-32-characters",
        "portal.sources.traceability.password=test",
        "portal.sources.hr.password=test",
        "portal.sources.planning.password=test",
		"spring.datasource.url=jdbc:h2:mem:sage-index-test;DB_CLOSE_DELAY=-1",
		"spring.datasource.driver-class-name=org.h2.Driver",
		"spring.datasource.username=sa",
		"spring.datasource.password=",
		"spring.jpa.hibernate.ddl-auto=create-drop"
})
class UnifiedPortalApplicationTests {
	@Autowired
	private UserAccountRepository repository;

	@Test
	void importsOnlyEligibleAccounts() {
		assertThat(repository.count()).isEqualTo(433);
		assertThat(repository.findAll())
				.allMatch(account -> !account.getWorkType().startsWith("DIRECT"));
	}

}
