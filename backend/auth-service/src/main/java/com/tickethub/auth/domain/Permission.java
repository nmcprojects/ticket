package com.tickethub.auth.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Entity
@Table(name = "permissions")
@Getter
@Setter
@NoArgsConstructor
public class Permission {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private String code;

    private String name;
    private String description;
    private String module;
    private String action;

    public Permission(String code, String name, String module, String action) {
        this.code = code;
        this.name = name;
        this.module = module;
        this.action = action;
    }
}
