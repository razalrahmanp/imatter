---
id: background-job
title: "Background job — async processing, fan-out, progress tracking, failure handling"
layer: generic
tags: [background-job, async, worker, queue, fan-out, reliability]
applies_to:
  task_types: [add-worker, add-handler]
  stages: [5, 7]
size_tokens: 200
related: [sqs-trigger, idempotency, error-handling, structured-logging]
---

# background-job — Background Job Pattern

## Pattern Summary

Offload work that takes > 2 seconds or is non-critical to request latency to a background job. Return a job ID immediately; clients poll or receive a callback when done.

**Job lifecycle:**
```
REQUEST: POST /reports/generate → { jobId: "uuid", status: "queued" }
POLL:    GET  /reports/jobs/{jobId} → { status: "processing"|"done"|"failed", resultUrl?: string }
```

**Job record schema:**
```sql
CREATE TABLE background_jobs (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id    uuid NOT NULL REFERENCES branches(id),
  job_type     text NOT NULL,        -- 'generate_report' | 'bulk_cancel' | etc.
  status       text NOT NULL DEFAULT 'queued'
               CHECK (status IN ('queued','processing','done','failed')),
  input        jsonb NOT NULL,       -- job parameters (no PII)
  result       jsonb,                -- output metadata (URL, counts, etc.)
  error        text,                 -- error message if failed
  attempt      integer NOT NULL DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT now(),
  started_at   timestamptz,
  completed_at timestamptz
);
```

**Job handler pattern:**
```typescript
export async function processJob(jobId: string, db: PoolClient): Promise<void> {
  await db.query(
    "UPDATE background_jobs SET status='processing', started_at=NOW(), attempt=attempt+1 WHERE id=$1",
    [jobId]
  );
  try {
    const { rows: [job] } = await db.query("SELECT * FROM background_jobs WHERE id=$1", [jobId]);
    const result = await runJobByType(job.job_type, job.input, db);
    await db.query(
      "UPDATE background_jobs SET status='done', result=$2, completed_at=NOW() WHERE id=$1",
      [jobId, result]
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await db.query(
      "UPDATE background_jobs SET status='failed', error=$2, completed_at=NOW() WHERE id=$1",
      [jobId, message]
    );
    throw err;  // allow queue retry
  }
}
```

## Full Reference

### Fan-out pattern
For jobs that process N items in parallel: create one parent job + N child jobs. Parent status is "done" only when all children complete. Track `parent_job_id` on child records.

### Retention
Retain completed jobs for 30 days (for audit/support). Retain failed jobs until manually reviewed. Purge queued jobs older than 24 hours (likely stale from a worker crash).

### Forbidden
- Blocking the HTTP handler for > 2 seconds (use background jobs)
- Jobs without a status endpoint (clients need a way to know when work is done)
