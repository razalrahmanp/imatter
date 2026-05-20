---
id: health-check
title: "Health check — liveness vs readiness, dependency checks, structured response"
layer: generic
tags: [health-check, liveness, readiness, monitoring, kubernetes, ecs]
applies_to:
  task_types: [add-endpoint, add-handler, deploy]
  stages: [5, 7]
size_tokens: 185
related: [structured-logging, error-handling, runbook-pattern]
---

# health-check — Health Check Pattern

## Pattern Summary

Expose two health endpoints. Liveness: is the process alive? Readiness: can it serve traffic? They serve different purposes and must not be conflated.

**Liveness endpoint (`GET /health/live`):**
```typescript
// Minimal — just confirms the process is running and can handle requests
// Should NEVER check external dependencies (DB, cache, external APIs)
// If this fails, the orchestrator kills and restarts the container

export const liveness = async (): Promise<APIGatewayProxyResult> => ({
  statusCode: 200,
  headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  body: JSON.stringify({ status: "ok", ts: new Date().toISOString() }),
});
```

**Readiness endpoint (`GET /health/ready`):**
```typescript
// Checks that the service can actually serve requests (dependencies healthy)
// If this fails, orchestrator stops sending traffic but does not restart

export const readiness = async (): Promise<APIGatewayProxyResult> => {
  const checks: Record<string, "ok" | "fail"> = {};

  // DB check
  try {
    await db.query("SELECT 1");
    checks.database = "ok";
  } catch { checks.database = "fail"; }

  // Cache check (optional — only include if cache is required for serving)
  try {
    await cache.ping();
    checks.cache = "ok";
  } catch { checks.cache = "fail"; }

  const healthy = Object.values(checks).every((v) => v === "ok");
  return {
    statusCode: healthy ? 200 : 503,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    body: JSON.stringify({ status: healthy ? "ok" : "degraded", checks }),
  };
};
```

## Full Reference

### Why separate liveness and readiness
Liveness: if DB is down, you do NOT want the container restarted (restart won't fix the DB). Readiness: if DB is down, you DO want to stop sending traffic so requests fail fast at the load balancer rather than timing out in the container.

### Health check response
Always return JSON with a `status` field. Include dependency names and their status for operational debugging. Never include secrets or internal stack traces.

### Forbidden
- Liveness endpoint that checks external dependencies (causes restart loops during dependency outages)
- Health endpoint that returns 200 even when dependencies are failing (defeats the purpose)
