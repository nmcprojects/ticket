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
 * Validates the JWT issued by auth-service.
 * <p>
 * - Valid Bearer token → forwards identity downstream via X-User-* headers.<br>
 * - Protected path without a valid token → 401 Unauthorized.<br>
 * - Client-supplied identity headers are always stripped to prevent forgery.
 */
@Component
public class JwtAuthGateway implements GlobalFilter, Ordered {

    // -----------------------------------------------------------------------
    // Route classification constants
    // -----------------------------------------------------------------------

    /**
     * GET paths that require an authenticated user.
     * Write access to these paths is already covered by {@link #WRITE_METHODS}.
     */
    private static final List<String> PROTECTED_PREFIXES = List.of(
            "/api/bookings",
            "/api/tickets",
            "/api/checkins",
            "/api/auth/me"
    );

    /** HTTP methods that mutate state and require authentication by default. */
    private static final Set<String> WRITE_METHODS = Set.of("POST", "PUT", "PATCH", "DELETE");

    /**
     * Write-method paths that are intentionally public (no JWT required).
     * All other write endpoints are protected.
     */
    private static final Set<String> PUBLIC_WRITE_PATHS = Set.of(
            "/api/payments/payos-webhook"
    );

    /**
     * Path prefix for the auth service's own public flows
     * (login / register / refresh / logout).
     */
    private static final String AUTH_SERVICE_PREFIX = "/api/auth/";

    // -----------------------------------------------------------------------
    // Headers forwarded to — and stripped from — downstream services
    // -----------------------------------------------------------------------

    private static final String HEADER_USER_ID       = "X-User-Id";
    private static final String HEADER_USER_EMAIL    = "X-User-Email";
    private static final String HEADER_USER_ROLES    = "X-User-Roles";
    /** Service-to-service trust token; must never be accepted from external callers. */
    private static final String HEADER_INTERNAL_SECRET = "X-Internal-Secret";

    // -----------------------------------------------------------------------
    // State
    // -----------------------------------------------------------------------

    // Public key only — the gateway can VERIFY tokens but cannot mint them (only auth-service can).
    private final PublicKey publicKey;

    public JwtAuthGateway(@Value("${tickethub.jwt.public-key}") String publicKeyB64) {
        try {
            this.publicKey = KeyFactory.getInstance("RSA")
                    .generatePublic(new X509EncodedKeySpec(Base64.getDecoder().decode(publicKeyB64)));
        } catch (Exception e) {
            throw new IllegalStateException("JWT public key không hợp lệ", e);
        }
    }

    // -----------------------------------------------------------------------
    // GlobalFilter
    // -----------------------------------------------------------------------

    @Override
    public Mono<Void> filter(ServerWebExchange exchange, GatewayFilterChain chain) {
        ServerHttpRequest request = exchange.getRequest();

        // CORS preflight must pass through without any auth check.
        if (isPreflightRequest(request)) {
            return chain.filter(exchange);
        }

        Claims claims = extractClaims(request);

        if (requiresAuthentication(request) && claims == null) {
            return rejectUnauthorized(exchange);
        }

        ServerHttpRequest sanitized = buildSanitizedRequest(request, claims);
        return chain.filter(exchange.mutate().request(sanitized).build());
    }

    @Override
    public int getOrder() {
        // Run before all other filters.
        return -1;
    }

    // -----------------------------------------------------------------------
    // Request classification helpers
    // -----------------------------------------------------------------------

    private static boolean isPreflightRequest(ServerHttpRequest request) {
        return request.getMethod() != null
                && "OPTIONS".equalsIgnoreCase(request.getMethod().name());
    }

    /**
     * Returns {@code true} when the request must carry a valid JWT.
     *
     * <p>Two cases trigger protection:
     * <ol>
     *   <li>A mutating method ({@link #WRITE_METHODS}) aimed at a non-public endpoint.</li>
     *   <li>Any method whose path starts with one of {@link #PROTECTED_PREFIXES}.</li>
     * </ol>
     */
    private static boolean requiresAuthentication(ServerHttpRequest request) {
        String path   = request.getURI().getPath();
        String method = request.getMethod() != null ? request.getMethod().name() : "GET";

        boolean isProtectedWrite = WRITE_METHODS.contains(method)
                && !path.startsWith(AUTH_SERVICE_PREFIX)
                && !PUBLIC_WRITE_PATHS.contains(path);

        boolean isProtectedRead = PROTECTED_PREFIXES.stream().anyMatch(path::startsWith);

        return isProtectedWrite || isProtectedRead;
    }

    // -----------------------------------------------------------------------
    // JWT helpers
    // -----------------------------------------------------------------------

    /**
     * Parses and verifies the Bearer token from the {@code Authorization} header.
     *
     * @return the verified {@link Claims}, or {@code null} if the header is absent or invalid.
     */
    private Claims extractClaims(ServerHttpRequest request) {
        String authHeader = request.getHeaders().getFirst("Authorization");
        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            return null;
        }
        try {
            return Jwts.parser()
                    .verifyWith(publicKey)
                    .build()
                    .parseSignedClaims(authHeader.substring(7))
                    .getPayload();
        } catch (Exception ignored) {
            return null;
        }
    }

    // -----------------------------------------------------------------------
    // Request mutation helpers
    // -----------------------------------------------------------------------

    /**
     * Strips all client-supplied identity / trust headers, then re-adds them
     * from verified JWT claims (if present).
     *
     * <p>Stripping happens unconditionally so a caller can never inject forged
     * values (e.g. {@code X-User-Roles: [ADMIN]}) without a valid token.
     */
    private static ServerHttpRequest buildSanitizedRequest(ServerHttpRequest request, Claims claims) {
        ServerHttpRequest.Builder builder = request.mutate()
                .headers(headers -> {
                    headers.remove(HEADER_USER_ID);
                    headers.remove(HEADER_USER_EMAIL);
                    headers.remove(HEADER_USER_ROLES);
                    headers.remove(HEADER_INTERNAL_SECRET);
                });

        if (claims != null) {
            Object roles = claims.get("roles");
            builder.header(HEADER_USER_ID,    claims.getSubject())
                   .header(HEADER_USER_EMAIL, String.valueOf(claims.get("email")))
                   .header(HEADER_USER_ROLES, roles != null ? roles.toString() : "");
        }

        return builder.build();
    }

    // -----------------------------------------------------------------------
    // Response helpers
    // -----------------------------------------------------------------------

    private static Mono<Void> rejectUnauthorized(ServerWebExchange exchange) {
        exchange.getResponse().setStatusCode(HttpStatus.UNAUTHORIZED);
        return exchange.getResponse().setComplete();
    }
}