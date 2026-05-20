package com.tickethub.booking.repository;

import com.tickethub.booking.domain.Booking;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface BookingRepository extends JpaRepository<Booking, Long> {
    List<Booking> findByUserIdOrderByIdDesc(Long userId);

    List<Booking> findByEventIdOrderByIdDesc(Long eventId);
}
