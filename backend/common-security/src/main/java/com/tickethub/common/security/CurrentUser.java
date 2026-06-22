package com.tickethub.common.security;

import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import java.util.Set;

/**
 * The authenticated caller for the current request, built by {@link GatewayAuthFilter}
 * from the gateway-injected X-User-* headers (or a trusted internal service call).
 *
 * Controllers receive this as a method argument and use it for ownership checks; role
 * checks are declared with {@link RequireRole} instead.
 */
public final class CurrentUser {

    /** Synthetic role for trusted service-to-service calls (carry X-Internal-Secret). */
    public static final String INTERNAL = "INTERNAL";

    private final Long id;
    private final String email;
    private final Set<String> roles;
    private final boolean internal;

    private CurrentUser(Long id, String email, Set<String> roles, boolean internal) {
        this.id = id;
        this.email = email;
        this.roles = roles;
        this.internal = internal;
    }

    public static CurrentUser of(Long id, String email, Set<String> roles) {
        return new CurrentUser(id, email, roles, false);
    }

    public static CurrentUser internal() {
        return new CurrentUser(null, null, Set.of(INTERNAL), true);
    }

    public Long id() { return id; }
    public String email() { return email; }
    public Set<String> roles() { return roles; }
    public boolean isInternal() { return internal; }

    public boolean hasRole(String role) {
        return INTERNAL.equals(role) ? internal : roles.contains(role);
    }

    public boolean isAdmin() { return roles.contains("ADMIN"); }

    /** Any non-customer business role (organizer/staff/admin). */
    public boolean isStaff() {
        return isAdmin() || roles.contains("ORGANIZER") || roles.contains("STAFF");
    }

    // ── Ownership guards (throw 403 when the caller is neither owner nor privileged) ──

    public void requireOwnerOrAdmin(Long ownerId) {
        if (internal || isAdmin()) return;
        requireSameUser(ownerId);
    }

    public void requireOwnerOrStaff(Long ownerId) {
        if (internal || isStaff()) return;
        requireSameUser(ownerId);
    }

    private void requireSameUser(Long ownerId) {
        if (id == null || ownerId == null || !ownerId.equals(id)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Bạn không có quyền truy cập dữ liệu này.");
        }
    }
}
