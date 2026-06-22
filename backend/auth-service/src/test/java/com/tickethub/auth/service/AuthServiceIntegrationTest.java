package com.tickethub.auth.service;

import com.tickethub.auth.domain.Role;
import com.tickethub.auth.domain.User;
import com.tickethub.auth.dto.AuthDtos.AuthResponse;
import com.tickethub.auth.dto.AuthDtos.LoginRequest;
import com.tickethub.auth.dto.AuthDtos.RegisterRequest;
import com.tickethub.auth.dto.AuthDtos.UpdateProfileRequest;
import com.tickethub.auth.dto.AuthDtos.UserDto;
import com.tickethub.auth.exception.ApiException;
import com.tickethub.auth.repository.RoleRepository;
import com.tickethub.auth.repository.UserRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Integration test for {@link AuthService} against a real Postgres (Testcontainers)
 * with the full Spring bean wiring. Eureka and the running Docker stack are not contacted.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.MOCK)
@Testcontainers
class AuthServiceIntegrationTest {

    @Container
    static final PostgreSQLContainer<?> POSTGRES =
            new PostgreSQLContainer<>("postgres:16-alpine");

    @DynamicPropertySource
    static void props(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", POSTGRES::getJdbcUrl);
        registry.add("spring.datasource.username", POSTGRES::getUsername);
        registry.add("spring.datasource.password", POSTGRES::getPassword);
        registry.add("spring.jpa.hibernate.ddl-auto", () -> "create-drop");
        // Keep all Eureka/registry traffic off — must not touch the running stack.
        registry.add("eureka.client.enabled", () -> "false");
        registry.add("eureka.client.register-with-eureka", () -> "false");
        registry.add("eureka.client.fetch-registry", () -> "false");
    }

    @Autowired
    AuthService authService;
    @Autowired
    UserRepository userRepository;
    @Autowired
    RoleRepository roleRepository;
    @Autowired
    PasswordEncoder passwordEncoder;

    @BeforeEach
    void ensureCustomerRoleExists() {
        // DataSeeder normally creates this on startup; guarantee it for the test regardless.
        if (roleRepository.findByCode("CUSTOMER").isEmpty()) {
            roleRepository.save(new Role("CUSTOMER", "Khách hàng"));
        }
    }

    private RegisterRequest newRegisterRequest(String email) {
        return new RegisterRequest(email, "secret123", "Test User", "0900000000");
    }

    private String uniqueEmail() {
        return "user-" + UUID.randomUUID() + "@example.com";
    }

    @Test
    void register_persistsHashedPasswordAndReturnsToken() {
        String email = uniqueEmail();

        AuthResponse response = authService.register(newRegisterRequest(email));

        assertThat(response.accessToken()).isNotBlank();
        assertThat(response.user().email()).isEqualTo(email);

        User stored = userRepository.findByEmailIgnoreCase(email).orElseThrow();
        assertThat(stored.getPasswordHash()).isNotEqualTo("secret123");
        assertThat(passwordEncoder.matches("secret123", stored.getPasswordHash())).isTrue();
    }

    @Test
    void register_duplicateEmail_isRejected() {
        String email = uniqueEmail();
        authService.register(newRegisterRequest(email));

        assertThatThrownBy(() -> authService.register(newRegisterRequest(email)))
                .isInstanceOf(ApiException.class)
                .hasMessageContaining("Email");
    }

    @Test
    void login_correctCredentials_returnsToken_wrongPassword_isRejected() {
        String email = uniqueEmail();
        authService.register(newRegisterRequest(email));

        AuthResponse ok = authService.login(new LoginRequest(email, "secret123"));
        assertThat(ok.accessToken()).isNotBlank();
        assertThat(ok.user().email()).isEqualTo(email);

        assertThatThrownBy(() -> authService.login(new LoginRequest(email, "wrong-password")))
                .isInstanceOf(ApiException.class);
    }

    @Test
    void updateProfile_updatesFieldsAndMeReflectsThem() {
        String email = uniqueEmail();
        Long userId = authService.register(newRegisterRequest(email)).user().id();

        UpdateProfileRequest update =
                new UpdateProfileRequest("Updated Name", "0911111111", "https://cdn/avatar.png");
        UserDto updated = authService.updateProfile(userId, update);

        assertThat(updated.fullName()).isEqualTo("Updated Name");
        assertThat(updated.phoneNumber()).isEqualTo("0911111111");
        assertThat(updated.avatarUrl()).isEqualTo("https://cdn/avatar.png");

        UserDto fetched = authService.me(userId);
        assertThat(fetched.fullName()).isEqualTo("Updated Name");
        assertThat(fetched.phoneNumber()).isEqualTo("0911111111");
        assertThat(fetched.avatarUrl()).isEqualTo("https://cdn/avatar.png");
    }
}
