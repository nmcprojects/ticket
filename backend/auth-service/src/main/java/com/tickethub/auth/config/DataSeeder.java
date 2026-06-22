package com.tickethub.auth.config;

import com.tickethub.auth.domain.Permission;
import com.tickethub.auth.domain.Role;
import com.tickethub.auth.domain.User;
import com.tickethub.auth.domain.UserStatus;
import com.tickethub.auth.repository.PermissionRepository;
import com.tickethub.auth.repository.RoleRepository;
import com.tickethub.auth.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;

/**
 * Seeds RBAC + accounts. Users are inserted in a FIXED order so other services can
 * reference their ids (id 1 = demo buyer; ids 5..16 = organization owners, in the
 * same order the event-service DataSeeder creates the organizations).
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class DataSeeder implements CommandLineRunner {

    private final PermissionRepository permissionRepository;
    private final RoleRepository roleRepository;
    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;

    private final Map<String, Permission> perms = new HashMap<>();
    private final Map<String, Role> roles = new HashMap<>();

    // Owner of each organization (order must match event-service DataSeeder.ORGS → ids 5..16).
    private static final String[][] OWNERS = {
        {"absolute@tickethub.vn",   "Absolute Media"},
        {"viechannel@tickethub.vn", "Vie Channel"},
        {"yeah1@tickethub.vn",      "YEAH1"},
        {"vi21@tickethub.vn",       "Vi21 Media"},
        {"idecaf@tickethub.vn",     "Sân khấu IDECAF"},
        {"metashow@tickethub.vn",   "Metashow Exhibition"},
        {"gardenart@tickethub.vn",  "Garden Art"},
        {"soulmate@tickethub.vn",   "Whats A Soulmate?"},
        {"newsports@tickethub.vn",  "New Sports"},
        {"saigonheat@tickethub.vn", "Saigon Heat"},
        {"americaasia@tickethub.vn","America & Asia"},
        {"noiconnect@tickethub.vn", "Nói Connect"},
        {"vietvision@tickethub.vn", "VIET VISION"},
        {"momang@tickethub.vn",     "Những Thành Phố Mơ Màng"},
        {"tanthaixuong@tickethub.vn","Tân Thái Xương"},
        {"thiendang@tickethub.vn",  "Sân khấu Thiên Đăng"},
        {"greenery@tickethub.vn",   "The Greenery Art"},
        {"tutorx@tickethub.vn",     "The TutorX"},
    };

    @Override
    public void run(String... args) {
        if (userRepository.count() > 0) return;
        log.info("Seeding RBAC + tài khoản cho auth_db...");

        // ── Permissions ─────────────────────────────────────────
        perm("AUTH_ME", "Xem hồ sơ", "AUTH", "ME");
        perm("EVENT_VIEW", "Xem sự kiện", "EVENT", "VIEW");
        perm("EVENT_CREATE", "Tạo sự kiện", "EVENT", "CREATE");
        perm("EVENT_UPDATE", "Sửa sự kiện", "EVENT", "UPDATE");
        perm("EVENT_DELETE", "Xoá sự kiện", "EVENT", "DELETE");
        perm("TICKET_TYPE_CREATE", "Tạo loại vé", "TICKET_TYPE", "CREATE");
        perm("TICKET_TYPE_UPDATE", "Sửa loại vé", "TICKET_TYPE", "UPDATE");
        perm("BOOKING_CREATE", "Đặt vé", "BOOKING", "CREATE");
        perm("BOOKING_VIEW_OWN", "Xem booking của mình", "BOOKING", "VIEW_OWN");
        perm("BOOKING_CANCEL", "Huỷ booking", "BOOKING", "CANCEL");
        perm("PAYMENT_CREATE", "Thanh toán", "PAYMENT", "CREATE");
        perm("PAYMENT_VIEW_OWN", "Xem thanh toán của mình", "PAYMENT", "VIEW_OWN");
        perm("TICKET_VIEW_OWN", "Xem vé của mình", "TICKET", "VIEW_OWN");
        perm("TICKET_CHECK_IN", "Check-in vé", "TICKET", "CHECK_IN");
        perm("NOTIFICATION_VIEW_OWN", "Xem thông báo", "NOTIFICATION", "VIEW_OWN");
        perm("USER_VIEW", "Xem người dùng", "USER", "VIEW");
        perm("USER_DISABLE", "Vô hiệu hoá người dùng", "USER", "DISABLE");
        perm("EVENT_MANAGE_ALL", "Quản lý mọi sự kiện", "EVENT", "MANAGE_ALL");
        perm("BOOKING_VIEW_ALL", "Xem mọi booking", "BOOKING", "VIEW_ALL");
        perm("PAYMENT_VIEW_ALL", "Xem mọi thanh toán", "PAYMENT", "VIEW_ALL");
        perm("TICKET_VIEW_ALL", "Xem mọi vé", "TICKET", "VIEW_ALL");

        // ── Roles ───────────────────────────────────────────────
        role("CUSTOMER", "Khách hàng", "AUTH_ME", "EVENT_VIEW", "BOOKING_CREATE",
                "BOOKING_VIEW_OWN", "BOOKING_CANCEL", "PAYMENT_CREATE", "PAYMENT_VIEW_OWN",
                "TICKET_VIEW_OWN", "NOTIFICATION_VIEW_OWN");
        role("ORGANIZER", "Nhà tổ chức", "AUTH_ME", "EVENT_VIEW", "EVENT_CREATE",
                "EVENT_UPDATE", "TICKET_TYPE_CREATE", "TICKET_TYPE_UPDATE");
        role("STAFF", "Nhân viên check-in", "AUTH_ME", "EVENT_VIEW", "TICKET_CHECK_IN");
        role("ADMIN", "Quản trị hệ thống", "AUTH_ME", "USER_VIEW", "USER_DISABLE",
                "EVENT_MANAGE_ALL", "BOOKING_VIEW_ALL", "PAYMENT_VIEW_ALL", "TICKET_VIEW_ALL");

        // ── Accounts (mật khẩu: "password") — ORDER IS SIGNIFICANT ──
        // id 1: demo buyer
        user("an@example.com", "Nguyễn Minh An", "0903 123 456", avatar(12), Set.of("CUSTOMER"));
        // id 2: admin
        user("admin@tickethub.vn", "Quản trị viên", "1900 0000", avatar(68), Set.of("ADMIN", "ORGANIZER", "STAFF", "CUSTOMER"));
        // id 3, 4: shared check-in staff (added as members to several organizations)
        user("vy@tickethub.vn", "Trần Vy", "0908 777 888", avatar(47), Set.of("STAFF", "CUSTOMER"));
        user("dang@tickethub.vn", "Phạm Đăng", "0907 222 333", avatar(13), Set.of("STAFF", "CUSTOMER"));
        // id 5..16: one owner account per organization
        for (int i = 0; i < OWNERS.length; i++) {
            user(OWNERS[i][0], OWNERS[i][1], "1900 " + (1000 + i), avatar(15 + i),
                    Set.of("ORGANIZER", "STAFF", "CUSTOMER"));
        }

        log.info("Seed xong: {} permission, {} role, {} user",
                permissionRepository.count(), roleRepository.count(), userRepository.count());
        log.info("Đăng nhập demo (mật khẩu 'password'): an@example.com, admin@tickethub.vn, " +
                "và các tổ chức: absolute@tickethub.vn, idecaf@tickethub.vn, newsports@tickethub.vn, ...");
    }

    private static String avatar(int n) {
        return "https://i.pravatar.cc/120?img=" + n;
    }

    private void perm(String code, String name, String module, String action) {
        perms.put(code, permissionRepository.save(new Permission(code, name, module, action)));
    }

    private void role(String code, String name, String... permCodes) {
        Role r = new Role(code, name);
        Map<String, Permission> ordered = new LinkedHashMap<>();
        for (String pc : permCodes) ordered.put(pc, perms.get(pc));
        r.getPermissions().addAll(ordered.values());
        roles.put(code, roleRepository.save(r));
    }

    private void user(String email, String fullName, String phone, String avatar, Set<String> roleCodes) {
        User u = new User();
        u.setEmail(email);
        u.setPasswordHash(passwordEncoder.encode("password"));
        u.setFullName(fullName);
        u.setPhoneNumber(phone);
        u.setAvatarUrl(avatar);
        u.setStatus(UserStatus.ACTIVE);
        roleCodes.forEach(rc -> u.getRoles().add(roles.get(rc)));
        userRepository.save(u);
    }
}
