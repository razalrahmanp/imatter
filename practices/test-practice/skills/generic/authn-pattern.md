---
id: authn-pattern
title: "Authentication pattern — JWT bearer tokens, session validation, 401 vs 403"
layer: generic
tags: [authentication, jwt, bearer-token, session, authorization]
applies_to:
  task_types: [add-handler, add-endpoint, modify-handler]
  stages: [3, 5, 6]
size_tokens: 195
related: [cognito-jwt-validation, input-validation, error-handling, structured-logging]
---

# authn-pattern — Authentication Pattern

## Pattern Summary

Authentication verifies identity; authorization verifies permission. Check authentication first, then authorization. Return 401 for missing/invalid identity, 403 for insufficient permission — never conflate them.

**Authentication vs authorization:**
```
401 Unauthorized — "I don't know who you are"
  → Missing token, expired token, invalid signature, wrong issuer

403 Forbidden — "I know who you are, but you can't do this"
  → Valid token, insufficient role, wrong tenant, resource not yours
```

**Standard auth middleware pattern:**
```typescript
type AuthMiddleware = (
  handler: (event: AuthenticatedEvent) => Promise<APIGatewayProxyResult>
) => (event: APIGatewayProxyEvent) => Promise<APIGatewayProxyResult>;

export const withAuth: AuthMiddleware = (handler) => async (event) => {
  // 1. Extract and validate token
  const claims = await verifyToken(event.headers.Authorization ?? "");
  if (!claims) {
    return {
      statusCode: 401,
      body: JSON.stringify({ code: "unauthorized", message: "Invalid or missing token" }),
    };
  }

  // 2. Extract tenant context — never from body or query
  const branchId = extractBranchId(claims);
  const role = extractRole(claims);

  // 3. Pass enriched event to handler
  return handler({ ...event, claims, branchId, role });
};

// Usage
export const handler = withAuth(async (event) => {
  // event.branchId and event.role are guaranteed to be valid here
  if (event.role !== "owner" && event.httpMethod !== "GET") {
    return { statusCode: 403, body: JSON.stringify({ code: "forbidden" }) };
  }
  // ...
});
```

## Full Reference

### Token extraction order
Check `Authorization` header first (Bearer token). Cookies are acceptable for browser sessions but must use `SameSite=Strict` and `HttpOnly`. Query parameter tokens are forbidden — they appear in server logs.

### Clock skew
Allow ≤ 60 seconds of clock skew when validating `exp` and `iat`. More than that indicates a misconfigured server clock or a very long-lived token.

### Forbidden
- Reading tenant/branch ID from request body (always from the verified token)
- Returning 401 for permission failures (use 403 — don't hide that the user is authenticated)
- Logging the full JWT token value (contains claims; log only the `sub`)
