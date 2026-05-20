---
name: sdlc-test-fixture-design
description: Use when designing test fixtures (factories, builders, seed data) — keeps test setup small, readable, and resilient to changes in the underlying schema.
---

## Rule

Test fixtures are factories with sensible defaults, not blobs of seed data. Each test specifies only the fields it cares about; the factory fills in the rest. Refactoring the schema shouldn't break every test.

## Pattern — factory functions with overrides

```ts
function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: `usr_${Math.random().toString(36).slice(2, 10)}`,
    email: `test+${Date.now()}@example.com`,
    role: "customer",
    tenant_id: "tnt_test",
    created_at: new Date(),
    ...overrides,
  };
}

function makeOrder(overrides: Partial<Order> = {}): Order {
  return {
    id: `ord_${Math.random().toString(36).slice(2, 10)}`,
    customer_id: "usr_test",
    tenant_id: "tnt_test",
    status: "pending",
    total: 1000,
    created_at: new Date(),
    ...overrides,
  };
}

// In tests:
const admin = makeUser({ role: "admin" });
const paidOrder = makeOrder({ status: "paid", total: 5000 });
```

The test reads as "an admin user" and "a paid order with total 5000" — only the relevant fields are visible.

## Factory libraries (when you need more)

- **JS/TS**: `@faker-js/faker` + custom factories, or `fishery`
- **Python**: `factory_boy` is the standard
- **Ruby**: `factory_bot`
- **Go**: hand-rolled (no widely-adopted library)

## Anti-patterns

- ❌ Global fixture files (`fixtures/users.json`) — every test depends on the same data; one change breaks everything
- ❌ Factories that hit the real database to generate IDs (slow, side-effecty)
- ❌ Factories with hardcoded timestamps (tests behave differently on weekends)
- ❌ Hand-built test data inline in 50 tests (when one factory would do)
- ❌ Factories that don't honor referential integrity (an order with customer_id pointing to nothing)

## Gate criteria

- Each domain object has a factory with sensible defaults
- Tests specify only the fields they assert against
- Factories generate unique IDs per call (no collisions)
- Factory output is pure (no DB writes); persistence is a separate step
- A factory test exists that verifies factory output passes domain validation
