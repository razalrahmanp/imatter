---
name: sdlc-e2e-test-pattern
description: Use when writing end-to-end tests that exercise a real running app from the outside (browser, full HTTP flow) — covers what to test, what to skip, and how to keep these from becoming a flaky nightmare.
---

## Rule

E2E tests exercise the full stack — real browser, real backend, real DB. They are slow (seconds to minutes each) and inherently more brittle than unit/integration tests. Cover *critical user journeys* only; everything else has cheaper test layers.

## What to E2E-test

| Test it E2E | Test it lower layer |
|---|---|
| Sign-up → first-action flow | Form field validation |
| Login → core feature → logout | Individual API endpoint contracts |
| Checkout / payment flow | Payment provider mock at unit layer |
| The 3–5 most important user journeys | Edge cases of individual functions |

Aim for **5–15 E2E tests total** across the app. More than that gets unmaintainable.

## Pattern — Playwright / Cypress / Selenium

```ts
test("user can sign up, place order, and see it in history", async ({ page }) => {
  await page.goto("/");
  await page.click("text=Sign up");
  await page.fill('[name="email"]', `test+${Date.now()}@example.com`);
  await page.fill('[name="password"]', "Test1234!");
  await page.click('button[type="submit"]');
  await expect(page).toHaveURL("/dashboard");

  await page.click("text=Browse menu");
  await page.click("text=Add to cart >> nth=0");
  await page.click("text=Checkout");
  await page.click("text=Place order");
  await expect(page.locator("text=Order placed")).toBeVisible();

  await page.click("text=Order history");
  await expect(page.locator(".order-row")).toHaveCount(1);
});
```

## Resilience patterns

- **Wait for elements, not for time** (`await expect(locator).toBeVisible()`, never `setTimeout`)
- **Use stable selectors** (data-testid, ARIA labels) — never CSS classes or nth-child
- **Unique test data** (timestamps, random IDs) — avoid collisions between parallel runs
- **Clean up after** (delete the test user) so repeat runs don't accumulate
- **Run on every PR** but allow one retry on flake — track flake rate

## Anti-patterns

- ❌ E2E for every endpoint (slow, redundant; lower-layer tests catch these cheaper)
- ❌ Time-based waits (`sleep(2000)`) — always flaky
- ❌ Tests that share data (test A creates an order that test B reads — order-dependent)
- ❌ Hitting real third-party APIs in E2E (Stripe sandbox, real email) — flaky, costs money
- ❌ E2E suite over 10 minutes (developer feedback loop dies)
- ❌ Suppressing failures by retrying 5 times (mask real bugs)

## Gate criteria

- Critical user journeys identified and E2E-tested (5–15 tests, not more)
- Test suite runs in < 10 min on CI (shard if needed)
- All selectors are stable (data-testid or ARIA), not CSS
- Tests are independent and parallelizable
- Real third-party APIs are stubbed at the network boundary
- Flake rate < 1% (tracked and acted on)
