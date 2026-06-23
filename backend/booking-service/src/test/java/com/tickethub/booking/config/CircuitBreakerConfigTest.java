package com.tickethub.booking.config;

import io.github.resilience4j.circuitbreaker.CircuitBreakerRegistry;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Boots the real Spring context (against a Testcontainers Postgres, Eureka + real Kafka disabled)
 * and asserts the Resilience4j {@link CircuitBreakerRegistry} has the "event" and "payment"
 * circuit breakers configured as declared in application.yml.
 */
@SpringBootTest(properties = {
        "eureka.client.enabled=false",
        "eureka.client.register-with-eureka=false",
        "eureka.client.fetch-registry=false",
        // keep Kafka auto-config so KafkaTemplate exists for BookingEventPublisher,
        // but never actually connect to the running broker. Point at an unused port and
        // disable topic auto-creation / listener startup so the context boots without Kafka.
        "spring.kafka.bootstrap-servers=localhost:0",
        "spring.kafka.listener.auto-startup=false",
        "spring.kafka.admin.auto-create=false",
        "spring.kafka.admin.fail-fast=false",
        "spring.kafka.properties.default.api.timeout.ms=1000",
        "spring.kafka.properties.request.timeout.ms=500",
        "spring.jpa.hibernate.ddl-auto=create-drop"
})
@Testcontainers
class CircuitBreakerConfigTest {

    @Container
    @ServiceConnection
    static final PostgreSQLContainer<?> POSTGRES =
            new PostgreSQLContainer<>("postgres:16-alpine");

    @DynamicPropertySource
    static void props(DynamicPropertyRegistry r) {
        r.add("eureka.client.enabled", () -> "false");
        r.add("eureka.client.register-with-eureka", () -> "false");
        r.add("eureka.client.fetch-registry", () -> "false");
    }

    @Autowired
    private CircuitBreakerRegistry circuitBreakerRegistry;

    @Test
    void registryHasEventAndPaymentCircuitBreakers() {
        assertThat(circuitBreakerRegistry).isNotNull();
        assertThat(circuitBreakerRegistry.find("event")).isPresent();
        assertThat(circuitBreakerRegistry.find("payment")).isPresent();

        // failure-rate threshold from the "default" config in application.yml
        assertThat(circuitBreakerRegistry.circuitBreaker("event")
                .getCircuitBreakerConfig().getFailureRateThreshold()).isEqualTo(50f);
        assertThat(circuitBreakerRegistry.circuitBreaker("payment")
                .getCircuitBreakerConfig().getFailureRateThreshold()).isEqualTo(50f);
    }
}
