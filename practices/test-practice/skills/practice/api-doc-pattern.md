---
id: api-doc-pattern
title: "API documentation pattern — OpenAPI spec, error catalog, versioning notes"
layer: practice
tags: [api, openapi, documentation, swagger, rest]
applies_to:
  task_types: [add-endpoint, add-handler, modify-handler]
  stages: [5, 7]
size_tokens: 195
related: [readme-structure, architecture-doc, changelog-pattern, api-endpoint-design]
---

# api-doc-pattern — API Documentation Pattern

## Pattern Summary

Document APIs as OpenAPI 3.1 specs stored in the repo alongside the code. Generated docs are always stale; spec-first or spec-alongside keeps docs accurate.

**OpenAPI skeleton per endpoint:**
```yaml
# docs/openapi.yaml
paths:
  /orders/{orderId}/cancel:
    post:
      summary: Cancel a single order
      operationId: cancelOrder
      security:
        - bearerAuth: []
      parameters:
        - name: orderId
          in: path
          required: true
          schema:
            type: string
            format: uuid
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/CancelOrderRequest'
      responses:
        '200':
          description: Order cancelled successfully
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/CancelOrderResponse'
        '404':
          $ref: '#/components/responses/NotFound'
        '403':
          $ref: '#/components/responses/Forbidden'
        '409':
          description: Order already in terminal state
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/Error'
```

**Error catalog — document all error codes:**
```yaml
components:
  schemas:
    Error:
      type: object
      required: [code, message]
      properties:
        code:    { type: string }   # machine-readable: "order_not_found"
        message: { type: string }   # human-readable
        details: { type: object }   # optional structured context
```

## Full Reference

### Error code naming
`{resource}_{condition}`: `order_not_found`, `payment_already_captured`, `branch_limit_exceeded`. Never use HTTP status text as error code.

### Versioning in the spec
Add `deprecated: true` and `x-deprecated-at: "YYYY-MM-DD"` to endpoints slated for removal. Document the replacement in the description. Remove after the deprecation window.

### Forbidden
- Documenting only happy-path responses (error responses are what clients actually need to handle)
- Prose documentation as the source of truth for request/response shapes (OpenAPI schema is authoritative)
