package com.tickethub.payment.service;

import com.tickethub.payment.domain.Payment;
import com.tickethub.payment.domain.PaymentStatus;
import com.tickethub.payment.dto.PaymentDtos.CreatePaymentRequest;
import com.tickethub.payment.dto.PaymentDtos.CreatePaymentResponse;
import com.tickethub.payment.dto.PaymentDtos.PaymentDto;
import com.tickethub.payment.kafka.PaymentEventPublisher;
import com.tickethub.payment.kafka.PaymentMessage;
import com.tickethub.payment.provider.PayosProvider;
import com.tickethub.payment.provider.SandboxProvider;
import com.tickethub.payment.repository.PaymentRepository;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.math.BigDecimal;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;

/**
 * Integration tests for the sandbox payment flow.
 * - Real Spring context + Testcontainers Postgres for the persistence path.
 * - Kafka publisher is mocked so no broker is contacted.
 * - Provider is forced to 'sandbox' so PayOS / network is never touched.
 */
@SpringBootTest
@Testcontainers
class PaymentServiceSandboxTest {

    @Container
    static final PostgreSQLContainer<?> POSTGRES =
            new PostgreSQLContainer<>("postgres:16-alpine");

    @DynamicPropertySource
    static void props(DynamicPropertyRegistry r) {
        r.add("spring.datasource.url", POSTGRES::getJdbcUrl);
        r.add("spring.datasource.username", POSTGRES::getUsername);
        r.add("spring.datasource.password", POSTGRES::getPassword);
        r.add("spring.jpa.hibernate.ddl-auto", () -> "create-drop");
        // Force sandbox provider — never reach PayOS.
        r.add("tickethub.payment.provider", () -> "sandbox");
        r.add("tickethub.frontend-url", () -> "http://frontend.test");
        // No Eureka, no Kafka broker.
        r.add("eureka.client.enabled", () -> "false");
        r.add("eureka.client.register-with-eureka", () -> "false");
        r.add("eureka.client.fetch-registry", () -> "false");
        r.add("spring.autoconfigure.exclude",
                () -> "org.springframework.boot.autoconfigure.kafka.KafkaAutoConfiguration");
    }

    @MockBean
    PaymentEventPublisher publisher;

    @Autowired
    PaymentService service;

    @Autowired
    PaymentRepository paymentRepository;

    @Autowired
    SandboxProvider sandboxProvider;

    @Autowired
    PayosProvider payosProvider;

    private CreatePaymentRequest req(long bookingId, long amount) {
        return new CreatePaymentRequest(
                bookingId, 7L, BigDecimal.valueOf(amount),
                "Test booking", "http://ret", "http://cancel");
    }

    /** 1. With provider=sandbox, create() selects the SandboxProvider strategy. */
    @Test
    void create_usesSandboxProvider_whenConfiguredSandbox() {
        CreatePaymentResponse resp = service.create(req(1001L, 50000));

        Payment saved = paymentRepository.findById(resp.paymentId()).orElseThrow();
        assertThat(saved.getProvider()).isEqualTo("SANDBOX");
        assertThat(saved.getProvider()).isEqualTo(sandboxProvider.name());
        // PayOS bean exists but must not have been used for the checkout URL.
        assertThat(saved.getCheckoutUrl()).doesNotContain("payos");
    }

    /** 2. Sandbox checkout returns a frontend mock-pay URL and a usable session shape. */
    @Test
    void create_returnsSandboxCheckoutUrlAndOrderCode() {
        CreatePaymentResponse resp = service.create(req(1002L, 75000));

        assertThat(resp.paymentId()).isNotNull();
        assertThat(resp.orderCode()).isNotNull();
        assertThat(resp.status()).isEqualTo(PaymentStatus.PENDING);
        assertThat(resp.checkoutUrl()).isNotNull();
        // Sandbox URL points at the frontend mock pay page: <frontend>/pay/<id>
        assertThat(resp.checkoutUrl())
                .startsWith("http://frontend.test/pay/")
                .endsWith("/pay/" + resp.paymentId());
        // And the SandboxProvider produces the same shape directly.
        Payment p = paymentRepository.findById(resp.paymentId()).orElseThrow();
        assertThat(sandboxProvider.createCheckout(p, "desc"))
                .isEqualTo("http://frontend.test/pay/" + p.getId());
    }

    /** 3a. sandboxComplete(SUCCESS): SUCCESS status, paidAt set, PaymentSucceeded published. */
    @Test
    void sandboxComplete_success_marksSuccessAndPublishesSucceeded() {
        CreatePaymentResponse created = service.create(req(2001L, 120000));

        PaymentDto dto = service.sandboxComplete(created.paymentId(), "SUCCESS");

        assertThat(dto.status()).isEqualTo(PaymentStatus.SUCCESS);
        Payment p = paymentRepository.findById(created.paymentId()).orElseThrow();
        assertThat(p.getStatus()).isEqualTo(PaymentStatus.SUCCESS);
        assertThat(p.getPaidAt()).isNotNull();
        assertThat(p.getFailedAt()).isNull();

        ArgumentCaptor<PaymentMessage> cap = ArgumentCaptor.forClass(PaymentMessage.class);
        verify(publisher, times(1)).publish(cap.capture());
        PaymentMessage msg = cap.getValue();
        assertThat(msg.eventType()).isEqualTo("PaymentSucceeded");
        assertThat(msg.bookingId()).isEqualTo(2001L);
        assertThat(msg.paymentId()).isEqualTo(created.paymentId());
        assertThat(msg.amount()).isEqualByComparingTo(BigDecimal.valueOf(120000));
    }

    /** 3b. sandboxComplete(FAILED): FAILED status, failedAt set, PaymentFailed published. */
    @Test
    void sandboxComplete_failed_marksFailedAndPublishesFailed() {
        CreatePaymentResponse created = service.create(req(2002L, 99000));

        PaymentDto dto = service.sandboxComplete(created.paymentId(), "FAILED");

        assertThat(dto.status()).isEqualTo(PaymentStatus.FAILED);
        Payment p = paymentRepository.findById(created.paymentId()).orElseThrow();
        assertThat(p.getStatus()).isEqualTo(PaymentStatus.FAILED);
        assertThat(p.getFailedAt()).isNotNull();
        assertThat(p.getPaidAt()).isNull();

        ArgumentCaptor<PaymentMessage> cap = ArgumentCaptor.forClass(PaymentMessage.class);
        verify(publisher, times(1)).publish(cap.capture());
        PaymentMessage msg = cap.getValue();
        assertThat(msg.eventType()).isEqualTo("PaymentFailed");
        assertThat(msg.bookingId()).isEqualTo(2002L);
    }

    /** 3c. settle is idempotent: a second completion does not re-publish. */
    @Test
    void sandboxComplete_isIdempotent_noSecondPublish() {
        CreatePaymentResponse created = service.create(req(2003L, 10000));

        service.sandboxComplete(created.paymentId(), "SUCCESS");
        service.sandboxComplete(created.paymentId(), "SUCCESS");

        // Only the first completion publishes.
        verify(publisher, times(1)).publish(org.mockito.ArgumentMatchers.any());
    }

    /** Guard: creating a payment alone publishes nothing to Kafka. */
    @Test
    void create_doesNotPublish() {
        service.create(req(3001L, 5000));
        verifyNoInteractions(publisher);
    }
}
