package com.tickethub.booking.service;

import com.tickethub.booking.client.EventClient;
import com.tickethub.booking.client.PaymentClient;
import com.tickethub.booking.domain.Booking;
import com.tickethub.booking.domain.BookingStatus;
import com.tickethub.booking.domain.ProcessedEvent;
import com.tickethub.booking.dto.BookingDtos.BookingItemRequest;
import com.tickethub.booking.dto.BookingDtos.CreateBookingRequest;
import com.tickethub.booking.dto.BookingDtos.CreateBookingResponse;
import com.tickethub.booking.kafka.BookingEventPublisher;
import com.tickethub.booking.kafka.BookingMessage;
import com.tickethub.booking.repository.BookingRepository;
import com.tickethub.booking.repository.ProcessedEventRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.math.BigDecimal;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

/**
 * Fast Mockito unit tests for the choreography Saga orchestrated by {@link BookingService}.
 * All collaborators (EventClient, PaymentClient, publisher, repos) are mocked — no Spring,
 * no Docker, no Kafka.
 */
@ExtendWith(MockitoExtension.class)
class BookingServiceTest {

    @Mock private BookingRepository bookingRepository;
    @Mock private ProcessedEventRepository processedRepository;
    @Mock private EventClient eventClient;
    @Mock private PaymentClient paymentClient;
    @Mock private BookingEventPublisher publisher;

    @InjectMocks private BookingService service;

    @BeforeEach
    void setUp() {
        ReflectionTestUtils.setField(service, "frontendUrl", "http://front.local");
    }

    private CreateBookingRequest twoItemRequest() {
        return new CreateBookingRequest(10L, "Concert", List.of(
                new BookingItemRequest(1L, "VIP", 2, new BigDecimal("100")),
                new BookingItemRequest(2L, "STD", 3, new BigDecimal("50"))));
    }

    /** Makes bookingRepository.save assign an id and echo the entity back. */
    private void stubSaveAssignsId() {
        when(bookingRepository.save(any(Booking.class))).thenAnswer(inv -> {
            Booking b = inv.getArgument(0);
            if (b.getId() == null) b.setId(77L);
            return b;
        });
    }

    @Test
    void create_happyPath_reservesPersistsCheckoutAndReturnsResponse() {
        stubSaveAssignsId();
        when(paymentClient.createCheckout(anyLong(), anyLong(), any(), anyString(), anyString(), anyString()))
                .thenReturn(new PaymentClient.CheckoutSession(999L, 555L, "http://pay/checkout", "PENDING"));

        CreateBookingResponse resp = service.create(42L, "u@x.com", twoItemRequest());

        // reserve called once per item, never released on success
        verify(eventClient).reserve(1L, 2);
        verify(eventClient).reserve(2L, 3);
        verify(eventClient, never()).release(anyLong(), org.mockito.ArgumentMatchers.anyInt());

        // checkout created with total = 2*100 + 3*50 = 350
        ArgumentCaptor<BigDecimal> amount = ArgumentCaptor.forClass(BigDecimal.class);
        verify(paymentClient).createCheckout(eq(77L), eq(42L), amount.capture(), anyString(), anyString(), anyString());
        assertThat(amount.getValue()).isEqualByComparingTo("350");

        // persisted booking is PENDING_PAYMENT with payment fields stored
        ArgumentCaptor<Booking> saved = ArgumentCaptor.forClass(Booking.class);
        verify(bookingRepository, times(2)).save(saved.capture());
        Booking finalState = saved.getAllValues().get(saved.getAllValues().size() - 1);
        assertThat(finalState.getStatus()).isEqualTo(BookingStatus.PENDING_PAYMENT);
        assertThat(finalState.getPaymentId()).isEqualTo(999L);
        assertThat(finalState.getPaymentUrl()).isEqualTo("http://pay/checkout");

        // response carries booking id, status and payment url/id
        assertThat(resp.bookingId()).isEqualTo(77L);
        assertThat(resp.status()).isEqualTo(BookingStatus.PENDING_PAYMENT);
        assertThat(resp.paymentUrl()).isEqualTo("http://pay/checkout");
        assertThat(resp.paymentId()).isEqualTo(999L);
    }

    @Test
    void create_reserveFailsOnSecondItem_releasesAlreadyReservedAndThrows_noPaidState() {
        // first reserve (1,2) succeeds; second (ticketTypeId=2, qty=3) throws -> compensation releases item 1.
        // lenient() so strict-stubs doesn't flag the (1,2) call as a stubbing mismatch on reserve().
        org.mockito.Mockito.lenient()
                .doThrow(new RuntimeException("sold out"))
                .when(eventClient).reserve(2L, 3);

        assertThatThrownBy(() -> service.create(42L, "u@x.com", twoItemRequest()))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("Không giữ được vé");

        // only the already-reserved first item is released
        verify(eventClient).release(1L, 2);
        verify(eventClient, never()).release(2L, 3);

        // saga aborted before booking/checkout — nothing persisted, no payment, no publish
        verifyNoInteractions(bookingRepository, paymentClient, publisher);
    }

