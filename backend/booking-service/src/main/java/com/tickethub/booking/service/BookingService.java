package com.tickethub.booking.service;

import com.tickethub.booking.client.EventClient;
import com.tickethub.booking.client.PaymentClient;
import com.tickethub.booking.client.TicketClient;
import com.tickethub.booking.domain.Booking;
import com.tickethub.booking.domain.BookingItem;
import com.tickethub.booking.domain.BookingStatus;
import com.tickethub.booking.domain.ProcessedEvent;
import com.tickethub.booking.dto.BookingDtos.*;
import com.tickethub.booking.kafka.BookingEventPublisher;
import com.tickethub.booking.kafka.BookingMessage;
import com.tickethub.booking.repository.BookingRepository;
import com.tickethub.booking.repository.ProcessedEventRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.security.SecureRandom;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Slf4j
@Service
@RequiredArgsConstructor
public class BookingService {

    private static final SecureRandom RANDOM = new SecureRandom();
    private static final String ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

    private final BookingRepository bookingRepository;
    private final ProcessedEventRepository processedRepository;
    private final EventClient eventClient;
    private final PaymentClient paymentClient;
    private final TicketClient ticketClient;
    private final BookingEventPublisher publisher;

    @Value("${tickethub.frontend-url}")
    private String frontendUrl;

    @Transactional
    public CreateBookingResponse create(Long userId, String email, CreateBookingRequest req) {
        // 0) Resolve authoritative ticket-type prices from event-service. Price and name are taken
        //    from the source of truth, NOT from the request, so a client cannot tamper with
        //    unitPrice to pay less. Also verify each ticket type belongs to the booked event.
        Map<Long, EventClient.TicketTypeInfo> catalog = new LinkedHashMap<>();
        for (BookingItemRequest it : req.items()) {
            EventClient.TicketTypeInfo tt = eventClient.getTicketType(it.ticketTypeId());
            if (!req.eventId().equals(tt.eventId())) {
                throw new IllegalArgumentException(
                        "Loại vé " + it.ticketTypeId() + " không thuộc sự kiện " + req.eventId());
            }
            catalog.put(it.ticketTypeId(), tt);
        }

        // 1) Hold tickets at event-service (rollback already-reserved on failure).
        List<BookingItemRequest> reserved = new ArrayList<>();
        try {
            for (BookingItemRequest it : req.items()) {
                eventClient.reserve(it.ticketTypeId(), it.quantity());
                reserved.add(it);
            }
        } catch (Exception e) {
            reserved.forEach(r -> eventClient.release(r.ticketTypeId(), r.quantity()));
            throw new IllegalStateException("Không giữ được vé (có thể đã hết): " + e.getMessage());
        }

        // 2) Create booking PENDING_PAYMENT.
        Booking b = new Booking();
        b.setCode(generateCode());
        b.setUserId(userId);
        b.setCustomerEmail(email);
        b.setEventId(req.eventId());
        b.setEventTitle(req.eventTitle());
        b.setStatus(BookingStatus.PENDING_PAYMENT);
        b.setExpiredAt(Instant.now().plus(15, ChronoUnit.MINUTES));

        BigDecimal total = BigDecimal.ZERO;
        for (BookingItemRequest it : req.items()) {
            EventClient.TicketTypeInfo tt = catalog.get(it.ticketTypeId());
            BigDecimal unitPrice = tt.price();
            BookingItem bi = new BookingItem();
            bi.setTicketTypeId(it.ticketTypeId());
            bi.setTicketTypeName(tt.name());
            bi.setQuantity(it.quantity());
            bi.setUnitPrice(unitPrice);
            bi.setTotalPrice(unitPrice.multiply(BigDecimal.valueOf(it.quantity())));
            total = total.add(bi.getTotalPrice());
            b.addItem(bi);
        }
        b.setTotalAmount(total);
        b = bookingRepository.save(b);

        // 3) Create a checkout session at payment-service.
        //    Nếu payment-service gián đoạn (sau retry + circuit breaker) → bù trừ: release vé đã giữ.
        String returnUrl = frontendUrl + "/booking/success?bookingId=" + b.getId();
        String cancelUrl = frontendUrl + "/booking/cancel?bookingId=" + b.getId();
        PaymentClient.CheckoutSession session;
        try {
            session = paymentClient.createCheckout(b.getId(), userId, total,
                    "TicketHub " + b.getCode(), returnUrl, cancelUrl);
        } catch (Exception e) {
            req.items().forEach(it -> eventClient.release(it.ticketTypeId(), it.quantity()));
            b.setStatus(BookingStatus.PAYMENT_FAILED);
            bookingRepository.save(b);
            throw new IllegalStateException("Không tạo được phiên thanh toán: " + e.getMessage());
        }
        b.setPaymentId(session.paymentId());
        b.setPaymentUrl(session.checkoutUrl());
        bookingRepository.save(b);

        log.info("Tạo booking {} ({}) total={} -> payment {}", b.getId(), b.getCode(), total, session.paymentId());
        return new CreateBookingResponse(b.getId(), b.getCode(), b.getStatus(), b.getPaymentUrl(), b.getPaymentId());
    }

