package com.tickethub.event.controller;

import com.tickethub.event.domain.OrgPermission;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Arrays;
import java.util.List;

/** The fixed catalog of permissions organizations can compose into custom roles. */
@RestController
@RequestMapping("/api/organizers/permissions")
public class PermissionController {

    public record PermissionDto(String key, String label) {
    }

    @GetMapping
    public List<PermissionDto> list() {
        return Arrays.stream(OrgPermission.values())
                .map(p -> new PermissionDto(p.name(), p.label))
                .toList();
    }
}
