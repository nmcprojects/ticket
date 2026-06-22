package com.tickethub.event.controller;

import com.tickethub.common.security.CurrentUser;
import com.tickethub.common.security.RequireRole;
import com.tickethub.event.dto.OrganizerDto;
import com.tickethub.event.dto.OrganizerMemberDto;
import com.tickethub.event.dto.OrganizerMemberRequest;
import com.tickethub.event.dto.OrganizerRequest;
import com.tickethub.event.dto.OrganizerRoleDto;
import com.tickethub.event.dto.OrganizerRoleRequest;
import com.tickethub.event.service.OrganizerService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/organizers")
@RequiredArgsConstructor
public class OrganizerController {

    private final OrganizerService service;

    @GetMapping
    public List<OrganizerDto> list() {
        return service.findAll();
    }

    /** The logged-in user's own organization (auto-created on first access). */
    @GetMapping("/me")
    @RequireRole
    public OrganizerDto me(CurrentUser me) {
        return service.findOrCreateForUser(me.id(), me.email());
    }

    @PutMapping("/me")
    @RequireRole
    public OrganizerDto updateMe(CurrentUser me, @Valid @RequestBody OrganizerRequest req) {
        return service.updateForUser(me.id(), me.email(), req);
    }

    // ── Members (team / check-in staff) of the logged-in user's org ──
    @GetMapping("/me/members")
    @RequireRole
    public List<OrganizerMemberDto> myMembers(CurrentUser me) {
        return service.listMembers(me.id(), me.email());
    }

    @PostMapping("/me/members")
    @RequireRole
    public ResponseEntity<OrganizerMemberDto> addMember(CurrentUser me, @Valid @RequestBody OrganizerMemberRequest req) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.addMember(me.id(), me.email(), req));
    }

    @PutMapping("/me/members/{memberId}")
    @RequireRole
    public OrganizerMemberDto updateMember(CurrentUser me, @PathVariable Long memberId,
                                           @Valid @RequestBody OrganizerMemberRequest req) {
        return service.updateMember(me.id(), me.email(), memberId, req);
    }

    @DeleteMapping("/me/members/{memberId}")
    @RequireRole
    public ResponseEntity<Void> removeMember(CurrentUser me, @PathVariable Long memberId) {
        service.removeMember(me.id(), me.email(), memberId);
        return ResponseEntity.noContent().build();
    }

    // ── Roles of the logged-in user's org (each = a set of permissions) ──
    @GetMapping("/me/roles")
    @RequireRole
    public List<OrganizerRoleDto> myRoles(CurrentUser me) {
        return service.listRoles(me.id(), me.email());
    }

    @PostMapping("/me/roles")
    @RequireRole
    public ResponseEntity<OrganizerRoleDto> addRole(CurrentUser me, @Valid @RequestBody OrganizerRoleRequest req) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.addRole(me.id(), me.email(), req));
    }

    @PutMapping("/me/roles/{roleId}")
    @RequireRole
    public OrganizerRoleDto updateRole(CurrentUser me, @PathVariable Long roleId,
                                       @Valid @RequestBody OrganizerRoleRequest req) {
        return service.updateRole(me.id(), me.email(), roleId, req);
    }

    @DeleteMapping("/me/roles/{roleId}")
    @RequireRole
    public ResponseEntity<Void> deleteRole(CurrentUser me, @PathVariable Long roleId) {
        service.deleteRole(me.id(), me.email(), roleId);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/{id}")
    public OrganizerDto get(@PathVariable Long id) {
        return service.findById(id);
    }

    // ── Platform-admin CRUD on arbitrary organizations ──
    @PostMapping
    @RequireRole("ADMIN")
    public ResponseEntity<OrganizerDto> create(@Valid @RequestBody OrganizerRequest req) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.create(req));
    }

    @PutMapping("/{id}")
    @RequireRole("ADMIN")
    public OrganizerDto update(@PathVariable Long id, @Valid @RequestBody OrganizerRequest req) {
        return service.update(id, req);
    }

    @DeleteMapping("/{id}")
    @RequireRole("ADMIN")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        service.delete(id);
        return ResponseEntity.noContent().build();
    }
}
