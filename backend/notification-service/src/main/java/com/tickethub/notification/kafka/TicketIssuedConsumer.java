package com.tickethub.notification.kafka;

import com.tickethub.common.events.TicketsIssuedEventMessage;
import com.tickethub.notification.service.NotificationService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;

@Slf4j
@Component
@RequiredArgsConstructor
public class TicketIssuedConsumer {

    private final NotificationService notificationService;

    @KafkaListener(
            topics = "${tickethub.kafka.topic.ticket-issued-events}",
            groupId = "notification-service",
            properties = {"spring.json.value.default.type=com.tickethub.common.events.TicketsIssuedEventMessage"})
    public void onTicketsIssued(TicketsIssuedEventMessage msg) {
        if (msg == null || !"TicketIssued".equals(msg.eventType())) return;
        log.info("Received [TicketIssued] booking={} email={}", msg.bookingId(), msg.customerEmail());
        notificationService.handleTicketsIssued(msg);
    }
}
