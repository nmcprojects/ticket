package com.tickethub.event.domain;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "events")
@Getter
@Setter
@NoArgsConstructor
public class Event {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "organizer_id")
    private OrganizerProfile organizer;

    @Column(nullable = false)
    private String title;

    @Column(columnDefinition = "text")
    private String description;

    /** Rich HTML "Giới thiệu" content authored by the organizer. */
    @Column(columnDefinition = "text")
    private String content;

    private String location;
    private String city;
    private String venue;
    private String category;

    /** Geo coordinates for the venue map (OpenStreetMap). */
    private Double latitude;
    private Double longitude;

    @Column(name = "start_time")
    private Instant startTime;

    @Column(name = "end_time")
    private Instant endTime;

    @Column(name = "banner_url", columnDefinition = "text")
    private String bannerUrl;

    @Column(name = "seat_map_url", columnDefinition = "text")
    private String seatMapUrl;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private EventStatus status = EventStatus.DRAFT;

    @OneToMany(mappedBy = "event", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<TicketType> ticketTypes = new ArrayList<>();

    @OneToMany(mappedBy = "event", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("position ASC")
    private List<Showtime> showtimes = new ArrayList<>();

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private Instant updatedAt;

    public void addTicketType(TicketType tt) {
        tt.setEvent(this);
        this.ticketTypes.add(tt);
    }

    /** Thay thế toàn bộ danh sách suất chiếu (giữ orphanRemoval xoá các bản ghi cũ). */
    public void setShowtimes(List<Showtime> showtimes) {
        this.showtimes.clear();
        if (showtimes != null) {
            for (Showtime s : showtimes) {
                s.setEvent(this);
                this.showtimes.add(s);
            }
        }
    }
}
