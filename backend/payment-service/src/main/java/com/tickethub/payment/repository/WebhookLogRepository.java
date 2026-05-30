package com.tickethub.payment.repository;

import com.tickethub.payment.domain.PaymentWebhookLog;
import org.springframework.data.jpa.repository.JpaRepository;

public interface WebhookLogRepository extends JpaRepository<PaymentWebhookLog, Long> {
}
