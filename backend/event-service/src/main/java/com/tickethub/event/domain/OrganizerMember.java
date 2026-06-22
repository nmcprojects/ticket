package com.tickethub.event.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;

import java.time.Instant;

/** A staff member of an organization. Always linked to a system user (authUserId). */
@Entity
@Table(name = "organizer_members")
@Getter
@Setter
@NoArgsConstructor
public class OrganizerMember {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "organizer_id", nullable = false)
    private Long organizerId;

    /** The linked system user (auth_db.users.id). Members must be existing accounts. */
    @Column(name = "auth_user_id", nullable = false)
    private Long authUserId;

    @Column(nullable = false)
    private String email;

    /** Cached display name from the user account. */
    @Column(name = "full_name")
    private String fullName;

    @Column(name = "role_id", nullable = false)
    private Long roleId;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private Instant createdAt;
}
