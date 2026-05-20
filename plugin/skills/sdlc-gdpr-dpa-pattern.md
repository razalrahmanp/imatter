---
name: sdlc-gdpr-dpa-pattern
description: Use when signing or maintaining a Data Processing Agreement with a third-party processor (vendors, SaaS tools, sub-processors) — covers the required clauses, the sub-processor mechanism, and what to audit.
---

## What a DPA is

A Data Processing Agreement (DPA) is a contract between Controller (your org, who decides why and how data is processed) and Processor (the vendor processing data on your behalf). GDPR Article 28 requires one for every processor relationship.

## When you need one

You need a DPA with:

- Cloud hosts (AWS, GCP, Azure)
- Email services (SendGrid, Mailgun, Postmark)
- Analytics (if they process PII — Google Analytics, Mixpanel)
- CRM / marketing tools (HubSpot, Salesforce)
- Customer support (Intercom, Zendesk)
- Payment processors (in some cases — usually they're controllers too)
- Any SaaS where you upload customer data

You do NOT need a DPA if:

- They're a Controller themselves (Google sells you ads — you don't control their use)
- No personal data flows (an internal analytics tool processing only aggregates)

## Required clauses (Art. 28)

A compliant DPA must include:

| Clause | What |
|---|---|
| **Subject matter and duration** | What the processor does, for how long |
| **Nature and purpose** | What kind of processing, why |
| **Type of data + categories of subjects** | What personal data, whose |
| **Obligations and rights of controller** | Your responsibilities |
| **Processing only on instructions** | Processor acts only on your documented instructions |
| **Confidentiality** | Their personnel are bound to confidentiality |
| **Security measures** | Article 32 security required (encryption, access control, etc.) |
| **Sub-processors** | Conditions for engaging sub-processors; notice + objection rights |
| **Assistance with subject rights** | Help you fulfill DSARs |
| **Breach notification** | Notify you "without undue delay" |
| **DPIA assistance** | Help with data protection impact assessments |
| **Deletion / return at end** | Return or delete data when contract ends |
| **Audit rights** | Allow you to audit (usually via reports / questionnaires) |
| **Compliance demonstration** | Show how they comply |

Most large processors have pre-signed DPAs available. Read them; don't just accept by reference.

## Sub-processors — the harder part

Most processors use their own sub-processors (their cloud host, payment gateway, email gateway). GDPR requires:

- Processor lists current sub-processors (usually a public page)
- Processor notifies you of new sub-processors with reasonable notice (commonly 30 days)
- You can object; if not resolved, you can terminate

Keep a register:

```
Processor: SendGrid
DPA signed: 2026-01-15 (v3)
Sub-processors:
  - Amazon Web Services (US, EU regions; storage + compute)
  - Twilio (US; email infra)
  - Sumo Logic (US; logging)
Last reviewed: 2026-04-30
Next review: 2027-04-30
```

Review annually (or more often). New sub-processor announcements arrive via email — route them to a queue, don't drop them.

## Cross-border transfers — Schrems II implications

If the processor stores or processes data outside the EU/EEA, you need additional safeguards:

| Transfer mechanism | When |
|---|---|
| **Adequacy decision** | Country deemed adequate by Commission (UK, Japan, etc.) |
| **Standard Contractual Clauses (SCCs)** | Default for non-adequate countries |
| **Binding Corporate Rules (BCRs)** | Intra-group transfers |
| **EU-US Data Privacy Framework** | US processors certified under DPF |

Post-Schrems II (2020): SCCs require a Transfer Impact Assessment (TIA) documenting that the destination country's laws don't undermine the SCCs.

## Audit rights — pragmatic version

You probably won't actually audit AWS. The DPA's audit clause is usually fulfilled by:

- Processor's SOC 2 / ISO 27001 reports (request and review)
- Processor's security questionnaire
- Public security pages (AWS Trust Center, GCP Trust Center)

Document what you've reviewed and when.

## Pattern — internal DPA register

```
Processor name:
DPA URL or filename:
DPA version + date signed:
Categories of data shared:
Purpose:
Sub-processor list URL:
Cross-border transfer mechanism:
Last security review:
Next review due:
Contact for privacy queries:
```

One row per processor. Review at least annually. Owned by the DPO or equivalent.

## Anti-patterns

- ❌ Just clicking "accept" on a vendor's DPA without reading
- ❌ No register of processors → can't answer "who has our data?"
- ❌ Ignoring sub-processor announcements (they show up in email; nobody reads)
- ❌ Storing data in non-EU regions without an SCC or adequacy basis
- ❌ Vendor "we're compliant" without showing the controls (ask for SOC 2 / ISO 27001 / DPA)
- ❌ Treating a Processor agreement as a Controller agreement — different obligations
- ❌ Letting the DPA lapse / not refreshing when vendor terms change

## Cross-references

- [[sdlc-gdpr-cross-border-transfer]] — SCC / adequacy specifics
- [[sdlc-data-retention]] — what the processor retains
- [[sdlc-secret-handling]] — never share more credentials than needed

## Gate criteria

- A processor register is maintained and reviewed annually
- Every processor has a signed DPA on file
- Sub-processor lists are checked at least annually; new sub-processors trigger review
- Cross-border transfers have a documented legal mechanism
- Security reports (SOC 2, ISO) on file for each major processor
- A process exists for objecting to / replacing problematic sub-processors
- Onboarding new processors goes through privacy review before integration
