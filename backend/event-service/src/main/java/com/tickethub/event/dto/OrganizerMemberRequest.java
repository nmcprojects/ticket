package com.tickethub.event.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

/** Add/update a member: email of an EXISTING system user + the role to assign. */
public record OrganizerMemberRequest(
        @NotBlank @Email String email,
        @NotNull Long roleId
) {
}
