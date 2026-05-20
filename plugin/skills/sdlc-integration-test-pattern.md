---
name: sdlc-integration-test-pattern
description: Use when writing tests that hit a real database, real queue, or other real infrastructure — covers fixture management, isolation between tests, and the rules that keep these tests fast and stable.
---

## Rule

An integration test exercises a real boundary — usually one or more of: a real database, a real queue/broker, a real cache. It is slower than a unit test (tens to hundreds of ms each), but still must be deterministic and isolated from other tests.

## When you need an integration test

| You need integration test if... | Why |
|---|---|
| The behavior depends on SQL the ORM generates | Your SQL is the actual contract |
| The behavior involves a DB constraint (UNIQUE, FK, RLS) | Mock DB cannot reproduce these |
| The behavior involves transactions, isolation, or locking | Concurrency only emerges with a real DB |
| The behavior involves queue semantics (at-least-once, ordering, DLQ) | Mock queues lie about delivery |
| Your code "looks right" but production keeps failing | Unit tests have a blind spot |

For pure logic: unit tests are enough.

## Pattern — Testcontainers / docker-compose / cloud emulators

```ts
import { GenericContainer } from "testcontainers";

let postgres: StartedTestContainer;
let db: Client;

beforeAll(async () => {
  postgres = await new GenericContainer("postgres:16-alpine")
    .withEnvironment({ POSTGRES_PASSWORD: "test" })
    .withExposedPorts(5432)
    .start();

  db = new Client({
    host: postgres.getHost(),
    port: postgres.getMappedPort(5432),
    user: "postgres",
    password: "test",
    database: "postgres",
  });
  await db.connect();
  await runMigrations(db);
});

afterAll(async () => {
  await db.end();
  await postgres.stop();
});
```

For most workflows, **a single shared real DB per test run** + per-test isolation (next section) is far faster than spinning containers per test.

## Test isolation — transaction rollback

Each test starts a transaction at the start and rolls back at the end. All writes happen in real Postgres, but no test sees another's data.

```ts
let tx: Client;

beforeEach(async () => {
  tx = await db.connect();
  await tx.query("BEGIN");
});

afterEach(async () => {
  await tx.query("ROLLBACK");
  tx.release();
});

test("inserts an order and reads it back", async () => {
  await tx.query("INSERT INTO orders ...");
  const { rows } = await tx.query("SELECT * FROM orders");
  expect(rows).toHaveLength(1);
});
```

Limitations:
- Tests that span multiple DB connections won't work this way (each connection is independent)
- Tests that exercise transactional semantics themselves (locks, serializable isolation) need a different pattern

Alternative: TRUNCATE all tables between tests. Slower but works with multiple connections.

## Fixture management

| Strategy | When |
|---|---|
| **Inline data** in each test | Default; clearest |
| **Factory functions** (`createOrder({ status: "paid" })` with defaults) | When many tests need a similar entity |
| **Fixture files** (JSON loaded into DB) | Snapshot-style integration tests; usually overkill |
| **Per-test seed scripts** | When data setup is complex and shared |

Avoid global "seed data" that every test depends on — change one fixture and unrelated tests break.

## Mocks at the integration boundary

The DB and queue are real. Everything else (Stripe, SendGrid, FCM, etc.) is mocked at the HTTP boundary:

```ts
import { setupServer } from "msw/node";
import { http, HttpResponse } from "msw";

const server = setupServer(
  http.post("https://api.stripe.com/v1/charges", () => {
    return HttpResponse.json({ id: "ch_test_abc", status: "succeeded" });
  })
);

beforeAll(() => server.listen());
afterAll(() => server.close());
afterEach(() => server.resetHandlers());
```

`msw` intercepts at the network layer — your code uses real `fetch`, but the HTTP call is captured.

## What integration tests should cover

For each module, at minimum:
- Happy path (write, then read what you wrote)
- DB constraint violation (UNIQUE conflict, FK violation, NOT NULL)
- Concurrency case if applicable (UPDATE WHERE version = X, idempotency key)
- Empty / boundary cases (zero rows, max rows, max page)
- Error from an external dependency (mocked Stripe returns 500)

You don't need an integration test for every code path — pick the high-risk ones.

## Anti-patterns

- ❌ Integration tests that depend on global mutable state across tests
- ❌ Sleeping arbitrary times to "wait for the queue to process" (use condition-based waiting)
- ❌ One huge `setup.sql` that every test depends on (slow when changed)
- ❌ Hitting real third-party APIs (Stripe sandbox, etc.) — flaky, slow, costs money
- ❌ Tests that pass locally and fail in CI (port collisions, timing issues)
- ❌ A 30-minute integration suite (split into shards; speed matters)
- ❌ Tests that depend on order (`test A` creates data that `test B` reads)
- ❌ Tests that mock the very thing they're supposed to integrate against

## Gate criteria

- A real DB (Testcontainers / dedicated test DB) is the target, not a mock
- Each test is isolated (transaction rollback or table truncation)
- Tests are deterministic — run 10 times in a row, all green
- The full integration suite runs in CI in < 10 minutes (shard if longer)
- External HTTP dependencies (Stripe, SendGrid) are mocked at the network layer
- Tests do not depend on order
