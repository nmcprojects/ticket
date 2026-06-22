package com.tickethub.event.domain;

/** Catalog of capabilities an organization can grant to a custom role. */
public enum OrgPermission {
    EVENT_MANAGE("Quản lý sự kiện & vé"),
    ORDER_MANAGE("Quản lý đơn hàng (xem/huỷ/hoàn)"),
    CHECKIN("Check-in tại cửa"),
    MEMBER_MANAGE("Quản lý thành viên & vai trò"),
    ORG_EDIT("Chỉnh sửa hồ sơ tổ chức"),
    STATS_VIEW("Xem thống kê & báo cáo");

    public final String label;

    OrgPermission(String label) {
        this.label = label;
    }

    public static boolean isValid(String key) {
        for (OrgPermission p : values()) if (p.name().equals(key)) return true;
        return false;
    }
}
