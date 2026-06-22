package com.tickethub.notification.service;

import com.tickethub.common.events.TicketsIssuedEventMessage;
import com.tickethub.notification.domain.EmailNotification;
import com.tickethub.notification.repository.EmailNotificationRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

/**
 * Pure Mockito unit tests for {@link NotificationService}. These NEVER open an SMTP
 * connection — {@link JavaMailSender} is always a Mockito mock — and never touch Kafka,
 * Postgres, Eureka or any running Docker stack.
 */
@ExtendWith(MockitoExtension.class)
class NotificationServiceTest {

    @Mock
    private EmailNotificationRepository repository;

    @Mock
    private ObjectProvider<JavaMailSender> mailSenderProvider;

    @Mock
    private JavaMailSender mailSender;

    private NotificationService service;

    @Captor
    private ArgumentCaptor<SimpleMailMessage> mailCaptor;

    @Captor
    private ArgumentCaptor<EmailNotification> notificationCaptor;

    @BeforeEach
    void setUp() {
        service = new NotificationService(repository, mailSenderProvider, new NotificationTemplate(),
                true, "techtok.support@gmail.com");
    }

    private TicketsIssuedEventMessage sampleEvent() {
        return new TicketsIssuedEventMessage(
                "TicketIssued",
                42L,
                7L,
                "customer@example.com",
                100L,
                "Coldplay Live",
                List.of("TK-AAA", "TK-BBB"),
                Instant.parse("2026-06-14T10:00:00Z"));
    }

    /** Simulate DB assigning an ID on save. */
    private void stubSave() {
        when(repository.save(any(EmailNotification.class))).thenAnswer(invocation -> {
            EmailNotification n = invocation.getArgument(0);
            if (n.getId() == null) n.setId(1L);
            return n;
        });
    }

    @Test
    void sendsEmailToCustomerWithEventInfo_whenMailEnabled() {
        doReturn(mailSender).when(mailSenderProvider).getIfAvailable();
        when(repository.findByDedupKey("TICKET_ISSUED-42")).thenReturn(Optional.empty());
        stubSave();

        service.handleTicketsIssued(sampleEvent());

        verify(mailSender, times(1)).send(mailCaptor.capture());
        SimpleMailMessage mail = mailCaptor.getValue();
        assertThat(mail.getTo()).containsExactly("customer@example.com");
        assertThat(mail.getFrom()).isEqualTo("techtok.support@gmail.com");
        assertThat(mail.getSubject()).contains("Coldplay Live");
        assertThat(mail.getText())
                .contains("Coldplay Live")
                .contains("TK-AAA")
                .contains("TK-BBB");

        verify(repository).save(notificationCaptor.capture());
        EmailNotification saved = notificationCaptor.getValue();
        assertThat(saved.getStatus()).isEqualTo(EmailNotification.Status.PENDING);
        assertThat(saved.getRecipientEmail()).isEqualTo("customer@example.com");
        assertThat(saved.getBookingId()).isEqualTo(42L);
    }

    @Test
    void doesNotSendEmail_whenMailDisabled() {
        service = new NotificationService(repository, mailSenderProvider, new NotificationTemplate(),
                false, "techtok.support@gmail.com");
        when(repository.findByDedupKey("TICKET_ISSUED-42")).thenReturn(Optional.empty());

        service.handleTicketsIssued(sampleEvent());

        // Mail disabled: sender must never be resolved nor invoked.
        verifyNoInteractions(mailSender);
        verify(mailSenderProvider, never()).getIfAvailable();

        // Still logged, as LOG provider (demo mode).
        verify(repository).save(notificationCaptor.capture());
        EmailNotification saved = notificationCaptor.getValue();
        assertThat(saved.getStatus()).isEqualTo(EmailNotification.Status.PENDING);
    }

    @Test
    void skipsDuplicateBooking_idempotent() {
        EmailNotification existing = new EmailNotification();
        existing.setBookingId(42L);
        existing.setDedupKey("TICKET_ISSUED-42");
        existing.setStatus(EmailNotification.Status.SENT);
        when(repository.findByDedupKey("TICKET_ISSUED-42")).thenReturn(Optional.of(existing));

        service.handleTicketsIssued(sampleEvent());

        // Already-sent booking: no email, no new row.
        verifyNoInteractions(mailSender);
        verify(mailSenderProvider, never()).getIfAvailable();
        verify(repository, never()).save(any());
    }
}