    @Transactional
    public void onPaymentSucceeded(Long paymentId, Long bookingId) {
        if (alreadyProcessed("pay-succeeded-" + paymentId)) return;
        Booking b = bookingRepository.findById(bookingId).orElse(null);
        if (b == null) {
            log.warn("PaymentSucceeded cho booking {} không tồn tại", bookingId);
            return;
        }
        if (b.getStatus() == BookingStatus.PAID) return;

        b.setStatus(BookingStatus.PAID);
        b.setPaidAt(Instant.now());
        bookingRepository.save(b);

        // Confirm reservations (held -> sold).
        b.getItems().forEach(it -> {
            try {
                eventClient.confirm(it.getTicketTypeId(), it.getQuantity());
            } catch (Exception e) {
                log.warn("Confirm vé ticketType={} thất bại: {}", it.getTicketTypeId(), e.getMessage());
            }
        });

        publisher.publish(new BookingMessage(
                "BookingPaid", b.getId(), b.getUserId(), b.getCustomerEmail(),
                b.getEventId(), b.getEventTitle(),
                b.getItems().stream().map(it -> new BookingMessage.Item(
                        it.getTicketTypeId(), it.getTicketTypeName(), it.getQuantity())).toList(),
                Instant.now()));
    }

    @Transactional
    public void onPaymentFailed(Long paymentId, Long bookingId) {
        if (alreadyProcessed("pay-failed-" + paymentId)) return;
        Booking b = bookingRepository.findById(bookingId).orElse(null);
        if (b == null || b.getStatus() == BookingStatus.PAID) return;

        b.setStatus(BookingStatus.PAYMENT_FAILED);
        bookingRepository.save(b);
        b.getItems().forEach(it -> eventClient.release(it.getTicketTypeId(), it.getQuantity()));
    }

    @Transactional(readOnly = true)
    public BookingDto get(Long id) {
        return toDto(bookingRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Booking không tồn tại: " + id)));
    }

    @Transactional(readOnly = true)
    public List<BookingDto> byUser(Long userId) {
        return bookingRepository.findByUserIdOrderByIdDesc(userId).stream().map(this::toDto).toList();
    }

    @Transactional(readOnly = true)
    public List<BookingDto> byEvent(Long eventId) {
        return bookingRepository.findByEventIdOrderByIdDesc(eventId).stream().map(this::toDto).toList();
    }

    /** Huỷ / hoàn vé một booking (thao tác của ban tổ chức). Saga bù trừ theo trạng thái. */
    @Transactional
    public BookingDto cancel(Long bookingId) {
        Booking b = bookingRepository.findById(bookingId)
                .orElseThrow(() -> new IllegalArgumentException("Booking không tồn tại: " + bookingId));
        if (b.getStatus() == BookingStatus.CANCELLED) return toDto(b);

        if (b.getStatus() == BookingStatus.PAID) {
            // Đã thanh toán: hoàn vé về kho, hoàn tiền, huỷ vé đã phát hành.
            b.getItems().forEach(it -> eventClient.refund(it.getTicketTypeId(), it.getQuantity()));
            if (b.getPaymentId() != null) paymentClient.refund(b.getPaymentId());
            ticketClient.voidBooking(b.getId());
        } else if (b.getStatus() == BookingStatus.PENDING_PAYMENT) {
            // Chưa thanh toán: chỉ cần nhả chỗ đang giữ.
            b.getItems().forEach(it -> eventClient.release(it.getTicketTypeId(), it.getQuantity()));
        }

        b.setStatus(BookingStatus.CANCELLED);
        b = bookingRepository.save(b);

        publisher.publish(new BookingMessage(
                "BookingCancelled", b.getId(), b.getUserId(), b.getCustomerEmail(),
                b.getEventId(), b.getEventTitle(),
                b.getItems().stream().map(it -> new BookingMessage.Item(
                        it.getTicketTypeId(), it.getTicketTypeName(), it.getQuantity())).toList(),
                Instant.now()));

        return toDto(b);
    }

    private boolean alreadyProcessed(String key) {
        if (processedRepository.existsById(key)) return true;
        processedRepository.save(new ProcessedEvent(key));
        return false;
    }

    private String generateCode() {
        StringBuilder sb = new StringBuilder("TKH-");
        for (int i = 0; i < 4; i++) sb.append(ALPHABET.charAt(RANDOM.nextInt(ALPHABET.length())));
        return sb.toString();
    }

    private BookingDto toDto(Booking b) {
        return new BookingDto(b.getId(), b.getCode(), b.getUserId(), b.getCustomerEmail(),
                b.getEventId(), b.getEventTitle(), b.getTotalAmount(), b.getStatus(),
                b.getPaymentId(), b.getPaymentUrl(),
                b.getItems().stream().map(it -> new BookingItemDto(
                        it.getTicketTypeId(), it.getTicketTypeName(), it.getQuantity(),
                        it.getUnitPrice(), it.getTotalPrice())).toList(),
                b.getCreatedAt(), b.getPaidAt());
    }
}
