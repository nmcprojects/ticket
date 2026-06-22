package com.tickethub.event.repository;

import com.tickethub.event.domain.TicketType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface TicketTypeRepository extends JpaRepository<TicketType, Long> {
    List<TicketType> findByEventId(Long eventId);

    // ── Atomic inventory ops ────────────────────────────────────
    // Mỗi thao tác là MỘT câu UPDATE có điều kiện: DB chỉ giữ row-lock trong thời
    // gian câu lệnh chạy (không qua cả transaction), chống oversell ngay ở mức
    // isolation READ_COMMITTED mặc định mà không cần khóa bi quan / @Version.
    // Trả về số dòng bị ảnh hưởng: 0 nghĩa là điều kiện không thỏa (hết vé / không đủ giữ).

    /** Giữ chỗ: chỉ thành công khi còn đủ vé (available >= q) VÀ không vượt giới hạn mỗi đơn (q <= maxPerOrder). */
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("""
            UPDATE TicketType t
               SET t.availableQuantity = t.availableQuantity - :q,
                   t.reservedQuantity  = t.reservedQuantity  + :q,
                   t.status = CASE
                       WHEN t.status = com.tickethub.event.domain.TicketTypeStatus.DISABLED THEN t.status
                       WHEN t.availableQuantity - :q <= 0 THEN com.tickethub.event.domain.TicketTypeStatus.SOLD_OUT
                       ELSE com.tickethub.event.domain.TicketTypeStatus.SELLING END
             WHERE t.id = :id AND t.availableQuantity >= :q AND t.maxPerOrder >= :q
            """)
    int reserve(@Param("id") Long id, @Param("q") int q);

    /** Xác nhận (giữ -> đã bán): chỉ thành công khi đang giữ đủ (reserved >= q). available không đổi nên status giữ nguyên. */
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("""
            UPDATE TicketType t
               SET t.reservedQuantity = t.reservedQuantity - :q,
                   t.soldQuantity     = t.soldQuantity     + :q
             WHERE t.id = :id AND t.reservedQuantity >= :q
            """)
    int confirm(@Param("id") Long id, @Param("q") int q);

    /** Hoàn chỗ (bù trừ): trả lại tối đa số đang giữ (least(q, reserved)), không bao giờ âm. */
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("""
            UPDATE TicketType t
               SET t.availableQuantity = t.availableQuantity + (CASE WHEN t.reservedQuantity < :q THEN t.reservedQuantity ELSE :q END),
                   t.reservedQuantity  = t.reservedQuantity  - (CASE WHEN t.reservedQuantity < :q THEN t.reservedQuantity ELSE :q END),
                   t.status = CASE
                       WHEN t.status = com.tickethub.event.domain.TicketTypeStatus.DISABLED THEN t.status
                       WHEN t.availableQuantity + (CASE WHEN t.reservedQuantity < :q THEN t.reservedQuantity ELSE :q END) <= 0
                            THEN com.tickethub.event.domain.TicketTypeStatus.SOLD_OUT
                       ELSE com.tickethub.event.domain.TicketTypeStatus.SELLING END
             WHERE t.id = :id
            """)
    int release(@Param("id") Long id, @Param("q") int q);

    /** Hoàn vé đã bán (sold -> available): trả lại tối đa số đã bán (least(q, sold)), không bao giờ âm. Dùng khi BTC huỷ/hoàn vé. */
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("""
            UPDATE TicketType t
               SET t.availableQuantity = t.availableQuantity + (CASE WHEN t.soldQuantity < :q THEN t.soldQuantity ELSE :q END),
                   t.soldQuantity      = t.soldQuantity      - (CASE WHEN t.soldQuantity < :q THEN t.soldQuantity ELSE :q END),
                   t.status = CASE
                       WHEN t.status = com.tickethub.event.domain.TicketTypeStatus.DISABLED THEN t.status
                       WHEN t.availableQuantity + (CASE WHEN t.soldQuantity < :q THEN t.soldQuantity ELSE :q END) > 0
                            THEN com.tickethub.event.domain.TicketTypeStatus.SELLING
                       ELSE com.tickethub.event.domain.TicketTypeStatus.SOLD_OUT END
             WHERE t.id = :id
            """)
    int refund(@Param("id") Long id, @Param("q") int q);
}
