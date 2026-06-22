package com.tickethub.gateway;

import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpStatusCode;
import org.springframework.test.web.reactive.server.WebTestClient;

/**
 * Full reactive gateway context (RANDOM_PORT) verifying the auth gate only.
 * Eureka is disabled so the test never touches the running Docker stack.
 * Routes point at a dead host, so a request that passes the auth gate fails
 * downstream (5xx) rather than returning 401/403 — that's what we assert on.
 */
@SpringBootTest(
        webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
        properties = {
                "eureka.client.enabled=false",
                "eureka.client.register-with-eureka=false",
                "eureka.client.fetch-registry=false"
        })
class AuthGateWebTestClientTest {

    @org.springframework.beans.factory.annotation.Autowired
    private WebTestClient webTestClient;

    @Test
    void protectedRoute_withoutToken_isRejectedByAuth() {
        webTestClient.get()
                .uri("/api/bookings/me")
                .exchange()
                .expectStatus().isUnauthorized();
    }

    @Test
    void publicRoute_withoutToken_isNotRejectedByAuth() {
        // The downstream is unreachable, so this typically yields a 5xx
        // (503/500/504). The key assertion is that the AUTH gate let it
        // through: the status must NOT be 401 or 403.
        HttpStatusCode status = webTestClient.get()
                .uri("/api/events/upcoming")
                .exchange()
                .returnResult(Void.class)
                .getStatus();

        org.assertj.core.api.Assertions.assertThat(status)
                .isNotEqualTo(HttpStatus.UNAUTHORIZED)
                .isNotEqualTo(HttpStatus.FORBIDDEN);
    }
}
