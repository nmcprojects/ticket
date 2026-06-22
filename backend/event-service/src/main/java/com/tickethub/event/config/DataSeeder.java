package com.tickethub.event.config;

import com.tickethub.event.domain.*;
import com.tickethub.event.repository.EventRepository;
import com.tickethub.event.repository.OrganizerMemberRepository;
import com.tickethub.event.repository.OrganizerRepository;
import com.tickethub.event.repository.OrganizerRoleRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Arrays;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Seeds real events crawled from ticketbox.vn (titles, venues, organizers and poster
 * images are real; dates are shifted to upcoming so the demo is browsable, and prices
 * use realistic VND tiers since they are not exposed in the page markup).
 *
 * Also seeds COMPLETE organizer management: each organization owns its events, has the
 * three default roles (Chủ tổ chức / Quản lý / Nhân viên check-in) and real members
 * (the owner + shared check-in staff) linked to auth_db accounts.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class DataSeeder implements CommandLineRunner {

    private final OrganizerRepository organizerRepository;
    private final OrganizerRoleRepository roleRepository;
    private final OrganizerMemberRepository memberRepository;
    private final EventRepository eventRepository;

    // auth_db user ids of the two shared check-in staff (see auth-service DataSeeder).
    private static final long STAFF_VY = 3L;
    private static final long STAFF_DANG = 4L;

    private static final Org[] ORGS = {
        new Org("Absolute Media", "1900 1000", 5L, "absolute@tickethub.vn", "Absolute Media", true,
                "https://salt.tkbcdn.com/ts/ds/eb/f4/4a/e9de0df799a5d28d2bb9dfa010b5ecbd.png",
                "Đơn vị sản xuất các liveshow và hoà nhạc nghệ thuật chất lượng cao như Giao Hưởng Mùa Yêu, Góc Ban Công."),
        new Org("Vie Channel", "1900 1001", 6L, "viechannel@tickethub.vn", "Vie Channel", true,
                "https://salt.tkbcdn.com/ts/ds/4c/d4/3b/d002a1011fe2ade59460341bd699f7a0.png",
                "Đơn vị sản xuất chương trình giải trí và truyền hình, mang đến các concert quy mô lớn như Anh Trai Say Hi."),
        new Org("YEAH1", "1900 1002", 7L, "yeah1@tickethub.vn", "YEAH1", true,
                "https://salt.tkbcdn.com/ts/ds/8e/04/37/1ddfc085fb9a5139065d63507f544d86.jpg",
                "Tập đoàn truyền thông giải trí YEAH1 — sản xuất các đại nhạc hội và show quy mô lớn."),
        new Org("Vi21 Media", "1900 1003", 8L, "vi21@tickethub.vn", "Vi21 Media", true,
                "https://salt.tkbcdn.com/ts/ds/66/a5/7b/b3719ed75df3bbf122eb0db9614258a8.png",
                "Công ty truyền thông tổ chức các đêm nhạc hoài niệm và sự kiện văn hoá."),
        new Org("Sân khấu IDECAF", "1900 1004", 9L, "idecaf@tickethub.vn", "Sân khấu IDECAF", true,
                "https://salt.tkbcdn.com/ts/ds/7d/fc/85/481ef3de9970b4bf4abe2a23e32da2ba.png",
                "Thương hiệu sân khấu kịch hàng đầu TP.HCM (Cty Thái Dương), thành lập 1997, nổi tiếng với Ngày Xửa Ngày Xưa."),
        new Org("Metashow Exhibition", "1900 1005", 10L, "metashow@tickethub.vn", "Metashow Exhibition", true,
                "https://salt.tkbcdn.com/ts/ds/79/09/7c/2a486aea3d9b361dc2ca358dfce3fc07.jpg",
                "Đơn vị tổ chức triển lãm nghệ thuật ánh sáng và trải nghiệm tương tác."),
        new Org("Garden Art", "1900 1006", 11L, "gardenart@tickethub.vn", "Garden Art", false,
                "https://salt.tkbcdn.com/ts/ds/d0/d6/ed/d4564b666ae1a0f1916d36aa0e632a77.png",
                "Không gian trải nghiệm workshop nghệ thuật: vẽ tranh, terrarium và đồ handmade."),
        new Org("Whats A Soulmate?", "1900 1007", 12L, "soulmate@tickethub.vn", "Whats A Soulmate?", false,
                "https://static.tkbcdn.com/Upload/avatar.png",
                "Đơn vị tổ chức workshop trải nghiệm nghệ thuật và thủ công thư giãn."),
        new Org("New Sports", "1900 1008", 13L, "newsports@tickethub.vn", "New Sports", true,
                "https://salt.tkbcdn.com/ts/ds/4f/66/9a/f585c590813b29fcc7ce0b90d7bb2c8a.png",
                "Đơn vị phát triển và vận hành sự kiện thể thao chuẩn quốc tế tại Việt Nam (pickleball, bóng rổ)."),
        new Org("Saigon Heat", "1900 1009", 14L, "saigonheat@tickethub.vn", "Saigon Heat", true,
                "https://salt.tkbcdn.com/ts/ds/b8/a6/61/b956f78a3ed8a4d239daebd354ec4f85.png",
                "Đội bóng rổ chuyên nghiệp đầu tiên của Việt Nam (2011), nhiều lần vô địch giải VBA."),
        new Org("America & Asia", "1900 1010", 15L, "americaasia@tickethub.vn", "America & Asia", false,
                "https://static.tkbcdn.com/Upload/organizerlogo/2024/03/27/967160.jpg",
                "Đơn vị tiên phong trong lĩnh vực giáo dục thể thao và giải trí tại Đà Nẵng."),
        new Org("Nói Connect", "1900 1011", 16L, "noiconnect@tickethub.vn", "Nói Connect", false,
                "https://salt.tkbcdn.com/ts/ds/df/55/7a/2fb859e50fbe48f6ab22eede35888a48.png",
                "Cộng đồng và lớp học phát triển kỹ năng giọng nói, thuyết trình và kết nối."),
        new Org("VIET VISION", "1900 1012", 17L, "vietvision@tickethub.vn", "VIET VISION", true,
                "https://salt.tkbcdn.com/ts/ds/03/02/94/b5392da8ff03b7ce1f17f1914d0c50c7.png",
                "Công ty tổ chức sự kiện và concert quy mô lớn (Forestival, Hà Anh Tuấn The Rose)."),
        new Org("Những Thành Phố Mơ Màng", "1900 1013", 18L, "momang@tickethub.vn", "Những Thành Phố Mơ Màng", true,
                "https://salt.tkbcdn.com/ts/ds/ea/6f/9c/a012e52f7228bd025408270365586a67.jpg",
                "Chuỗi nhạc hội indie acoustic ngoài trời được yêu thích khắp Việt Nam."),
        new Org("Tân Thái Xương", "1900 1014", 19L, "tanthaixuong@tickethub.vn", "Tân Thái Xương", true,
                "https://salt.tkbcdn.com/ts/ds/13/13/63/1608366ca676485ca2936239bee7099d.png",
                "Đơn vị tổ chức đại nhạc hội K-Pop và sự kiện giải trí quy mô lớn."),
        new Org("Sân khấu Thiên Đăng", "1900 1015", 20L, "thiendang@tickethub.vn", "Sân khấu Thiên Đăng", true,
                "https://salt.tkbcdn.com/Upload/organizerlogo/2023/08/15/99DD16.jpg",
                "Sân khấu kịch nghệ thuật do NSƯT Thành Lộc sáng lập, dàn dựng các vở kịch chất lượng."),
        new Org("The Greenery Art", "1900 1016", 21L, "greenery@tickethub.vn", "The Greenery Art", false,
                "https://salt.tkbcdn.com/ts/ds/c4/48/c8/c53b6ca4fea75bb9e39cf78562e4cf97.png",
                "Studio workshop vẽ tranh canvas và trải nghiệm nghệ thuật sáng tạo."),
        new Org("The TutorX", "1900 1017", 22L, "tutorx@tickethub.vn", "The TutorX", false,
                "https://salt.tkbcdn.com/ts/ds/af/67/3b/4f23875375628a3d07d54b7b67239848.png",
                "Học viện tổ chức workshop vẽ tranh và trải nghiệm sáng tạo Color of Joy."),
    };

    private static final Ev[] EVENTS = {
        new Ev(0, "Giao Hưởng Mùa Yêu — Live Concert Đặc Biệt", "Âm nhạc",
                "Nhà Hát Hồ Gươm", "Hà Nội",
                "https://salt.tkbcdn.com/ts/ds/ca/fe/cf/8325906dbf8e970dee5bd1a4acb053de.jpg",
                12, 3, "CONCERT",
                "Live Concert kết hợp âm nhạc hiện đại và dàn nhạc semi-classical tinh tế, sản xuất bởi Absolute Media."),
        new Ev(0, "Liveshow Góc Ban Công: Vệt Nắng", "Âm nhạc",
                "TT Văn hoá Thể thao Quần Ngựa", "Hà Nội",
                "https://salt.tkbcdn.com/ts/ds/52/96/35/b73cf6db01fa3541951377c518182f15.jpg",
                26, 3, "CONCERT",
                "Đêm nhạc với Tuấn Hưng, Lệ Quyên, Đăng Khôi, Phúc Tiệp, Hà Anh và nhiều nghệ sĩ khách mời."),
        new Ev(1, "Anh Trai \"Say Hi\" 2025 Concert — Đêm 2", "Âm nhạc",
                "Sân Vận Động Quốc Gia Mỹ Đình", "Hà Nội",
                "https://salt.tkbcdn.com/ts/ds/be/41/57/f201a54f6e9b984749fcd7d5ac3992a1.png",
                40, 4, "CONCERT_BIG",
                "Concert quy mô sân vận động của chương trình Anh Trai Say Hi, sản xuất bởi VieChannel."),
        new Ev(2, "Y-Concert by YEAH1", "Âm nhạc",
                "Vinhomes Ocean Park 3", "Hưng Yên",
                "https://salt.tkbcdn.com/ts/ds/8e/89/4c/407e32bba0e4d1651175680a2452954e.jpg",
                33, 4, "CONCERT_BIG",
                "Đại nhạc hội YEAH1 x 1Production với dàn line-up đình đám."),
        new Ev(3, "Concert Vé Về Thanh Xuân", "Âm nhạc",
                "Cung Điền Kinh Mỹ Đình", "Hà Nội",
                "https://salt.tkbcdn.com/ts/ds/b9/e0/85/ed5490af6170540225747b74f8d98fb4.png",
                54, 3, "CONCERT",
                "Đêm nhạc hoài niệm thanh xuân, tổ chức bởi Vi21 Media & HCC Productions."),

        new Ev(4, "Nhà Hát Kịch IDECAF: NXNX36 — Hậu Duệ Thần Mặt Trời", "Sân khấu",
                "Nhà Hát Bến Thành", "TP. Hồ Chí Minh",
                "https://salt.tkbcdn.com/ts/ds/5f/f6/12/0cd025b035cb58dfe10a28830f5e5ea5.jpg",
                8, 2, "THEATER",
                "Chương trình Ngày Xửa Ngày Xưa số 36 dành cho thiếu nhi và gia đình."),
        new Ev(4, "Nhà Hát Kịch IDECAF: Thuốc Đắng Giã Tật", "Sân khấu",
                "Sân khấu kịch IDECAF", "TP. Hồ Chí Minh",
                "https://salt.tkbcdn.com/ts/ds/bc/39/97/0bcedd8331d17bee81b65261a29976c2.jpg",
                15, 2, "THEATER",
                "Vở kịch hài đặc sắc của Nhà Hát Kịch IDECAF."),
        new Ev(4, "Nhà Hát Kịch IDECAF: Làng Vô Tặc", "Sân khấu",
                "Nhà Hát Kịch IDECAF", "TP. Hồ Chí Minh",
                "https://salt.tkbcdn.com/ts/ds/db/d9/6b/7ef0f96eb6bc673df8fd0a7163f1a640.jpg",
                21, 2, "THEATER",
                "Vở diễn mới của thương hiệu kịch IDECAF."),
        new Ev(4, "Nhà Hát Kịch IDECAF: NXNX37 — Học Viện Phép Thuật", "Sân khấu",
                "Nhà Hát Bến Thành", "TP. Hồ Chí Minh",
                "https://salt.tkbcdn.com/ts/ds/6e/ab/b4/0f6935c65156a20082bc6b7b4456389c.jpg",
                30, 2, "THEATER",
                "Ngày Xửa Ngày Xưa số 37 — nhạc kịch thiếu nhi."),
        new Ev(4, "Nhà Hát Kịch IDECAF: 12 Bà Mụ", "Sân khấu",
                "Nhà Hát Kịch IDECAF", "TP. Hồ Chí Minh",
                "https://salt.tkbcdn.com/ts/ds/7c/18/6f/b32013793b1dbda15606e1cca4ab40ac.jpg",
                18, 2, "THEATER",
                "Vở kịch dân gian đặc sắc của IDECAF."),
        new Ev(4, "Nhà Hát Kịch IDECAF: Tấm Cám Đại Chiến!", "Sân khấu",
                "Nhà Hát Kịch IDECAF", "TP. Hồ Chí Minh",
                "https://salt.tkbcdn.com/ts/ds/12/c5/75/d09af12e58cebe049ce432dcf109e26b.jpg",
                36, 2, "THEATER",
                "Phiên bản cổ tích Tấm Cám hài hước, dàn dựng công phu."),

        new Ev(5, "Metashow — Triển Lãm Nghệ Thuật Ánh Sáng", "Nghệ thuật",
                "Lầu 4, Thiso Mall Sala", "TP. Hồ Chí Minh",
                "https://salt.tkbcdn.com/ts/ds/3e/bb/d4/2d72f27d8a1273bed60ea05f408cccda.jpg",
                5, 10, "ART",
                "Triển lãm sắp đặt ánh sáng Metashow — không gian nghệ thuật tương tác."),

        new Ev(6, "Garden Art Workshop: Terrarium Cake", "Workshop",
                "Garden Art Studio", "TP. Hồ Chí Minh",
                "https://salt.tkbcdn.com/ts/ds/f8/b9/66/b4bae6ec9cf07154f52ae4c722f7267b.jpg",
                7, 3, "WORKSHOP",
                "Workshop nghệ thuật làm tiểu cảnh terrarium hình bánh kem tại Garden Art."),
        new Ev(7, "Workshop Bày Đặt Móc Len ở Bình Thạnh", "Workshop",
                "BAMOS Coffee, Bình Thạnh", "TP. Hồ Chí Minh",
                "https://images.tkbcdn.com/1/1560/600/Upload/eventcover/2023/10/18/B818A2.jpg",
                10, 3, "WORKSHOP",
                "Buổi workshop trải nghiệm móc len thư giãn cùng Whats A Soulmate?"),

        new Ev(8, "PPA Asia 1000 — MB Hanoi Cup 2026 (Pickleball)", "Thể thao",
                "Cung Điền Kinh Mỹ Đình", "Hà Nội",
                "https://salt.tkbcdn.com/ts/ds/66/c4/1a/829f6d0533407aaa5a134c541e6f9bb9.png",
                45, 6, "SPORT",
                "Giải pickleball quốc tế PPA Asia 1000 do UPA Asia & New Sports tổ chức."),
        new Ev(8, "Hanoi Pro-Am Basketball Championship 2026", "Thể thao",
                "Nhà Thi Đấu Cầu Giấy", "Hà Nội",
                "https://salt.tkbcdn.com/ts/ds/7f/66/cc/fb7e3ff3e6c96e8aceed9b4a875222f8.jpg",
                28, 3, "SPORT",
                "Giải bóng rổ Pro-Am Hà Nội 2026 do New Sports tổ chức."),
        new Ev(9, "VBA 2026 — Saigon Heat vs Can Tho Catfish", "Thể thao",
                "Nhà thi đấu MLC (CIS Arena)", "TP. Hồ Chí Minh",
                "https://salt.tkbcdn.com/ts/ds/94/57/44/ba7b3310617240a4c5777bd92152347c.png",
                20, 2, "SPORT",
                "Trận đấu VBA 2026 của đương kim vô địch Saigon Heat trên sân nhà."),
        new Ev(10, "Brazil Vietnam Football Festival", "Thể thao",
                "Sân vận động Hòa Xuân", "Đà Nẵng",
                "https://images.tkbcdn.com/1/1560/600/Upload/eventcover/2024/04/22/B17195.jpg",
                60, 3, "SPORT",
                "Lễ hội bóng đá giao hữu Brazil — Việt Nam tại Đà Nẵng."),

        new Ev(11, "Workshop: Giọng Nói \"Cưa Đổ\" Nhà Tuyển Dụng", "Hội thảo",
                "SGN The Social Cafe", "TP. Hồ Chí Minh",
                "https://salt.tkbcdn.com/ts/ds/fa/6d/1b/6b94d2175da217771913462389937e57.png",
                9, 3, "CONF",
                "Buổi chia sẻ kỹ năng luyện giọng nói khi phỏng vấn cùng Nói Connect."),

        // ── Batch 2 (crawl thêm) ──
        new Ev(13, "Forestival — Chiến Binh Bình Minh 2026", "Âm nhạc",
                "Quảng trường Bình Minh", "Ninh Bình",
                "https://salt.tkbcdn.com/ts/ds/1d/76/0a/92e5cd05b44a5c9b40f675b1b2e15153.jpg",
                52, 8, "CONCERT_BIG",
                "Đại nhạc hội ngoài trời Forestival 2026 do VIET VISION tổ chức."),
        new Ev(13, "Hà Anh Tuấn Live Concert \"The Rose\" — Đà Lạt 2026", "Âm nhạc",
                "Sân Vận Động Đà Lạt", "Đà Lạt",
                "https://salt.tkbcdn.com/ts/ds/d0/fe/dc/aa4454e09f0dc2c96be8c1845d37668f.jpg",
                48, 3, "CONCERT_BIG",
                "Live Concert The Rose của Hà Anh Tuấn giữa cao nguyên Đà Lạt."),
        new Ev(12, "Những Thành Phố Mơ Màng Summer 2026 — Hà Nội", "Âm nhạc",
                "Sân khấu ngoài trời", "Hà Nội",
                "https://salt.tkbcdn.com/ts/ds/9b/0d/4b/072152800382c4e950314ad8f5488fed.png",
                38, 6, "CONCERT",
                "Chuỗi nhạc hội indie Những Thành Phố Mơ Màng phiên bản mùa hè Hà Nội."),
        new Ev(14, "K-Pulse Hanoi 2026", "Âm nhạc",
                "Sân Vận Động Mỹ Đình", "Hà Nội",
                "https://salt.tkbcdn.com/ts/ds/19/44/c0/e972723771651dba16409c5acaf0b417.jpg",
                58, 4, "CONCERT_BIG",
                "Đại nhạc hội K-Pop quy mô sân vận động tại Hà Nội."),

        new Ev(4, "Nhà Hát Bến Thành — Hài Kịch: Đảo Hoa Hậu", "Sân khấu",
                "Nhà Hát Bến Thành", "TP. Hồ Chí Minh",
                "https://salt.tkbcdn.com/ts/ds/df/73/58/48093f2ebde108ffb8ae51fe702b1fcb.jpg",
                14, 2, "THEATER",
                "Vở hài kịch Đảo Hoa Hậu của sân khấu Thái Dương."),
        new Ev(4, "Nhà Hát Thanh Niên — Hài Kịch: Thanh Xà Bạch Xà Ngoại Truyện", "Sân khấu",
                "Nhà Văn hoá Thanh niên TP.HCM", "TP. Hồ Chí Minh",
                "https://salt.tkbcdn.com/ts/ds/72/00/b4/c3ee374b63d5baf3d0a27b18d13e99ce.jpg",
                24, 2, "THEATER",
                "Hài kịch Thanh Xà Bạch Xà ngoại truyện."),
        new Ev(4, "Nhà Hát Thanh Niên — Hài Kịch: Náo Loạn Tiếu Lâm Đường", "Sân khấu",
                "Nhà Hát Thanh Niên", "TP. Hồ Chí Minh",
                "https://salt.tkbcdn.com/ts/ds/e0/6c/75/8fcd63d1ac5c32be01e4ba46ba19cbf2.jpg",
                33, 2, "THEATER",
                "Hài kịch Náo Loạn Tiếu Lâm Đường."),
        new Ev(15, "Sân Khấu Thiên Đăng — Vở Kịch: Giáng Hương", "Sân khấu",
                "Tầng 12B Toà nhà IMC", "TP. Hồ Chí Minh",
                "https://salt.tkbcdn.com/ts/ds/7c/9e/e9/573f9a55794e30964908a20f06d629a2.jpg",
                17, 2, "THEATER",
                "Vở kịch Giáng Hương của sân khấu Thiên Đăng."),

        new Ev(6, "Garden Art Workshop: Vẽ Tranh Màu Nước \"Hoa Trong Vườn\"", "Nghệ thuật",
                "Garden Art Studio", "TP. Hồ Chí Minh",
                "https://salt.tkbcdn.com/ts/ds/b3/fc/2c/2a96787e02e412d56b4021c838f3aa58.jpg",
                13, 3, "WORKSHOP",
                "Workshop vẽ tranh màu nước chủ đề Hoa Trong Vườn tại Garden Art."),
        new Ev(16, "The Greenery Art — Workshop Vẽ Tranh Canvas", "Nghệ thuật",
                "Art Workshop Space", "TP. Hồ Chí Minh",
                "https://salt.tkbcdn.com/ts/ds/b4/9f/72/a49fc634754b99c78669075f425ae3cd.jpg",
                19, 3, "WORKSHOP",
                "Workshop vẽ tranh canvas thư giãn cùng The Greenery Art."),
        new Ev(17, "Workshop Vẽ Tranh Canvas: Gam Màu Hạnh Phúc", "Workshop",
                "Văn phòng The TutorX", "TP. Hồ Chí Minh",
                "https://salt.tkbcdn.com/ts/ds/3d/56/d0/1953b6e8bdb089a3fd54b5f7363f1d61.jpg",
                11, 3, "WORKSHOP",
                "Workshop Color of Joy — vẽ tranh canvas cùng The TutorX."),
    };

    @Override
    public void run(String... args) {
        if (eventRepository.count() > 0) return;
        log.info("Seeding dữ liệu thật (crawl ticketbox.vn) cho event_db...");

        long[] orgIds = new long[ORGS.length];
        for (int i = 0; i < ORGS.length; i++) {
            Org spec = ORGS[i];
            OrganizerProfile o = new OrganizerProfile();
            o.setOrganizationName(spec.name());
            o.setContactEmail(spec.ownerEmail());
            o.setContactPhone(spec.phone());
            o.setDescription(spec.bio());
            o.setAvatarUrl(spec.logo());
            o.setVerified(spec.verified());
            o.setAuthUserId(spec.ownerUid());
            o = organizerRepository.save(o);
            orgIds[i] = o.getId();

            long ownerRoleId = roleRepository.save(
                    role(o.getId(), "Chủ tổ chức", true,
                            Arrays.stream(OrgPermission.values()).map(Enum::name).collect(Collectors.toSet()))
            ).getId();
            roleRepository.save(role(o.getId(), "Quản lý", false,
                    Set.of("EVENT_MANAGE", "ORDER_MANAGE", "STATS_VIEW")));
            long checkinRoleId = roleRepository.save(
                    role(o.getId(), "Nhân viên check-in", false, Set.of("CHECKIN"))
            ).getId();

            memberRepository.save(member(o.getId(), spec.ownerUid(), spec.ownerEmail(), spec.ownerName(), ownerRoleId));
            if (i < 4) {
                memberRepository.save(member(o.getId(), STAFF_VY, "vy@tickethub.vn", "Trần Vy", checkinRoleId));
                memberRepository.save(member(o.getId(), STAFF_DANG, "dang@tickethub.vn", "Phạm Đăng", checkinRoleId));
            }
        }

        for (Ev e : EVENTS) {
            OrganizerProfile org = organizerRepository.findById(orgIds[e.orgIdx()]).orElseThrow();
            Event ev = new Event();
            ev.setOrganizer(org);
            ev.setTitle(e.title());
            ev.setCategory(e.category());
            ev.setDescription(e.desc());
            ev.setLocation(e.venue() + ", " + e.city());
            ev.setCity(e.city());
            ev.setVenue(e.venue());
            ev.setBannerUrl(e.img());
            // Placeholder seat map for events that have assigned seating (skip Workshop).
            if (!"Workshop".equals(e.category())) ev.setSeatMapUrl("/seat-map-placeholder.svg");
            double[] ll = coords(e.city(), e.title().hashCode());
            ev.setLatitude(ll[0]);
            ev.setLongitude(ll[1]);
            ev.setStartTime(Instant.now().plus(e.offsetDays(), ChronoUnit.DAYS).truncatedTo(ChronoUnit.HOURS));
            ev.setEndTime(ev.getStartTime().plus(e.durationHrs(), ChronoUnit.HOURS));
            ev.setStatus(EventStatus.PUBLISHED);
            for (TicketType t : tiers(e.tierPreset())) ev.addTicketType(t);
            eventRepository.save(ev);
        }

        log.info("Seed xong: {} tổ chức, {} vai trò, {} thành viên, {} sự kiện",
                organizerRepository.count(), roleRepository.count(),
                memberRepository.count(), eventRepository.count());
    }

    // ── Helpers ──────────────────────────────────────────────────

    private static OrganizerRole role(Long orgId, String name, boolean systemDefault, Set<String> perms) {
        OrganizerRole r = new OrganizerRole();
        r.setOrganizerId(orgId);
        r.setName(name);
        r.setSystemDefault(systemDefault);
        r.setPermissions(new HashSet<>(perms));
        return r;
    }

    private static OrganizerMember member(Long orgId, Long uid, String email, String name, Long roleId) {
        OrganizerMember m = new OrganizerMember();
        m.setOrganizerId(orgId);
        m.setAuthUserId(uid);
        m.setEmail(email);
        m.setFullName(name);
        m.setRoleId(roleId);
        return m;
    }

    private static double[] coords(String city, int seed) {
        double jx = (Math.abs(seed) % 24) * 0.0016;
        double jy = (Math.abs(seed / 7) % 24) * 0.0016;
        return switch (city) {
            case "Hà Nội" -> new double[]{21.0278 + jx, 105.8342 + jy};
            case "Đà Nẵng" -> new double[]{16.0544 + jx, 108.2022 + jy};
            case "Hưng Yên" -> new double[]{20.9700 + jx, 106.0150 + jy};
            case "Ninh Bình" -> new double[]{20.2506 + jx, 105.9745 + jy};
            case "Đà Lạt" -> new double[]{11.9404 + jx, 108.4583 + jy};
            default -> new double[]{10.7769 + jx, 106.7009 + jy}; // TP. Hồ Chí Minh
        };
    }

    private static List<TicketType> tiers(String preset) {
        return switch (preset) {
            case "CONCERT_BIG" -> List.of(
                    tt("Standard", "Khu vực đứng, view sân khấu chính.", 800_000, 2000, 1460, 6, TicketTypeStatus.SELLING),
                    tt("VIP", "Khu vực gần sân khấu, kèm quà tặng.", 1_800_000, 800, 624, 4, TicketTypeStatus.SELLING),
                    tt("VVIP", "Hàng đầu, lounge riêng, quà giới hạn.", 3_500_000, 200, 200, 2, TicketTypeStatus.SOLD_OUT));
            case "CONCERT" -> List.of(
                    tt("Thường", "Vé phổ thông, đầy đủ trải nghiệm.", 500_000, 600, 320, 6, TicketTypeStatus.SELLING),
                    tt("VIP", "Khu vực ngồi đẹp, welcome drink.", 1_200_000, 300, 214, 4, TicketTypeStatus.SELLING),
                    tt("VVIP", "Hàng ghế đầu, quà tặng giới hạn.", 2_500_000, 100, 72, 2, TicketTypeStatus.SELLING));
            case "THEATER" -> List.of(
                    tt("Hạng B", "Hai bên cánh gà.", 250_000, 120, 64, 6, TicketTypeStatus.SELLING),
                    tt("Hạng A", "Khu vực giữa, tầm nhìn tốt nhất.", 450_000, 150, 96, 6, TicketTypeStatus.SELLING),
                    tt("VIP", "Hàng ghế đầu.", 650_000, 40, 28, 4, TicketTypeStatus.SELLING));
            case "ART" -> List.of(
                    tt("Vé vào cửa", "Vào theo khung giờ đã chọn.", 180_000, 400, 150, 10, TicketTypeStatus.SELLING),
                    tt("Combo 2 người", "Tiết kiệm cho cặp đôi.", 320_000, 150, 60, 5, TicketTypeStatus.SELLING));
            case "WORKSHOP" -> List.of(
                    tt("Vé đơn", "Một chỗ, đủ nguyên vật liệu.", 350_000, 20, 11, 2, TicketTypeStatus.SELLING),
                    tt("Vé đôi", "Hai người, tiết kiệm 15%.", 600_000, 10, 6, 1, TicketTypeStatus.SELLING));
            case "CONF" -> List.of(
                    tt("Vé thường", "Tham dự đầy đủ chương trình.", 200_000, 120, 48, 4, TicketTypeStatus.SELLING),
                    tt("VIP", "Chỗ ngồi ưu tiên, tài liệu riêng.", 450_000, 40, 18, 2, TicketTypeStatus.SELLING));
            default -> List.of( // SPORT
                    tt("Khán đài B", "Sau rổ/cầu môn, không khí cổ vũ.", 150_000, 600, 240, 8, TicketTypeStatus.SELLING),
                    tt("Khán đài A", "Khán đài chính có mái che.", 300_000, 400, 210, 8, TicketTypeStatus.SELLING),
                    tt("VIP Courtside", "Sát sân, trải nghiệm tốt nhất.", 600_000, 120, 70, 4, TicketTypeStatus.SELLING));
        };
    }

    private static TicketType tt(String name, String desc, long price, int total, int sold, int maxPerOrder, TicketTypeStatus status) {
        TicketType t = new TicketType();
        t.setName(name);
        t.setDescription(desc);
        t.setPrice(BigDecimal.valueOf(price));
        t.setCurrency("VND");
        t.setTotalQuantity(total);
        t.setSoldQuantity(sold);
        t.setReservedQuantity(0);
        t.setAvailableQuantity(total - sold);
        t.setMaxPerOrder(maxPerOrder);
        t.setStatus(status);
        return t;
    }

    private record Org(String name, String phone, long ownerUid, String ownerEmail, String ownerName,
                       boolean verified, String logo, String bio) {}

    private record Ev(int orgIdx, String title, String category, String venue, String city,
                      String img, int offsetDays, int durationHrs, String tierPreset, String desc) {}
}
