package com.tickethub.event.exception;

/** Caller is not authenticated (no X-User-Id). Maps to HTTP 401. */
public class UnauthorizedException extends RuntimeException {
    public UnauthorizedException(String message) {
        super(message);
    }
}
