package com.tickethub.event.service;

import com.tickethub.event.domain.Event;
import com.tickethub.event.domain.EventStatus;
import com.tickethub.event.domain.TicketType;
import com.tickethub.event.domain.TicketTypeStatus;
import com.tickethub.event.repository.TicketTypeRepository;
import com.tickethub.event.support.PostgresTestContainer;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;

import java.math.BigDecimal;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/**
 * Inventory slice tests — chạy câu SQL UPDATE nguyên tử thật trên Postgres (Testcontainers).
 *
 * Dùng @DataJpaTest (chỉ nạp tầng JPA, KHÔNG nạp Kafka/web) và tự tay khởi tạo
 * TicketTypeService với một EventService giả (mock) — vì các thao tác inventory không
 * cần tới EventService.
 */
@DataJpaTest
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
class TicketTypeInventoryTest extends PostgresTestContainer {

    @Autowired
    TicketTypeRepository repository;

    @PersistenceContext
    EntityManager em;

    TicketTypeService service;

    private Long ticketTypeId;
    private static final int TOTAL = 100;

    @BeforeEach
    void setUp() {
        // EventService chỉ được service.create() dùng tới; inventory ops không cần -> mock.
        service = new TicketTypeService(repository, Mockito.mock(EventService.class));

        Event event = new Event();
        event.setTitle("Concert");
        event.setStatus(EventStatus.PUBLISHED);
        em.persist(event);

        TicketType t = new TicketType();
        t.setEvent(event);
        t.setName("VIP");
        t.setPrice(new BigDecimal("100"));
        t.setCurrency("VND");
        t.setTotalQuantity(TOTAL);
        t.setAvailableQuantity(TOTAL);
        t.setReservedQuantity(0);
        t.setSoldQuantity(0);
        t.setStatus(TicketTypeStatus.SELLING);
        em.persist(t);
        em.flush();
        ticketTypeId = t.getId();
        em.clear();
    }

    private TicketType reload() {
        em.clear();
        return repository.findById(ticketTypeId).orElseThrow();
    }

    private void assertInvariant(TicketType t) {
        assertThat(t.inventoryValid())
                .as("invariant total = available + reserved + sold")
                .isTrue();
        assertThat(t.getAvailableQuantity()).isGreaterThanOrEqualTo(0);
        assertThat(t.getReservedQuantity()).isGreaterThanOrEqualTo(0);
        assertThat(t.getSoldQuantity()).isGreaterThanOrEqualTo(0);
    }

    @Test
    void reserve_reducesAvailable_andIncreasesReserved() {
        service.reserve(ticketTypeId, 10);

        TicketType t = reload();
        assertThat(t.getAvailableQuantity()).isEqualTo(TOTAL - 10);
        assertThat(t.getReservedQuantity()).isEqualTo(10);
        assertThat(t.getSoldQuantity()).isZero();
        assertThat(t.getStatus()).isEqualTo(TicketTypeStatus.SELLING);
        assertInvariant(t);
    }

    @Test
    void confirm_movesReservedToSold() {
        service.reserve(ticketTypeId, 10);
        service.confirm(ticketTypeId, 4);

        TicketType t = reload();
        assertThat(t.getAvailableQuantity()).isEqualTo(TOTAL - 10);
        assertThat(t.getReservedQuantity()).isEqualTo(6);
        assertThat(t.getSoldQuantity()).isEqualTo(4);
        assertInvariant(t);
    }

    @Test
    void release_returnsReservedToAvailable() {
        service.reserve(ticketTypeId, 10);
        service.release(ticketTypeId, 3);

        TicketType t = reload();
        assertThat(t.getAvailableQuantity()).isEqualTo(TOTAL - 7);
        assertThat(t.getReservedQuantity()).isEqualTo(7);
        assertThat(t.getSoldQuantity()).isZero();
        assertInvariant(t);
    }

    @Test
    void release_isCappedAtReserved_neverNegative() {
        service.reserve(ticketTypeId, 5);
        // hoàn nhiều hơn số đang giữ -> chỉ trả lại tối đa 5
        service.release(ticketTypeId, 999);

        TicketType t = reload();
        assertThat(t.getReservedQuantity()).isZero();
        assertThat(t.getAvailableQuantity()).isEqualTo(TOTAL);
        assertThat(t.getSoldQuantity()).isZero();
        assertInvariant(t);
    }

    @Test
    void status_flipsToSoldOut_whenAvailableHitsZero_andBackToSellingAfterRelease() {
        service.reserve(ticketTypeId, TOTAL);

        TicketType t = reload();
        assertThat(t.getAvailableQuantity()).isZero();
        assertThat(t.getReservedQuantity()).isEqualTo(TOTAL);
        assertThat(t.getStatus()).isEqualTo(TicketTypeStatus.SOLD_OUT);
        assertInvariant(t);

        // hoàn 1 vé -> available > 0 -> quay lại SELLING
        service.release(ticketTypeId, 1);
        t = reload();
        assertThat(t.getAvailableQuantity()).isEqualTo(1);
        assertThat(t.getStatus()).isEqualTo(TicketTypeStatus.SELLING);
        assertInvariant(t);
    }

    @Test
    void reserve_moreThanAvailable_isRejected_countsUnchanged() {
        assertThatThrownBy(() -> service.reserve(ticketTypeId, TOTAL + 1))
                .isInstanceOf(IllegalStateException.class);

        TicketType t = reload();
        assertThat(t.getAvailableQuantity()).isEqualTo(TOTAL);
        assertThat(t.getReservedQuantity()).isZero();
        assertThat(t.getSoldQuantity()).isZero();
        assertThat(t.getStatus()).isEqualTo(TicketTypeStatus.SELLING);
        assertInvariant(t);
    }

    @Test
    void boundary_reserveExceedingAvailableByOne_rejected_thenExactFit_flipsSoldOut() {
        // Đưa available về đúng 2 (giữ 98/100), rồi kiểm tra biên.
        service.reserve(ticketTypeId, TOTAL - 2);
        TicketType t = reload();
        assertThat(t.getAvailableQuantity()).isEqualTo(2);

        // reserve(3) khi chỉ còn 2 -> từ chối hoàn toàn, KHÔNG trừ gì cả (rows == 0).
        assertThat(repository.reserve(ticketTypeId, 3)).as("reserve(3) affects 0 rows").isZero();
        t = reload();
        assertThat(t.getAvailableQuantity()).as("nothing decremented").isEqualTo(2);
        assertThat(t.getReservedQuantity()).isEqualTo(TOTAL - 2);
        assertThat(t.getStatus()).isEqualTo(TicketTypeStatus.SELLING);
        assertInvariant(t);

        // reserve(2) vừa khít -> thành công, available về 0, status -> SOLD_OUT.
        assertThat(repository.reserve(ticketTypeId, 2)).as("reserve(2) affects 1 row").isEqualTo(1);
        t = reload();
        assertThat(t.getAvailableQuantity()).isZero();
        assertThat(t.getReservedQuantity()).isEqualTo(TOTAL);
        assertThat(t.getStatus()).isEqualTo(TicketTypeStatus.SOLD_OUT);
        assertInvariant(t);
    }

    @Test
    void confirm_moreThanReserved_isRejected_countsUnchanged() {
        service.reserve(ticketTypeId, 5);

        assertThatThrownBy(() -> service.confirm(ticketTypeId, 6))
                .isInstanceOf(IllegalStateException.class);

        TicketType t = reload();
        assertThat(t.getReservedQuantity()).isEqualTo(5);
        assertThat(t.getSoldQuantity()).isZero();
        assertInvariant(t);
    }
}
