import { describe, it, expect, beforeAll, afterAll, beforeEach } from "@jest/globals";

// High-risk module: order placement and status transitions
// Integration tests run against a real PostgreSQL instance (see docker-compose.test.yml)

describe("POST /orders — place order", () => {
  it("creates an order record with correct branch_id from table token");
  it("returns the order summary to the customer");
  it("order placement completes in < 2s p95 (NFR-2)");
  it("rejects an order if the table token is expired");
  it("rejects an order if branch_id in token does not match menu branch_id");
  it("does not expose orders from other branches (RLS enforcement)");
});

describe("PATCH /orders/:id/status — status transitions", () => {
  it("bearer can transition order from PLACED to ACKNOWLEDGED");
  it("kitchen can transition order from ACKNOWLEDGED to READY");
  it("bearer can transition order from READY to DELIVERED");
  it("rejects invalid status transition (e.g. PLACED → DELIVERED)");
  it("rejects status update from a user in a different branch");
  it("emits WebSocket event on every valid status transition");
});

describe("GET /orders — order list", () => {
  it("owner sees only their branch orders");
  it("bearer sees only active orders for their branch");
  it("returns orders in descending created_at order");
  it("does not return orders from other branches");
});
