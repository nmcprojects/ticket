package com.tickethub.payment.service;

import com.tickethub.payment.domain.Payment;
import com.tickethub.payment.domain.PaymentStatus;
import com.tickethub.payment.domain.PaymentWebhookLog;
import com.tickethub.payment.dto.PaymentDtos.*;
import com.tickethub.payment.kafka.PaymentEventPublisher;
import com.tickethub.payment.kafka.PaymentMessage;
import com.tickethub.payment.provider.PayosProvider;
import com.tickethub.payment.provider.SandboxProvider;
import com.tickethub.payment.repository.PaymentRepository;
import com.tickethub.payment.repository.WebhookLogRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;

@Slf4j
@Service
@RequiredArgsConstructor
public class PaymentService {

    private final PaymentRepository paymentRepository;
    private final WebhookLogRepository webhookLogRepository;
    private final PaymentEventPublisher publisher;
    private final SandboxProvider sandboxProvider;
    private final PayosProvider payosProvider;

    @Value("${tickethub.payment.provider}")
    private String configuredProvider;

    @Transactional
    public CreatePaymentResponse create(CreatePaymentRequest req) {
        Payment p = new Payment();
        p.setBookingId(req.bookingId());
        p.setUserId(req.userId());
        p.setAmount(req.amount());
        p.setReturnUrl(req.returnUrl());
        p.setCancelUrl(req.cancelUrl());
        p.setStatus(PaymentStatus.PENDING);
        p = paymentRepository.save(p);
        // PayOS requires a globally-unique numeric orderCode (time-based, collision-checked).
        long oc = System.currentTimeMillis();
        while (paymentRepository.findByOrderCode(oc).isPresent()) oc++;
        p.setOrderCode(oc);

        boolean usePayos = "payos".equalsIgnoreCase(configuredProvider) && payosProvider.isConfigured();
        if ("payos".equalsIgnoreCase(configuredProvider) && !payosProvider.isConfigured()) {
            log.warn("PAYMENT_PROVIDER=payos nhưng thiếu secret -> dùng tạm SANDBOX.");
        }
        var provider = usePayos ? payosProvider : sandboxProvider;
        p.setProvider(provider.name());
        p.setCheckoutUrl(provider.createCheckout(p, req.description()));
        paymentRepository.save(p);

        log.info("Tạo payment {} (order {}) provider={} cho booking {}",
                p.getId(), p.getOrderCode(), p.getProvider(), p.getBookingId());
        return new CreatePaymentResponse(p.getId(), p.getOrderCode(), p.getCheckoutUrl(), p.getStatus());
    }

    /** Sandbox "gateway" callback from the mock pay page. */
    @Transactional
    public PaymentDto sandboxComplete(Long paymentId, String result) {
        Payment p = paymentRepository.findById(paymentId)
                .orElseThrow(() -> new IllegalArgumentException("Payment không tồn tại: " + paymentId));
        log("SANDBOX", p.getId(), result, "sandbox-complete");
        boolean success = !"FAILED".equalsIgnoreCase(result);
        settle(p, success);
        return toDto(p);
    }

    /** Real PayOS webhook. */
    @Transactional
    public void payosWebhook(String rawBody, Long orderCode, boolean success) {
        Payment p = orderCode != null ? paymentRepository.findByOrderCode(orderCode).orElse(null) : null;
        log("PAYOS", p != null ? p.getId() : null, success ? "PAID" : "FAILED", rawBody);
        if (p == null) {
            log.warn("Webhook PayOS không map được orderCode={}", orderCode);
            return;
        }
        settle(p, success);
    }

    private void settle(Payment p, boolean success) {
        if (p.getStatus() == PaymentStatus.SUCCESS || p.getStatus() == PaymentStatus.FAILED) {
            return; // idempotent
        }
        if (success) {
            p.setStatus(PaymentStatus.SUCCESS);
            p.setPaidAt(Instant.now());
            paymentRepository.save(p);
            publisher.publish(new PaymentMessage("PaymentSucceeded", p.getId(), p.getBookingId(), p.getAmount(), Instant.now()));
        } else {
            p.setStatus(PaymentStatus.FAILED);
            p.setFailedAt(Instant.now());
            paymentRepository.save(p);
            publisher.publish(new PaymentMessage("PaymentFailed", p.getId(), p.getBookingId(), p.getAmount(), Instant.now()));
        }
    }

    @Transactional(readOnly = true)
    public PaymentDto get(Long id) {
        return toDto(paymentRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Payment không tồn tại: " + id)));
    }

    /** The id of the user who owns this payment (for ownership checks); null if not found. */
    @Transactional(readOnly = true)
    public Long ownerOf(Long id) {
        return paymentRepository.findById(id).map(Payment::getUserId).orElse(null);
    }

    /** Verify-on-return: asks PayOS for the real status (works without a public webhook). */
    @Transactional
    public PaymentDto verify(Long id) {
        Payment p = paymentRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Payment không tồn tại: " + id));
        if (p.getStatus() == PaymentStatus.PENDING && "PAYOS".equals(p.getProvider()) && p.getOrderCode() != null) {
            try {
                String s = payosProvider.getStatus(p.getOrderCode());
                log("PAYOS", p.getId(), s, "verify");
                if ("PAID".equalsIgnoreCase(s)) settle(p, true);
                else if ("CANCELLED".equalsIgnoreCase(s) || "EXPIRED".equalsIgnoreCase(s)) settle(p, false);
            } catch (Exception e) {
                log.warn("Verify PayOS thất bại cho payment {}: {}", id, e.getMessage());
            }
        }
        return toDto(p);
    }

    /** Refund a paid booking when the organizer cancels it. Idempotent. */
    @Transactional
    public PaymentDto refund(Long id) {
        Payment p = paymentRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Payment không tồn tại: " + id));
        if (p.getStatus() == PaymentStatus.REFUNDED) {
            return toDto(p); // idempotent
        }
        p.setStatus(PaymentStatus.REFUNDED);
        p.setRefundedAt(Instant.now());
        paymentRepository.save(p);
        publisher.publish(new PaymentMessage("PaymentRefunded", p.getId(), p.getBookingId(), p.getAmount(), Instant.now()));
        return toDto(p);
    }

    private void log(String provider, Long paymentId, String eventType, String payload) {
        PaymentWebhookLog l = new PaymentWebhookLog();
        l.setProvider(provider);
        l.setPaymentId(paymentId);
        l.setEventType(eventType);
        l.setRawPayload(payload);
        l.setProcessed(true);
        webhookLogRepository.save(l);
    }

    private PaymentDto toDto(Payment p) {
        return new PaymentDto(p.getId(), p.getBookingId(), p.getOrderCode(), p.getAmount(),
                p.getProvider(), p.getCheckoutUrl(), p.getStatus(), p.getPaidAt());
    }
}
