package com.tickethub.eureka;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

/**
 * Smoke / integration test for the standalone Eureka registry.
 *
 * <p>The test boots the full Spring context on a random port and verifies that
 * both the actuator health endpoint and the Eureka apps endpoint respond. The
 * Eureka client is fully disabled so the server never tries to register with
 * itself or with the Docker stack already running on localhost:8761.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class EurekaServerApplicationTests {

    @DynamicPropertySource
    static void disableEurekaClient(DynamicPropertyRegistry registry) {
        // Standalone registry: do not register with or fetch from any peer.
        // The client auto-config itself stays enabled so the server can obtain
        // its required ApplicationInfoManager bean.
        registry.add("eureka.client.register-with-eureka", () -> "false");
        registry.add("eureka.client.fetch-registry", () -> "false");
    }

    @LocalServerPort
    private int port;

    @Autowired
    private TestRestTemplate restTemplate;

    @Test
    void contextLoads() {
        assertThat(restTemplate).isNotNull();
        assertThat(port).isGreaterThan(0);
    }

    @Test
    void actuatorHealthEndpointResponds() {
        ResponseEntity<String> response =
                restTemplate.getForEntity("http://localhost:" + port + "/actuator/health", String.class);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.OK);
        assertThat(response.getBody()).contains("UP");
    }

    @Test
    void eurekaAppsEndpointResponds() {
        // The registry should answer its own apps endpoint. With no client
        // registration the application list is empty, but the endpoint is live.
        ResponseEntity<String> response =
                restTemplate.getForEntity("http://localhost:" + port + "/eureka/apps", String.class);

        assertThat(response.getStatusCode().is2xxSuccessful()).isTrue();
    }
}
