package com.tickethub.payment.provider;

import com.tickethub.payment.domain.Payment;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

/**
 * Simulated gateway used until real PayOS credentials are provided.
 * The checkout URL points to a mock payment page in the frontend that calls
 * POST /api/payments/{id}/sandbox-complete to finish the flow.
 */
@Component
public class SandboxProvider implements PaymentProvider {

    private final String frontendUrl;

    public SandboxProvider(@Value("${tickethub.frontend-url}") String frontendUrl) {
        this.frontendUrl = frontendUrl;
    }

    @Override
    public String name() {
        return "SANDBOX";
    }

    @Override
    public String createCheckout(Payment payment, String description) {
        return frontendUrl + "/pay/" + payment.getId();
    }
}
