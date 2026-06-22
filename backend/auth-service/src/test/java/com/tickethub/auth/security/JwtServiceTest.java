package com.tickethub.auth.security;

import com.tickethub.auth.domain.Permission;
import com.tickethub.auth.domain.Role;
import com.tickethub.auth.domain.User;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import org.junit.jupiter.api.Test;

import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Base64;
import java.util.Date;
import java.util.List;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Plain JUnit unit test for {@link JwtService} — no Spring context, no container.
 * Verifies the RS256 sign/parse round-trip and that expired or tampered tokens are rejected.
 */
class JwtServiceTest {

    private static final long ACCESS_MINUTES = 60;

    // A throwaway RSA keypair: auth-service signs with the private key, verifies with the public key.
    private final KeyPair keyPair = generateKeyPair();
    private final JwtService jwtService = new JwtService(
            Base64.getEncoder().encodeToString(keyPair.getPrivate().getEncoded()),
            Base64.getEncoder().encodeToString(keyPair.getPublic().getEncoded()),
            ACCESS_MINUTES);

    private static KeyPair generateKeyPair() {
        try {
            KeyPairGenerator generator = KeyPairGenerator.getInstance("RSA");
            generator.initialize(2048);
            return generator.generateKeyPair();
        } catch (Exception e) {
            throw new IllegalStateException("Không tạo được RSA keypair cho test", e);
        }
    }

    private User sampleUser() {
        Permission viewEvent = new Permission("EVENT_VIEW", "Xem sự kiện", "EVENT", "VIEW");
        Role customer = new Role("CUSTOMER", "Khách hàng");
        customer.setPermissions(Set.of(viewEvent));

        User user = new User();
        user.setId(42L);
        user.setEmail("alice@example.com");
        user.setFullName("Alice");
        user.setRoles(Set.of(customer));
        return user;
    }

    @Test
    void signThenParse_returnsSameSubjectEmailAndRoles() {
        User user = sampleUser();

        String token = jwtService.generateAccessToken(user);
        Claims claims = jwtService.parse(token);

        assertThat(claims.getSubject()).isEqualTo("42");
        assertThat(claims.get("email", String.class)).isEqualTo("alice@example.com");
        assertThat(claims.get("fullName", String.class)).isEqualTo("Alice");
        assertThat(claims.get("roles", List.class)).containsExactly("CUSTOMER");
        assertThat(claims.get("permissions", List.class)).containsExactly("EVENT_VIEW");
    }

    @Test
    void signedTokenUsesRs256() {
        String token = jwtService.generateAccessToken(sampleUser());
        String headerJson = new String(Base64.getUrlDecoder().decode(token.substring(0, token.indexOf('.'))));
        assertThat(headerJson).contains("\"alg\":\"RS256\"");
    }

    @Test
    void parse_expiredToken_isRejected() {
        // A genuinely-expired token, validly signed with the matching private key.
        Instant past = Instant.now().minus(2, ChronoUnit.HOURS);
        String expired = Jwts.builder()
                .subject("42")
                .issuedAt(Date.from(past))
                .expiration(Date.from(past.plus(1, ChronoUnit.HOURS)))
                .signWith(keyPair.getPrivate(), Jwts.SIG.RS256)
                .compact();

        assertThatThrownBy(() -> jwtService.parse(expired))
                .isInstanceOf(JwtException.class);
    }

    @Test
    void parse_tamperedToken_isRejected() {
        String token = jwtService.generateAccessToken(sampleUser());

        // Flip the FIRST character of the signature segment (always significant bits, unlike the
        // last char which may map to ignored base64 padding bits) to invalidate the RSA signature.
        int lastDot = token.lastIndexOf('.');
        assertThat(lastDot).isGreaterThan(0);
        String signature = token.substring(lastDot + 1);
        char first = signature.charAt(0);
        char replacement = (first == 'A') ? 'B' : 'A';
        String tampered = token.substring(0, lastDot + 1) + replacement + signature.substring(1);
        assertThat(tampered).isNotEqualTo(token);

        assertThatThrownBy(() -> jwtService.parse(tampered))
                .isInstanceOf(JwtException.class);
    }

    @Test
    void parse_tokenSignedByDifferentKey_isRejected() {
        // A token signed by a DIFFERENT private key must fail verification — this is the whole point
        // of asymmetric signing: only auth-service's key produces tokens this service accepts.
        KeyPair attacker = generateKeyPair();
        String forged = Jwts.builder()
                .subject("42")
                .claim("roles", List.of("ADMIN"))
                .issuedAt(Date.from(Instant.now()))
                .expiration(Date.from(Instant.now().plus(1, ChronoUnit.HOURS)))
                .signWith(attacker.getPrivate(), Jwts.SIG.RS256)
                .compact();

        assertThatThrownBy(() -> jwtService.parse(forged))
                .isInstanceOf(JwtException.class);
    }
}
