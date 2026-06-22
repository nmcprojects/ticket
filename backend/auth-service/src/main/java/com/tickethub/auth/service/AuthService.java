package com.tickethub.auth.service;

import com.tickethub.auth.domain.*;
import com.tickethub.auth.dto.AuthDtos.*;
import com.tickethub.auth.exception.ApiException;
import com.tickethub.auth.repository.RefreshTokenRepository;
import com.tickethub.auth.repository.RoleRepository;
import com.tickethub.auth.repository.UserRepository;
import com.tickethub.auth.security.JwtService;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class AuthService {

    private final UserRepository userRepository;
    private final RoleRepository roleRepository;
    private final RefreshTokenRepository refreshTokenRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtService jwtService;

    @Value("${tickethub.jwt.refresh-token-days}")
    private long refreshDays;

    @Transactional(readOnly = true)
    public java.util.Optional<UserLookup> findByEmail(String email) {
        return userRepository.findByEmailIgnoreCase(email)
                .map(u -> new UserLookup(u.getId(), u.getEmail(), u.getFullName()));
    }

    @Transactional
    public AuthResponse register(RegisterRequest req) {
        if (userRepository.existsByEmailIgnoreCase(req.email())) {
            throw ApiException.conflict("Email đã được sử dụng.");
        }
        Role customer = roleRepository.findByCode("CUSTOMER")
                .orElseThrow(() -> ApiException.badRequest("Thiếu role CUSTOMER"));

        User u = new User();
        u.setEmail(req.email().toLowerCase());
        u.setPasswordHash(passwordEncoder.encode(req.password()));
        u.setFullName(req.fullName());
        u.setPhoneNumber(req.phoneNumber());
        u.setStatus(UserStatus.ACTIVE);
        u.setAvatarUrl("https://i.pravatar.cc/120?u=" + req.email());
        u.getRoles().add(customer);
        u = userRepository.save(u);

        return issueTokens(u);
    }

    @Transactional
    public AuthResponse login(LoginRequest req) {
        User u = userRepository.findByEmailIgnoreCase(req.email())
                .orElseThrow(() -> ApiException.unauthorized("Email hoặc mật khẩu không đúng."));
        if (!passwordEncoder.matches(req.password(), u.getPasswordHash())) {
            throw ApiException.unauthorized("Email hoặc mật khẩu không đúng.");
        }
        if (u.getStatus() != UserStatus.ACTIVE) {
            throw ApiException.unauthorized("Tài khoản đang bị khoá hoặc vô hiệu hoá.");
        }
        return issueTokens(u);
    }

    @Transactional
    public AuthResponse refresh(RefreshRequest req) {
        RefreshToken rt = refreshTokenRepository.findByToken(req.refreshToken())
                .orElseThrow(() -> ApiException.unauthorized("Refresh token không hợp lệ."));
        if (!rt.isActive()) {
            throw ApiException.unauthorized("Refresh token đã hết hạn hoặc bị thu hồi.");
        }
        User u = rt.getUser();
        String access = jwtService.generateAccessToken(u);
        return new AuthResponse(access, rt.getToken(), toDto(u));
    }

    @Transactional
    public void logout(RefreshRequest req) {
        refreshTokenRepository.findByToken(req.refreshToken()).ifPresent(rt -> {
            rt.setRevoked(true);
            refreshTokenRepository.save(rt);
        });
    }

    @Transactional(readOnly = true)
    public UserDto me(Long userId) {
        User u = userRepository.findById(userId)
                .orElseThrow(() -> ApiException.unauthorized("Phiên không hợp lệ."));
        return toDto(u);
    }

    @Transactional
    public UserDto updateProfile(Long userId, UpdateProfileRequest req) {
        User u = userRepository.findById(userId)
                .orElseThrow(() -> ApiException.unauthorized("Phiên không hợp lệ."));
        u.setFullName(req.fullName());
        u.setPhoneNumber(req.phoneNumber());
        if (req.avatarUrl() != null && !req.avatarUrl().isBlank()) {
            u.setAvatarUrl(req.avatarUrl());
        }
        return toDto(userRepository.save(u));
    }

    private AuthResponse issueTokens(User u) {
        String access = jwtService.generateAccessToken(u);

        RefreshToken rt = new RefreshToken();
        rt.setUser(u);
        rt.setToken(UUID.randomUUID().toString() + UUID.randomUUID());
        rt.setExpiredAt(Instant.now().plus(refreshDays, ChronoUnit.DAYS));
        rt.setRevoked(false);
        refreshTokenRepository.save(rt);

        return new AuthResponse(access, rt.getToken(), toDto(u));
    }

    private UserDto toDto(User u) {
        List<String> roles = u.getRoles().stream().map(Role::getCode).sorted().toList();
        List<String> permissions = u.getRoles().stream()
                .flatMap(r -> r.getPermissions().stream())
                .map(Permission::getCode).distinct().sorted().toList();
        return new UserDto(u.getId(), u.getEmail(), u.getFullName(), u.getPhoneNumber(),
                u.getAvatarUrl(), u.getStatus().name(), roles, permissions, u.getCreatedAt());
    }
}
