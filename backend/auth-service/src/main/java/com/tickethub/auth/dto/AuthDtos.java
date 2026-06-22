package com.tickethub.auth.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.time.Instant;
import java.util.List;

/** Auth request/response payloads. */
public final class AuthDtos {

    private AuthDtos() {
    }

    public record RegisterRequest(
            @Email @NotBlank String email,
            @NotBlank @Size(min = 6, message = "Mật khẩu tối thiểu 6 ký tự") String password,
            @NotBlank String fullName,
            String phoneNumber
    ) {
    }

    public record LoginRequest(
            @Email @NotBlank String email,
            @NotBlank String password
    ) {
    }

    public record RefreshRequest(@NotBlank String refreshToken) {
    }

    public record UpdateProfileRequest(
            @NotBlank String fullName,
            String phoneNumber,
            String avatarUrl
    ) {
    }

    public record UserDto(
            Long id,
            String email,
            String fullName,
            String phoneNumber,
            String avatarUrl,
            String status,
            List<String> roles,
            List<String> permissions,
            Instant createdAt
    ) {
    }

    public record AuthResponse(
            String accessToken,
            String refreshToken,
            UserDto user
    ) {
    }

    /** Minimal user info for service-to-service lookup by email. */
    public record UserLookup(Long id, String email, String fullName) {
    }
}
