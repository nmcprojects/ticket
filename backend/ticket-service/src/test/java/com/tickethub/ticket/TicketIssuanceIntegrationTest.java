package com.tickethub.ticket;

import com.tickethub.ticket.domain.Ticket;
import com.tickethub.ticket.domain.TicketStatus;
import com.tickethub.ticket.dto.CheckinRequest;
import com.tickethub.ticket.dto.CheckinResponse;
import com.tickethub.ticket.dto.TicketDto;
import com.tickethub.ticket.dto.TicketStatsDto;
import com.tickethub.ticket.domain.CheckinResult;
import com.tickethub.common.events.BookingEventMessage;
import com.tickethub.ticket.kafka.BookingEventsConsumer;
import com.tickethub.ticket.kafka.TicketEventPublisher;
import com.tickethub.ticket.repository.TicketRepository;
import com.tickethub.ticket.service.TicketService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Set;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.stream.Collectors;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Integration tests for ticket issuance on BookingPaid, dedup/idempotency,
 * lookup by bookingId and check-in. Uses a real Postgres via Testcontainers.
 * Kafka is kept out of the picture: autoconfig is excluded and the publisher
 * is mocked, so the consumer method is driven directly.
 */
@SpringBootTest(properties = {
        "eureka.client.enabled=false",
        "eureka.client.register-with-eureka=false",
        "eureka.client.fetch-registry=false",
        "spring.cloud.discovery.enabled=false",
        "spring.autoconfigure.exclude=" +
                "org.springframework.boot.autoconfigure.kafka.KafkaAutoConfiguration",
        "spring.jpa.hibernate.ddl-auto=create-drop"
})
@Testcontainers
class TicketIssuanceIntegrationTest {

    @Container
    static final PostgreSQLContainer<?> POSTGRES =
            new PostgreSQLContainer<>("postgres:16-alpine");

    @DynamicPropertySource
    static void datasourceProps(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", POSTGRES::getJdbcUrl);
        registry.add("spring.datasource.username", POSTGRES::getUsername);
        registry.add("spring.datasource.password", POSTGRES::getPassword);
    }

    @Autowired
    BookingEventsConsumer bookingEventsConsumer;

    @Autowired
    TicketService ticketService;

    @Autowired
    TicketRepository ticketRepository;

    @Autowired
    com.tickethub.ticket.repository.ProcessedEventRepository processedRepository;

    /** Kafka publisher is mocked so nothing tries to reach a broker. */
    @MockBean
    TicketEventPublisher publisher;

    @BeforeEach
    void clean() {
        ticketRepository.deleteAll();
        processedRepository.deleteAll();
    }

    private BookingEventMessage bookingPaid(long bookingId, int quantity) {
        return bookingPaid(bookingId, 77L, 42L, quantity);
    }

    private BookingEventMessage bookingPaid(long bookingId, long userId, long eventId, int quantity) {
        return new BookingEventMessage(
                "BookingPaid", bookingId, userId, "buyer@tickethub.test",
                eventId, "Spring Fest",
                List.of(new BookingEventMessage.Item(5L, "VIP", quantity)),
                Instant.now());
    }

    @Test
    void bookingPaid_issuesExactlyQuantityTickets_eachIssuedUniqueAndLinked() {
        bookingEventsConsumer.onBookingMessage(bookingPaid(1001L, 3));

        List<Ticket> tickets = ticketRepository.findByBookingId(1001L);
        assertThat(tickets).hasSize(3);

        // All ISSUED, linked to the booking/user/event.
        assertThat(tickets).allSatisfy(t -> {
            assertThat(t.getStatus()).isEqualTo(TicketStatus.ISSUED);
            assertThat(t.getBookingId()).isEqualTo(1001L);
            assertThat(t.getUserId()).isEqualTo(77L);
            assertThat(t.getEventId()).isEqualTo(42L);
            assertThat(t.getTicketCode()).isNotBlank();
            assertThat(t.getQrPayload()).isNotBlank();
        });

        // Unique non-null codes and qr payloads.
        Set<String> codes = tickets.stream().map(Ticket::getTicketCode).collect(Collectors.toSet());
        Set<String> qrs = tickets.stream().map(Ticket::getQrPayload).collect(Collectors.toSet());
        assertThat(codes).hasSize(3);
        assertThat(qrs).hasSize(3);
    }

    @Test
    void duplicateBookingPaid_isIdempotent_noDuplicateTickets() {
        bookingEventsConsumer.onBookingMessage(bookingPaid(1002L, 2));
        // Same bookingId processed again.
        bookingEventsConsumer.onBookingMessage(bookingPaid(1002L, 2));

        assertThat(ticketRepository.findByBookingId(1002L)).hasSize(2);
        assertThat(processedRepository.existsById("booking-paid-1002")).isTrue();
    }

    @Test
    void findByBookingId_returnsIssuedTickets() {
        bookingEventsConsumer.onBookingMessage(bookingPaid(1003L, 2));

        List<TicketDto> found = ticketService.findAll(null, null, 1003L);
        assertThat(found).hasSize(2);
        assertThat(found).allSatisfy(t -> {
            assertThat(t.bookingId()).isEqualTo(1003L);
            assertThat(t.status()).isEqualTo(TicketStatus.ISSUED);
        });
    }

