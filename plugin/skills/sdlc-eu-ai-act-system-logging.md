---
name: sdlc-eu-ai-act-system-logging
description: Use when implementing logging for an AI system that is or may be high-risk under the EU AI Act — covers the record-keeping obligation, what to log, and the retention required for traceability.
---

## Rule

High-risk AI systems must automatically record events ("logs") sufficient to ensure traceability over the lifetime of the system. The provider/deployer must keep these logs and make them available to authorities on request. Article 12 of the EU AI Act.

## What to log

Logs must enable, at minimum:

- Identification of situations resulting in risk or material modification
- Post-market monitoring (was the system performing as expected?)
- Monitoring of operation by the deployer
- Particularly for "remote biometric ID" systems: period of use + reference database + identified persons + reviewing personnel

## Practical event log

For most high-risk AI systems, log per inference / decision:

```json
{
  "log_id": "log_01H...",
  "system_id": "credit-scorer-v2",
  "system_version": "2.3.1",
  "ts": "2026-05-20T10:30:00Z",
  "deployer_id": "acme-bank",
  "input_hash": "sha256:abc...",      // hash, not raw input (PII / minimization)
  "input_size_bytes": 1234,
  "model_version": "claude-sonnet-3.5-20241022",
  "output_summary": {
    "decision": "approve",
    "confidence": 0.87,
    "top_features": ["income_band", "tenure_years", "debt_ratio"]
  },
  "human_override": false,
  "human_reviewer_id": null,
  "processing_duration_ms": 423,
  "user_consent_id": "consent_xyz"
}
```

Log:
- Time of operation
- Input characterization (hash, size, type — not raw input)
- Model + version used
- Output / decision
- Whether human review was triggered
- Whether the result was overridden by a human
- Confidence and key drivers (for explainability)

Don't log:
- Raw PII inputs (use hashes / pseudonyms)
- Identifying information beyond what's necessary

## Retention

EU AI Act: at least 6 months from the date the system is no longer in service.

Practical: keep all decisions for at least the longer of:
- 6 months past system retirement
- 5 years (audit / dispute window)
- The retention required by other applicable rules (GDPR, sectoral)

## Anomaly events — also logged

```json
{
  "log_id": "log_01H...",
  "event_type": "anomaly",
  "system_id": "credit-scorer-v2",
  "ts": "2026-05-20T10:30:00Z",
  "anomaly_type": "out_of_distribution_input",
  "details": "Input vector L2-distance to training distribution: 4.7σ",
  "action_taken": "rejected_routed_to_human"
}
```

Anomalies, errors, system modifications, and material risk events are all logged events.

## Linking to monitoring

Logs feed two things:

1. **Post-market monitoring** (Art. 72): ongoing performance monitoring; deviation triggers investigation
2. **Incident reporting** (Art. 73): serious incidents and malfunctions reported to authorities within 15 days

The logs are the evidence behind both.

## Audit-ready

Logs must be:

- Tamper-resistant (append-only — see [[sdlc-audit-logging]])
- Time-synced reliably (NTP; not user-supplied timestamps)
- Available to authorities on request — usually within 15 days
- Queryable by case / decision (lookup by `log_id` or input hash)

## Anti-patterns

- ❌ Logging raw inputs including PII (violates data minimization)
- ❌ Application logs treated as the AI Act log (different retention, different access)
- ❌ Logs in a mutable store (no tamper resistance)
- ❌ Sampling logs (every decision should be logged for high-risk; sampling is for low-risk)
- ❌ No anomaly detection / logging
- ❌ Logs retained per generic policy (30 days) — AI Act needs 6+ months
- ❌ No retrieval-by-decision capability
- ❌ Time stamps from user clock or unsynced

## Cross-references

- [[sdlc-audit-logging]] — generic audit log pattern (tamper-resistance, retention)
- [[sdlc-eu-ai-act-human-oversight]] — human-override logging
- [[sdlc-eu-ai-act-risk-classification]] — when these obligations apply

## Gate criteria

- Every inference / decision of a high-risk system writes a log entry
- Logs contain time, system version, input hash, output, human-review flag, override flag
- Logs are append-only and tamper-resistant
- Retention configured ≥ 6 months past system retirement (typically 5+ years)
- Anomaly events are detected and logged
- A query exists to retrieve all logs for a given case / decision
- Time sync via NTP verified
- A documented process exists for authority requests (response within 15 days)
