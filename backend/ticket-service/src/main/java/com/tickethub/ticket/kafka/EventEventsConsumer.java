package com.tickethub.ticket.kafka;

import com.tickethub.common.events.EventEventMessage;
import com.tickethub.ticket.domain.EventSnapshot;
import com.tickethub.ticket.repository.EventSnapshotRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;

import java.time.Instant;

/**
 * Async consumer: keeps a local snapshot of events in sync so the Ticket
 * Service can issue tickets with snapshot data without calling Event Service.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class EventEventsConsumer {

    private final EventSnapshotRepository snapshotRepository;

    @KafkaListener(
            topics = "${tickethub.kafka.topic.event-events}",
            groupId = "ticket-service",
            properties = {"spring.json.value.default.type=com.tickethub.common.events.EventEventMessage"})
    public void onEventMessage(EventEventMessage message) {
        if (message == null || message.eventId() == null) {
            log.warn("Skipping empty message from event-events");
            return;
        }
        log.info("Received [{}] event={} title='{}'", message.eventType(), message.eventId(), message.title());

        if ("EventDeleted".equals(message.eventType())) {
            snapshotRepository.deleteById(message.eventId());
            return;
        }

        EventSnapshot snap = snapshotRepository.findById(message.eventId()).orElseGet(EventSnapshot::newInstance);
        snap.setEventId(message.eventId());
        snap.setTitle(message.title());
        snap.setStatus(message.status());
        snap.setUpdatedAt(Instant.now());
        snapshotRepository.save(snap);
    }
}
