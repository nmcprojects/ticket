package com.tickethub.event.storage;

import com.tickethub.common.security.RequireRole;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.util.Map;
import java.util.Set;

@RestController
@RequestMapping("/api/uploads")
@RequiredArgsConstructor
@RequireRole({"ADMIN", "ORGANIZER", "STAFF"}) // only organizers/staff upload images
public class UploadController {

    private static final long MAX_SIZE = 8 * 1024 * 1024;
    private static final Set<String> ALLOWED = Set.of(
            "image/jpeg", "image/png", "image/gif", "image/webp", "image/svg+xml");

    private final S3StorageService storage;

    @PostMapping
    public ResponseEntity<?> upload(@RequestParam("file") MultipartFile file) {
        if (file.isEmpty()) return ResponseEntity.badRequest().body(Map.of("error", "File trống"));
        if (file.getSize() > MAX_SIZE) return ResponseEntity.badRequest().body(Map.of("error", "Ảnh vượt quá 8 MB"));
        String type = file.getContentType();
        if (type == null || !ALLOWED.contains(type)) {
            return ResponseEntity.badRequest().body(Map.of("error", "Chỉ chấp nhận ảnh JPEG/PNG/GIF/WebP/SVG"));
        }
        try {
            return ResponseEntity.ok(Map.of("url", storage.upload(file)));
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body(Map.of("error", "Upload thất bại: " + e.getMessage()));
        }
    }
}
