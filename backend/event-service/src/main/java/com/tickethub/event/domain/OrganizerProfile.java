package com.tickethub.event.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.Instant;

@Entity
@Table(name = "organizer_profiles")
@Getter
@Setter
@NoArgsConstructor
public class OrganizerProfile {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** Logical reference to auth_db.users.id — no physical FK. */
    @Column(name = "auth_user_id")
    private Long authUserId;

    @Column(name = "organization_name", nullable = false)
    private String organizationName;

    @Column(name = "contact_email")
    private String contactEmail;

    @Column(name = "contact_phone")
    private String contactPhone;

    /** Public "Giới thiệu" bio shown on the organizer/event pages. */
    @Column(columnDefinition = "text")
    private String description;

    private String avatarUrl;

    private boolean verified;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private Instant updatedAt;
}
