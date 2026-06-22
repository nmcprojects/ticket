package com.tickethub.ticket.controller;

import com.tickethub.common.security.CurrentUser;
import com.tickethub.common.security.RequireRole;
import com.tickethub.ticket.client.EventClient;
import com.tickethub.ticket.dto.*;
import com.tickethub.ticket.service.TicketService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@RestController
@RequestMapping("/api/tickets")
@RequiredArgsConstructor
public class TicketController {

    private static final int DEFAULT_PAGE_SIZE = 20;
    private static final int MAX_PAGE_SIZE = 100;
    private static final String FORBIDDEN_MSG = "You do not manage this event.";

    private final TicketService service;
    private final EventClient eventClient;

    /**
     * Customers may only ever list their OWN tickets (forced to their id). Staff must scope to an
     * event they manage; admins may filter freely.
     */
    @GetMapping
    @RequireRole
    public Page<TicketDto> list(CurrentUser me,
                                @RequestParam(value = "userId", required = false) Long userId,
                                @RequestParam(required = false) Long eventId,
                                @RequestParam(required = false) Long bookingId,
                                @RequestParam(defaultValue = "0") int page,
                                @RequestParam(defaultValue = "" + DEFAULT_PAGE_SIZE) int size) {
        if (size > MAX_PAGE_SIZE) size = MAX_PAGE_SIZE;
        if (eventId != null) {
            requireEventAccess(me, eventId);
            return service.findAllPaginated(null, eventId, null, PageRequest.of(page, size));
        }
        if (me.isAdmin()) {
            return service.findAllPaginated(userId, null, bookingId, PageRequest.of(page, size));
        }
        return service.findAllPaginated(me.id(), null, null, PageRequest.of(page, size)); // default: caller's own tickets only
    }

    /** Business figures for an event — the event's organization (or an admin) only. */
    @GetMapping("/stats")
    @RequireRole({"ADMIN", "ORGANIZER", "STAFF"})
    public TicketStatsDto stats(CurrentUser me, @RequestParam Long eventId) {
        requireEventAccess(me, eventId);
        return service.statsForEvent(eventId);
    }

    private void requireEventAccess(CurrentUser me, Long eventId) {
        if (me.isAdmin()) return;
        if (eventId == null || !eventClient.canManageEvent(eventId, me.id())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, FORBIDDEN_MSG);
        }
    }

    @GetMapping("/{id}")
    @RequireRole
    public TicketDto get(CurrentUser me, @PathVariable Long id) {
        TicketDto t = service.findById(id);
        me.requireOwnerOrStaff(t.userId());
        return t;
    }

    @PostMapping
    @RequireRole({"ADMIN", "ORGANIZER", "STAFF"})
    public ResponseEntity<TicketDto> create(@Valid @RequestBody TicketRequest req) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.create(req));
    }

    @PostMapping("/issue")
    @RequireRole({"ADMIN", "ORGANIZER", "STAFF"})
    public ResponseEntity<List<TicketDto>> issue(@Valid @RequestBody IssueRequest req) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.issue(req));
    }

    @PutMapping("/{id}")
    @RequireRole({"ADMIN", "ORGANIZER", "STAFF"})
    public TicketDto update(@PathVariable Long id, @Valid @RequestBody TicketRequest req) {
        return service.update(id, req);
    }

    @DeleteMapping("/{id}")
    @RequireRole({"ADMIN", "ORGANIZER", "STAFF"})
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        service.delete(id);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/check-in")
    @RequireRole({"ADMIN", "ORGANIZER", "STAFF"})
    public CheckinResponse checkIn(@Valid @RequestBody CheckinRequest req) {
        return service.checkIn(req);
    }

    /** Internal compensation call (booking-service) or staff/admin. */
    @PostMapping("/void")
    @RequireRole({"INTERNAL", "ADMIN", "ORGANIZER", "STAFF"})
    public VoidResult voidByBooking(@Valid @RequestBody VoidBookingRequest req) {
        int voided = service.voidByBooking(req.bookingId());
        return new VoidResult(voided);
    }
}
