package tn.sageindex.portal.auth;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.security.crypto.password.PasswordEncoder;
import tn.sageindex.portal.account.*;
import tn.sageindex.portal.dashboard.OperationalDataService;
import tools.jackson.databind.ObjectMapper;

import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest(properties = {
    "portal.admin.username=test-bootstrap",
    "portal.admin.password=test-password-not-for-production",
    "portal.jwt.secret=test-jwt-key-with-at-least-32-characters",
    "portal.sources.traceability.password=test",
    "portal.sources.hr.password=test",
    "portal.sources.planning.password=test",
    "spring.datasource.url=jdbc:h2:mem:activation-test;DB_CLOSE_DELAY=-1",
    "spring.datasource.driver-class-name=org.h2.Driver",
    "spring.datasource.username=sa", "spring.datasource.password=",
    "spring.jpa.hibernate.ddl-auto=create-drop"
})
@AutoConfigureMockMvc
class AccountActivationTests {
    @Autowired MockMvc mvc;
    @Autowired ObjectMapper json;
    @Autowired UserAccountRepository accounts;
    @Autowired PasswordEncoder encoder;
    @Autowired AccountImporter importer;
    @MockitoBean OperationalDataService operations;

    private String login(String username, String password) throws Exception {
        return mvc.perform(post("/api/auth/login").contentType("application/json")
                .content(json.writeValueAsString(Map.of("username", username, "password", password))))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
    }

    @Test
    void activationRequiresAdminAndPasswordReplacementBeforeAnyBusinessAccess() throws Exception {
        when(operations.applicationAccess(any())).thenReturn(Map.of());
        when(operations.loadFor(any())).thenReturn(Map.of());
        String username = "3744";
        assertThat(accounts.findByUsername(username).orElseThrow().getPasswordHash()).isNull();
        mvc.perform(post("/api/auth/login").contentType("application/json")
                .content(json.writeValueAsString(Map.of("username", username, "password", username))))
                .andExpect(status().isUnauthorized());
        mvc.perform(post("/api/accounts/" + username + "/activate")).andExpect(status().isUnauthorized());
        String admin = json.readTree(login("test-bootstrap", "test-password-not-for-production")).path("accessToken").asText();
        String activation = mvc.perform(post("/api/accounts/" + username + "/activate")
                .header("Authorization", "Bearer " + admin))
                .andExpect(status().isOk()).andExpect(header().string("Cache-Control", "no-store"))
                .andReturn().getResponse().getContentAsString();
        String temporary = json.readTree(activation).path("temporaryPassword").asText();
        assertThat(temporary).hasSize(32).isNotEqualTo(username);
        assertThat(encoder.matches(temporary, accounts.findByUsername(username).orElseThrow().getPasswordHash())).isTrue();
        var session = json.readTree(login(username, temporary));
        assertThat(session.path("passwordChangeRequired").asBoolean()).isTrue();
        String token = session.path("accessToken").asText();
        for (String path : new String[]{"/api/dashboard/me", "/api/accounts", "/api/dashboard/operational"}) {
            mvc.perform(get(path).header("Authorization", "Bearer " + token)).andExpect(status().isForbidden());
        }
        mvc.perform(post("/api/sso/launch").header("Authorization", "Bearer " + token)).andExpect(status().isForbidden());
        mvc.perform(post("/api/auth/change-password").header("Authorization", "Bearer " + token)
                .contentType("application/json").content(json.writeValueAsString(Map.of("currentPassword", temporary, "newPassword", temporary))))
                .andExpect(status().isBadRequest());
        String personal = "personal-password-for-test";
        mvc.perform(post("/api/auth/change-password").header("Authorization", "Bearer " + token)
                .contentType("application/json").content(json.writeValueAsString(Map.of("currentPassword", temporary, "newPassword", personal))))
                .andExpect(status().isNoContent());
        mvc.perform(get("/api/dashboard/me").header("Authorization", "Bearer " + token)).andExpect(status().isUnauthorized());
        var active = json.readTree(login(username, personal));
        assertThat(active.path("passwordChangeRequired").asBoolean()).isFalse();
        mvc.perform(get("/api/dashboard/me").header("Authorization", "Bearer " + active.path("accessToken").asText())).andExpect(status().isOk());
        mvc.perform(post("/api/accounts/" + username + "/activate").header("Authorization", "Bearer " + admin)).andExpect(status().isConflict());
        importer.run();
        assertThat(encoder.matches(personal, accounts.findByUsername(username).orElseThrow().getPasswordHash())).isTrue();
    }

    @Test
    void creationAndLegacyMigrationNeverProvisionAnEmployeePassword() throws Exception {
        when(operations.applicationAccess(any())).thenReturn(Map.of());
        when(operations.findActiveEmployee("999999")).thenReturn(Optional.of(
                new OperationalDataService.EmployeeProfile(999999L, "Test employee", "test@invalid.local", "IT", "Test", "CADRE", "Test")));
        String admin = json.readTree(login("test-bootstrap", "test-password-not-for-production")).path("accessToken").asText();
        mvc.perform(post("/api/accounts").header("Authorization", "Bearer " + admin)
                .contentType("application/json").content("{\"matricule\":\"999999\"}"))
                .andExpect(status().isCreated()).andExpect(jsonPath("$.accountStatus").value("ACTIVATION_REQUIRED"));
        assertThat(accounts.findByUsername("999999").orElseThrow().getPasswordHash()).isNull();
        UserAccount legacy = accounts.findByUsername("3743").orElseThrow();
        legacy.setPasswordHash(encoder.encode(legacy.getMatricule()));
        legacy.setAccountStatus(AccountStatus.ACTIVE);
        accounts.save(legacy);
        UserAccount disabled = accounts.findByUsername("3745").orElseThrow();
        disabled.setPasswordHash(encoder.encode(disabled.getMatricule()));
        disabled.setAccountStatus(AccountStatus.DISABLED);
        accounts.save(disabled);
        UserAccount manual = accounts.findByUsername("999999").orElseThrow();
        manual.setPasswordHash(encoder.encode(manual.getMatricule()));
        manual.setAccountStatus(AccountStatus.ACTIVE);
        accounts.save(manual);
        importer.run();
        assertThat(accounts.findByUsername("999999").orElseThrow().getPasswordHash()).isNull();
        assertThat(accounts.findByUsername("999999").orElseThrow().getAccountStatus()).isEqualTo(AccountStatus.ACTIVATION_REQUIRED);
        assertThat(accounts.findByUsername("3743").orElseThrow().getAccountStatus()).isEqualTo(AccountStatus.ACTIVATION_REQUIRED);
        assertThat(accounts.findByUsername("3743").orElseThrow().getPasswordHash()).isNull();
        assertThat(accounts.findByUsername("3745").orElseThrow().getAccountStatus()).isEqualTo(AccountStatus.DISABLED);
    }
}
