package com.tickethub.ticket.service;

import com.tickethub.ticket.domain.*;
import com.tickethub.ticket.dto.*;
import com.tickethub.ticket.exception.NotFoundException;
import com.tickethub.ticket.kafka.TicketEventPublisher;
import com.tickethub.ticket.repository.CheckinLogRepository;
import com.tickethub.ticket.repository.EventSnapshotRepository;
import com.tickethub.ticket.repository.TicketRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

import static com.tickethub.ticket.dto.TicketMapper.toDto;

@Service
@RequiredArgsConstructor
public class TicketService {

    private static final SecureRandom RANDOM = new SecureRandom();
    private static final String ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

    private final TicketRepository ticketRepository;
    private final CheckinLogRepository checkinLogRepository;
    private final EventSnapshotRepository snapshotRepository;
    private final TicketEventPublisher publisher;
    private final QrSigner qrSigner;

    // ── Queries ─────────────────────────────────────────────────
    @Transactional(readOnly = true)
    public List<TicketDto> findAll(Long userId, Long eventId, Long bookingId) {
        List<Ticket> list;
        if (userId != null) list = ticketRepository.findByUserId(userId);
        else if (eventId != null) list = ticketRepository.findByEventId(eventId);
        else if (bookingId != null) list = ticketRepository.findByBookingId(bookingId);
        else list = ticketRepository.findAll();
        return list.stream().map(TicketMapper::toDto).toList();
    }

    @Transactional(readOnly = true)
    public Page<TicketDto> findAllPaginated(Long userId, Long eventId, Long bookingId, Pageable pageable) {
        Page<Ticket> page;
        if (userId != null) page = ticketRepository.findByUserId(userId, pageable);
        else if (eventId != null) page = ticketRepository.findByEventId(eventId, pageable);
        else if (bookingId != null) page = ticketRepository.findByBookingId(bookingId, pageable);
        else page = ticketRepository.findAll(pageable);
        return page.map(TicketMapper::toDto);
    }

    @Transactional(readOnly = true)
    public TicketDto findById(Long id) {
        return toDto(get(id));
    }

    @Transactional(readOnly = true)
    public TicketStatsDto statsForEvent(Long eventId) {
        List<Object[]> rows = ticketRepository.countByEventIdGroupByStatus(eventId);
        long issued = 0, checkedIn = 0, cancelled = 0;
        for (Object[] row : rows) {
            TicketStatus status = (TicketStatus) row[0];
            long count = (Long) row[1];
            switch (status) {
                case ISSUED -> issued = count;
                case CHECKED_IN -> checkedIn = count;
                case CANCELLED -> cancelled = count;
            }
        }
        long total = issued + checkedIn + cancelled;
        int pct = total == 0 ? 0 : Math.round(checkedIn * 100f / total);
        return new TicketStatsDto(eventId, total, issued, checkedIn, cancelled, pct);
    }

    @Transactional(readOnly = true)
    public Ticket get(Long id) {
        return ticketRepository.findById(id).orElseThrow(() -> NotFoundException.of("Ticket", id));
    }

    // ── Create / Issue ──────────────────────────────────────────
    @Transactional
    public TicketDto create(TicketRequest req) {
        Ticket t = newTicket(req.bookingId(), req.bookingItemId(), req.userId(), req.customerEmail(),
                req.eventId(), req.eventTitle(), req.ticketTypeId(), req.ticketTypeName());
        if (req.status() != null) t.setStatus(req.status());
        Ticket saved = ticketRepository.save(t);
        return toDto(saved);
    }

    @Transactional
    public List<TicketDto> issue(IssueRequest req) {
        List<TicketDto> result = new ArrayList<>();
        for (int i = 0; i < req.quantity(); i++) {
            Ticket t = newTicket(req.bookingId(), req.bookingItemId(), req.userId(), req.customerEmail(),
                    req.eventId(), req.eventTitle(), req.ticketTypeId(), req.ticketTypeName());
            Ticket saved = ticketRepository.save(t);
            result.add(toDto(saved));
        }
        return result;
    }

    @Transactional
    public TicketDto update(Long id, TicketRequest req) {
        Ticket t = get(id);
        t.setCustomerEmail(req.customerEmail());
        if (req.eventTitle() != null) t.setEventTitle(req.eventTitle());
        if (req.ticketTypeName() != null) t.setTicketTypeName(req.ticketTypeName());
        if (req.status() != null) t.setStatus(req.status());
        return toDto(ticketRepository.save(t));
    }

    @Transactional
    public void delete(Long id) {
        if (!ticketRepository.existsById(id)) throw NotFoundException.of("Ticket", id);
        ticketRepository.deleteById(id);
    }

