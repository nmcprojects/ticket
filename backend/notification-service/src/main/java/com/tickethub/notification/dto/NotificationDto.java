package com.tickethub.notification.dto;

import java.time.Instant;

public record NotificationDto(
    Long id,
    Long userId,
    Long bookingId,
    Long paymentId,
    String recipientEmail,
    String subject,
    String notificationType,
    String status,
    String provider,
    Instant sentAt,
    Instant createdAt
) {}
