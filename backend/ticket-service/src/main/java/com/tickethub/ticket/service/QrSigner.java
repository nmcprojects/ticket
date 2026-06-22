package com.tickethub.ticket.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.util.Base64;

/**
 * Signs and verifies QR payloads using HMAC-SHA256.
 *
 * <p>The payload format is compact and URL-safe:
 * <pre>base64(ticketCode) + ":" + base64(signature)</pre>
 *
 * <p>This makes the QR tamper-proof: a forged code will fail verification.
 * It also enables offline check-in (verify signature without a DB round-trip;
 * DB is only needed to mark "already used").
 */
@Component
public class QrSigner {

    private static final String ALGORITHM = "HmacSHA256";
    private static final Base64.Encoder B64_ENC = Base64.getUrlEncoder().withoutPadding();
    private static final Base64.Decoder B64_DEC = Base64.getUrlDecoder();

    private final String secret;

    public QrSigner(@Value("${tickethub.qr.secret}") String secret) {
        this.secret = secret;
    }

    /** Sign a ticket code and return the compact signed payload. */
    public String sign(String ticketCode) {
        try {
            String payload = B64_ENC.encodeToString(ticketCode.getBytes(StandardCharsets.UTF_8));
            String sig = signature(ticketCode);
            return payload + ":" + sig;
        } catch (Exception e) {
            throw new RuntimeException("Failed to sign QR payload", e);
        }
    }

    /**
     * Verify a signed QR payload.
     *
     * @return the original ticketCode if valid
     * @throws IllegalArgumentException if format is invalid or signature doesn't match
     */
    public String verify(String signedPayload) {
        if (signedPayload == null || !signedPayload.contains(":")) {
            throw new IllegalArgumentException("Invalid QR payload format");
        }
        String[] parts = signedPayload.split(":", 2);
        if (parts.length != 2) {
            throw new IllegalArgumentException("Invalid QR payload format");
        }

        try {
            String ticketCode = new String(B64_DEC.decode(parts[0]), StandardCharsets.UTF_8);
            String expectedSig = signature(ticketCode);
            if (!constantTimeEquals(parts[1], expectedSig)) {
                throw new IllegalArgumentException("QR signature mismatch");
            }
            return ticketCode;
        } catch (IllegalArgumentException e) {
            throw e;
        } catch (Exception e) {
            throw new IllegalArgumentException("Failed to verify QR payload", e);
        }
    }

    private String signature(String ticketCode) throws Exception {
        Mac mac = Mac.getInstance(ALGORITHM);
        mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), ALGORITHM));
        byte[] sig = mac.doFinal(ticketCode.getBytes(StandardCharsets.UTF_8));
        return B64_ENC.encodeToString(sig);
    }

    /** Constant-time comparison to prevent timing attacks. */
    private boolean constantTimeEquals(String a, String b) {
        byte[] ba = a.getBytes(StandardCharsets.UTF_8);
        byte[] bb = b.getBytes(StandardCharsets.UTF_8);
        if (ba.length != bb.length) return false;
        int result = 0;
        for (int i = 0; i < ba.length; i++) {
            result |= ba[i] ^ bb[i];
        }
        return result == 0;
    }
}
