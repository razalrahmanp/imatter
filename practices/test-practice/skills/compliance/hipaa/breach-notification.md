---
id: breach-notification
title: "HIPAA breach notification — 60-day timeline, HHS, affected individuals, media"
layer: compliance
compliance_module: hipaa
tags: [hipaa, breach, notification, 60-day, hhs, compliance]
applies_to:
  task_types: [add-handler, add-monitoring, add-worker]
  stages: [7, 10]
size_tokens: 210
related: [phi-handling, phi-access-logging, baa-pattern, incident-evidence]
---

# breach-notification — HIPAA Breach Notification Pattern

## Pattern Summary

A breach of unsecured PHI triggers mandatory notification to: affected individuals, HHS, and (if > 500 in a state) local media. Clock starts on the date you discover the breach, not when it occurred.

**Breach notification timeline:**
```
Discovery date (day 0):
  → Immediately: Begin investigation. Preserve evidence. Start breach record.
  → Within 24h:  Notify your Security Officer and legal counsel.

Day 0–60 (individual notification deadline):
  → Notify each affected individual in writing (first-class mail)
  → If contact info unavailable for 10+ individuals: post on website or major print/broadcast media
  → Content required: description of breach, PHI involved, steps you've taken,
    what individuals should do, contact info for questions

Day 0–60 (HHS notification):
  → < 500 affected: log in HHS breach portal annually by March 1 of following year
  → ≥ 500 affected: notify HHS immediately (within 60 days)

≥ 500 in a state → media notification:
  → Notify prominent media outlets in each affected state within 60 days
```

**Breach assessment — 4-factor rule:**
Not every security incident is a notifiable breach. Apply the 4-factor risk assessment:
```typescript
interface BreachRiskAssessment {
  phi_nature_and_extent: string;     // what PHI, how sensitive
  who_accessed_or_used:  string;     // unauthorized person's identity and purpose
  phi_actually_acquired: boolean;    // was it actually viewed/taken, or just at risk?
  mitigation_extent:     string;     // what was done to reduce risk

  // If low probability PHI was compromised → not a notifiable breach (document reasoning)
  // If uncertain → treat as notifiable breach (err on side of notification)
  verdict: "notifiable_breach" | "not_a_breach" | "investigation_ongoing";
  rationale: string;
}
```

**Breach record — open on discovery, close on resolution:**
```sql
CREATE TABLE hipaa_breach_log (
  breach_id        uuid PRIMARY KEY,
  discovered_at    timestamptz NOT NULL,
  notification_due timestamptz GENERATED ALWAYS AS (discovered_at + INTERVAL '60 days') STORED,
  individuals_affected integer,
  phi_categories   text[],
  risk_assessment  jsonb,
  individuals_notified_at timestamptz,
  hhs_notified_at  timestamptz,
  media_notified_at timestamptz,
  status           text NOT NULL DEFAULT 'investigating'
);
```

## Full Reference

### Safe harbor from notification
PHI that was encrypted with NIST-compliant encryption AND the key was not compromised = not "unsecured PHI" = no notification required. This is the primary reason to encrypt PHI at rest.

### Business Associate breaches
Your BA must notify you of a breach "without unreasonable delay and in no case later than 60 days." Their discovery starts YOUR clock — not the date they notify you.

### Forbidden
- Starting the 60-day clock from the date you received a BA's breach notice rather than their discovery date
- Assuming encrypted data never requires notification (if key is compromised, encryption is irrelevant)
- Delaying investigation pending full root-cause analysis (notification clock doesn't pause for investigation)
