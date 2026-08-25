package tn.sageindex.portal.auth;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.core.userdetails.UserDetailsService;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@SpringBootTest(properties = {
        "portal.admin.password=test-password-not-for-production",
        "spring.datasource.url=jdbc:h2:mem:sage_index_session_test;DB_CLOSE_DELAY=-1",
        "spring.datasource.driver-class-name=org.h2.Driver",
        "spring.datasource.username=sa",
        "spring.datasource.password=",
        "spring.jpa.hibernate.ddl-auto=create-drop"
})
class JwtSingleSessionTests {
    @Autowired private JwtService jwtService;
    @Autowired private UserDetailsService users;

    @Test
    void aNewLoginImmediatelyInvalidatesThePreviousToken() {
        var admin = users.loadUserByUsername("3744");
        String firstToken = jwtService.create(admin);
        String secondToken = jwtService.create(admin);

        assertThatThrownBy(() -> jwtService.parse(firstToken))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("nouvelle session");
        assertThat(jwtService.parse(secondToken).getSubject()).isEqualTo("3744");
    }

    @Test
    void logoutInvalidatesTheOnlyActiveToken() {
        var admin = users.loadUserByUsername("3744");
        String token = jwtService.create(admin);

        jwtService.revoke(token);

        assertThatThrownBy(() -> jwtService.parse(token))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Session terminée");
    }
}
