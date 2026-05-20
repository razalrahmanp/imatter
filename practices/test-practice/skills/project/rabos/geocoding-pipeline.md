---
id: geocoding-pipeline
title: "Geocoding pipeline — pin code extraction, quality scoring, fallback"
layer: project
project: rabos
tags: [rabos, geocoding, pin-code, location, india, quality-score]
applies_to:
  task_types: [add-geocoding, modify-geocoding, add-location]
  stages: [3, 7, 9]
size_tokens: 230
related: [bedrock-call, supabase-rls, structured-logging]
---

# geocoding-pipeline — Geocoding Pipeline Pattern

## Pattern Summary

All address-to-coordinates resolution goes through the three-stage pipeline. Never call a geocoding API directly from a handler.

```
Stage 1: Pin code extraction
  Input:  raw address string
  Output: { pin_code: string | null; confidence: "high" | "low" | "none" }
  How:    regex patterns → Claude extraction (if regex fails) → null (if Claude fails)

Stage 2: Coordinate lookup
  Input:  pin_code
  Output: { lat: number; lng: number; source: "db" | "api" | "fallback" }
  How:    local PIN→coords DB → external geocoding API → district centroid fallback

Stage 3: Quality scoring
  Input:  { pin_code, lat, lng, source, confidence }
  Output: { score: number; usable: boolean }
  Scores: pin_code extracted + api source = 90–100
          pin_code extracted + db source  = 80–89
          pin_code extracted + fallback   = 50–60
          no pin_code                     = 20–30 (use district centroid only)
```

```typescript
// Usage — always through the pipeline, never direct API call
const result = await geocodingPipeline.resolve(rawAddress, branchId);
if (!result.usable) {
  // log quality score, store with low-confidence flag, do not block the transaction
  log("warn", { action: "geocoding.low_quality", score: result.score, addressHash: hash(rawAddress) });
}
```

**Never log the raw address — it may contain customer PII.** Log the hash or pin code only.

**The pipeline is async and non-blocking.** Geocoding failure never prevents the primary transaction from completing — store coordinates when available, proceed without when not.

## Full Reference

### Pin code extraction
Indian pin codes: 6-digit numeric (`\b[1-9]\d{5}\b`). If regex finds exactly one match, use it (confidence: high). If regex finds multiple or none, send to Claude with BEDROCK_MAX_TOKENS.ENTITY_EXTRACTION (300 tokens). If Claude also fails, confidence: none.

### Fallback hierarchy
1. Local PIN→coords lookup table (fast, no cost)
2. External geocoding API (cached 30 days per PIN)
3. District centroid from state-district-pin reference table

### Forbidden
- Calling geocoding API from Lambda handler directly (use the pipeline)
- Blocking transactions on geocoding failure
- Logging raw address strings
