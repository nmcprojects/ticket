package com.tickethub.gateway;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/fallback")
public class FallbackController {

    @RequestMapping("/booking")
    public ResponseEntity<Map<String, Object>> bookingFallback() {
        return buildFallbackResponse("booking-service", "Booking service is currently unavailable");
    }

    @RequestMapping("/payment")
    public ResponseEntity<Map<String, Object>> paymentFallback() {
        return buildFallbackResponse("payment-service", "Payment service is currently unavailable");
    }

    @RequestMapping("/ticket")
    public ResponseEntity<Map<String, Object>> ticketFallback() {
        return buildFallbackResponse("ticket-service", "Ticket service is currently unavailable");
    }

    @RequestMapping("/event")
    public ResponseEntity<Map<String, Object>> eventFallback() {
        return buildFallbackResponse("event-service", "Event service is currently unavailable");
    }

    private ResponseEntity<Map<String, Object>> buildFallbackResponse(String service, String message) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("status", 503);
        body.put("error", "Service Unavailable");
        body.put("service", service);
        body.put("message", message);
        body.put("timestamp", Instant.now().toString());
        return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).body(body);
    }
}
