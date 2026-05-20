---
name: sdlc-mocking-strategy
description: Use when deciding whether to mock a dependency in a test, and at what layer — covers the test-double types and when each one helps or hurts.
---

## Rule

Mocks make tests easier to write but harder to trust. Default to real implementations or in-memory fakes; reach for mocks only when the real thing is impossible, slow, or non-deterministic. Mock at the *interface*, not at the *call site*.

## Test-double taxonomy

| Type | What it does | Use when |
|---|---|---|
| **Dummy** | Object passed but never used | Function signature requires a parameter |
| **Stub** | Returns canned value | You need a specific input → output for the test |
| **Fake** | Working implementation, simplified | Best default for non-trivial dependencies |
| **Spy** | Records calls, runs real code | Verifying a side effect happened |
| **Mock** | Pre-programmed expectations + assertions | When call shape matters (rarely — see anti-patterns) |

Prefer fakes. They're real code, they break when contracts change, and they're refactor-resistant.

## Pattern — fake DB for unit tests

```ts
// Real interface
interface OrderRepo {
  insert(order: Order): Promise<void>;
  findById(id: string): Promise<Order | null>;
  findByCustomer(customerId: string): Promise<Order[]>;
}

// In-memory fake
class InMemoryOrderRepo implements OrderRepo {
  private orders = new Map<string, Order>();

  async insert(order: Order) {
    this.orders.set(order.id, order);
  }
  async findById(id: string) {
    return this.orders.get(id) ?? null;
  }
  async findByCustomer(customerId: string) {
    return [...this.orders.values()].filter(o => o.customerId === customerId);
  }
}

// Test
test("placeOrder writes order with correct status", async () => {
  const repo = new InMemoryOrderRepo();
  const placeOrder = makePlaceOrder({ repo });
  await placeOrder({ customerId: "c1", items: [...] });
  const orders = await repo.findByCustomer("c1");
  expect(orders).toHaveLength(1);
  expect(orders[0].status).toBe("pending");
});
```

Bonus: the in-memory fake doubles as a perfect dev/staging fallback when the real DB is unreachable.

## When to actually mock (stubs and call assertions)

| Case | Why mock |
|---|---|
| Third-party API (Stripe, SendGrid, OpenAI) | Don't hit production; predictable output |
| File system in unit test | Real FS makes the test slow and flaky |
| Random / time / UUID generation | Need deterministic output |
| Email/SMS/push send | Verify "we tried to send X" without actually sending |

Mock these at the **HTTP boundary** (with `msw`, `nock`, or equivalent), not at the SDK function level:

```ts
// ✅ Mock at HTTP — agnostic to SDK changes
http.post("https://api.stripe.com/v1/charges", () => ...);

// ❌ Mock at SDK call site — fragile to SDK upgrades, library refactors
jest.mock("stripe", () => ({ charges: { create: jest.fn() } }));
```

## When NOT to mock

| Case | Why not |
|---|---|
| Your own pure functions | Just call them with test inputs |
| Your own modules (importing module A from a test of module B) | Test the integration; if you must isolate, refactor module B to take a dependency |
| The DB in an integration test | The DB *is* what you're testing |
| The framework (Express, React, Vue) | Bad signal; you're testing your code, not the framework |

## Pattern — dependency injection makes testing trivial

```ts
// ❌ Hard to test — dependency hardcoded
export async function sendWelcomeEmail(userId: string) {
  const user = await db.users.findById(userId);
  await sgMail.send({ to: user.email, subject: "Welcome", html: "..." });
}

// ✅ Easy to test — dependencies passed in
export function makeSendWelcomeEmail(deps: { db: Db; mailer: Mailer }) {
  return async function sendWelcomeEmail(userId: string) {
    const user = await deps.db.users.findById(userId);
    await deps.mailer.send({ to: user.email, subject: "Welcome", html: "..." });
  };
}

// Production wiring
const sendWelcomeEmail = makeSendWelcomeEmail({ db: realDb, mailer: sgMailer });

// Test
const fakeDb = new InMemoryDb();
const fakeMailer = { send: vi.fn() };
const fn = makeSendWelcomeEmail({ db: fakeDb, mailer: fakeMailer });
await fn("u1");
expect(fakeMailer.send).toHaveBeenCalledWith({ to: "user1@example.com", ... });
```

## Strict mocks — assertion on call shape

Sometimes you genuinely care that a specific call happened with specific args (audit log written, email sent, metric recorded). Use a mock with `toHaveBeenCalledWith`:

```ts
expect(fakeMetrics.counter).toHaveBeenCalledWith("orders_total", { status: "success" });
```

But: this couples the test to *how* the code calls the dependency. If you refactor the call shape, the test breaks. Use sparingly — usually for outbound effects (audit, metric, email) where the shape *is* the contract.

## Anti-patterns

- ❌ Mocking your own modules (the test then covers the mock, not the code)
- ❌ Asserting `mock.calls.length === 3` (count assertions are brittle)
- ❌ Mocking everything by default (tests pass but production breaks)
- ❌ Mocks that drift from reality (mocked Stripe returns shape from 2 years ago)
- ❌ Mock returning `undefined` because nobody set it up → test passes, code crashes in production
- ❌ Different mock setup for every test (refactor pain; consolidate in a fixture)
- ❌ Mocking `Date.now()` differently in each test (use the test runner's fake timers globally)

## Gate criteria

- Production dependencies are injected, not hardcoded inside functions
- Tests prefer fakes over mocks where the dependency is non-trivial
- Mocks at the HTTP boundary (`msw`/`nock`) for third-party services, not at SDK level
- No test mocks the system-under-test itself
- A test's mock setup is < ~10 lines for a single behavior (more = sign of poor seams)
- Mocks don't drift: a periodic "contract test" against the real dependency runs in CI or on a schedule
