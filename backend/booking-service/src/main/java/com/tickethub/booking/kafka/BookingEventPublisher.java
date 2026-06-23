package com.tickethub.booking.kafka;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.kafka.clients.admin.NewTopic;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.kafka.config.TopicBuilder;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Component;

@Slf4j
@Component
@RequiredArgsConstructor
public class BookingEventPublisher {

    private final KafkaTemplate<String, Object> kafkaTemplate;

    @Value("${tickethub.kafka.topic.booking-events}")
    private String topic;

    public void publish(BookingMessage message) {
        kafkaTemplate.send(topic, String.valueOf(message.bookingId()), message);
        log.info("Đã publish [{}] booking={} -> {}", message.eventType(), message.bookingId(), topic);
    }

    @Configuration
    static class Topics {
        @Bean
        public NewTopic bookingEventsTopic(@Value("${tickethub.kafka.topic.booking-events}") String topic) {
            return TopicBuilder.name(topic).partitions(1).replicas(1).build();
        }
    }
}
