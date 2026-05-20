---
id: cloudfront-cache
title: "CloudFront cache — cache-control headers, invalidation, signed URLs"
layer: stack
stack: react-supabase-lambda
tags: [cloudfront, cdn, caching, cache-control, signed-url, aws]
applies_to:
  task_types: [add-handler, add-integration, deploy]
  stages: [5, 7]
size_tokens: 200
related: [lambda-handler, serverless-yml-pattern, caching-strategy]
---

# cloudfront-cache — CloudFront Cache Pattern

## Pattern Summary

Set explicit `Cache-Control` headers on every response. CloudFront caches what you tell it to. Unbounded caching of dynamic content causes stale data; no caching causes unnecessary origin load.

**Cache-Control decision table:**
```
Static assets (JS, CSS, fonts — content-hashed filenames):
  Cache-Control: public, max-age=31536000, immutable
  → Cache forever — the URL changes on content change

API responses (dynamic, authenticated):
  Cache-Control: private, no-store
  → Never cache — each user sees their own data

Public read-only data (menu items, branch config — rarely changes):
  Cache-Control: public, s-maxage=300, stale-while-revalidate=60
  → CloudFront caches 5 min; serves stale for 1 min while refreshing

Download/export responses (PDFs, CSVs):
  Cache-Control: private, no-store
  Content-Disposition: attachment; filename="report-2026-05.pdf"
```

**Setting headers in Lambda responses:**
```typescript
return {
  statusCode: 200,
  headers: {
    "Content-Type": "application/json",
    "Cache-Control": "private, no-store",
  },
  body: JSON.stringify(data),
};
```

**CloudFront invalidation after deploy (for public routes):**
```bash
aws cloudfront create-invalidation \
  --distribution-id $CF_DISTRIBUTION_ID \
  --paths "/menu/*" "/config/*"
# Wildcard invalidation costs $0.005 per path — use specific paths when possible
```

**Signed URLs (for private S3 assets):**
```typescript
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { GetObjectCommand } from "@aws-sdk/client-s3";

const url = await getSignedUrl(s3, new GetObjectCommand({
  Bucket: process.env.ASSETS_BUCKET,
  Key: `${branchId}/reports/${reportId}.pdf`,
}), { expiresIn: 300 });  // 5 min — don't make long-lived signed URLs
```

## Full Reference

### CloudFront behaviours
Configure separate cache behaviours for `/api/*` (no cache) and `/_next/static/*` (immutable). Default behaviour handles everything else.

### Forbidden
- Returning API responses without explicit `Cache-Control: private, no-store` (CloudFront may cache 200 responses by default)
- Signed URLs with `expiresIn > 3600` for user-requested downloads
