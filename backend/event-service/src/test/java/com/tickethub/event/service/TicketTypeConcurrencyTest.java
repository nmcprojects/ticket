package com.tickethub.event.service;

import com.tickethub.event.domain.Event;
import com.tickethub.event.domain.EventStatus;
import com.tickethub.event.domain.TicketType;
import com.tickethub.event.domain.TicketTypeStatus;
import com.tickethub.event.kafka.EventEventPublisher;
import com.tickethub.event.repository.EventRepository;
import com.tickethub.event.repository.TicketTypeRepository;
import com.tickethub.event.support.PostgresTestContainer;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.kafka.core.KafkaTemplate;

import java.math.BigDecimal;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * CONCURRENCY test — bằng chứng câu UPDATE nguyên tử chống oversell (lost update).
 *
 * N ghế, bắn M lời gọi reserve(qty=1) ĐỒNG THỜI vào service/repository THẬT trên
 * Postgres (Testcontainers). Mỗi thread chạy trong transaction riêng (service @Transactional),
 * commit độc lập -> mô phỏng đúng tải thực tế.
 *
 * @SpringBootTest để có transaction manager thật cho từng thread. Kafka KHÔNG được nạp:
 * loại trừ autoconfig + mock publisher/KafkaTemplate. Eureka tắt qua PostgresTestContainer.
 */
@SpringBootTest(properties = {
        "spring.autoconfigure.exclude=" +
                "org.springframework.boot.autoconfigure.kafka.KafkaAutoConfiguration",
        "eureka.client.enabled=false",
        "eureka.client.register-with-eureka=false",
        "eureka.client.fetch-registry=false"
})
class TicketTypeConcurrencyTest extends PostgresTestContainer {

    @Autowired
    TicketTypeService service;
    @Autowired
    TicketTypeRepository ticketTypeRepository;
    @Autowired
    EventRepository eventRepository;

    // Kafka không được nạp -> cung cấp bean giả để context khởi động được.
    @MockBean
    EventEventPublisher publisher;
    @MockBean
    KafkaTemplate<String, Object> kafkaTemplate;

    private static final int N_SEATS = 100;
    private static final int M_ATTEMPTS = 1000;

    @Test
    void atomicReserve_preventsOversell_underHeavyConcurrency() throws Exception {
        // ── seed: 1 event + 1 ticket type N ghế, commit ngay (method này không @Transactional)
        Event event = new Event();
        event.setTitle("Big Show");
        event.setStatus(EventStatus.PUBLISHED);
        event = eventRepository.saveAndFlush(event);

        TicketType t = new TicketType();
        t.setEvent(event);
        t.setName("GA");
        t.setPrice(new BigDecimal("50"));
        t.setCurrency("VND");
        t.setTotalQuantity(N_SEATS);
        t.setAvailableQuantity(N_SEATS);
        t.setReservedQuantity(0);
        t.setSoldQuantity(0);
        t.setStatus(TicketTypeStatus.SELLING);
        final Long id = ticketTypeRepository.saveAndFlush(t).getId();

        // ── bắn M reserve(1) đồng thời
        ExecutorService pool = Executors.newFixedThreadPool(32);
        CountDownLatch startGate = new CountDownLatch(1);
        AtomicInteger success = new AtomicInteger();
        AtomicInteger failure = new AtomicInteger();

        @SuppressWarnings("unchecked")
        Future<?>[] futures = new Future<?>[M_ATTEMPTS];
        for (int i = 0; i < M_ATTEMPTS; i++) {
            futures[i] = pool.submit(() -> {
                startGate.await();           // tất cả thread chờ rồi cùng xuất phát
                try {
                    service.reserve(id, 1);
                    success.incrementAndGet();
                } catch (IllegalStateException ex) {
                    failure.incrementAndGet();  // hết vé -> đúng như mong đợi
                }
                return null;
            });
        }

        startGate.countDown();               // thả cửa
        for (Future<?> f : futures) {
            f.get(60, TimeUnit.SECONDS);     // join, propagate lỗi bất ngờ (không phải IllegalState)
        }
        pool.shutdown();
        assertThat(pool.awaitTermination(30, TimeUnit.SECONDS)).isTrue();

        // ── kiểm tra: ĐÚNG N thành công, phần còn lại fail, KHÔNG oversell
        assertThat(success.get()).as("exactly N reserves succeed").isEqualTo(N_SEATS);
        assertThat(failure.get()).as("the rest fail").isEqualTo(M_ATTEMPTS - N_SEATS);

        TicketType after = ticketTypeRepository.findById(id).orElseThrow();
        assertThat(after.getAvailableQuantity()).as("available drained to 0").isZero();
        assertThat(after.getReservedQuantity()).as("reserved == N").isEqualTo(N_SEATS);
        assertThat(after.getSoldQuantity()).as("sold unchanged").isZero();
        assertThat(after.getStatus()).isEqualTo(TicketTypeStatus.SOLD_OUT);

        // không oversell + invariant
        assertThat(after.getReservedQuantity() + after.getSoldQuantity())
                .as("reserved + sold <= total (no oversell)")
                .isLessThanOrEqualTo(after.getTotalQuantity());
        assertThat(after.getAvailableQuantity()).isGreaterThanOrEqualTo(0);
        assertThat(after.inventoryValid()).as("invariant holds").isTrue();
    }
}
