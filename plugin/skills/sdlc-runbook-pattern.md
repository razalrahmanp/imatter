---
name: sdlc-runbook-pattern
description: Use when designing the operational documentation for a service — produces runbooks that an on-call engineer can follow at 3am with no prior context, for known failure modes.
---

## Rule

Every service has a runbook. The runbook lists the failure modes, the symptoms, the steps to diagnose, and the steps to mitigate. It is written for the engineer who has never touched this service before — usually you, at 3am, six months from now.

## What goes in a runbook

| Section | Content |
|---|---|
| **Overview** | What this service does, who depends on it, who owns it |
| **Alerts** | One section per alert/symptom |
| **Common ops** | Restart, scale up, drain, rollback |
| **Configuration** | Where settings live, what each one does |
| **Dependencies** | What this service needs to run; what breaks if each fails |
| **Recovery** | Full recovery from total loss; restore-from-backup steps |
| **Contacts** | Who to escalate to (and when) |

## Per-alert structure — copy this template

```markdown
### Alert: <alert name>

**Symptom:** <what the alert sees — e.g. "p99 latency > 2s for 5min">

**User impact:** <none / degraded / outage; what users notice>

**Severity:** <P0–P4; matches alert severity in monitoring>

**Common causes (in order of likelihood):**
1. <cause 1>
2. <cause 2>
3. <cause 3>

**Diagnose:**
1. Check <dashboard URL> — look for <specific signal>
2. Run: `<command>` — should show <expected output>
3. Tail logs: `<command>` — look for <pattern>

**Mitigate:**
1. <quick fix to stop user pain — restart, failover, rate-limit>
2. <medium-term fix — patch, scale up>
3. <if all else fails — escalate to @<person>>

**Resolve:**
1. <verify the system is healthy again — specific check>
2. <prevent recurrence — e.g. open a ticket for proper fix>

**Post-incident:**
- Write up in `docs/incidents/` if SEV-1 or SEV-2
- Update this runbook if a new failure mode was discovered
```

## Example — concrete runbook entry

```markdown
### Alert: orders-api p99 latency > 2s

**Symptom:** p99 latency on POST /orders > 2s for 5 minutes (Datadog monitor #4567)

**User impact:** Slow checkout. Some users may abandon. No data loss.

**Severity:** P2

**Common causes:**
1. Postgres connection pool exhausted (most common — see metric `db.connections.active`)
2. Stripe API slow (check Stripe status page + `stripe.charges.create` span latency)
3. Lambda cold starts (rare; only matters during deploy or traffic surge)

**Diagnose:**
1. Open https://app.datadoghq.com/dashboard/abc — look at "DB connections" tile
2. If DB connections == max: see Mitigate step 1
3. If Stripe latency tile is red: see Mitigate step 2
4. Check `aws lambda list-functions --query "Functions[?FunctionName=='orders-api']"` for recent updates

**Mitigate:**
1. **DB pool exhausted**: kill long-running queries via
   `psql $DATABASE_URL -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE query_duration > interval '30 seconds'"`
   Then scale up the pool via Pulumi: `pnpm pulumi config set dbPoolSize 30; pnpm pulumi up`.
2. **Stripe slow**: enable the cached-quote fallback via `aws lambda update-function-configuration --function-name orders-api --environment Variables={STRIPE_FALLBACK=on}`
3. If neither, page @ops on PagerDuty.

**Resolve:**
1. Confirm p99 < 1s for 10 min straight
2. If pool exhaustion: file a ticket to investigate which query held connections

**Post-incident:**
- Always write up for P2 — see `docs/incidents/template.md`
```

## Where the runbook lives

- `docs/runbooks/<service>.md` — committed to source control
- Linked from monitoring alerts (Datadog "runbook URL" field; PagerDuty Incident Workflows)
- Indexed in a top-level `docs/runbooks/README.md`

Keep them in source control so:
- They diff
- They survive contractor/team turnover
- They can be updated in the same PR as the code change that caused a new failure mode

## What runbooks are NOT

| Confusion | Reality |
|---|---|
| Architecture docs | Different audience (designer vs. 3am operator) |
| Tutorials | Tutorials teach; runbooks fix |
| Generic "how to use Linux" | Specific to this service |
| The full source code | Pointers to source, not source itself |

## Anti-patterns

- ❌ Runbook that says "see the wiki" (the wiki has rotted; the link is dead)
- ❌ Runbook longer than the source code (over-documented; nobody reads)
- ❌ Generic "restart the service" advice with no specific commands
- ❌ Steps that require knowledge nobody has at 3am ("just look at the metrics")
- ❌ Runbook not updated after the incident that exposed a new failure
- ❌ Runbook in a tool nobody can access from their phone
- ❌ No "user impact" section — operator can't triage severity
- ❌ No "common causes" — every incident becomes a first-principles investigation

## Gate criteria

- A runbook exists for every production service (Stage 7 gate criterion)
- Each alert in monitoring has a `runbook_url` field linking to its section
- Each alert section follows the standard template (symptom, impact, diagnose, mitigate)
- A new on-call engineer can read the runbook and resolve a P2 without escalation (test this — actually onboard someone)
- Post-incident reviews include "did the runbook help?" and updates if not
- Runbooks updated within 1 week of any new failure mode discovery
