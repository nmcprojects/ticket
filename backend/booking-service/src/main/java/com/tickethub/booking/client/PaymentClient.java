package com.tickethub.booking.client;

import io.github.resilience4j.circuitbreaker.annotation.CircuitBreaker;
import io.github.resilience4j.retry.annotation.Retry;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import java.math.BigDecimal;
import java.util.HashMap;
import java.util.Map;

/**
 * Synchronous call to payment-service to create a checkout session.
 * Bọc Resilience4j: retry lỗi tạm thời, circuit breaker khi payment-service "chết".
 */
@Slf4j
@Component
public class PaymentClient {

    private final RestClient client;
    private final String internalSecret;

    public PaymentClient(@Value("${tickethub.services.payment-url}") String baseUrl,
                         @Value("${tickethub.internal.secret:tickethub-internal-secret}") String internalSecret) {
        this.client = RestClient.builder().baseUrl(baseUrl).build();
        this.internalSecret = internalSecret;
    }

    public record CheckoutSession(Long paymentId, Long orderCode, String checkoutUrl, String status) {
    }

    @Retry(name = "payment")
    @CircuitBreaker(name = "payment", fallbackMethod = "createCheckoutFallback")
    public CheckoutSession createCheckout(Long bookingId, Long userId, BigDecimal amount,
                                          String description, String returnUrl, String cancelUrl) {
        Map<String, Object> body = new HashMap<>();
        body.put("bookingId", bookingId);
        body.put("userId", userId);
        body.put("amount", amount);
        body.put("description", description);
        body.put("returnUrl", returnUrl);
        body.put("cancelUrl", cancelUrl);

        return client.post()
                .uri("/api/payments")
                .header("Content-Type", "application/json")
                .header("X-Internal-Secret", internalSecret)
                .body(body)
                .retrieve()
                .body(CheckoutSession.class);
    }

    /** Hoàn tiền là bù trừ (compensation) — best-effort: nuốt lỗi, chỉ log. */
    public void refund(Long paymentId) {
        try {
            client.post()
                    .uri("/api/payments/{id}/refund", paymentId)
                    .header("X-Internal-Secret", internalSecret)
                    .retrieve()
                    .toBodilessEntity();
        } catch (Exception e) {
            log.warn("Refund payment={} thất bại (bỏ qua): {}", paymentId, e.getMessage());
        }
    }

    @SuppressWarnings("unused")
    private CheckoutSession createCheckoutFallback(Long bookingId, Long userId, BigDecimal amount,
                                                   String description, String returnUrl, String cancelUrl,
                                                   Throwable t) {
        log.error("Tạo phiên thanh toán cho booking={} thất bại sau retry/circuit-breaker: {}",
                bookingId, t.getMessage());
        throw new PaymentServiceUnavailableException(
                "Không tạo được phiên thanh toán do cổng thanh toán tạm thời gián đoạn. Vui lòng thử lại.", t);
    }
}
