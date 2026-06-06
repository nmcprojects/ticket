package com.tickethub.payment.provider;

import org.junit.jupiter.api.Test;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Pure unit tests for the PayOS HMAC-SHA256 checksum helper.
 * No Spring context, no network — only the deterministic crypto.
 */
class PayosSignatureTest {

    /** Known-answer vector: HmacSHA256("amount=10000&...&returnUrl=...", key) is stable. */
    @Test
    void hmacSha256_isDeterministic_forKnownInputs() throws Exception {
        String data = "amount=10000"
                + "&cancelUrl=http://c"
                + "&description=Booking 42"
                + "&orderCode=1700000000000"
                + "&returnUrl=http://r";
        String key = "secret-checksum-key";

        String sig = PayosProvider.hmacSha256(data, key);

        // Hex, lowercase, 64 chars (SHA-256 -> 32 bytes).
        assertThat(sig).hasSize(64).matches("[0-9a-f]{64}");

        // Same inputs -> same signature (deterministic).
        assertThat(PayosProvider.hmacSha256(data, key)).isEqualTo(sig);

        // Matches an independent JDK Mac computation (cross-check, not self-reference).
        Mac mac = Mac.getInstance("HmacSHA256");
        mac.init(new SecretKeySpec(key.getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
        byte[] raw = mac.doFinal(data.getBytes(StandardCharsets.UTF_8));
        StringBuilder expected = new StringBuilder();
        for (byte b : raw) expected.append(String.format("%02x", b));
        assertThat(sig).isEqualTo(expected.toString());
    }

    /** Different key or different data yields a different signature. */
    @Test
    void hmacSha256_differsForDifferentKeyOrData() {
        String data = "orderCode=1&amount=100";
        String a = PayosProvider.hmacSha256(data, "key-A");
        String b = PayosProvider.hmacSha256(data, "key-B");
        String c = PayosProvider.hmacSha256("orderCode=2&amount=100", "key-A");

        assertThat(a).isNotEqualTo(b);
        assertThat(a).isNotEqualTo(c);
    }
}
