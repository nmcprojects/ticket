package com.tickethub.auth.controller;

import com.tickethub.auth.dto.AuthDtos.*;
import com.tickethub.auth.exception.ApiException;
import com.tickethub.auth.service.AuthService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/auth")
@RequiredArgsConstructor
public class AuthController {

    private final AuthService authService;

    @PostMapping("/register")
    public ResponseEntity<AuthResponse> register(@Valid @RequestBody RegisterRequest req) {
        return ResponseEntity.status(HttpStatus.CREATED).body(authService.register(req));
    }

    @PostMapping("/login")
    public AuthResponse login(@Valid @RequestBody LoginRequest req) {
        return authService.login(req);
    }

    @PostMapping("/refresh")
    public AuthResponse refresh(@Valid @RequestBody RefreshRequest req) {
        return authService.refresh(req);
    }

    @PostMapping("/logout")
    public ResponseEntity<Void> logout(@Valid @RequestBody RefreshRequest req) {
        authService.logout(req);
        return ResponseEntity.noContent().build();
    }

    /** Service-to-service lookup: resolve a system user by email (used to add org members). */
    @GetMapping("/users/by-email")
    public ResponseEntity<UserLookup> byEmail(@RequestParam String email) {
        return authService.findByEmail(email)
                .map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    @GetMapping("/me")
    public UserDto me(Authentication authentication) {
        return authService.me(currentUserId(authentication));
    }

    @PutMapping("/me")
    public UserDto updateProfile(Authentication authentication, @Valid @RequestBody UpdateProfileRequest req) {
        return authService.updateProfile(currentUserId(authentication), req);
    }

    private Long currentUserId(Authentication authentication) {
        if (authentication == null || authentication.getPrincipal() == null) {
            throw ApiException.unauthorized("Chưa đăng nhập.");
        }
        return Long.valueOf(authentication.getPrincipal().toString());
    }
}
