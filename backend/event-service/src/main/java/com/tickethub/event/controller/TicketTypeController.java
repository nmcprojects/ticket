package com.tickethub.event.controller;

import com.tickethub.common.security.RequireRole;
import com.tickethub.event.dto.InventoryRequest;
import com.tickethub.event.dto.TicketTypeDto;
import com.tickethub.event.dto.TicketTypeRequest;
import com.tickethub.event.service.TicketTypeService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/ticket-types")
@RequiredArgsConstructor
public class TicketTypeController {

    private final TicketTypeService service;

    @GetMapping("/{id}")
    public TicketTypeDto get(@PathVariable Long id) {
        return service.findById(id);
    }

    @PutMapping("/{id}")
    @RequireRole({"ADMIN", "ORGANIZER", "STAFF"})
    public TicketTypeDto update(@PathVariable Long id, @Valid @RequestBody TicketTypeRequest req) {
        return service.update(id, req);
    }

    @DeleteMapping("/{id}")
    @RequireRole({"ADMIN", "ORGANIZER", "STAFF"})
    public void delete(@PathVariable Long id) {
        service.delete(id);
    }

    // ── Inventory (reserve / confirm / release / refund) — internal saga calls only ──
    @PostMapping("/{id}/reserve")
    @RequireRole("INTERNAL")
    public TicketTypeDto reserve(@PathVariable Long id, @Valid @RequestBody InventoryRequest req) {
        return service.reserve(id, req.quantity());
    }

    @PostMapping("/{id}/confirm")
    @RequireRole("INTERNAL")
    public TicketTypeDto confirm(@PathVariable Long id, @Valid @RequestBody InventoryRequest req) {
        return service.confirm(id, req.quantity());
    }

    @PostMapping("/{id}/release")
    @RequireRole("INTERNAL")
    public TicketTypeDto release(@PathVariable Long id, @Valid @RequestBody InventoryRequest req) {
        return service.release(id, req.quantity());
    }

    @PostMapping("/{id}/refund")
    @RequireRole("INTERNAL")
    public TicketTypeDto refund(@PathVariable Long id, @Valid @RequestBody InventoryRequest req) {
        return service.refund(id, req.quantity());
    }
}
