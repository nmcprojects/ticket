package com.tickethub.booking.client;

/**
 * Ném ra khi payment-service không phản hồi sau khi đã retry và circuit breaker đã mở.
 * Cho phép BookingService bù trừ (release vé đã giữ) và trả lỗi rõ ràng cho người dùng.
 */
public class PaymentServiceUnavailableException extends RuntimeException {
    public PaymentServiceUnavailableException(String message, Throwable cause) {
        super(message, cause);
    }
}
