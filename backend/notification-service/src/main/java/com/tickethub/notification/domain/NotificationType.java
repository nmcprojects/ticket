package com.tickethub.notification.domain;

public enum NotificationType {
    TICKET_ISSUED,      // "Here are your tickets"
    BOOKING_CANCELLED,  // "Booking cancelled / refunded"
    PAYMENT_FAILED,     // "Payment failed, retry"
    PAYMENT_REFUNDED    // "Refund processed"
}
