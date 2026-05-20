---
name: sdlc-hipaa-breach-notification
description: Use when an actual or suspected PHI breach has occurred, or when designing breach response procedures — covers the 60-day timeline, the four-factor risk assessment, and who must be notified.
---

## What counts as a breach

A breach is the acquisition, access, use, or disclosure of PHI in a manner not permitted under the HIPAA Privacy Rule, which compromises the security or privacy of the PHI.

This includes:

- A laptop with unencrypted PHI lost or stolen
- An email with PHI sent to the wrong recipient
- An employee viewing records of patients they have no relationship with
- A ransomware attack on a system holding PHI (presumed breach unless low-probability shown)
- A misconfigured S3 bucket exposed to the internet
- A subcontractor leaking PHI without notice

Encrypted data lost is NOT a breach if encryption meets the NIST standards (Guidance on rendering PHI unusable, unreadable, or indecipherable to unauthorized individuals). This is why encryption + key separation matters.

## Rule

When a breach is suspected, run the four-factor risk assessment within hours. If a breach is confirmed: notify affected individuals within 60 days. Notify HHS by the same deadline. If ≥500 individuals affected, notify HHS immediately and notify media in the state.

## The four-factor risk assessment

Determine whether there's a "low probability that PHI has been compromised." If yes, no notification required — but document the assessment.

| Factor | Question |
|---|---|
| **1. Nature and extent of PHI involved** | What identifiers? How clinical? More sensitive = harder to argue low probability |
| **2. The unauthorized person who used or received it** | Other workforce member with similar access? Or external party? |
| **3. Whether PHI was actually acquired or viewed** | Just access logs showing read? Or only theoretically accessible? |
| **4. Extent to which the risk has been mitigated** | Did they delete it? Sign confidentiality? Return device? |

Document the assessment. If you conclude low probability → no notification. But the documentation must be defensible if HHS audits.

## Timeline

| Event | Within |
|---|---|
| Discovery of breach | Treat as Day 0 |
| Investigation begins | Same day |
| Four-factor assessment | Days 1–5 typically |
| Decision to notify | Within reasonable time |
| Notify affected individuals | **60 days** from discovery |
| Notify HHS (< 500 affected) | Annual log (next year by 60 days after end of calendar year) |
| Notify HHS (≥ 500 affected) | **60 days** from discovery + same |
| Notify media (state of ≥ 500 affected) | **60 days** |
| Business Associate notifies you | "Without unreasonable delay" + per BAA terms (often within 60 days) |

"Discovery" is when the breach is *known* or *should have been known* — not when fully investigated. The clock starts at suspicion.

## Notification content

| Required in individual notification |
|---|
| Brief description of what happened |
| Description of the types of PHI involved (general categories, not specific records) |
| Steps individuals should take to protect themselves |
| What the covered entity is doing to investigate, mitigate, and prevent recurrence |
| Contact procedures: toll-free number, email, postal, website with > 10 individuals affected |

Delivery: first-class mail to last known address; email if individual agreed to electronic communication; substitute notice (website prominent posting + state media) if you cannot reach 10+ individuals.

## Pattern — breach response runbook

```markdown
## Breach response

### Detection
- Source: alert / report / self-discovery
- Severity: assess via four-factor

### Containment (immediate)
- Revoke credentials of involved actors
- Take affected system offline if needed
- Preserve evidence (do NOT delete logs)

### Assessment (Days 1–5)
- Run four-factor analysis
- Document conclusion
- Decide: notification required Y/N

### If notification required
- Day 5–55: prepare notifications
- Day 55–60: send to affected individuals
- Day 60: HHS notification submitted
- Day 60: media (if ≥ 500)

### Post-incident
- Post-mortem ([[sdlc-postmortem-blameless]])
- Update policies to prevent recurrence
- HHS follow-up if requested
```

## OCR Wall of Shame

Breaches affecting 500+ individuals are public on the HHS Office for Civil Rights (OCR) "Wall of Shame" indefinitely. Reputational risk is real.

## Anti-patterns

- ❌ Waiting to confirm 100% before starting the 60-day clock (clock starts at discovery)
- ❌ Not documenting the four-factor assessment (can't justify "no notification" later)
- ❌ Generic mass-email notification ("we had a security incident") — must describe the PHI types
- ❌ Substitute notice without trying first-class mail
- ❌ Notifying internally only; missing HHS or media
- ❌ Treating ransomware as "not a breach" without showing low probability of PHI compromise
- ❌ Breach response runbook in a wiki that's stale and untested
- ❌ No tabletop exercise (first time team runs the process is during a real breach)

## Cross-references

- [[sdlc-hipaa-phi-handling]] — encryption (which can negate "breach" status)
- [[sdlc-hipaa-phi-access-logging]] — logs to investigate scope
- [[sdlc-hipaa-baa-pattern]] — BA must report to you
- [[sdlc-incident-response]] — general incident-response wraps this

## Gate criteria

- A breach response runbook exists, tested via tabletop annually
- Detection capability is in place: log monitoring, anomaly detection, BA notification path
- Four-factor risk assessment template documented and used
- Notification templates exist for individual + HHS + media
- Designated owner (CISO, privacy officer) accountable for breach decisions
- Cyber insurance coverage in place (breach notification costs are large)
- Encryption at rest + in transit + key separation in place so most "breaches" are actually exempt
