package com.tickethub.payment.controller;

import com.tickethub.common.security.CurrentUser;
import com.tickethub.common.security.RequireRole;
import com.tickethub.payment.dto.PaymentDtos.*;
import com.tickethub.payment.service.PaymentService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/payments")
@RequiredArgsConstructor
public class PaymentController {

    private final PaymentService service;

    /** Internal-only: called by booking-service to start a checkout. */
    @PostMapping
    @RequireRole("INTERNAL")
    public ResponseEntity<CreatePaymentResponse> create(@Valid @RequestBody CreatePaymentRequest req) {
        return ResponseEntity.status(HttpStatus.CREATED).body(service.create(req));
    }

    @GetMapping("/{id}")
    @RequireRole
    public PaymentDto get(CurrentUser me, @PathVariable Long id) {
        me.requireOwnerOrAdmin(service.ownerOf(id));
        return service.get(id);
    }

    /** Called by the frontend after returning from PayOS to confirm status. */
    @PostMapping("/{id}/verify")
    @RequireRole
    public PaymentDto verify(CurrentUser me, @PathVariable Long id) {
        me.requireOwnerOrAdmin(service.ownerOf(id));
        return service.verify(id);
    }

    /** Sandbox gateway callback from the frontend mock pay page — only the buyer (or admin). */
    @PostMapping("/{id}/sandbox-complete")
    @RequireRole
    public PaymentDto sandboxComplete(CurrentUser me, @PathVariable Long id,
                                      @RequestParam(defaultValue = "SUCCESS") String result) {
        me.requireOwnerOrAdmin(service.ownerOf(id));
        return service.sandboxComplete(id, result);
    }

    /** Refund — internal compensation (booking-service) or admin. */
    @PostMapping("/{id}/refund")
    @RequireRole({"INTERNAL", "ADMIN"})
    public PaymentDto refund(@PathVariable Long id) {
        return service.refund(id);
    }

    /** Real PayOS webhook — public (no auth; the gateway lets it through). */
    @PostMapping("/payos-webhook")
    public ResponseEntity<Map<String, String>> payosWebhook(@RequestBody Map<String, Object> body) {
        Object dataObj = body.get("data");
        Long orderCode = null;
        boolean success = false;
        if (dataObj instanceof Map<?, ?> data) {
            Object oc = data.get("orderCode");
            if (oc != null) orderCode = Long.valueOf(String.valueOf(oc).replaceAll("\\..*$", ""));
            success = "00".equals(String.valueOf(data.get("code"))) || "00".equals(String.valueOf(body.get("code")));
        }
        service.payosWebhook(body.toString(), orderCode, success);
        return ResponseEntity.ok(Map.of("error", "0", "message", "ok"));
    }
}
