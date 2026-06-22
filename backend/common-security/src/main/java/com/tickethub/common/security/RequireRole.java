package com.tickethub.common.security;

import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * Declarative authorization on a controller method (or class). Enforced centrally by
 * {@link AuthInterceptor} — no header parsing in controllers.
 *
 * <ul>
 *   <li>{@code @RequireRole} (no value) — any authenticated caller.</li>
 *   <li>{@code @RequireRole("ADMIN")} — must hold that role.</li>
 *   <li>{@code @RequireRole({"ADMIN","ORGANIZER","STAFF"})} — any one of these.</li>
 *   <li>{@code "INTERNAL"} matches trusted service-to-service calls.</li>
 * </ul>
 * Ownership ("only the owner") is not expressible here — inject {@link CurrentUser} and call
 * {@code requireOwnerOrStaff(...)} for that.
 */
@Retention(RetentionPolicy.RUNTIME)
@Target({ElementType.METHOD, ElementType.TYPE})
public @interface RequireRole {
    String[] value() default {};
}
