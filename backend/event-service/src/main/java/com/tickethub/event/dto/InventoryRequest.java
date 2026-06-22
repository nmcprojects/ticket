package com.tickethub.event.dto;

import jakarta.validation.constraints.Min;

public record InventoryRequest(
        @Min(1) int quantity
) {
}
