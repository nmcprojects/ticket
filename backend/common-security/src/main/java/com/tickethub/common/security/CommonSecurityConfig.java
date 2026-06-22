package com.tickethub.common.security;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.Ordered;
import org.springframework.web.method.support.HandlerMethodArgumentResolver;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

import java.util.List;

/**
 * Wires the shared gateway-header authentication + declarative authorization into a service.
 * Import it from a service's main class: {@code @Import(CommonSecurityConfig.class)}.
 *
 * Registers (in order): the {@link GatewayAuthFilter} (parses identity once), the
 * {@link AuthInterceptor} (enforces {@link RequireRole}), and the {@link CurrentUserArgumentResolver}
 * (injects {@link CurrentUser} into controllers).
 */
@Configuration
public class CommonSecurityConfig implements WebMvcConfigurer {

    @Value("${tickethub.internal.secret:tickethub-internal-secret}")
    private String internalSecret;

    @Bean
    public FilterRegistrationBean<GatewayAuthFilter> gatewayAuthFilter() {
        FilterRegistrationBean<GatewayAuthFilter> registration =
                new FilterRegistrationBean<>(new GatewayAuthFilter(internalSecret));
        registration.setOrder(Ordered.HIGHEST_PRECEDENCE);
        registration.addUrlPatterns("/*");
        return registration;
    }

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        registry.addInterceptor(new AuthInterceptor());
    }

    @Override
    public void addArgumentResolvers(List<HandlerMethodArgumentResolver> resolvers) {
        resolvers.add(new CurrentUserArgumentResolver());
    }
}