    @Test
    void create_paymentFails_releasesReservedMarksPaymentFailedAndThrows() {
        stubSaveAssignsId();
        doThrow(new RuntimeException("gateway down")).when(paymentClient)
                .createCheckout(anyLong(), anyLong(), any(), anyString(), anyString(), anyString());

        assertThatThrownBy(() -> service.create(42L, "u@x.com", twoItemRequest()))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("Không tạo được phiên thanh toán");

        // both reserved items released as compensation
        verify(eventClient).release(1L, 2);
        verify(eventClient).release(2L, 3);

        // booking persisted then re-saved as PAYMENT_FAILED; never published
        ArgumentCaptor<Booking> saved = ArgumentCaptor.forClass(Booking.class);
        verify(bookingRepository, times(2)).save(saved.capture());
        Booking finalState = saved.getAllValues().get(saved.getAllValues().size() - 1);
        assertThat(finalState.getStatus()).isEqualTo(BookingStatus.PAYMENT_FAILED);
        verifyNoInteractions(publisher);
    }

    @Test
    void onPaymentSucceeded_marksPaidConfirmsEachItemAndPublishesBookingPaid() {
        Booking b = bookingWithTwoItems();
        when(processedRepository.existsById("pay-succeeded-999")).thenReturn(false);
        when(bookingRepository.findById(77L)).thenReturn(java.util.Optional.of(b));

        service.onPaymentSucceeded(999L, 77L);

        assertThat(b.getStatus()).isEqualTo(BookingStatus.PAID);
        assertThat(b.getPaidAt()).isNotNull();
        verify(eventClient).confirm(1L, 2);
        verify(eventClient).confirm(2L, 3);

        ArgumentCaptor<BookingMessage> msg = ArgumentCaptor.forClass(BookingMessage.class);
        verify(publisher).publish(msg.capture());
        assertThat(msg.getValue().eventType()).isEqualTo("BookingPaid");
        assertThat(msg.getValue().bookingId()).isEqualTo(77L);
        assertThat(msg.getValue().items()).hasSize(2);
    }

    @Test
    void onPaymentSucceeded_calledTwice_processesSideEffectsOnlyOnce() {
        Booking b = bookingWithTwoItems();
        // simulate ProcessedEvent dedup: first call not processed, second call already processed
        Map<String, ProcessedEvent> store = new HashMap<>();
        when(processedRepository.existsById("pay-succeeded-999"))
                .thenAnswer(inv -> store.containsKey("pay-succeeded-999"));
        when(processedRepository.save(any(ProcessedEvent.class))).thenAnswer(inv -> {
            ProcessedEvent pe = inv.getArgument(0);
            store.put(pe.getMessageKey(), pe);
            return pe;
        });
        when(bookingRepository.findById(77L)).thenReturn(java.util.Optional.of(b));

        service.onPaymentSucceeded(999L, 77L);
        service.onPaymentSucceeded(999L, 77L);

        // confirm + publish happen exactly once despite two invocations
        verify(eventClient, times(1)).confirm(1L, 2);
        verify(eventClient, times(1)).confirm(2L, 3);
        verify(publisher, times(1)).publish(any(BookingMessage.class));
    }

    @Test
    void onPaymentFailed_marksPaymentFailedAndReleasesEachItem() {
        Booking b = bookingWithTwoItems();
        when(processedRepository.existsById("pay-failed-999")).thenReturn(false);
        when(bookingRepository.findById(77L)).thenReturn(java.util.Optional.of(b));

        service.onPaymentFailed(999L, 77L);

        assertThat(b.getStatus()).isEqualTo(BookingStatus.PAYMENT_FAILED);
        verify(bookingRepository).save(b);
        // each reserved item released as compensation
        verify(eventClient).release(1L, 2);
        verify(eventClient).release(2L, 3);
        // a failed payment never publishes a BookingPaid event
        verifyNoInteractions(publisher);
    }

    private Booking bookingWithTwoItems() {
        Booking b = new Booking();
        b.setId(77L);
        b.setCode("TKH-ABCD");
        b.setUserId(42L);
        b.setCustomerEmail("u@x.com");
        b.setEventId(10L);
        b.setEventTitle("Concert");
        b.setStatus(BookingStatus.PENDING_PAYMENT);
        com.tickethub.booking.domain.BookingItem i1 = new com.tickethub.booking.domain.BookingItem();
        i1.setTicketTypeId(1L);
        i1.setTicketTypeName("VIP");
        i1.setQuantity(2);
        b.addItem(i1);
        com.tickethub.booking.domain.BookingItem i2 = new com.tickethub.booking.domain.BookingItem();
        i2.setTicketTypeId(2L);
        i2.setTicketTypeName("STD");
        i2.setQuantity(3);
        b.addItem(i2);
        return b;
    }
}
