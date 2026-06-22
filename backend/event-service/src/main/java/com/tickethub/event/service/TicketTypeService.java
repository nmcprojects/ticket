package com.tickethub.event.service;

import com.tickethub.event.domain.Event;
import com.tickethub.event.domain.TicketType;
import com.tickethub.event.dto.EventMapper;
import com.tickethub.event.dto.TicketTypeDto;
import com.tickethub.event.dto.TicketTypeRequest;
import com.tickethub.event.exception.NotFoundException;
import com.tickethub.event.repository.TicketTypeRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;

import static com.tickethub.event.dto.EventMapper.toDto;

@Service
@RequiredArgsConstructor
public class TicketTypeService {

    private final TicketTypeRepository repository;
    private final EventService eventService;

    @Transactional(readOnly = true)
    public List<TicketTypeDto> findByEvent(Long eventId) {
        return repository.findByEventId(eventId).stream().map(EventMapper::toDto).toList();
    }

    @Transactional(readOnly = true)
    public TicketTypeDto findById(Long id) {
        return toDto(get(id));
    }

    public TicketType get(Long id) {
        return repository.findById(id).orElseThrow(() -> NotFoundException.of("TicketType", id));
    }

    @Transactional
    public TicketTypeDto create(Long eventId, TicketTypeRequest req) {
        Event event = eventService.get(eventId);
        TicketType t = new TicketType();
        t.setEvent(event);
        t.setName(req.name());
        t.setDescription(req.description());
        t.setPrice(req.price() != null ? req.price() : BigDecimal.ZERO);
        t.setCurrency(req.currency() != null ? req.currency() : "VND");
        t.setTotalQuantity(req.totalQuantity());
        t.setAvailableQuantity(req.totalQuantity());
        t.setReservedQuantity(0);
        t.setSoldQuantity(0);
        t.setMaxPerOrder(req.maxPerOrder() != null ? req.maxPerOrder() : 10);
        if (req.status() != null) t.setStatus(req.status());
        return toDto(repository.save(t));
    }

    @Transactional
    public TicketTypeDto update(Long id, TicketTypeRequest req) {
        TicketType t = get(id);
        t.setName(req.name());
        t.setDescription(req.description());
        if (req.price() != null) t.setPrice(req.price());
        if (req.currency() != null) t.setCurrency(req.currency());
        // adjust total while keeping the inventory invariant
        int delta = req.totalQuantity() - t.getTotalQuantity();
        if (delta != 0) {
            t.setTotalQuantity(req.totalQuantity());
            t.setAvailableQuantity(Math.max(0, t.getAvailableQuantity() + delta));
        }
        if (req.maxPerOrder() != null) t.setMaxPerOrder(req.maxPerOrder());
        if (req.status() != null) t.setStatus(req.status());
        return toDto(repository.save(t));
    }

    @Transactional
    public void delete(Long id) {
        if (!repository.existsById(id)) throw NotFoundException.of("TicketType", id);
        repository.deleteById(id);
    }

    // ── Inventory operations (Booking flow support) ─────────────
    // Dùng UPDATE nguyên tử (xem TicketTypeRepository) thay cho read-modify-write,
    // nên an toàn khi nhiều request giữ/xác nhận cùng một loại vé song song.
    @Transactional
    public TicketTypeDto reserve(Long id, int quantity) {
        int rows = repository.reserve(id, quantity);
        if (rows == 0) {
            // 0 dòng: id không tồn tại (get -> 404), vượt giới hạn mỗi đơn, hoặc không đủ vé.
            TicketType t = get(id);
            if (quantity > t.getMaxPerOrder()) {
                throw new IllegalStateException("Vượt giới hạn " + t.getMaxPerOrder() + " vé/đơn cho loại vé \"" + t.getName() + "\".");
            }
            throw new IllegalStateException("Không đủ vé: còn " + t.getAvailableQuantity() + ", cần " + quantity);
        }
        return toDto(get(id));
    }

    @Transactional
    public TicketTypeDto confirm(Long id, int quantity) {
        int rows = repository.confirm(id, quantity);
        if (rows == 0) {
            TicketType t = get(id);
            throw new IllegalStateException("Số vé giữ không đủ để xác nhận: " + t.getReservedQuantity());
        }
        return toDto(get(id));
    }

    @Transactional
    public TicketTypeDto release(Long id, int quantity) {
        int rows = repository.release(id, quantity);
        if (rows == 0) throw NotFoundException.of("TicketType", id); // chỉ khi id không tồn tại
        return toDto(get(id));
    }

    @Transactional
    public TicketTypeDto refund(Long id, int quantity) {
        int rows = repository.refund(id, quantity);
        if (rows == 0) throw NotFoundException.of("TicketType", id); // chỉ khi id không tồn tại
        return toDto(get(id));
    }
}
