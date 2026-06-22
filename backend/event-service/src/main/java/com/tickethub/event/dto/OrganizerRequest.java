package com.tickethub.event.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;

public record OrganizerRequest(
        Long authUserId,
        @NotBlank String organizationName,
        @Email String contactEmail,
        String contactPhone,
        String description,
        String avatarUrl,
        Boolean verified
) {
}
