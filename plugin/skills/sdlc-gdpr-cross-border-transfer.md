---
name: sdlc-gdpr-cross-border-transfer
description: Use when personal data leaves the EU/EEA (cloud regions outside EU, US vendors, offshore processing) — covers the legal mechanisms (adequacy, SCCs, BCRs) and the Schrems II transfer impact assessment.
---

## Rule

Personal data of EU/EEA subjects cannot be transferred to third countries unless one of the GDPR-recognized mechanisms applies. Default to using EU regions when possible; when transfers are necessary, document the legal basis and the safeguards.

## Mechanisms (in order of preference)

| Mechanism | When | Notes |
|---|---|---|
| **EU/EEA region only** | Best — no transfer happens | Pick `eu-west-1`, `eu-central-1`, `europe-west1` etc. for cloud |
| **Adequacy decision** | Country has EU-recognized adequate protection | UK, Switzerland, Japan, Korea, etc. — check current list |
| **SCCs (Standard Contractual Clauses)** | Most common for US / non-adequate countries | Requires Transfer Impact Assessment (TIA) post-Schrems II |
| **EU-US Data Privacy Framework** | US processor certified under DPF | Replaces Privacy Shield; verify certification |
| **BCRs (Binding Corporate Rules)** | Intra-group transfers within a multinational | Heavy approval process |
| **Derogations (Art. 49)** | Specific situations: explicit consent, contract necessity, vital interests | Last resort; narrow |

## Adequacy — countries currently recognized

(Verify against the European Commission's current list — it changes.)

- Andorra, Argentina, Canada (commercial orgs only), Faroe Islands
- Guernsey, Israel, Isle of Man, Japan, Jersey, New Zealand
- Republic of Korea, Switzerland, United Kingdom (subject to review), Uruguay

Transfers to adequate countries are treated like intra-EU transfers.

## SCCs — the workhorse

EU Standard Contractual Clauses 2021 (modules for different scenarios). Used for:

- US vendors (most common — even with DPF available, SCCs are belt-and-suspenders)
- Any country without adequacy

The SCCs are pre-defined; you don't draft them. They get incorporated by reference or attached to your DPA. Both controller (you) and processor sign.

### Module choice (SCC 2021)

| Module | Direction |
|---|---|
| 1 | Controller-to-Controller |
| 2 | Controller-to-Processor (most common — you to a vendor) |
| 3 | Processor-to-Processor |
| 4 | Processor-to-Controller (reverse — vendor sends data back to you as controller of further processing) |

Pick the right module. Most third-party DPAs include the SCCs with Module 2 by default.

## Transfer Impact Assessment (TIA) — Schrems II requirement

Schrems II (2020) ruled that SCCs alone aren't enough if the destination country has surveillance laws undermining the SCCs (FISA 702 in the US, for example). The TIA documents:

1. **The transfer**: data categories, frequency, format
2. **The legal landscape** in the destination country (relevant surveillance laws, redress mechanisms)
3. **The risk**: is government access realistic for this data?
4. **Supplementary measures**: encryption at rest, encryption in transit, pseudonymization, contractual safeguards beyond SCC

Don't transfer data with high government-interest (lawyer-client communications, dissident communications) to high-risk jurisdictions without supplementary measures.

## DPF (Data Privacy Framework)

The current EU-US transfer mechanism (since July 2023, post-Privacy Shield).

- US companies self-certify under DPF, listed at dataprivacyframework.gov
- If processor is certified, transfers from EU to that processor are deemed adequate
- Belt and suspenders: most companies also use SCCs

Verify a US vendor's DPF certification before relying on it.

## Pattern — transfer register

For every cross-border data flow, document:

```
Source: EU customers (signed up via .eu domain)
Destination: AWS us-east-1
Categories: account data, order history, support messages
Volume: ~50,000 EU users
Mechanism: SCCs (Module 2) + DPF self-certification
TIA completed: 2026-03-15
Supplementary measures:
  - Customer data encrypted at rest (AES-256, customer-managed keys)
  - TLS 1.3 in transit
  - Access logging
  - Backup encryption with separate keys
Review date: 2027-03-15
```

## Cloud region choice — pragmatic

| Cloud | EU regions |
|---|---|
| AWS | eu-west-1 (Ireland), eu-west-2 (London), eu-central-1 (Frankfurt), eu-south-1 (Milan), eu-north-1 (Stockholm) |
| GCP | europe-west1 (Belgium), europe-west2 (London), europe-west3 (Frankfurt), europe-west4 (Netherlands) |
| Azure | West Europe, North Europe, France Central, Germany West Central, UK South |

Pick one EU region as the primary for EU customer data. Disaster recovery to another EU region. Don't span to US for backups without justification.

## When transfer is impossible

If you genuinely cannot keep data in EU (e.g. workforce is in the US and needs admin access):

- Strict role-based access — who can see what, logged
- Minimum necessary data shared
- Pseudonymization where possible
- Document the legitimate interest balancing

## Anti-patterns

- ❌ Cloud account defaulting to us-east-1 even for EU customers (legacy AWS default)
- ❌ No TIA — assuming SCCs alone are enough post-Schrems II
- ❌ "We have SCCs" but the vendor doesn't actually use them (check signing)
- ❌ Backup region in the US when primary is EU (transfer happens at backup)
- ❌ Analytics events shipping to a US-hosted analytics tool without consent + SCCs
- ❌ Sub-processor in a non-adequate country without separate analysis
- ❌ DPF "certified" claim without verifying

## Cross-references

- [[sdlc-gdpr-dpa-pattern]] — SCCs are part of the DPA
- [[sdlc-data-retention]] — backups in different regions
- [[sdlc-secret-handling]] — encryption keys for supplementary measures

## Gate criteria

- A register of every cross-border data flow exists
- Each flow has a documented legal mechanism (region / adequacy / SCC / DPF / BCR)
- TIAs completed for SCC-based transfers
- Cloud regions chosen with EU residency for EU customer data unless documented exception
- Encryption + access controls + logging documented as supplementary measures
- Annual review of mechanisms (adequacy decisions can change; SCCs are versioned)
