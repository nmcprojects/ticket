package com.tickethub.booking.controller;

import com.tickethub.booking.client.EventClient;
import com.tickethub.booking.dto.BookingDtos.*;
import com.tickethub.booking.service.BookingService;
import com.tickethub.common.security.CurrentUser;
import com.tickethub.common.security.RequireRole;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@RestController
@RequestMapping("/api/bookings")
@RequiredArgsConstructor
public class BookingController {

    private final BookingService service;
    private final EventClient eventClient;

    @PostMapping
    @RequireRole // any authenticated user
    public ResponseEntity<CreateBookingResponse> create(CurrentUser me, @Valid @RequestBody CreateBookingRequest req) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.create(me.id(), me.email(), req));
    }

    @GetMapping("/mine")
    @RequireRole
    public List<BookingDto> mine(CurrentUser me) {
        return service.byUser(me.id());
    }

    /** Buyer list for an event — only the organization that owns the event (or an admin). */
    @GetMapping(params = "eventId")
    @RequireRole({"ADMIN", "ORGANIZER", "STAFF"})
    public List<BookingDto> byEvent(CurrentUser me, @RequestParam Long eventId) {
        if (!me.isAdmin() && !eventClient.canManageEvent(eventId, me.id())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Bạn không quản lý sự kiện này.");
        }
        return service.byEvent(eventId);
    }

    @GetMapping("/{id}")
    @RequireRole
    public BookingDto get(CurrentUser me, @PathVariable Long id) {
        BookingDto b = service.get(id);
        me.requireOwnerOrStaff(b.userId());
        return b;
    }

    @PostMapping("/{id}/cancel")
    @RequireRole
    public BookingDto cancel(CurrentUser me, @PathVariable Long id) {
        me.requireOwnerOrStaff(service.get(id).userId());
        return service.cancel(id);
    }
}
