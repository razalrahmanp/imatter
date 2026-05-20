---
name: sdlc-api-doc-pattern
description: Use when generating or maintaining API reference documentation — covers OpenAPI as the source of truth, how to keep docs in sync with code, and what consumers actually need.
---

## Rule

API documentation is generated from the OpenAPI (or AsyncAPI, GraphQL schema, gRPC proto) spec — not hand-written. The spec lives next to the code, generated from typed schemas, and renders as the public docs. Hand-edited docs drift; generated docs stay honest.

## Pattern — OpenAPI from typed schemas

```ts
import { z } from "zod";
import { extendZodWithOpenApi, OpenApiGeneratorV31 } from "@asteasolutions/zod-to-openapi";

extendZodWithOpenApi(z);

const CreateOrderInput = z.object({
  customer_id: z.string().uuid().openapi({ example: "usr_abc123" }),
  items: z.array(z.object({
    sku: z.string().regex(/^[A-Z0-9-]+$/).openapi({ example: "WIDGET-1" }),
    qty: z.number().int().positive().openapi({ example: 2 }),
  })).min(1),
}).openapi("CreateOrderInput");

const Order = z.object({
  id: z.string(),
  status: z.enum(["pending", "paid", "shipped", "cancelled"]),
  total: z.number(),
}).openapi("Order");

// In the route registration:
registry.registerPath({
  method: "post",
  path: "/orders",
  request: { body: { content: { "application/json": { schema: CreateOrderInput } } } },
  responses: {
    201: { description: "Order created", content: { "application/json": { schema: Order } } },
    400: { description: "Invalid input" },
  },
});

// Generate spec:
const generator = new OpenApiGeneratorV31(registry.definitions);
const spec = generator.generateDocument({
  openapi: "3.1.0",
  info: { title: "API", version: "1.0.0" },
});
```

One source: the Zod schema. The handler uses it for parsing, the docs are generated from it. They cannot drift.

## What renders well

For each operation:
- One-sentence summary
- Description with use case
- All parameters documented (where they come from: path, query, header)
- Request body schema with example
- Each possible response with schema and HTTP status
- Authentication required
- Rate limits
- Idempotency support (if any)
- Deprecation warning (if applicable)

## What docs consumers actually need (in this order)

1. **Authentication** — how to get a token, where it goes
2. **Quickstart** — copy-pasteable curl that works
3. **Reference** — every endpoint, every field
4. **Error reference** — every error code, what it means, how to recover
5. **Rate limits and quotas** — what they are, how to monitor headers
6. **Pagination** — explained once, applied everywhere
7. **Idempotency** — how to retry safely
8. **Webhooks** — if applicable: signature verification, retry policy, event catalogue
9. **Changelog** — what changed in the last few versions

Most teams document #3 well and skip #1–2 and #4–9. Reverse that priority.

## Auto-generated example code

For each endpoint, generate a runnable curl + at least one SDK snippet:

```bash
curl -X POST https://api.example.com/v1/orders \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: $(uuidgen)" \
  -d '{"customer_id": "usr_abc123", "items": [{"sku": "WIDGET-1", "qty": 2}]}'
```

Tools like Redocly, Stoplight, Mintlify generate these from OpenAPI. Don't hand-write per language.

## Renderers — pick one

| Tool | Notes |
|---|---|
| **Redocly** | Polished default; free self-host |
| **Swagger UI** | Free, ubiquitous, ugly out of the box |
| **Mintlify** | Best DX, paid |
| **Stoplight Elements** | Good free option |
| **GitBook with OpenAPI block** | If docs already in GitBook |
| **Hand-built site (Docusaurus, Astro Starlight)** | Most control; most work |

For most teams: **Redocly or Stoplight Elements**, served from a `/docs` route.

## Keeping the spec honest

The spec must match the running server. Common drift sources and fixes:

| Drift | Fix |
|---|---|
| Schema in spec doesn't match handler | Generate spec from handler's schema |
| Field added to handler, not to spec | Same — generate, don't write |
| Endpoint removed in code, still in spec | Same — spec is computed |
| Response shape changed | Type generation; spec auto-updates |
| Error responses missing | Add `responses` registry to every handler |

A failing CI check: "Generated spec matches committed spec." Forces docs to stay current.

## Anti-patterns

- ❌ Hand-edited OpenAPI YAML (will drift)
- ❌ Docs in a CMS / Notion / Confluence (separated from code, no review trail)
- ❌ Reference docs without quickstart (consumer can't find their way in)
- ❌ Quickstart with placeholder values that don't actually work
- ❌ Different endpoints documented in different styles
- ❌ No error reference (consumers can't write good error handling)
- ❌ Spec lives somewhere; running API actually returns different shape (always test with a generated client)
- ❌ Changelog buried five levels deep
- ❌ Postman collections / Insomnia files as the "documentation" — they're examples, not docs

## Gate criteria

- An OpenAPI (or AsyncAPI / proto / GraphQL schema) document is generated from typed code, not hand-edited
- The spec is rendered as user-facing docs at a stable URL
- A CI check verifies the generated spec matches the committed spec
- Quickstart exists, includes a copy-pasteable working example
- Error reference exists with stable error codes
- Webhook / async event catalogue exists if applicable
- Changelog is visible from the docs site
