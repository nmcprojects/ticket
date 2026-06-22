package com.tickethub.notification.repository;

import com.tickethub.notification.domain.EmailNotification;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface EmailNotificationRepository extends JpaRepository<EmailNotification, Long> {
    List<EmailNotification> findByBookingId(Long bookingId);
    List<EmailNotification> findTop50ByOrderByIdDesc();
    boolean existsByDedupKey(String dedupKey);
    Optional<EmailNotification> findByDedupKey(String dedupKey);
}
