package com.tickethub.event.kafka;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Component;

@Slf4j
@Component
@RequiredArgsConstructor
public class EventEventPublisher {

    private final KafkaTemplate<String, Object> kafkaTemplate;

    @Value("${tickethub.kafka.topic.event-events}")
    private String topic;

    public void publish(EventMessage message) {
        kafkaTemplate.send(topic, String.valueOf(message.eventId()), message)
                .whenComplete((res, ex) -> {
                    if (ex != null) {
                        log.error("Không gửi được message {} cho event {}: {}",
                                message.eventType(), message.eventId(), ex.getMessage());
                    } else {
                        log.info("Đã publish [{}] event={} title='{}' -> topic {}",
                                message.eventType(), message.eventId(), message.title(), topic);
                    }
                });
    }
}
