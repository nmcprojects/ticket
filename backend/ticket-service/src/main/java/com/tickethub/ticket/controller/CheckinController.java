package com.tickethub.ticket.controller;

import com.tickethub.common.security.CurrentUser;
import com.tickethub.common.security.RequireRole;
import com.tickethub.ticket.client.EventClient;
import com.tickethub.ticket.dto.CheckinLogDto;
import com.tickethub.ticket.dto.CheckinRequest;
import com.tickethub.ticket.dto.CheckinResponse;
import com.tickethub.ticket.service.TicketService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@RestController
@RequestMapping("/api/checkins")
@RequiredArgsConstructor
@RequireRole({"ADMIN", "ORGANIZER", "STAFF"})
public class CheckinController {

    private static final int DEFAULT_LIMIT = 50;
    private static final String FORBIDDEN_MSG = "You do not manage this event.";

    private final TicketService service;
    private final EventClient eventClient;

    /** Perform a check-in (alias of POST /api/tickets/check-in). */
    @PostMapping
    public CheckinResponse checkIn(@Valid @RequestBody CheckinRequest req) {
        return service.checkIn(req);
    }


    @GetMapping
    public List<CheckinLogDto> logs(CurrentUser me,
                                    @RequestParam(required = false) Long eventId,
                                    @RequestParam(defaultValue = "" + DEFAULT_LIMIT) int limit) {
        if (me.isAdmin()) {
            return service.listCheckins(eventId, limit);
        }
        if (eventId != null) {
            if (!eventClient.canManageEvent(eventId, me.id())) {
                throw new ResponseStatusException(HttpStatus.FORBIDDEN, FORBIDDEN_MSG);
            }
            return service.listCheckins(eventId, limit);
        }
        return service.listCheckinsForEvents(eventClient.managedEventIds(me.id()), limit);
    }
}
