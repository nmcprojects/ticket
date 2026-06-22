package com.tickethub.common.security;

import org.springframework.core.MethodParameter;
import org.springframework.web.bind.support.WebDataBinderFactory;
import org.springframework.web.context.request.NativeWebRequest;
import org.springframework.web.context.request.RequestAttributes;
import org.springframework.web.method.support.HandlerMethodArgumentResolver;
import org.springframework.web.method.support.ModelAndViewContainer;

/**
 * Lets controllers declare a {@link CurrentUser} parameter and receive the authenticated caller
 * directly — no {@code @RequestHeader("X-User-Id")} boilerplate. Resolves to {@code null} for
 * anonymous requests (controllers that need a non-null caller should be guarded with
 * {@link RequireRole}).
 */
public class CurrentUserArgumentResolver implements HandlerMethodArgumentResolver {

    @Override
    public boolean supportsParameter(MethodParameter parameter) {
        return CurrentUser.class.equals(parameter.getParameterType());
    }

    @Override
    public Object resolveArgument(MethodParameter parameter, ModelAndViewContainer mavContainer,
                                  NativeWebRequest webRequest, WebDataBinderFactory binderFactory) {
        return webRequest.getAttribute(GatewayAuthFilter.ATTRIBUTE, RequestAttributes.SCOPE_REQUEST);
    }
}
