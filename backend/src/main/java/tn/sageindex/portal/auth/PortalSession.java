package tn.sageindex.portal.auth;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;

@Entity
@Table(name = "portal_sessions")
public class PortalSession {
    @Id
    @Column(length = 80)
    private String username;

    @Column(nullable = false, unique = true, length = 36)
    private String tokenId;

    @Column(nullable = false)
    private Instant issuedAt;

    @Column(nullable = false)
    private Instant expiresAt;

    protected PortalSession() {}

    public PortalSession(String username, String tokenId, Instant issuedAt, Instant expiresAt) {
        this.username = username;
        this.tokenId = tokenId;
        this.issuedAt = issuedAt;
        this.expiresAt = expiresAt;
    }

    public String getUsername() { return username; }
    public String getTokenId() { return tokenId; }
    public Instant getIssuedAt() { return issuedAt; }
    public Instant getExpiresAt() { return expiresAt; }
}
