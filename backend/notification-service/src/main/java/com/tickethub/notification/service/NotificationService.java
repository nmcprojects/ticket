package com.tickethub.notification.service;

import com.tickethub.common.events.BookingEventMessage;
import com.tickethub.common.events.PaymentEventMessage;
import com.tickethub.common.events.TicketsIssuedEventMessage;
import com.tickethub.notification.domain.EmailNotification;
import com.tickethub.notification.domain.NotificationType;
import com.tickethub.notification.repository.EmailNotificationRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@Slf4j
@Service
public class NotificationService {

    private final EmailNotificationRepository repository;
    private final ObjectProvider<JavaMailSender> mailSenderProvider;
    private final NotificationTemplate template;
    private final boolean mailEnabled;
    private final String from;

    public NotificationService(EmailNotificationRepository repository,
                               ObjectProvider<JavaMailSender> mailSenderProvider,
                               NotificationTemplate template,
                               @Value("${tickethub.mail.enabled}") boolean mailEnabled,
                               @Value("${tickethub.mail.from}") String from) {
        this.repository = repository;
        this.mailSenderProvider = mailSenderProvider;
        this.template = template;
        this.mailEnabled = mailEnabled;
        this.from = from;
    }

    // ── Ticket Issued ───────────────────────────────────────────
    public void handleTicketsIssued(TicketsIssuedEventMessage msg) {
        if (msg.bookingId() == null) return;
        String dedupKey = dedupKey(NotificationType.TICKET_ISSUED, msg.bookingId());
        List<String> codes = msg.ticketCodes() == null ? List.of() : msg.ticketCodes();
        NotificationTemplate.Content c = template.render(NotificationType.TICKET_ISSUED, Map.of(
                "eventTitle", msg.eventTitle(),
                "ticketCodes", codes
        ));

        Long id = getOrCreateNotification(dedupKey, msg.userId(), msg.bookingId(), null,
                msg.customerEmail(), NotificationType.TICKET_ISSUED,
                c.subject(), c.body(), String.join(",", codes));
        if (id == null) return;

        sendSmtp(id, dedupKey, msg.customerEmail(), c.subject(), c.body());
    }

    // ── Booking Cancelled ───────────────────────────────────────
    public void handleBookingCancelled(BookingEventMessage msg) {
        if (msg.bookingId() == null) return;
        String dedupKey = dedupKey(NotificationType.BOOKING_CANCELLED, msg.bookingId());
        NotificationTemplate.Content c = template.render(NotificationType.BOOKING_CANCELLED, Map.of(
                "eventTitle", msg.eventTitle(),
                "reason", "theo yeu cau"
        ));

        Long id = getOrCreateNotification(dedupKey, msg.userId(), msg.bookingId(), null,
                msg.customerEmail(), NotificationType.BOOKING_CANCELLED,
                c.subject(), c.body(), null);
        if (id == null) return;

        sendSmtp(id, dedupKey, msg.customerEmail(), c.subject(), c.body());
    }

    // ── Payment Failed ──────────────────────────────────────────
    public void handlePaymentFailed(PaymentEventMessage msg) {
        if (msg.paymentId() == null) return;
        String dedupKey = dedupKey(NotificationType.PAYMENT_FAILED, msg.paymentId());
        NotificationTemplate.Content c = template.render(NotificationType.PAYMENT_FAILED, Map.of(
                "amount", msg.amount(),
                "eventTitle", "TicketHub",
                "reason", "thanh toan that bai"
        ));

        // NOTE: PaymentEventMessage does not carry userId / customerEmail.
        // A real hub would look these up by bookingId; here we record the event without email.
        Long id = getOrCreateNotification(dedupKey, null, msg.bookingId(), msg.paymentId(),
                null, NotificationType.PAYMENT_FAILED,
                c.subject(), c.body(), null);
        if (id == null) return;

        sendSmtp(id, dedupKey, null, c.subject(), c.body());
    }

