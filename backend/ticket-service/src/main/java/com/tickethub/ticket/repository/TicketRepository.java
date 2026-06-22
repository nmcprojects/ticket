package com.tickethub.ticket.repository;

import com.tickethub.ticket.domain.Ticket;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

public interface TicketRepository extends JpaRepository<Ticket, Long> {
    Optional<Ticket> findByTicketCode(String ticketCode);
    List<Ticket> findByUserId(Long userId);
    List<Ticket> findByEventId(Long eventId);
    List<Ticket> findByBookingId(Long bookingId);

    Page<Ticket> findByUserId(Long userId, Pageable pageable);
    Page<Ticket> findByEventId(Long eventId, Pageable pageable);
    Page<Ticket> findByBookingId(Long bookingId, Pageable pageable);

    /**
     * Atomic conditional update: only succeeds when the ticket is still ISSUED.
     * Returns the number of rows updated (0 or 1).
     */
    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query("UPDATE Ticket t SET t.status = 'CHECKED_IN', t.checkedInAt = :checkedInAt " +
           "WHERE t.ticketCode = :ticketCode AND t.status = 'ISSUED'")
    int updateStatusToCheckedIn(@Param("ticketCode") String ticketCode,
                                @Param("checkedInAt") Instant checkedInAt);

    /**
     * COUNT per status for a given event — replaces in-memory stream-counting.
     */
    @Query("SELECT t.status, COUNT(t) FROM Ticket t WHERE t.eventId = :eventId GROUP BY t.status")
    List<Object[]> countByEventIdGroupByStatus(@Param("eventId") Long eventId);

    /**
     * Bulk void: cancel all ISSUED tickets for a booking in one query.
     */
    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query("UPDATE Ticket t SET t.status = 'CANCELLED' WHERE t.bookingId = :bookingId AND t.status = 'ISSUED'")
    int voidIssuedByBookingId(@Param("bookingId") Long bookingId);
}
