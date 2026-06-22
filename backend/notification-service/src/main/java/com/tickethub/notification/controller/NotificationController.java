package com.tickethub.notification.controller;

import com.tickethub.notification.domain.EmailNotification;
import com.tickethub.notification.dto.NotificationDto;
import com.tickethub.notification.repository.EmailNotificationRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/notifications")
@RequiredArgsConstructor
public class NotificationController {

    private final EmailNotificationRepository repository;

    @GetMapping
    public List<NotificationDto> recent() {
        return repository.findTop50ByOrderByIdDesc().stream()
                .map(this::toDto)
                .toList();
    }

    private NotificationDto toDto(EmailNotification n) {
        return new NotificationDto(
                n.getId(),
                n.getUserId(),
                n.getBookingId(),
                n.getPaymentId(),
                n.getRecipientEmail(),
                n.getSubject(),
                n.getNotificationType() != null ? n.getNotificationType().name() : null,
                n.getStatus() != null ? n.getStatus().name() : null,
                n.getProvider(),
                n.getSentAt(),
                n.getCreatedAt()
        );
    }
}
