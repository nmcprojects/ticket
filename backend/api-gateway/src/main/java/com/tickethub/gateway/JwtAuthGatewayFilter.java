package com.tickethub.gateway;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.cloud.gateway.filter.GatewayFilterChain;
import org.springframework.cloud.gateway.filter.GlobalFilter;
import org.springframework.core.Ordered;
import org.springframework.http.HttpStatus;
import org.springframework.http.server.reactive.ServerHttpRequest;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ServerWebExchange;
import reactor.core.publisher.Mono;

import java.security.KeyFactory;
import java.security.PublicKey;
import java.security.spec.X509EncodedKeySpec;
import java.util.Base64;
import java.util.List;
import java.util.Set;

/**
 * Validates the JWT issued by auth-service. For any request carrying a valid
 * Bearer token it forwards identity to downstream services via X-User-* headers.
 * Requests to protected prefixes without a valid token are rejected with 401.
 */
@Component
public class JwtAuthGatewayFilter implements GlobalFilter, Ordered {

    // GET paths that REQUIRE a logged-in user (their writes are covered by the write rule below).
    private static final List<String> PROTECTED_PREFIXES = List.of(
            "/api/bookings",
            "/api/tickets",
            "/api/checkins",
            "/api/auth/me"
    );

    // Mutating HTTP methods. Any of these requires authentication unless it's a public auth flow.
    private static final Set<String> WRITE_METHODS = Set.of("POST", "PUT", "PATCH", "DELETE");

    // Public key only — the gateway can VERIFY tokens but cannot mint them (only auth-service can).
    private final PublicKey publicKey;

    public JwtAuthGatewayFilter(@Value("${tickethub.jwt.public-key}") String publicKeyB64) {
        try {
            this.publicKey = KeyFactory.getInstance("RSA")
                    .generatePublic(new X509EncodedKeySpec(Base64.getDecoder().decode(publicKeyB64)));
        } catch (Exception e) {
            throw new IllegalStateException("JWT public key không hợp lệ", e);
        }
    }

    @Override
    public Mono<Void> filter(ServerWebExchange exchange, GatewayFilterChain chain) {
        ServerHttpRequest request = exchange.getRequest();
        String path = request.getURI().getPath();

        // Let CORS preflight through untouched.
        if (request.getMethod() != null && "OPTIONS".equalsIgnoreCase(request.getMethod().name())) {
            return chain.filter(exchange);
        }

        Claims claims = null;
        String auth = request.getHeaders().getFirst("Authorization");
        if (auth != null && auth.startsWith("Bearer ")) {
            try {
                claims = Jwts.parser().verifyWith(publicKey).build()
                        .parseSignedClaims(auth.substring(7)).getPayload();
            } catch (Exception ignored) {
                claims = null;
            }
        }

        // A write to anything other than the public auth flows (login/register/refresh/logout)
        // requires authentication — this closes write access to events, organizers, ticket-types,
        // uploads, etc. Per-resource ownership is then enforced by the downstream services.
        String method = request.getMethod() != null ? request.getMethod().name() : "GET";
        boolean writeNeedsAuth = WRITE_METHODS.contains(method)
                && !path.startsWith("/api/auth/")          // login/register/refresh are pre-auth
                && !path.equals("/api/payments/payos-webhook"); // public PayOS callback (no JWT)

        boolean protectedPath = writeNeedsAuth || PROTECTED_PREFIXES.stream().anyMatch(path::startsWith);
        if (protectedPath && claims == null) {
            exchange.getResponse().setStatusCode(HttpStatus.UNAUTHORIZED);
            return exchange.getResponse().setComplete();
        }

        // ALWAYS strip client-supplied identity/trust headers so a caller can never forge them
        // (e.g. sending "X-User-Roles: [ADMIN]" without a token). Downstream services trust these
        // headers, so the gateway must be the only thing that ever sets them.
        ServerHttpRequest.Builder mutated = request.mutate().headers(h -> {
            h.remove("X-User-Id");
            h.remove("X-User-Email");
            h.remove("X-User-Roles");
            h.remove("X-Internal-Secret"); // service-to-service trust token — never accept from outside
        });
        if (claims != null) {
            Object roles = claims.get("roles");
            mutated.header("X-User-Id", claims.getSubject())
                    .header("X-User-Email", String.valueOf(claims.get("email")))
                    .header("X-User-Roles", roles != null ? roles.toString() : "");
        }
        return chain.filter(exchange.mutate().request(mutated.build()).build());
    }

    @Override
    public int getOrder() {
        return -1;
    }
}
