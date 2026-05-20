---
id: api-versioning
title: "API versioning — URL path versioning, deprecation headers, sunset policy"
layer: generic
tags: [api, versioning, deprecation, backward-compatibility, rest]
applies_to:
  task_types: [add-endpoint, modify-handler]
  stages: [3, 5, 7]
size_tokens: 195
related: [api-endpoint-design, changelog-pattern, api-doc-pattern]
---

# api-versioning — API Versioning Pattern

## Pattern Summary

Version APIs in the URL path (`/v1/`, `/v2/`). Deprecate old versions with response headers and a published sunset date. Never break existing clients without a migration window.

**URL path versioning:**
```
/api/v1/orders      ← current stable version
/api/v2/orders      ← new version when breaking changes needed
/api/orders         ← redirect to latest (use sparingly — breaks caching)
```

**Breaking vs non-breaking changes:**
```
NON-BREAKING (safe to deploy to existing version):
  + Adding a new optional field to a response
  + Adding a new endpoint
  + Making a required field optional
  + Adding a new enum value (only if clients ignore unknown values)

BREAKING (requires a new version):
  - Removing or renaming a field
  - Changing a field type (string → number)
  - Changing response status codes
  - Changing authentication requirements
  - Removing an enum value
```

**Deprecation response headers:**
```typescript
// Add to every response from a deprecated endpoint
const deprecationHeaders = {
  "Deprecation": "true",
  "Sunset": "Sat, 01 Jan 2027 00:00:00 GMT",   // RFC 8594 format
  "Link": '</api/v2/orders>; rel="successor-version"',
};
```

**Minimum deprecation window:**
```
Internal APIs (no external consumers): 30 days
Partner/external APIs:                 6 months minimum
Public APIs:                           12 months minimum
```

## Full Reference

### Versioning in the OpenAPI spec
Document both versions. Mark deprecated endpoints with `deprecated: true` and `x-sunset: "YYYY-MM-DD"`. Keep deprecated docs live until the sunset date.

### Migration comms
Notify consumers via email/changelog at deprecation start. Send reminder 30 days before sunset. Track which clients are still using deprecated versions via access logs.

### Forbidden
- Removing a field without a deprecation period (even for "internal" endpoints — internal clients break too)
- Sunset date < 30 days from deprecation announcement
- Silent breaking changes without a new version number
