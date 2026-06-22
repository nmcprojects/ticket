package com.tickethub.event.client;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.util.Optional;

/** Looks up system users in auth-service (members must be existing accounts). */
@Component
public class AuthClient {

    private final RestClient client;

    public AuthClient(@Value("${tickethub.services.auth-url}") String baseUrl) {
        this.client = RestClient.builder().baseUrl(baseUrl).build();
    }

    public record UserLookup(Long id, String email, String fullName) {
    }

    /** Returns the user with this email, or empty if no such account exists. */
    public Optional<UserLookup> findByEmail(String email) {
        try {
            UserLookup u = client.get()
                    .uri(b -> b.path("/api/auth/users/by-email").queryParam("email", email).build())
                    .retrieve()
                    .body(UserLookup.class);
            return Optional.ofNullable(u);
        } catch (Exception e) {
            // 404 (no such user) or any transient error → treat as "not found"
            return Optional.empty();
        }
    }
}
