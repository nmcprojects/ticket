package com.tickethub.payment.provider;

import com.tickethub.payment.domain.Payment;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.util.Map;

/**
 * Real PayOS integration (https://payos.vn/docs/checkout).
 * Activated when tickethub.payment.provider=payos AND credentials are set.
 */
@Slf4j
@Component
public class PayosProvider implements PaymentProvider {

    // PayOS sits behind Cloudflare which blocks default Java/SDK user agents.
    private static final String UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

    private final String clientId;
    private final String apiKey;
    private final String checksumKey;
    private final String createUrl;
    private final RestClient http = RestClient.builder()
            .defaultHeader(HttpHeaders.USER_AGENT, UA)
            .build();

    public PayosProvider(
            @Value("${tickethub.payment.payos.client-id}") String clientId,
            @Value("${tickethub.payment.payos.api-key}") String apiKey,
            @Value("${tickethub.payment.payos.checksum-key}") String checksumKey,
            @Value("${tickethub.payment.payos.create-url}") String createUrl) {
        this.clientId = clientId;
        this.apiKey = apiKey;
        this.checksumKey = checksumKey;
        this.createUrl = createUrl;
    }

    @Override
    public String name() {
        return "PAYOS";
    }

    public boolean isConfigured() {
        return !clientId.isBlank() && !apiKey.isBlank() && !checksumKey.isBlank();
    }

    @Override
    @SuppressWarnings("unchecked")
    public String createCheckout(Payment payment, String description) {
        long orderCode = payment.getOrderCode();
        long amount = payment.getAmount().longValue();
        String desc = description != null ? description : ("Booking " + payment.getBookingId());
        String returnUrl = payment.getReturnUrl();
        String cancelUrl = payment.getCancelUrl();

        // PayOS requires HMAC_SHA256 over alphabetically-sorted key=value pairs.
        String data = "amount=" + amount
                + "&cancelUrl=" + cancelUrl
                + "&description=" + desc
                + "&orderCode=" + orderCode
                + "&returnUrl=" + returnUrl;
        String signature = hmacSha256(data, checksumKey);

        Map<String, Object> body = Map.of(
                "orderCode", orderCode,
                "amount", amount,
                "description", desc,
                "returnUrl", returnUrl,
                "cancelUrl", cancelUrl,
                "signature", signature
        );

        Map<String, Object> resp = http.post()
                .uri(createUrl)
                .header("x-client-id", clientId)
                .header("x-api-key", apiKey)
                .header("Content-Type", "application/json")
                .body(body)
                .retrieve()
                .body(Map.class);

        if (resp == null || !"00".equals(String.valueOf(resp.get("code")))) {
            throw new IllegalStateException("PayOS từ chối tạo link: " + resp);
        }
        Map<String, Object> respData = (Map<String, Object>) resp.get("data");
        return String.valueOf(respData.get("checkoutUrl"));
    }

    /** Query PayOS for the real status of an order (PAID / PENDING / CANCELLED / EXPIRED). */
    @SuppressWarnings("unchecked")
    public String getStatus(long orderCode) {
        Map<String, Object> resp = http.get()
                .uri(createUrl + "/" + orderCode)
                .header("x-client-id", clientId)
                .header("x-api-key", apiKey)
                .retrieve()
                .body(Map.class);
        if (resp == null) return "PENDING";
        Map<String, Object> data = (Map<String, Object>) resp.get("data");
        if (data == null) return "PENDING";
        return String.valueOf(data.get("status"));
    }

    public static String hmacSha256(String data, String key) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(key.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            byte[] raw = mac.doFinal(data.getBytes(StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder();
            for (byte b : raw) sb.append(String.format("%02x", b));
            return sb.toString();
        } catch (Exception e) {
            throw new IllegalStateException("HMAC error", e);
        }
    }
}
