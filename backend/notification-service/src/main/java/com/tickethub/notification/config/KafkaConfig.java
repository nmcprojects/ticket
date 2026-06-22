package com.tickethub.notification.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.kafka.listener.DeadLetterPublishingRecoverer;
import org.springframework.kafka.listener.DefaultErrorHandler;
import org.springframework.util.backoff.FixedBackOff;

/**
 * Kafka consumer error handling: after 3 retries (3s apart), poison messages
 * are published to the DLT (e.g. ticket-issued-events.DLT) so the partition
 * is not blocked and the bad message can be inspected later.
 */
@Configuration
public class KafkaConfig {

    private static final long BACK_OFF_INTERVAL_MS = 3000L;
    private static final long MAX_RETRIES = 3L;

    @Bean
    DefaultErrorHandler defaultErrorHandler(KafkaTemplate<String, Object> kafkaTemplate) {
        DeadLetterPublishingRecoverer recoverer = new DeadLetterPublishingRecoverer(kafkaTemplate);
        FixedBackOff backOff = new FixedBackOff(BACK_OFF_INTERVAL_MS, MAX_RETRIES);
        DefaultErrorHandler handler = new DefaultErrorHandler(recoverer, backOff);
        handler.addNotRetryableExceptions(IllegalArgumentException.class);
        return handler;
    }
}
