package com.tickethub.event.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.Instant;

@Entity
@Table(name = "showtimes")
@Getter
@Setter
@NoArgsConstructor
public class Showtime {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "event_id", nullable = false)
    private Event event;

    @Column(name = "start_time")
    private Instant startTime;

    @Column(name = "end_time")
    private Instant endTime;

    /** Trạng thái suất chiếu: "SELLING" / "SOLD_OUT" / "ENDED". */
    @Column(nullable = false)
    private String status = "SELLING";

    @Column(nullable = false)
    private int position;
}
