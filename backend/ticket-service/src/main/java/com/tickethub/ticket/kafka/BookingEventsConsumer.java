package com.tickethub.ticket.kafka;

import com.tickethub.common.events.BookingEventMessage;
import com.tickethub.common.events.TicketsIssuedEventMessage;
import com.tickethub.ticket.domain.ProcessedEvent;
import com.tickethub.ticket.dto.IssueRequest;
import com.tickethub.ticket.dto.TicketDto;
import com.tickethub.ticket.repository.ProcessedEventRepository;
import com.tickethub.ticket.service.TicketService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

/** On BookingPaid: issue one ticket per quantity for every booking item. */
@Slf4j
@Component
@RequiredArgsConstructor
public class BookingEventsConsumer {

    private final TicketService ticketService;
    private final ProcessedEventRepository processedRepository;
    private final TicketEventPublisher publisher;

    @KafkaListener(
            topics = "${tickethub.kafka.topic.booking-events}",
            groupId = "ticket-service",
            properties = {"spring.json.value.default.type=com.tickethub.common.events.BookingEventMessage"})
    @Transactional
    public void onBookingMessage(BookingEventMessage msg) {
        if (msg == null || msg.bookingId() == null) return;
        if (!"BookingPaid".equals(msg.eventType())) return;
        log.info("Received [BookingPaid] booking={} ({} ticket types)", msg.bookingId(),
                msg.items() == null ? 0 : msg.items().size());

        // Idempotency: ProcessedEvent written in the SAME transaction as issuance.
        // If the key already exists, the DB unique constraint prevents duplicate processing.
        String dedupKey = "booking-paid-" + msg.bookingId();
        if (alreadyProcessed(dedupKey)) {
            log.info("Skipping: booking {} already processed", msg.bookingId());
            return;
        }

        if (msg.items() == null) return;
        List<String> codes = new ArrayList<>();
        for (BookingEventMessage.Item it : msg.items()) {
            List<TicketDto> issued = ticketService.issue(new IssueRequest(
                    msg.bookingId(), null, msg.userId(), msg.customerEmail(),
                    msg.eventId(), msg.eventTitle(), it.ticketTypeId(), it.ticketTypeName(),
                    it.quantity()));
            issued.forEach(t -> codes.add(t.ticketCode()));
        }

        // Aggregated issuance -> notification-service sends one email per order.
        publisher.publishIssuedAfterCommit(new TicketsIssuedEventMessage(
                "TicketIssued", msg.bookingId(), msg.userId(), msg.customerEmail(),
                msg.eventId(), msg.eventTitle(), codes, Instant.now()));
    }

    private boolean alreadyProcessed(String key) {
        if (processedRepository.existsById(key)) return true;
        processedRepository.save(new ProcessedEvent(key));
        return false;
    }
}
