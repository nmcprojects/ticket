package com.tickethub.common.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.Arrays;
import java.util.LinkedHashSet;
import java.util.Set;

/**
 * Reads the trusted identity headers the API gateway injects (X-User-Id / X-User-Email /
 * X-User-Roles) — or recognises a trusted internal service call via X-Internal-Secret — and
 * stashes a {@link CurrentUser} on the request. This is the ONE place identity is parsed.
 *
 * The gateway strips these headers from external requests and only re-sets them from a verified
 * JWT, so by the time a request arrives here the headers are trustworthy. Internal calls go
 * service-to-service (bypassing the gateway) and authenticate with the shared internal secret.
 */
public class GatewayAuthFilter extends OncePerRequestFilter {

    public static final String ATTRIBUTE = "tickethub.currentUser";

    private final String internalSecret;

    public GatewayAuthFilter(String internalSecret) {
        this.internalSecret = internalSecret;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        CurrentUser user = resolve(request);
        if (user != null) {
            request.setAttribute(ATTRIBUTE, user);
        }
        chain.doFilter(request, response);
    }

    private CurrentUser resolve(HttpServletRequest request) {
        String internal = request.getHeader("X-Internal-Secret");
        if (internal != null && internal.equals(internalSecret)) {
            return CurrentUser.internal();
        }
        String userId = request.getHeader("X-User-Id");
        if (userId == null || userId.isBlank()) {
            return null;
        }
        try {
            return CurrentUser.of(Long.valueOf(userId.trim()),
                    request.getHeader("X-User-Email"),
                    parseRoles(request.getHeader("X-User-Roles")));
        } catch (NumberFormatException e) {
            return null; // malformed header → treat as anonymous
        }
    }

    /** Parses "[CUSTOMER, ADMIN]" (or "CUSTOMER,ADMIN") into an exact-match set of role codes. */
    static Set<String> parseRoles(String header) {
        if (header == null) return Set.of();
        String trimmed = header.trim();
        if (trimmed.startsWith("[")) trimmed = trimmed.substring(1);
        if (trimmed.endsWith("]")) trimmed = trimmed.substring(0, trimmed.length() - 1);
        if (trimmed.isBlank()) return Set.of();
        Set<String> roles = new LinkedHashSet<>();
        Arrays.stream(trimmed.split(",")).map(String::trim).filter(s -> !s.isEmpty()).forEach(roles::add);
        return roles;
    }
}
