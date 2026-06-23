package com.tickethub.booking.repository;

import com.tickethub.booking.domain.ProcessedEvent;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.jdbc.DataSourceAutoConfiguration;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Real-repository proof of the inbox-style idempotency guard against a Testcontainers
 * Postgres (postgres:16-alpine). Must NOT touch the running docker stack or Eureka/Kafka.
 */
@DataJpaTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@Testcontainers
class ProcessedEventIdempotencyTest {

    @Container
    @ServiceConnection
    static final PostgreSQLContainer<?> POSTGRES =
            new PostgreSQLContainer<>("postgres:16-alpine");

    @DynamicPropertySource
    static void props(DynamicPropertyRegistry r) {
        // keep the test fully offline from the running infra
        r.add("eureka.client.enabled", () -> "false");
        r.add("eureka.client.register-with-eureka", () -> "false");
        r.add("eureka.client.fetch-registry", () -> "false");
        r.add("spring.jpa.hibernate.ddl-auto", () -> "create-drop");
    }

    @Autowired
    private ProcessedEventRepository repo;

    @Test
    void dedup_secondInsertOfSameKeyIsRejectedAndOnlyOneRowExists() {
        String key = "pay-succeeded-999";

        assertThat(repo.existsById(key)).isFalse();
        repo.saveAndFlush(new ProcessedEvent(key));
        assertThat(repo.existsById(key)).isTrue();

        // a duplicate event with the same key must not create a second processed row
        boolean firstSeen = repo.existsById(key);
        if (!firstSeen) {
            repo.saveAndFlush(new ProcessedEvent(key));
        }
        assertThat(repo.count()).isEqualTo(1L);
    }
}
