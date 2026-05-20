---
name: sdlc-api-versioning
description: Use when adding a breaking change to an API or planning long-term API evolution — covers versioning strategies, deprecation policy, and how to coexist multiple versions.
---

## Rule

Breaking changes deserve a new version. Additive changes (new optional fields, new endpoints) do not. Pick a versioning strategy, commit to a deprecation policy, and never break a documented public API silently.

## What counts as breaking

| Change | Breaking? |
|---|---|
| Add a new endpoint | No |
| Add a new optional field to response | No (clients should ignore unknown fields) |
| Add a new required field to request | **Yes** |
| Remove a field from response | **Yes** |
| Change a field's type | **Yes** |
| Change a field's semantics (same name, different meaning) | **Yes** (and usually worse — clients don't notice) |
| Change a default value | **Yes** (silent change) |
| Add a stricter validation rule | **Yes** if it rejects previously-accepted inputs |
| Rename a field | **Yes** |
| Change error response shape | **Yes** |
| Change HTTP status code for the same outcome | **Yes** |

## Versioning strategies

| Strategy | When | Notes |
|---|---|---|
| **URL path** (`/v1/orders`, `/v2/orders`) | Default for most apps | Visible, easy to route, easy to document |
| **Custom header** (`API-Version: 2`) | Internal APIs, complex versioning | Harder to test in browser |
| **Accept header** (`Accept: application/vnd.acme.v2+json`) | Hypermedia APIs | Most "correct" REST; most cumbersome |
| **Query parameter** (`?version=2`) | Avoid | Pollutes caching, confuses clients |
| **Date-based** (`Stripe-Version: 2024-04-10`) | Stripe-style; granular control | Strong tooling needed; client must declare |

**Default: URL path.** It's pragmatic, visible, and easy to deprecate.

## Deprecation policy — write this down once

Example policy:

> A version is deprecated when its successor reaches GA. Deprecated versions are supported for **12 months** from the deprecation date. During that window:
> - All endpoints work
> - Each response includes `Deprecation: true` and `Sunset: <date>` headers
> - Email warnings sent to API key owners at 90, 60, 30, 7, and 1 days before sunset
> - Documentation marks the version "DEPRECATED — sunset YYYY-MM-DD"
> After sunset, requests to deprecated versions return 410 Gone with a migration link.

Different products choose different windows: Stripe gives indefinite backwards compatibility; GitHub has rolled major deprecations over months; AWS APIs typically 12+ months.

Whatever you choose, document it and stick to it.

## Coexisting versions — how to actually do it

### Strategy A: Branch in the handler

```ts
app.post("/v1/orders", handlerV1);
app.post("/v2/orders", handlerV2);
```

Pros: Clean. No conditional logic.
Cons: Code duplication. Drift over time.

### Strategy B: Shared core + version-specific shim

```ts
async function createOrderCore(input: NormalizedInput) { /* business logic */ }

app.post("/v1/orders", async (req, res) => {
  const normalized = v1ToCore(req.body);          // shim
  const result = await createOrderCore(normalized);
  return res.json(coreToV1(result));              // shim
});

app.post("/v2/orders", async (req, res) => {
  const result = await createOrderCore(req.body); // v2 IS the core shape
  return res.json(result);
});
```

Pros: One business logic path. New versions are shims, not new logic.
Cons: Shims have to handle every edge case of the old shape.

### Strategy C: Adapter at the gateway

Old version translated to new at the API gateway / proxy layer; backend only knows the new shape.

Pros: Backend stays clean.
Cons: Adapter is a separate codebase to maintain; complex requests are hard to translate.

**Pick B as default.** Most APIs converge there.

## Anti-patterns

- ❌ "Soft" breaking changes that nobody notices until production breaks
- ❌ No deprecation window — old version removed overnight
- ❌ Version in path + version in header (two ways to specify; confusing)
- ❌ Major version bump for additive changes (forces clients to migrate for nothing)
- ❌ Branching code at every layer for every version (cancer; consolidate at the boundary)
- ❌ Two-version coexistence that lasts forever (operational burden grows)
- ❌ No `Deprecation` / `Sunset` headers in responses from deprecated versions

## Gate criteria

- A versioning strategy is chosen and documented before the first public API ship
- A deprecation policy with explicit windows is documented
- Deprecated endpoints emit `Deprecation` and `Sunset` headers
- A migration guide exists for each version pair (`v1 → v2`)
- Coexisting versions share a core implementation; no duplicated business logic
- The OpenAPI spec includes the version and the deprecation status for each operation
- A test exists that hits both versions of any coexisting endpoint to catch drift
