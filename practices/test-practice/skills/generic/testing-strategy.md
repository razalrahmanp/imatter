---
id: testing-strategy
title: "Testing strategy — unit vs integration vs e2e, what to test, what not to"
layer: generic
tags: [testing, unit-test, integration-test, e2e, jest, vitest]
applies_to:
  task_types: [add-handler, add-endpoint, add-worker, add-component]
  stages: [5, 7]
size_tokens: 200
related: [code-review-checklist, refactoring-safety, error-handling]
---

# testing-strategy — Testing Strategy Pattern

## Pattern Summary

Test at the level that gives you the most confidence with the least maintenance cost. Integration tests over unit tests for I/O-heavy code. Unit tests for pure business logic. E2E tests for critical user flows only.

**Test pyramid for this stack:**
```
                 ┌─────┐
                 │ E2E │  3–5 tests (login, core happy path, payment)
                ┌┴─────┴┐
                │  Intg  │ 20–50 tests (API handlers with real DB)
               ┌┴────────┴┐
               │   Unit    │ 50–200 tests (pure business logic, utils)
               └───────────┘
```

**What to unit test:**
- Pure functions with no I/O (fee calculators, validators, formatters, cursor encoding)
- Business rules that have many edge cases (tax calculations, status transitions)
- Error handling paths

**What to integration test (handler with real test DB):**
```typescript
// vitest + real DB — no mocks for DB or auth
describe("POST /orders/:id/cancel", () => {
  it("cancels an open order and emits event", async () => {
    const { order } = await createTestOrder(db, { status: "open" });
    const res = await callHandler({ orderId: order.id, branchId: order.branch_id });
    expect(res.statusCode).toBe(200);
    const updated = await db.query("SELECT status FROM orders WHERE id=$1", [order.id]);
    expect(updated.rows[0].status).toBe("cancelled");
  });

  it("returns 409 for already-cancelled order", async () => {
    const { order } = await createTestOrder(db, { status: "cancelled" });
    const res = await callHandler({ orderId: order.id, branchId: order.branch_id });
    expect(res.statusCode).toBe(409);
  });
});
```

**What NOT to test:**
- Framework behavior (Next.js routing, AWS SDK retry logic)
- Trivial getters/setters with no logic
- Third-party library internals

## Full Reference

### Test isolation
Each test gets a fresh DB transaction that's rolled back on teardown — no test data bleeds between tests. Use a test factory for setup.

### Coverage targets
Aim for 80% branch coverage on business logic files, 60% overall. Coverage percentage without meaningful assertions is vanity — a test that always passes is worse than no test.
