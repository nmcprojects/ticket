package com.tickethub.payment.repository;

import com.tickethub.payment.domain.Payment;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface PaymentRepository extends JpaRepository<Payment, Long> {
    Optional<Payment> findByOrderCode(Long orderCode);
    Optional<Payment> findFirstByBookingIdOrderByIdDesc(Long bookingId);
}
