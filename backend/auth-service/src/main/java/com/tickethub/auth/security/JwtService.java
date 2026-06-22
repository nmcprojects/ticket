package com.tickethub.auth.security;

import com.tickethub.auth.domain.Permission;
import com.tickethub.auth.domain.Role;
import com.tickethub.auth.domain.User;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.security.KeyFactory;
import java.security.PrivateKey;
import java.security.PublicKey;
import java.security.spec.PKCS8EncodedKeySpec;
import java.security.spec.X509EncodedKeySpec;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Base64;
import java.util.List;

/**
 * Issues and verifies access tokens with an RSA keypair (RS256): auth-service is the ONLY holder
 * of the private (signing) key; every other service verifies with the public key. This is the
 * asymmetric replacement for the old shared HMAC secret (where any service could mint tokens).
 */
@Service
public class JwtService {

    private final PrivateKey privateKey;
    private final PublicKey publicKey;
    private final long accessMinutes;

    public JwtService(
            @Value("${tickethub.jwt.private-key}") String privateKeyB64,
            @Value("${tickethub.jwt.public-key}") String publicKeyB64,
            @Value("${tickethub.jwt.access-token-minutes}") long accessMinutes) {
        this.privateKey = loadPrivate(privateKeyB64);
        this.publicKey = loadPublic(publicKeyB64);
        this.accessMinutes = accessMinutes;
    }

    public String generateAccessToken(User user) {
        Instant now = Instant.now();
        List<String> roles = user.getRoles().stream().map(Role::getCode).toList();
        List<String> permissions = user.getRoles().stream()
                .flatMap(r -> r.getPermissions().stream())
                .map(Permission::getCode)
                .distinct()
                .toList();

        return Jwts.builder()
                .subject(String.valueOf(user.getId()))
                .claim("email", user.getEmail())
                .claim("fullName", user.getFullName())
                .claim("roles", roles)
                .claim("permissions", permissions)
                .issuedAt(java.util.Date.from(now))
                .expiration(java.util.Date.from(now.plus(accessMinutes, ChronoUnit.MINUTES)))
                .signWith(privateKey, Jwts.SIG.RS256)
                .compact();
    }

    public Claims parse(String token) {
        return Jwts.parser().verifyWith(publicKey).build().parseSignedClaims(token).getPayload();
    }

    private static PrivateKey loadPrivate(String b64) {
        try {
            return KeyFactory.getInstance("RSA")
                    .generatePrivate(new PKCS8EncodedKeySpec(Base64.getDecoder().decode(b64)));
        } catch (Exception e) {
            throw new IllegalStateException("JWT private key không hợp lệ", e);
        }
    }

    private static PublicKey loadPublic(String b64) {
        try {
            return KeyFactory.getInstance("RSA")
                    .generatePublic(new X509EncodedKeySpec(Base64.getDecoder().decode(b64)));
        } catch (Exception e) {
            throw new IllegalStateException("JWT public key không hợp lệ", e);
        }
    }
}
