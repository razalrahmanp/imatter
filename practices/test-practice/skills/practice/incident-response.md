---
id: incident-response
title: "Incident response — declare, mitigate, communicate, resolve"
layer: practice
tags: [incident, on-call, response, sre, communication]
applies_to:
  task_types: [add-monitoring, add-worker]
  stages: [7, 10]
size_tokens: 200
related: [postmortem-blameless, runbook-pattern, oncall-handoff]
---

# incident-response — Incident Response Pattern

## Pattern Summary

When production breaks: declare fast, mitigate first, communicate often, investigate after. Never let "I'm not sure it's an incident" delay declaration.

**Severity definition:**
```
P0 — customer-facing outage or data integrity issue. Declare immediately.
P1 — significant degradation (>20% error rate or >3× latency). Declare within 5 min.
P2 — partial degradation, workaround exists. Declare within 15 min.
P3 — minor, no customer impact. Log, schedule fix, no urgent response.
```

**Response playbook:**
```
1. DECLARE
   → Open incident channel: #incidents or equivalent
   → Post: "Incident declared: [symptom]. Severity: P[N]. IC: @you."
   → Assign IC (Incident Commander) — one person owns communication

2. MITIGATE (priority over root cause)
   → Rollback the last deployment if timing correlates
   → Toggle feature flag off if a new feature correlates
   → Scale up if resource exhaustion
   → Fail over if single-AZ issue
   → Goal: stop customer impact ASAP, investigation comes after

3. COMMUNICATE (every 15 min for P0/P1)
   → Post updates even if there's nothing new: "Still investigating. No change."
   → Notify affected tenants if SLA impact is likely
   → Update status page

4. RESOLVE
   → Confirm metrics returning to normal (error rate, latency, throughput)
   → Post all-clear in incident channel with timeline summary
   → Open postmortem ticket for P0/P1
   → Update incident record (see SOC 2 incident-evidence skill)
```

## Full Reference

### IC responsibilities
IC does NOT debug — they coordinate. IC: tracks who is doing what, manages communication, makes calls when consensus is slow, owns the timeline record.

### Rollback first policy
If the incident started within 30 minutes of a deployment: rollback immediately without waiting for root cause confirmation. The cost of a false rollback is low; the cost of delayed mitigation is high.

### Forbidden
- Skipping declaration because "I think I know what it is and I'll fix it quickly"
- Silent fixes with no incident record (SOC 2 and HIPAA require documented evidence)
