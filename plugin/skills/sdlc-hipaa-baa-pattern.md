---
name: sdlc-hipaa-baa-pattern
description: Use when onboarding a vendor that will touch PHI, or auditing existing vendor relationships — covers when a BAA is required, what it must contain, and the chain-of-BAAs problem.
---

## Rule

Anyone (vendor, contractor, downstream processor) who creates, receives, maintains, or transmits PHI on your behalf is a Business Associate (BA). You must have a signed Business Associate Agreement (BAA) with them before any PHI flows. Subcontractors of your BAs need their own BAAs with the BA — the chain must be unbroken.

## When you need a BAA

You need a BAA with:

| Category | Examples |
|---|---|
| Cloud hosts | AWS (HIPAA-eligible services), GCP (with BAA tier), Azure |
| Storage / backup | S3 with BAA, hosted backup services |
| Email | Paubox, MailHippo, Microsoft 365 (with BAA), Google Workspace (with BAA) |
| SaaS for PHI | EHR / EMR systems, e-prescribing, billing software |
| Analytics | Only those with BAAs (most public analytics tools do NOT have BAAs) |
| Customer support | Zendesk (with BAA), Intercom (with BAA on certain plans) |
| Communication | Twilio (HIPAA-eligible products), Vonage (with BAA) |
| Payment | If they touch PHI tied to billing (often controllers themselves; check) |
| Contractors / consultants | Anyone with access to your PHI systems |

You do NOT need a BAA when:

- The vendor doesn't see PHI (a logo design firm with no PHI access)
- Conduit exception applies (mere transmission — pure ISP role, rare in practice)
- Vendor is itself a covered entity processing the same data for treatment

## What the BAA must include (45 CFR §164.504(e))

| Required clause | What |
|---|---|
| Permitted uses and disclosures | What the BA can do with PHI |
| Compliance with Security Rule | BA agrees to safeguards |
| Subcontractor flow-down | BA's subcontractors must have BAAs |
| Breach reporting | BA reports breaches to you within a defined window |
| Provision of access | BA provides access to PHI when needed for individual rights |
| Amendment, accounting | BA supports amendment and accounting of disclosures |
| Internal practices on disclosure | Made available to HHS on request |
| Return / destruction at termination | Or extension of protections if return not feasible |

Most large vendors have pre-signed BAAs. Read them — they sometimes scope which products are covered.

## The chain — flow-down

```
You (Covered Entity)
   │ BAA
   ├─→ Vendor A (BA)
   │      │ BAA
   │      ├─→ Vendor A's subcontractor 1 (sub-BA)
   │      └─→ Vendor A's subcontractor 2 (sub-BA)
   └─→ Vendor B (BA)
          │ BAA
          └─→ Vendor B's subcontractor (sub-BA)
```

If Vendor A uses AWS for hosting, AWS must have a BAA with Vendor A. If Vendor A also uses an offshore call center that handles PHI, the call center needs a BAA with Vendor A. The chain must be unbroken.

You don't sign BAAs with sub-BAs directly. But you can require Vendor A to disclose its sub-BAs and represent that they all have BAAs.

## Pattern — vendor register

```
Vendor: Datadog
BAA signed: 2026-02-01 (v4)
BAA scope: Datadog Logs, Datadog APM, Datadog RUM (not all products covered)
Services we use: Logs, APM
PHI categories sent: User IDs, error messages (no clinical data)
Sub-processors disclosed: AWS, GCP (both have BAAs with Datadog)
Last security review: 2026-03-15
Next review: 2027-03-15
Renewal date: 2027-02-01
```

Maintain this register; review annually.

## AWS / GCP / Azure BAA specifics

These BAAs cover specific services only. Verify your service is on the list:

- AWS: HIPAA-eligible services list (e.g. EC2, S3, RDS yes; some newer services no)
- GCP: Cloud Storage, Compute Engine yes; some products not covered
- Azure: Most services with BAA; specific exclusions in the BAA

If you're using a non-eligible service for PHI: you're in violation, regardless of the BAA.

## Vendor due diligence

Beyond the BAA, verify:

- SOC 2 Type II or HIPAA-specific attestation
- Pen test reports (within last 12 months)
- Incident response plan
- Encryption at rest and in transit (verify, don't trust the marketing page)
- Data residency claims (where they actually store PHI)
- Subcontractor list and disclosure cadence

Document what you reviewed and when.

## Anti-patterns

- ❌ Pushing PHI to a service without a BAA, even briefly ("just for testing")
- ❌ BAA signed but not actually using HIPAA-eligible products of that vendor
- ❌ Trust the marketing "HIPAA compliant" claim without seeing the BAA
- ❌ One BAA covering products that change over time (re-confirm what's in scope)
- ❌ Vendor uses subcontractors but won't disclose them
- ❌ No vendor register — can't answer "which vendors touch PHI?"
- ❌ BAA term expires; nobody renews
- ❌ Conduit exception abused — claiming pass-through when the vendor inspects payload

## Cross-references

- [[sdlc-hipaa-phi-handling]] — overall PHI safeguards
- [[sdlc-gdpr-dpa-pattern]] — analogous GDPR mechanism
- [[sdlc-hipaa-breach-notification]] — BAs must notify you of breaches

## Gate criteria

- A vendor register exists listing every vendor that touches PHI
- BAA signed and on file for each
- BAA scope verified against actually-used services
- Sub-processor disclosure obtained and reviewed
- Annual review of each vendor's BAA and security posture
- Onboarding process for new vendors includes BAA before PHI access
- Contract termination process includes data return / destruction
