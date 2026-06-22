package com.tickethub.event.storage;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.S3Configuration;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;

import java.io.IOException;
import java.net.URI;
import java.util.UUID;

/** Uploads images to S3-compatible storage (Cloudflare R2). */
@Slf4j
@Service
public class S3StorageService {

    private final S3Client s3Client;
    private final String bucket;
    private final String publicBaseUrl;

    public S3StorageService(
            @Value("${app.s3.endpoint:}") String endpoint,
            @Value("${app.s3.region}") String region,
            @Value("${app.s3.access-key}") String accessKey,
            @Value("${app.s3.secret-key}") String secretKey,
            @Value("${app.s3.bucket}") String bucket,
            @Value("${app.s3.public-base-url}") String publicBaseUrl,
            @Value("${app.s3.path-style-access:false}") boolean pathStyleAccess) {
        var builder = S3Client.builder()
                .region(Region.of(region))
                .credentialsProvider(StaticCredentialsProvider.create(
                        AwsBasicCredentials.create(accessKey, secretKey)))
                .serviceConfiguration(S3Configuration.builder()
                        .pathStyleAccessEnabled(pathStyleAccess)
                        .build());
        if (endpoint != null && !endpoint.isBlank()) {
            builder.endpointOverride(URI.create(endpoint));
        }
        this.s3Client = builder.build();
        this.bucket = bucket;
        this.publicBaseUrl = publicBaseUrl.endsWith("/")
                ? publicBaseUrl.substring(0, publicBaseUrl.length() - 1) : publicBaseUrl;
    }

    public String upload(MultipartFile file) throws IOException {
        String key = "events/" + UUID.randomUUID() + extension(file.getOriginalFilename());
        s3Client.putObject(
                PutObjectRequest.builder()
                        .bucket(bucket)
                        .key(key)
                        .contentType(file.getContentType() != null ? file.getContentType() : "application/octet-stream")
                        .build(),
                RequestBody.fromInputStream(file.getInputStream(), file.getSize()));
        String url = publicBaseUrl + "/" + key;
        log.info("Đã upload ảnh -> {}", url);
        return url;
    }

    private String extension(String name) {
        if (name == null || !name.contains(".")) return "";
        String ext = name.substring(name.lastIndexOf('.')).replaceAll("[^a-zA-Z0-9.]", "");
        return ext.length() > 10 ? ext.substring(0, 10) : ext;
    }
}
