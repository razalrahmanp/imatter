---
name: sdlc-cloudfront-cache
description: Use when configuring CloudFront (or other CDN) for an app or API — covers cache policies, what to cache, what not to cache, and invalidation strategy.
---

## Rule

The CDN caches what's safe to cache. Static assets cache aggressively; HTML responses cache cautiously; authenticated responses don't cache at all. Define explicit cache policies — don't rely on defaults.

## Decision tree

```
Request →
├─ Static asset (CSS, JS, images)? → Cache aggressively (years), bust via hash in filename
├─ HTML page (public)? → Cache briefly (minutes), with stale-while-revalidate
├─ HTML page (per-user)? → Don't cache; pass through
├─ API response (idempotent GET, public)? → Cache by URL + relevant headers
├─ API response (mutation, or authenticated, or personalized)? → Don't cache
```

## Cache headers — set them deliberately

```http
# Static asset with hash in URL (versioned)
Cache-Control: public, max-age=31536000, immutable

# Public HTML, ok to be a few min stale
Cache-Control: public, max-age=300, s-maxage=3600, stale-while-revalidate=60

# Authenticated / personalized
Cache-Control: private, no-store
```

| Directive | Meaning |
|---|---|
| `public` | Any cache can store |
| `private` | Only browser cache, not CDN |
| `max-age=N` | Fresh for N seconds (browser + CDN) |
| `s-maxage=N` | Fresh for N seconds (CDN only; overrides max-age for CDN) |
| `stale-while-revalidate=N` | Serve stale up to N seconds while refreshing in background |
| `no-store` | Don't cache at all |
| `immutable` | Don't even check for updates within max-age |

## CloudFront cache policy

```yaml
DefaultCacheBehavior:
  TargetOriginId: api-origin
  AllowedMethods: [GET, HEAD, OPTIONS, PUT, POST, PATCH, DELETE]
  CachedMethods: [GET, HEAD, OPTIONS]
  CachePolicyId: !Ref ApiCachePolicy
  OriginRequestPolicyId: !Ref ApiOriginRequestPolicy

ApiCachePolicy:
  Type: AWS::CloudFront::CachePolicy
  Properties:
    Name: api-cache
    MinTTL: 0
    DefaultTTL: 60       # 1 minute default
    MaxTTL: 86400         # 1 day max
    ParametersInCacheKeyAndForwardedToOrigin:
      CookiesConfig:
        CookieBehavior: none      # don't cache by cookie
      HeadersConfig:
        HeaderBehavior: whitelist
        Headers: [Authorization]  # vary by auth header (= per-user)
      QueryStringsConfig:
        QueryStringBehavior: all  # cache key includes all query strings
```

## Cache busting via hash in filename

```html
<!-- ❌ Wrong: same URL forever -->
<link href="/styles.css" />

<!-- ✅ Right: URL changes when content changes -->
<link href="/styles.abc123.css" />
```

Bundlers (Webpack, Vite, esbuild) generate hashed filenames. Set `Cache-Control: max-age=31536000, immutable` on these — they'll be cached forever and invalidated by the URL change.

## When to use `private` vs `public`

| Response | Directive |
|---|---|
| Logged-out homepage | `public` |
| Logged-in dashboard HTML | `private, no-store` |
| Authenticated API response | `private, no-store` |
| Public API key required (less sensitive) | `public` ok if rate-limited |
| Per-user data (`/api/me`) | `private, no-store` |

## Invalidation

When you must invalidate (rare with hashed filenames):

```bash
aws cloudfront create-invalidation \
  --distribution-id ABCDEF123 \
  --paths "/api/config" "/index.html"
```

CloudFront invalidations are expensive ($0.005 per path beyond 1000/month). Avoid by using hashed filenames. Reserve invalidations for surprise content changes (e.g. unpublishing an article).

## Edge cases

| Case | Handle |
|---|---|
| Cookies set on response | Default CloudFront won't cache; set explicitly if you want to |
| Vary header | Include in cache key — but watch cardinality (`Vary: Cookie` = no caching) |
| Range requests (video, large files) | CloudFront caches by range; works automatically |
| Streaming responses | Don't cache; pass through |
| WebSocket | Different config; CloudFront supports but not as cache |

## Anti-patterns

- ❌ Caching authenticated responses (every user gets the wrong data)
- ❌ No `Cache-Control` on responses (CDN guesses; behavior is browser/CDN-specific)
- ❌ Cache key by cookie (cardinality explosion → no real caching)
- ❌ Invalidating on every deploy (expensive; should use hashed filenames)
- ❌ Different cache TTL on origin vs CDN (drift; CDN serves stale forever)
- ❌ Caching error responses (5xx as fresh = users see errors forever)
- ❌ Vary on Accept-Encoding (mostly handled; making it explicit can hurt)
- ❌ No `OriginRequestPolicy` (Authorization header isn't forwarded by default)

## Gate criteria

- Every endpoint has an explicit `Cache-Control` header
- Static assets use hashed filenames + `immutable` Cache-Control
- Authenticated responses use `private, no-store`
- Cache policy in CloudFront matches the application's intended caching behavior
- Cache hit rate is on a dashboard; investigated when low for ostensibly-cacheable content
- A documented invalidation runbook exists for unplanned content changes
