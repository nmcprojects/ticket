package com.tickethub.event.support;

import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.PostgreSQLContainer;

/**
 * Shared Testcontainers Postgres base. Một container duy nhất (singleton) được tái
 * sử dụng cho MỌI test class kế thừa, image postgres:16-alpine đã pull sẵn.
 *
 * KHÔNG dùng @Testcontainers/@Container: vòng đời do JUnit quản sẽ STOP container sau
 * test class đầu tiên, khiến class thứ hai tái dùng singleton trỏ vào port đã chết
 * (Connection refused). Thay vào đó tự start trong static block và để Ryuk/JVM-shutdown
 * dọn dẹp -> container sống xuyên suốt cả phiên test.
 *
 * Đồng thời tắt Eureka để test KHÔNG bao giờ chạm tới Docker stack đang chạy.
 */
public abstract class PostgresTestContainer {

    static final PostgreSQLContainer<?> POSTGRES =
            new PostgreSQLContainer<>("postgres:16-alpine")
                    .withDatabaseName("event_db")
                    .withUsername("tickethub")
                    .withPassword("tickethub");

    static {
        POSTGRES.start();
    }

    @DynamicPropertySource
    static void props(DynamicPropertyRegistry r) {
        r.add("spring.datasource.url", POSTGRES::getJdbcUrl);
        r.add("spring.datasource.username", POSTGRES::getUsername);
        r.add("spring.datasource.password", POSTGRES::getPassword);
        r.add("spring.jpa.hibernate.ddl-auto", () -> "create-drop");

        // Không bao giờ chạm Eureka thật
        r.add("eureka.client.enabled", () -> "false");
        r.add("eureka.client.register-with-eureka", () -> "false");
        r.add("eureka.client.fetch-registry", () -> "false");
    }
}
