package com.tickethub.ticket.kafka;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

@Slf4j
@Component
@RequiredArgsConstructor
public class TicketEventPublisher {

    private final KafkaTemplate<String, Object> kafkaTemplate;

    @Value("${tickethub.kafka.topic.ticket-issued-events}")
    private String issuedTopic;

    /** Aggregated "TicketIssued" per booking — consumed by notification-service.
     *  Published after transaction commit. */
    public void publishIssuedAfterCommit(com.tickethub.common.events.TicketsIssuedEventMessage message) {
        doAfterCommit(() -> {
            kafkaTemplate.send(issuedTopic, String.valueOf(message.bookingId()), message);
            log.info("Published [TicketIssued] booking={} ({} tickets) -> {}",
                    message.bookingId(), message.ticketCodes().size(), issuedTopic);
        });
    }

    private void doAfterCommit(Runnable action) {
        if (TransactionSynchronizationManager.isActualTransactionActive()) {
            TransactionSynchronizationManager.registerSynchronization(
                    new TransactionSynchronization() {
                        @Override
                        public void afterCommit() {
                            action.run();
                        }
                    });
        } else {
            // No active transaction — send immediately
            action.run();
        }
    }
}
