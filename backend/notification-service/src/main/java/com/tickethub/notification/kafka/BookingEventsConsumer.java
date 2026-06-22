package com.tickethub.notification.kafka;

import com.tickethub.common.events.BookingEventMessage;
import com.tickethub.notification.service.NotificationService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;

@Slf4j
@Component
@RequiredArgsConstructor
public class BookingEventsConsumer {

    private final NotificationService notificationService;

    @KafkaListener(
            topics = "${tickethub.kafka.topic.booking-events}",
            groupId = "notification-service",
            properties = {"spring.json.value.default.type=com.tickethub.common.events.BookingEventMessage"})
    public void onBookingMessage(BookingEventMessage msg) {
        if (msg == null || msg.bookingId() == null) return;
        if (!"BookingCancelled".equals(msg.eventType())) return;
        log.info("Received [BookingCancelled] booking={} email={}", msg.bookingId(), msg.customerEmail());
        notificationService.handleBookingCancelled(msg);
    }
}
