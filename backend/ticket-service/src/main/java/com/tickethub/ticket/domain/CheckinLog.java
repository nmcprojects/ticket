package com.tickethub.ticket.domain;

import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;

import java.time.Instant;

@Entity
@Table(name = "checkin_logs")
@Getter
@Setter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class CheckinLog {

    public static CheckinLog newInstance() {
        return new CheckinLog();
    }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "ticket_id")
    private Long ticketId;

    @Column(name = "ticket_code")
    private String ticketCode;

    @Column(name = "staff_id")
    private Long staffId;

    @Column(name = "event_id")
    private Long eventId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private CheckinResult result;

    private String message;

    @CreationTimestamp
    @Column(name = "checked_in_at", updatable = false)
    private Instant checkedInAt;
}
