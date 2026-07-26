package tn.sageindex.portal.auth;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Date;
import java.util.Set;
import java.util.UUID;
import java.util.Base64;
import java.util.concurrent.ConcurrentHashMap;
import java.util.Map;
import java.security.MessageDigest;

@Service
public class JwtService {
    private final SecretKey key;
    private final long lifetimeSeconds;
    private final Set<String> revoked = ConcurrentHashMap.newKeySet();
    private final Map<String, Instant> revokedBefore = new ConcurrentHashMap<>();

    public JwtService(@Value("${portal.jwt.secret}") String secret,
                      @Value("${portal.jwt.lifetime-seconds:28800}") long lifetimeSeconds) {
        this.key = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
        this.lifetimeSeconds = lifetimeSeconds;
    }

    public String create(UserDetails user) {
        Instant now = Instant.now();
        return Jwts.builder().subject(user.getUsername()).id(UUID.randomUUID().toString())
                .claim("roles", user.getAuthorities().stream().map(Object::toString).toList())
                .claim("pwd", fingerprint(user.getPassword()))
                .issuedAt(Date.from(now)).expiration(Date.from(now.plusSeconds(lifetimeSeconds)))
                .signWith(key).compact();
    }

    public Claims parse(String token) {
        Claims claims = Jwts.parser().verifyWith(key).build().parseSignedClaims(token).getPayload();
        if (revoked.contains(claims.getId())) throw new IllegalArgumentException("Token révoqué");
        Instant cutoff = revokedBefore.get(claims.getSubject());
        if (cutoff != null && claims.getIssuedAt().toInstant().isBefore(cutoff))
            throw new IllegalArgumentException("Session révoquée");
        return claims;
    }

    public void revoke(String token) {
        try { revoked.add(parse(token).getId()); } catch (RuntimeException ignored) { }
    }

    public void revokeAll(String username) {
        revokedBefore.put(username, Instant.now().plusMillis(1));
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
