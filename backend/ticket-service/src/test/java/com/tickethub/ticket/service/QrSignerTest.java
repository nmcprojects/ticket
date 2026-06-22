package com.tickethub.ticket.service;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class QrSignerTest {

    private final QrSigner signer = new QrSigner("test-secret-123");

    @Test
    void signAndVerify_roundTrip_ok() {
        String code = "TICKET-ABCD-1234";
        String signed = signer.sign(code);

        assertThat(signed).isNotBlank();
        assertThat(signed).contains(":");

        String verified = signer.verify(signed);
        assertThat(verified).isEqualTo(code);
    }

    @Test
    void verify_tamperedPayload_throws() {
        String code = "TICKET-ABCD-1234";
        String signed = signer.sign(code);
        String tampered = signed.substring(0, signed.length() - 2) + "XX";

        assertThatThrownBy(() -> signer.verify(tampered))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("signature mismatch");
    }

    @Test
    void verify_plainText_throws() {
        assertThatThrownBy(() -> signer.verify("TICKET-ABCD-1234"))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Invalid QR payload format");
    }

    @Test
    void verify_differentSecret_throws() {
        String code = "TICKET-ABCD-1234";
        String signed = signer.sign(code);

        QrSigner other = new QrSigner("different-secret");
        assertThatThrownBy(() -> other.verify(signed))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("signature mismatch");
    }
}
