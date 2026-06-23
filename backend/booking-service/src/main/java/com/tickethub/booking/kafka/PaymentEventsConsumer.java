package com.tickethub.booking.kafka;

import com.tickethub.booking.service.BookingService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;

@Slf4j
@Component
@RequiredArgsConstructor
public class PaymentEventsConsumer {

    private final BookingService bookingService;

    @KafkaListener(topics = "${tickethub.kafka.topic.payment-events}", groupId = "booking-service")
    public void onPaymentMessage(IncomingPaymentMessage msg) {
        if (msg == null || msg.bookingId() == null) return;
        log.info("Nhận [{}] payment={} booking={}", msg.eventType(), msg.paymentId(), msg.bookingId());
        if ("PaymentSucceeded".equals(msg.eventType())) {
            bookingService.onPaymentSucceeded(msg.paymentId(), msg.bookingId());
        } else if ("PaymentFailed".equals(msg.eventType())) {
            bookingService.onPaymentFailed(msg.paymentId(), msg.bookingId());
        }
    }
}
