package com.tickethub.ticket.kafka;

import org.apache.kafka.clients.admin.NewTopic;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.kafka.config.TopicBuilder;

@Configuration
public class KafkaTopicConfig {

    private static final int PARTITIONS = 1;
    private static final int REPLICAS = 1;

    @Bean
    public NewTopic ticketIssuedEventsTopic(@Value("${tickethub.kafka.topic.ticket-issued-events}") String topic) {
        return TopicBuilder.name(topic).partitions(PARTITIONS).replicas(REPLICAS).build();
    }
}
