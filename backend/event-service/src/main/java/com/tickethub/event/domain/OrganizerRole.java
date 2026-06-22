package com.tickethub.event.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;

import java.time.Instant;
import java.util.HashSet;
import java.util.Set;

/** A role defined BY an organization = a named set of permissions. */
@Entity
@Table(name = "organizer_roles")
@Getter
@Setter
@NoArgsConstructor
public class OrganizerRole {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "organizer_id", nullable = false)
    private Long organizerId;

    @Column(nullable = false)
    private String name;

    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "organizer_role_permissions", joinColumns = @JoinColumn(name = "role_id"))
    @Column(name = "permission")
    private Set<String> permissions = new HashSet<>();

    /** The built-in "owner" role: full permissions, cannot be edited or deleted. */
    @Column(name = "system_default")
    private boolean systemDefault;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private Instant createdAt;
}
