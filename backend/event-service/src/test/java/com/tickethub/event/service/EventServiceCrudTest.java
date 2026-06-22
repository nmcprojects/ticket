package com.tickethub.event.service;

import com.tickethub.event.domain.EventStatus;
import com.tickethub.event.domain.TicketTypeStatus;
import com.tickethub.event.dto.EventDto;
import com.tickethub.event.dto.EventRequest;
import com.tickethub.event.dto.TicketTypeRequest;
import com.tickethub.event.kafka.EventEventPublisher;
import com.tickethub.event.repository.EventRepository;
import com.tickethub.event.repository.OrganizerRepository;
import com.tickethub.event.support.PostgresTestContainer;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;

import java.math.BigDecimal;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * EventService CRUD happy-path — chạy trên Postgres thật (Testcontainers), tầng JPA only.
 *
 * EventService phụ thuộc EventEventPublisher (Kafka). Ở slice @DataJpaTest Kafka KHÔNG được
 * nạp, nên ta mock publisher và tự dựng EventService với các repository thật.
 */
@DataJpaTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
class EventServiceCrudTest extends PostgresTestContainer {

    @Autowired
    EventRepository eventRepository;
    @Autowired
    OrganizerRepository organizerRepository;

    EventService service;

    @BeforeEach
    void setUp() {
        service = new EventService(eventRepository, organizerRepository,
                Mockito.mock(EventEventPublisher.class));
    }

    @Test
    void create_thenGet_returnsPersistedEventWithTicketTypes() {
        EventRequest req = new EventRequest(
                null, "Spring Fest", "desc", "<p>content</p>",
                "Hanoi", "Hanoi", "Stadium", "Music",
                null, null, null, EventStatus.PUBLISHED,
                List.of(new TicketTypeRequest(
                        "VIP", "front row", new BigDecimal("250000"), "VND",
                        100, 10, TicketTypeStatus.SELLING)));

        EventDto created = service.create(req);

        assertThat(created.id()).isNotNull();
        assertThat(created.title()).isEqualTo("Spring Fest");
        assertThat(created.status()).isEqualTo(EventStatus.PUBLISHED);
        assertThat(created.ticketTypes()).hasSize(1);
        assertThat(created.ticketTypes().get(0).availableQuantity()).isEqualTo(100);
        assertThat(created.ticketTypes().get(0).totalQuantity()).isEqualTo(100);

        // get() phải đọc lại đúng record đã persist.
        EventDto fetched = service.findById(created.id());
        assertThat(fetched.id()).isEqualTo(created.id());
        assertThat(fetched.title()).isEqualTo("Spring Fest");
        assertThat(fetched.ticketTypes()).hasSize(1);
        assertThat(fetched.ticketTypes().get(0).name()).isEqualTo("VIP");
    }

    @Test
    void create_withoutTicketTypes_persists_andFindAllSeesIt() {
        EventRequest req = new EventRequest(
                null, "Bare Event", null, null, null, null, null, null,
                null, null, null, null, null);

        EventDto created = service.create(req);

        assertThat(created.id()).isNotNull();
        assertThat(created.status()).isEqualTo(EventStatus.DRAFT); // default
        assertThat(created.ticketTypes()).isEmpty();

        assertThat(service.findAll(null, null))
                .extracting(EventDto::id)
                .contains(created.id());
    }
}