    // ── Check-in ────────────────────────────────────────────────
    @Transactional
    public CheckinResponse checkIn(CheckinRequest req) {
        String raw = req.ticketCode().trim();

        // Verify QR signature (tamper-proof). Falls back to plain ticketCode
        // if the payload isn't signed (e.g. manual entry, old tickets).
        String code;
        try {
            code = qrSigner.verify(raw);
        } catch (IllegalArgumentException e) {
            code = raw; // plain ticket code
        }

        // Atomic conditional update: only succeeds if status is still ISSUED.
        // This prevents the race where two simultaneous scans both pass the gate.
        int updated = ticketRepository.updateStatusToCheckedIn(code, Instant.now());

        Ticket ticket = ticketRepository.findByTicketCode(code).orElse(null);
        CheckinResult result;
        String message;

        if (updated == 1) {
            // We won the race — ticket was ISSUED and is now CHECKED_IN.
            result = CheckinResult.VALID;
            message = "Check-in successful.";
        } else if (ticket == null) {
            result = CheckinResult.INVALID_TICKET;
            message = "Ticket code not found.";
        } else if (ticket.getStatus() == TicketStatus.CHECKED_IN) {
            result = CheckinResult.ALREADY_CHECKED_IN;
            message = "Ticket already checked in at " + ticket.getCheckedInAt();
        } else if (ticket.getStatus() == TicketStatus.CANCELLED) {
            result = CheckinResult.CANCELLED_TICKET;
            message = "Ticket has been cancelled.";
        } else {
            // Fallback — shouldn't normally reach here.
            result = CheckinResult.ALREADY_CHECKED_IN;
            message = "Ticket already checked in.";
        }

        CheckinLog log = CheckinLog.newInstance();
        log.setTicketId(ticket != null ? ticket.getId() : null);
        log.setTicketCode(code);
        log.setStaffId(req.staffId());
        log.setEventId(ticket != null ? ticket.getEventId() : null);
        log.setResult(result);
        log.setMessage(message);
        checkinLogRepository.save(log);

        return new CheckinResponse(result, message, ticket != null ? toDto(ticket) : null);
    }

    // ── Void / Cancel ───────────────────────────────────────────
    @Transactional
    public int voidByBooking(Long bookingId) {
        return ticketRepository.voidIssuedByBookingId(bookingId);
    }

    @Transactional(readOnly = true)
    public List<CheckinLogDto> listCheckins(Long eventId, int limit) {
        List<CheckinLog> logs = (eventId != null)
                ? checkinLogRepository.findByEventIdOrderByCheckedInAtDesc(eventId)
                : checkinLogRepository.findAllByOrderByCheckedInAtDesc(PageRequest.of(0, limit));
        return logs.stream().map(TicketMapper::toDto).toList();
    }

    /** Check-in logs across a specific set of events (used to scope an organizer to their own events). */
    @Transactional(readOnly = true)
    public List<CheckinLogDto> listCheckinsForEvents(java.util.Collection<Long> eventIds, int limit) {
        if (eventIds == null || eventIds.isEmpty()) return List.of();
        return checkinLogRepository.findByEventIdInOrderByCheckedInAtDesc(eventIds, PageRequest.of(0, limit))
                .stream().map(TicketMapper::toDto).toList();
    }

    // ── Helpers ─────────────────────────────────────────────────
    private Ticket newTicket(Long bookingId, Long bookingItemId, Long userId, String email,
                             Long eventId, String eventTitle, Long ticketTypeId, String ticketTypeName) {
        Ticket t = Ticket.newInstance();
        t.setBookingId(bookingId);
        t.setBookingItemId(bookingItemId);
        t.setUserId(userId);
        t.setCustomerEmail(email);
        t.setEventId(eventId);
        t.setEventTitle(eventTitle != null ? eventTitle : resolveEventTitle(eventId));
        t.setTicketTypeId(ticketTypeId);
        t.setTicketTypeName(ticketTypeName);
        String code = generateCode();
        t.setTicketCode(code);
        t.setQrPayload(qrSigner.sign(code));
        t.setStatus(TicketStatus.ISSUED);
        t.setIssuedAt(Instant.now());
        return t;
    }

    private String resolveEventTitle(Long eventId) {
        if (eventId == null) return null;
        return snapshotRepository.findById(eventId).map(EventSnapshot::getTitle).orElse(null);
    }

    private String generateCode() {
        String code;
        do {
            StringBuilder sb = new StringBuilder("TICKET-");
            for (int i = 0; i < 8; i++) {
                if (i == 4) sb.append('-');
                sb.append(ALPHABET.charAt(RANDOM.nextInt(ALPHABET.length())));
            }
            code = sb.toString();
        } while (ticketRepository.findByTicketCode(code).isPresent());
        return code;
    }
}
