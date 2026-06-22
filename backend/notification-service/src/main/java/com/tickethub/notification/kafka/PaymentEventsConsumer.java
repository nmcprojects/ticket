package com.tickethub.notification.kafka;

import com.tickethub.common.events.PaymentEventMessage;
import com.tickethub.notification.service.NotificationService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;

@Slf4j
@Component
@RequiredArgsConstructor
public class PaymentEventsConsumer {

    private final NotificationService notificationService;

    @KafkaListener(
            topics = "${tickethub.kafka.topic.payment-events}",
            groupId = "notification-service",
            properties = {"spring.json.value.default.type=com.tickethub.common.events.PaymentEventMessage"})
    public void onPaymentMessage(PaymentEventMessage msg) {
        if (msg == null || msg.paymentId() == null) return;

        switch (msg.eventType()) {
            case "PaymentFailed" -> {
                log.info("Received [PaymentFailed] payment={} booking={}", msg.paymentId(), msg.bookingId());
                notificationService.handlePaymentFailed(msg);
            }
            case "PaymentRefunded" -> {
                log.info("Received [PaymentRefunded] payment={} booking={}", msg.paymentId(), msg.bookingId());
                notificationService.handlePaymentRefunded(msg);
            }
            default -> {
                // PaymentSucceeded is handled by booking-service; ignore here.
            }
        }
    }
}
