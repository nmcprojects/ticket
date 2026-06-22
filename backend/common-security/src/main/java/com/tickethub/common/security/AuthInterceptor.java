package com.tickethub.common.security;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpStatus;
import org.springframework.web.method.HandlerMethod;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.servlet.HandlerInterceptor;

/**
 * Enforces {@link RequireRole} declared on controller methods/classes, using the
 * {@link CurrentUser} placed on the request by {@link GatewayAuthFilter}. All role-based
 * authorization lives here instead of being scattered across controllers.
 */
public class AuthInterceptor implements HandlerInterceptor {

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) {
        if (!(handler instanceof HandlerMethod method)) {
            return true;
        }
        RequireRole rule = method.getMethodAnnotation(RequireRole.class);
        if (rule == null) {
            rule = method.getBeanType().getAnnotation(RequireRole.class);
        }
        if (rule == null) {
            return true; // endpoint has no declarative guard
        }

        CurrentUser user = (CurrentUser) request.getAttribute(GatewayAuthFilter.ATTRIBUTE);
        if (user == null) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Cần đăng nhập.");
        }
        String[] allowed = rule.value();
        if (allowed.length == 0) {
            return true; // any authenticated caller is fine
        }
        for (String role : allowed) {
            if (user.hasRole(role)) {
                return true;
            }
        }
        throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Bạn không có quyền thực hiện thao tác này.");
    }
}