    @Test
    void findAll_filtersByEventIdAndUserId() {
        // Two bookings: same event (90) but different users; plus an unrelated event.
        bookingEventsConsumer.onBookingMessage(bookingPaid(2001L, 11L, 90L, 2));
        bookingEventsConsumer.onBookingMessage(bookingPaid(2002L, 22L, 90L, 1));
        bookingEventsConsumer.onBookingMessage(bookingPaid(2003L, 11L, 91L, 1));

        // eventId filter: 2 (user 11) + 1 (user 22) = 3 tickets for event 90.
        List<TicketDto> byEvent = ticketService.findAll(null, 90L, null);
        assertThat(byEvent).hasSize(3);
        assertThat(byEvent).allSatisfy(t -> assertThat(t.eventId()).isEqualTo(90L));

        // userId filter: user 11 has 2 (event 90) + 1 (event 91) = 3 tickets.
        List<TicketDto> byUser = ticketService.findAll(11L, null, null);
        assertThat(byUser).hasSize(3);
        assertThat(byUser).allSatisfy(t -> assertThat(t.userId()).isEqualTo(11L));

        // bookingId filter remains exact.
        assertThat(ticketService.findAll(null, null, 2002L)).hasSize(1);
    }

    @Test
    void statsForEvent_reflectsIssuedAndCheckedInCounts() {
        bookingEventsConsumer.onBookingMessage(bookingPaid(3001L, 55L, 70L, 3));

        // All issued initially.
        TicketStatsDto before = ticketService.statsForEvent(70L);
        assertThat(before.total()).isEqualTo(3);
        assertThat(before.issued()).isEqualTo(3);
        assertThat(before.checkedIn()).isZero();
        assertThat(before.checkinPercent()).isZero();

        // Check one in.
        Ticket one = ticketRepository.findByEventId(70L).get(0);
        ticketService.checkIn(new CheckinRequest(one.getTicketCode(), 9L));

        TicketStatsDto after = ticketService.statsForEvent(70L);
        assertThat(after.total()).isEqualTo(3);
        assertThat(after.issued()).isEqualTo(2);
        assertThat(after.checkedIn()).isEqualTo(1);
        assertThat(after.checkinPercent()).isEqualTo(33);
    }

    @Test
    void checkIn_setsStatusAndTimestamp() {
        bookingEventsConsumer.onBookingMessage(bookingPaid(1004L, 1));
        Ticket ticket = ticketRepository.findByBookingId(1004L).get(0);

        CheckinResponse resp = ticketService.checkIn(new CheckinRequest(ticket.getTicketCode(), 9L));

        assertThat(resp.result()).isEqualTo(CheckinResult.VALID);
        Ticket reloaded = ticketRepository.findById(ticket.getId()).orElseThrow();
        assertThat(reloaded.getStatus()).isEqualTo(TicketStatus.CHECKED_IN);
        assertThat(reloaded.getCheckedInAt()).isNotNull();
    }

    @Test
    void checkIn_alreadyCheckedIn_isRejectedAndNotReprocessed() {
        bookingEventsConsumer.onBookingMessage(bookingPaid(1005L, 1));
        Ticket ticket = ticketRepository.findByBookingId(1005L).get(0);

        CheckinResponse first = ticketService.checkIn(new CheckinRequest(ticket.getTicketCode(), 9L));
        assertThat(first.result()).isEqualTo(CheckinResult.VALID);
        Instant firstCheckedInAt = ticketRepository.findById(ticket.getId()).orElseThrow().getCheckedInAt();

        // Second check-in of the same ticket is reported as ALREADY_CHECKED_IN.
        CheckinResponse second = ticketService.checkIn(new CheckinRequest(ticket.getTicketCode(), 9L));
        assertThat(second.result()).isEqualTo(CheckinResult.ALREADY_CHECKED_IN);

        // Timestamp is not overwritten.
        Ticket reloaded = ticketRepository.findById(ticket.getId()).orElseThrow();
        assertThat(reloaded.getStatus()).isEqualTo(TicketStatus.CHECKED_IN);
        assertThat(reloaded.getCheckedInAt()).isEqualTo(firstCheckedInAt);
    }

    @Test
    void concurrentCheckIn_sameTicket_exactlyOneSucceeds() throws InterruptedException {
        bookingEventsConsumer.onBookingMessage(bookingPaid(1006L, 1));
        Ticket ticket = ticketRepository.findByBookingId(1006L).get(0);

        int threadCount = 2;
        ExecutorService executor = Executors.newFixedThreadPool(threadCount);
        CountDownLatch latch = new CountDownLatch(threadCount);
        List<CheckinResponse> responses = Collections.synchronizedList(new ArrayList<>());

        for (int i = 0; i < threadCount; i++) {
            executor.submit(() -> {
                try {
                    // Wait for all threads to be ready, then fire simultaneously.
                    latch.countDown();
                    latch.await();
                    CheckinResponse resp = ticketService.checkIn(
                            new CheckinRequest(ticket.getTicketCode(), 9L));
                    responses.add(resp);
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                }
            });
        }

        executor.shutdown();
        assertThat(executor.awaitTermination(10, TimeUnit.SECONDS)).isTrue();

        // Exactly one thread sees VALID, the other sees ALREADY_CHECKED_IN.
        long validCount = responses.stream()
                .filter(r -> r.result() == CheckinResult.VALID).count();
        long alreadyCount = responses.stream()
                .filter(r -> r.result() == CheckinResult.ALREADY_CHECKED_IN).count();

        assertThat(validCount).isEqualTo(1);
        assertThat(alreadyCount).isEqualTo(threadCount - 1);

        // The ticket is CHECKED_IN and has a non-null timestamp.
        Ticket reloaded = ticketRepository.findById(ticket.getId()).orElseThrow();
        assertThat(reloaded.getStatus()).isEqualTo(TicketStatus.CHECKED_IN);
        assertThat(reloaded.getCheckedInAt()).isNotNull();
    }
}
