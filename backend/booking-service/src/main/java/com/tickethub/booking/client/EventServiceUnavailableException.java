package com.tickethub.booking.client;

/**
 * Ném ra khi event-service không phản hồi sau khi đã retry và circuit breaker đã mở.
 * Cho phép BookingService bù trừ (release) và trả lỗi rõ ràng cho người dùng.
 */
public class EventServiceUnavailableException extends RuntimeException {
    public EventServiceUnavailableException(String message, Throwable cause) {
        super(message, cause);
    }
}
