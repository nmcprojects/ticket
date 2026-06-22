package com.tickethub.auth.exception;

import org.springframework.http.HttpStatus;

public class ApiException extends RuntimeException {
    private final HttpStatus status;

    public ApiException(HttpStatus status, String message) {
        super(message);
        this.status = status;
    }

    public HttpStatus getStatus() {
        return status;
    }

    public static ApiException unauthorized(String msg) {
        return new ApiException(HttpStatus.UNAUTHORIZED, msg);
    }

    public static ApiException conflict(String msg) {
        return new ApiException(HttpStatus.CONFLICT, msg);
    }

    public static ApiException badRequest(String msg) {
        return new ApiException(HttpStatus.BAD_REQUEST, msg);
    }
}
