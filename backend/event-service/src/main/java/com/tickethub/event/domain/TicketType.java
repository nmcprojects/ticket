package com.tickethub.event.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.math.BigDecimal;
import java.time.Instant;

@Entity
@Table(name = "ticket_types")
@Getter
@Setter
@NoArgsConstructor
public class TicketType {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "event_id", nullable = false)
    private Event event;

    @Column(nullable = false)
    private String name;

    @Column(columnDefinition = "text")
    private String description;

    @Column(nullable = false)
    private BigDecimal price = BigDecimal.ZERO;

    @Column(nullable = false)
    private String currency = "VND";

    @Column(name = "total_quantity", nullable = false)
    private int totalQuantity;

    @Column(name = "available_quantity", nullable = false)
    private int availableQuantity;

    @Column(name = "reserved_quantity", nullable = false)
    private int reservedQuantity;

    @Column(name = "sold_quantity", nullable = false)
    private int soldQuantity;

    @Column(name = "max_per_order", nullable = false)
    private int maxPerOrder = 10;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private TicketTypeStatus status = TicketTypeStatus.SELLING;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private Instant updatedAt;

    /** Inventory invariant: total = available + reserved + sold */
    public boolean inventoryValid() {
        return totalQuantity == availableQuantity + reservedQuantity + soldQuantity;
    }
}
