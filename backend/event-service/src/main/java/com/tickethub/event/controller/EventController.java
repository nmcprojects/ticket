package com.tickethub.event.controller;

import com.tickethub.common.security.CurrentUser;
import com.tickethub.common.security.RequireRole;
import com.tickethub.event.domain.EventStatus;
import com.tickethub.event.dto.EventDto;
import com.tickethub.event.dto.EventRequest;
import com.tickethub.event.dto.TicketTypeDto;
import com.tickethub.event.dto.TicketTypeRequest;
import com.tickethub.event.exception.ForbiddenException;
import com.tickethub.event.service.EventService;
import com.tickethub.event.service.OrganizerService;
import com.tickethub.event.service.TicketTypeService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/events")
@RequiredArgsConstructor
public class EventController {

    private final EventService eventService;
    private final TicketTypeService ticketTypeService;
    private final OrganizerService organizerService;

    @GetMapping
    public List<EventDto> list(@RequestParam(required = false) EventStatus status,
                               @RequestParam(required = false) Long organizerId) {
        return eventService.findAll(status, organizerId);
    }

    @GetMapping("/{id}")
    public EventDto get(@PathVariable Long id) {
        return eventService.findById(id);
    }

    /** Business figures (revenue, sold) — the event's organizer or an admin only. */
    @GetMapping("/{id}/stats")
    @RequireRole
    public com.tickethub.event.dto.EventStatsDto stats(CurrentUser me, @PathVariable Long id) {
        assertCanManage(id, me);
        return eventService.stats(id);
    }

    /**
     * Internal endpoint: does {@code userId} manage (own or belong to the org of) this event?
     * Called by booking/ticket services to enforce per-event ownership on their own endpoints.
     */
    @GetMapping("/{id}/access")
    @RequireRole("INTERNAL")
    public java.util.Map<String, Boolean> access(@PathVariable Long id, @RequestParam Long userId) {
        Long orgId = eventService.get(id).getOrganizer().getId();
        return java.util.Map.of("canManage", organizerService.userManagesOrg(userId, orgId));
    }

    /** Internal: ids of all events the given user manages (their org's events). */
    @GetMapping("/managed-ids")
    @RequireRole("INTERNAL")
    public List<Long> managedIds(@RequestParam Long userId) {
        return eventService.idsByOrganizers(organizerService.orgIdsForUser(userId));
    }

    /** Creates an event under the LOGGED-IN user's organization. */
    @PostMapping
    @RequireRole
    public ResponseEntity<EventDto> create(CurrentUser me, @Valid @RequestBody EventRequest req) {
        Long organizerId = organizerService.resolveOrgIdForUser(me.id(), me.email());
        return ResponseEntity.status(HttpStatus.CREATED).body(eventService.create(req, organizerId));
    }

    @PutMapping("/{id}")
    @RequireRole
    public EventDto update(CurrentUser me, @PathVariable Long id, @Valid @RequestBody EventRequest req) {
        assertCanManage(id, me);
        return eventService.update(id, req);
    }

    @DeleteMapping("/{id}")
    @RequireRole
    public ResponseEntity<Void> delete(CurrentUser me, @PathVariable Long id) {
        assertCanManage(id, me);
        eventService.delete(id);
        return ResponseEntity.noContent().build();
    }

    // ── Nested ticket types ─────────────────────────────────────
    @GetMapping("/{id}/ticket-types")
    public List<TicketTypeDto> ticketTypes(@PathVariable Long id) {
        return ticketTypeService.findByEvent(id);
    }

    @PostMapping("/{id}/ticket-types")
    @RequireRole
    public ResponseEntity<TicketTypeDto> addTicketType(CurrentUser me, @PathVariable Long id,
                                                       @Valid @RequestBody TicketTypeRequest req) {
        assertCanManage(id, me);
        return ResponseEntity.status(HttpStatus.CREATED).body(ticketTypeService.create(id, req));
    }

    /**
     * Per-event ownership: admins (and trusted internal calls) may manage any event; otherwise the
     * caller must own the organization the event belongs to. Authentication itself is already
     * guaranteed by {@code @RequireRole} (so {@code me} is never null here).
     */
    private void assertCanManage(Long eventId, CurrentUser me) {
        if (me.isAdmin() || me.isInternal()) return;
        Long eventOrgId = eventService.get(eventId).getOrganizer().getId();
        Long userOrgId = organizerService.findOrgIdForUser(me.id()).orElse(null);
        if (userOrgId == null || !userOrgId.equals(eventOrgId)) {
            throw new ForbiddenException("Bạn không có quyền quản lý sự kiện này.");
        }
    }
}
