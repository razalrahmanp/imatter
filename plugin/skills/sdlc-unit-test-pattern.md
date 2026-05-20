---
name: sdlc-unit-test-pattern
description: Use when writing unit tests for a new module or class — covers what a unit test actually tests, the AAA structure, naming, and the failure modes that turn tests into liability.
---

## Rule

A unit test exercises one unit of behavior — usually a function or class method — in isolation from I/O, time, and randomness. It is fast (sub-millisecond), deterministic, and fails for one reason. Tests that don't meet those bars are not unit tests; reclassify them as integration tests.

## What "unit" means

A unit is:
- A pure function (best — no setup needed)
- A class method with mockable dependencies
- A small logical operation

A unit is NOT:
- An HTTP route + DB query (that's integration)
- A workflow involving 3 services (that's E2E)
- "The thing the user does" (that's E2E from a different angle)

If your "unit test" needs a real database, real HTTP, real time, or real randomness → it's an integration test. See [[sdlc-integration-test-pattern]].

## Pattern — Arrange / Act / Assert (AAA)

```ts
test("calculateTotal applies the right discount tier", () => {
  // Arrange
  const cart = [
    { sku: "A", price: 100, qty: 1 },
    { sku: "B", price: 50, qty: 2 },
  ];
  const customer = { tier: "gold" };

  // Act
  const total = calculateTotal(cart, customer);

  // Assert
  expect(total).toEqual({ subtotal: 200, discount: 20, total: 180 });
});
```

One section per phase. Blank line between phases is helpful. No assertion inside the Arrange or Act blocks.

## Test names — describe behavior, not implementation

```
✅ "calculateTotal applies 10% discount for gold-tier customers"
✅ "createOrder rejects when any item is out of stock"
✅ "parseEmail returns null for missing @ sign"

❌ "test1"
❌ "calculateTotal works"
❌ "should call the discount function"     ← couples to implementation
```

A reader who hasn't seen the code should understand what the test asserts from the name alone.

## One assertion per behavior, not per primitive value

```ts
// ✅ One conceptual assertion
expect(result).toEqual({
  status: "success",
  items: [{ id: 1, name: "A" }],
  total: 100,
});

// ❌ Three coupled assertions on the same outcome
expect(result.status).toBe("success");
expect(result.items).toHaveLength(1);
expect(result.total).toBe(100);
```

`toEqual` on the whole object gives a complete diff on failure. Three separate asserts only show the first one that fails.

But: separate `it` blocks for genuinely separate behaviors. The rule is "one behavior per test," not "one assertion per test."

## Dependencies — fake at the boundary

A function that calls `Date.now()`, `Math.random()`, or `fetch()` is hard to test. Inject dependencies:

```ts
// ❌ Hard to test
function generateInviteCode(): string {
  return `INV-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// ✅ Testable
function generateInviteCode(now: () => number, random: () => number): string {
  return `INV-${now()}-${random().toString(36).slice(2, 8)}`;
}

test("generateInviteCode formats correctly", () => {
  const code = generateInviteCode(() => 1700000000000, () => 0.5);
  expect(code).toMatch(/^INV-1700000000000-[a-z0-9]{6}$/);
});
```

For frameworks that support it, use a fake clock (`vi.useFakeTimers`, `jest.useFakeTimers`).

## Mocks vs fakes vs stubs

| Type | What |
|---|---|
| **Stub** | Returns canned value; no behavior |
| **Mock** | Pre-programmed expectations; assertion on calls |
| **Fake** | Working implementation, simplified (e.g. in-memory DB) |
| **Spy** | Real implementation but records calls |

Prefer **fakes** over mocks. Mocks couple to implementation; fakes test against a contract. See [[sdlc-mocking-strategy]].

## What unit tests cannot catch

| Bug class | Why |
|---|---|
| Integration mismatch (your code is right, but it calls the API wrong) | Mocks make your assumption look correct |
| DB query correctness against schema | Mocked DB doesn't have the real schema |
| Network/timeout behavior | Mocks don't time out |
| Race conditions | Single-threaded test loop hides them |
| Browser-rendering bugs | Unit tests don't render |

Compensate with integration tests + E2E tests.

## Anti-patterns

- ❌ Mocking your own modules (the thing you're testing, by proxy, isn't your code anymore)
- ❌ Testing private methods (test through the public interface)
- ❌ Test that needs a real DB / real network — that's an integration test, name it as such
- ❌ Setup that lives across tests (`beforeAll` mutating global state)
- ❌ Time-dependent tests without fake timers (`flaky on Tuesday at midnight`)
- ❌ One huge test file with shared setup (split by behavior)
- ❌ Snapshot tests for everything (snapshots that nobody reads become rubber stamps)
- ❌ Asserting on exact log strings (couple to logging implementation; refactor breaks tests)

## Gate criteria

- Test runner runs unit tests in < 30 seconds for the whole suite
- Tests pass deterministically — run them 10 times in a row, all green
- No test depends on the order of other tests
- No test hits real I/O (DB, network, filesystem outside tmp)
- Test names describe behavior, not implementation
- Code coverage measured but not a single hard threshold — focus coverage on critical paths
