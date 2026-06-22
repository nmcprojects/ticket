package com.tickethub.event.exception;

/** Caller is authenticated but does not own/manage the target resource. Maps to HTTP 403. */
public class ForbiddenException extends RuntimeException {
    public ForbiddenException(String message) {
        super(message);
    }
}
