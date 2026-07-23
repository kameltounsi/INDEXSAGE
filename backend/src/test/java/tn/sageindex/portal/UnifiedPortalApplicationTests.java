package tn.sageindex.portal;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import tn.sageindex.portal.account.UserAccountRepository;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest(properties = "portal.admin.password=test-password-not-for-production")
class UnifiedPortalApplicationTests {
	@Autowired
	private UserAccountRepository repository;

	@Test
	void importsOnlyEligibleAccounts() {
		assertThat(repository.count()).isEqualTo(432);
		assertThat(repository.findAll())
				.allMatch(account -> !account.getWorkType().startsWith("DIRECT"));
	}

}
