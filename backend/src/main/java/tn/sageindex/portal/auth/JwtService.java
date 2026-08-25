package tn.sageindex.portal.auth;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Date;
import java.util.UUID;
import java.util.Base64;
import java.security.MessageDigest;

@Service
public class JwtService {
    private final SecretKey key;
    private final long lifetimeSeconds;
    private final PortalSessionRepository sessions;

    public JwtService(@Value("${portal.jwt.secret}") String secret,
                      @Value("${portal.jwt.lifetime-seconds:28800}") long lifetimeSeconds,
                      PortalSessionRepository sessions) {
        this.key = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
        this.lifetimeSeconds = lifetimeSeconds;
        this.sessions = sessions;
    }

    @Transactional
    public String create(UserDetails user) {
        Instant now = Instant.now();
        Instant expiresAt = now.plusSeconds(lifetimeSeconds);
        String tokenId = UUID.randomUUID().toString();
        String token = Jwts.builder().subject(user.getUsername()).id(tokenId)
                .claim("roles", user.getAuthorities().stream().map(Object::toString).toList())
                .claim("pwd", fingerprint(user.getPassword()))
                .issuedAt(Date.from(now)).expiration(Date.from(expiresAt))
                .signWith(key).compact();
        // La clé primaire username garantit une seule session active par compte.
        sessions.saveAndFlush(new PortalSession(user.getUsername(), tokenId, now, expiresAt));
        return token;
    }

    @Transactional(readOnly = true)
    public Claims parse(String token) {
        Claims claims = Jwts.parser().verifyWith(key).build().parseSignedClaims(token).getPayload();
        PortalSession active = sessions.findById(claims.getSubject())
                .orElseThrow(() -> new IllegalArgumentException("Session terminée"));
        if (!MessageDigest.isEqual(active.getTokenId().getBytes(StandardCharsets.UTF_8),
                claims.getId().getBytes(StandardCharsets.UTF_8)))
            throw new IllegalArgumentException("Une nouvelle session a remplacé ce token");
        if (active.getExpiresAt().isBefore(Instant.now()))
            throw new IllegalArgumentException("Session expirée");
        return claims;
    }

    @Transactional
    public void revoke(String token) {
        try {
            Claims claims = parse(token);
            sessions.deleteById(claims.getSubject());
        } catch (RuntimeException ignored) { }
    }

    @Transactional
    public void revokeAll(String username) {
        sessions.deleteById(username);
    }

    public boolean validFor(Claims claims, UserDetails user) {
        return MessageDigest.isEqual(
                String.valueOf(claims.get("pwd")).getBytes(StandardCharsets.UTF_8),
                fingerprint(user.getPassword()).getBytes(StandardCharsets.UTF_8));
    }

    private String fingerprint(String encodedPassword) {
        try {
            return Base64.getUrlEncoder().withoutPadding()
                    .encodeToString(MessageDigest.getInstance("SHA-256").digest(encodedPassword.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }
}
