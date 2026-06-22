package com.tickethub.ticket.dto;

import com.tickethub.ticket.domain.CheckinLog;
import com.tickethub.ticket.domain.Ticket;

public final class TicketMapper {

    private TicketMapper() {
    }

    public static TicketDto toDto(Ticket t) {
        return new TicketDto(
                t.getId(), t.getBookingId(), t.getBookingItemId(), t.getUserId(),
                t.getCustomerEmail(), t.getEventId(), t.getEventTitle(),
                t.getTicketTypeId(), t.getTicketTypeName(), t.getTicketCode(),
                t.getQrPayload(), t.getStatus(), t.getIssuedAt(), t.getCheckedInAt()
        );
    }

    public static CheckinLogDto toDto(CheckinLog l) {
        return new CheckinLogDto(
                l.getId(), l.getTicketId(), l.getTicketCode(), l.getStaffId(),
                l.getEventId(), l.getResult(), l.getMessage(), l.getCheckedInAt()
        );
    }
}
