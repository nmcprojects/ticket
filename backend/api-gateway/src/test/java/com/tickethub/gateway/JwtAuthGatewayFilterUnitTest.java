package com.tickethub.gateway;

import io.jsonwebtoken.Jwts;
import org.junit.jupiter.api.Test;
import org.springframework.cloud.gateway.filter.GatewayFilterChain;
import org.springframework.http.HttpStatus;
import org.springframework.http.server.reactive.ServerHttpRequest;
import org.springframework.mock.http.server.reactive.MockServerHttpRequest;
import org.springframework.mock.web.server.MockServerWebExchange;
import reactor.core.publisher.Mono;
import reactor.test.StepVerifier;

import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.util.Base64;
import java.util.Date;
import java.util.List;
import java.util.concurrent.atomic.AtomicReference;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Plain JUnit unit test (no Spring context) for {@link JwtAuthGatewayFilter}.
 * Drives the GlobalFilter directly with mock exchanges, signing tokens with an
 * RSA private key and feeding the matching public key to the filter.
 */
class JwtAuthGatewayFilterUnitTest {

    private static final KeyPair KEY_PAIR = generateRsaKeyPair();

    private final JwtAuthGatewayFilter filter = new JwtAuthGatewayFilter(
            Base64.getEncoder().encodeToString(KEY_PAIR.getPublic().getEncoded())
    );

    private static KeyPair generateRsaKeyPair() {
        try {
            KeyPairGenerator gen = KeyPairGenerator.getInstance("RSA");
            gen.initialize(2048);
            return gen.generateKeyPair();
        } catch (Exception e) {
            throw new IllegalStateException("Failed to generate RSA keypair for test", e);
        }
    }

    private String token(String userId, String email, List<String> roles, long ttlMillis) {
        long now = System.currentTimeMillis();
        return Jwts.builder()
                .subject(userId)
                .claim("email", email)
                .claim("roles", roles)
                .issuedAt(new Date(now))
                .expiration(new Date(now + ttlMillis))
                .signWith(KEY_PAIR.getPrivate(), Jwts.SIG.RS256)
                .compact();
    }

    @Test
    void validToken_isAccepted_andClaimsPropagatedAsHeaders() {
        String jwt = token("user-42", "alice@tickethub.io", List.of("USER", "ORGANIZER"), 60_000);

        MockServerHttpRequest request = MockServerHttpRequest
                .get("/api/bookings/123")
                .header("Authorization", "Bearer " + jwt)
                .build();
        MockServerWebExchange exchange = MockServerWebExchange.from(request);

        AtomicReference<ServerHttpRequest> forwarded = new AtomicReference<>();
        GatewayFilterChain chain = ex -> {
            forwarded.set(ex.getRequest());
            return Mono.empty();
        };

        StepVerifier.create(filter.filter(exchange, chain)).verifyComplete();

        assertThat(exchange.getResponse().getStatusCode()).isNull();

        ServerHttpRequest mutated = forwarded.get();
        assertThat(mutated).isNotNull();
        assertThat(mutated.getHeaders().getFirst("X-User-Id")).isEqualTo("user-42");
        assertThat(mutated.getHeaders().getFirst("X-User-Email")).isEqualTo("alice@tickethub.io");
        assertThat(mutated.getHeaders().getFirst("X-User-Roles")).contains("USER", "ORGANIZER");
    }

    @Test
    void tamperedToken_onProtectedPath_isRejectedWith401() {
        String jwt = token("user-42", "alice@tickethub.io", List.of("USER"), 60_000);
        // Modify the payload (middle) section so the RSA signature no longer matches.
        String[] parts = jwt.split("\\.");
        char last = parts[1].charAt(parts[1].length() - 1);
        parts[1] = parts[1].substring(0, parts[1].length() - 1) + (last == 'A' ? 'B' : 'A');
        String tampered = String.join(".", parts);

        MockServerHttpRequest request = MockServerHttpRequest
                .get("/api/bookings/123")
                .header("Authorization", "Bearer " + tampered)
                .build();
        MockServerWebExchange exchange = MockServerWebExchange.from(request);

        AtomicReference<Boolean> chainCalled = new AtomicReference<>(false);
        GatewayFilterChain chain = ex -> {
            chainCalled.set(true);
            return Mono.empty();
        };

        StepVerifier.create(filter.filter(exchange, chain)).verifyComplete();

        assertThat(chainCalled.get()).isFalse();
        assertThat(exchange.getResponse().getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
    }

    @Test
    void expiredToken_onProtectedPath_isRejectedWith401() {
        String jwt = token("user-42", "alice@tickethub.io", List.of("USER"), -1_000);

        MockServerHttpRequest request = MockServerHttpRequest
                .get("/api/tickets/9")
                .header("Authorization", "Bearer " + jwt)
                .build();
        MockServerWebExchange exchange = MockServerWebExchange.from(request);

        GatewayFilterChain chain = ex -> Mono.empty();

        StepVerifier.create(filter.filter(exchange, chain)).verifyComplete();

        assertThat(exchange.getResponse().getStatusCode()).isEqualTo(HttpStatus.UNAUTHORIZED);
    }

    @Test
    void noToken_onPublicPath_isAllowedThrough() {
        MockServerHttpRequest request = MockServerHttpRequest
                .get("/api/events/upcoming")
                .build();
        MockServerWebExchange exchange = MockServerWebExchange.from(request);

        AtomicReference<Boolean> chainCalled = new AtomicReference<>(false);
        GatewayFilterChain chain = ex -> {
            chainCalled.set(true);
            return Mono.empty();
        };

        StepVerifier.create(filter.filter(exchange, chain)).verifyComplete();

        assertThat(chainCalled.get()).isTrue();
        assertThat(exchange.getResponse().getStatusCode()).isNull();
    }
}
