package com.tickethub.notification.service;

import com.tickethub.common.events.TicketsIssuedEventMessage;
import com.tickethub.notification.domain.EmailNotification;
import com.tickethub.notification.repository.EmailNotificationRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.testcontainers.service.connection.ServiceConnection;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.test.context.TestPropertySource;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.time.Instant;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

/**
 * Persistence test backed by a real Postgres (Testcontainers postgres:16-alpine).
 * Exercises {@link NotificationService} against the real JPA repository to prove a
 * notification-log row is written, while the {@link JavaMailSender} stays a Mockito mock
 * so NO real email / SMTP connection is ever opened. Kafka and Eureka are not started.
 */
@DataJpaTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@Testcontainers
@TestPropertySource(properties = {
        "eureka.client.enabled=false",
        "eureka.client.register-with-eureka=false",
        "eureka.client.fetch-registry=false"
})
class NotificationServicePersistenceTest {

    @Container
    @ServiceConnection
    static final PostgreSQLContainer<?> POSTGRES =
            new PostgreSQLContainer<>("postgres:16-alpine");

    @org.springframework.beans.factory.annotation.Autowired
    private EmailNotificationRepository repository;

    private JavaMailSender mailSender;
    private NotificationService service;

    @BeforeEach
    void setUp() {
        repository.deleteAll();
        mailSender = mock(JavaMailSender.class);

        @SuppressWarnings("unchecked")
        ObjectProvider<JavaMailSender> provider = mock(ObjectProvider.class);
        when(provider.getIfAvailable()).thenReturn(mailSender);

        service = new NotificationService(repository, provider, new NotificationTemplate(),
                true, "techtok.support@gmail.com");
    }

    private TicketsIssuedEventMessage event(Long bookingId) {
        return new TicketsIssuedEventMessage(
                "TicketIssued", bookingId, 7L, "customer@example.com",
                100L, "Coldplay Live", List.of("TK-AAA", "TK-BBB"),
                Instant.parse("2026-06-14T10:00:00Z"));
    }

    @Test
    void persistsSentNotificationRow() {
        service.handleTicketsIssued(event(42L));

        verify(mailSender, times(1)).send(any(SimpleMailMessage.class));

        List<EmailNotification> rows = repository.findByBookingId(42L);
        assertThat(rows).hasSize(1);
        EmailNotification row = rows.get(0);
        assertThat(row.getId()).isNotNull();
        assertThat(row.getStatus()).isEqualTo(EmailNotification.Status.SENT);
        assertThat(row.getProvider()).isEqualTo("SMTP");
        assertThat(row.getRecipientEmail()).isEqualTo("customer@example.com");
        assertThat(row.getCreatedAt()).isNotNull();
    }

    @Test
    void doesNotWriteSecondRowForDuplicateBooking() {
        service.handleTicketsIssued(event(99L));
        service.handleTicketsIssued(event(99L)); // duplicate -> deduped

        // Only the first send happened; second was skipped.
        verify(mailSender, times(1)).send(any(SimpleMailMessage.class));
        assertThat(repository.findByBookingId(99L)).hasSize(1);
    }
}
