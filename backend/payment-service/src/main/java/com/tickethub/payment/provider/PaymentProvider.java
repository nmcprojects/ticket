package com.tickethub.payment.provider;

import com.tickethub.payment.domain.Payment;

public interface PaymentProvider {
    /** Provider id, e.g. SANDBOX / PAYOS. */
    String name();

    /** Create a checkout session and return the URL the user should be sent to. */
    String createCheckout(Payment payment, String description);
}