    // ── Payment Refunded ────────────────────────────────────────
    public void handlePaymentRefunded(PaymentEventMessage msg) {
        if (msg.paymentId() == null) return;
        String dedupKey = dedupKey(NotificationType.PAYMENT_REFUNDED, msg.paymentId());
        NotificationTemplate.Content c = template.render(NotificationType.PAYMENT_REFUNDED, Map.of(
                "amount", msg.amount(),
                "eventTitle", "TicketHub"
        ));

        // NOTE: PaymentEventMessage does not carry userId / customerEmail.
        Long id = getOrCreateNotification(dedupKey, null, msg.bookingId(), msg.paymentId(),
                null, NotificationType.PAYMENT_REFUNDED,
                c.subject(), c.body(), null);
        if (id == null) return;

        sendSmtp(id, dedupKey, null, c.subject(), c.body());
    }

    // ── Helpers ─────────────────────────────────────────────────

    private String dedupKey(NotificationType type, Long referenceId) {
        return type.name() + "-" + referenceId;
    }

    /**
     * Get an existing notification for retry, or create a new one.
     * Returns null if the notification was already successfully sent (or logged).
     */
    private Long getOrCreateNotification(String dedupKey, Long userId, Long bookingId, Long paymentId,
                                         String email, NotificationType type,
                                         String subject, String body, String ticketCodes) {
        Optional<EmailNotification> existing = repository.findByDedupKey(dedupKey);
        if (existing.isPresent()) {
            EmailNotification n = existing.get();
            if (n.getStatus() == EmailNotification.Status.SENT || n.getStatus() == EmailNotification.Status.LOGGED) {
                log.info("{} already processed ({}), skipping", dedupKey, n.getStatus());
                return null;
            }
            // Retry: reset to pending so we can attempt delivery again.
            n.setStatus(EmailNotification.Status.PENDING);
            n.setErrorMessage(null);
            n.setSubject(subject);
            n.setContent(body);
            n.setRecipientEmail(email);
            n.setTicketCodes(ticketCodes);
            return repository.save(n).getId();
        }
        return savePending(userId, bookingId, paymentId, dedupKey, email, type, subject, body, ticketCodes);
    }

    @Transactional
    public Long savePending(Long userId, Long bookingId, Long paymentId, String dedupKey,
                            String email, NotificationType type, String subject, String body,
                            String ticketCodes) {
        EmailNotification n = new EmailNotification();
        n.setUserId(userId);
        n.setBookingId(bookingId);
        n.setPaymentId(paymentId);
        n.setDedupKey(dedupKey);
        n.setRecipientEmail(email);
        n.setNotificationType(type);
        n.setSubject(subject);
        n.setContent(body);
        n.setTicketCodes(ticketCodes);
        n.setStatus(EmailNotification.Status.PENDING);
        repository.save(n);
        return n.getId();
    }

    private void sendSmtp(Long notificationId, String dedupKey, String email,
                          String subject, String body) {
        JavaMailSender sender = mailEnabled ? mailSenderProvider.getIfAvailable() : null;
        if (sender != null && email != null && !email.isBlank()) {
            try {
                SimpleMailMessage mail = new SimpleMailMessage();
                mail.setFrom(from);
                mail.setTo(email);
                mail.setSubject(subject);
                mail.setText(body);
                sender.send(mail);
                markSent(notificationId);
                log.info("Sent {} to {}", dedupKey, email);
            } catch (Exception e) {
                markFailed(notificationId, e.getMessage());
                log.error("Failed to send email {}: {}", dedupKey, e.getMessage());
                throw new RuntimeException(e); // propagate to Kafka for retry
            }
        } else {
            markLogged(notificationId);
            log.info("[EMAIL-LOG] {} | To: {} | {}", dedupKey, email, subject);
        }
    }

    @Transactional
    public void markSent(Long id) {
        repository.findById(id).ifPresent(n -> {
            n.setProvider("SMTP");
            n.setStatus(EmailNotification.Status.SENT);
            n.setSentAt(Instant.now());
            repository.save(n);
        });
    }

    @Transactional
    public void markLogged(Long id) {
        repository.findById(id).ifPresent(n -> {
            n.setProvider("LOG");
            n.setStatus(EmailNotification.Status.LOGGED);
            n.setSentAt(Instant.now());
            repository.save(n);
        });
    }

    @Transactional
    public void markFailed(Long id, String error) {
        repository.findById(id).ifPresent(n -> {
            n.setProvider("SMTP");
            n.setStatus(EmailNotification.Status.FAILED);
            n.setErrorMessage(error);
            repository.save(n);
        });
    }
}
