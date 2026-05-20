---
id: incident-evidence
title: "SOC 2 incident evidence — CC7.3/CC7.4 logging, timeline, resolution record"
layer: compliance
compliance_module: soc2
tags: [soc2, incident, cc7, evidence, timeline, postmortem, compliance]
applies_to:
  task_types: [add-worker, add-handler, add-monitoring]
  stages: [7, 10]
size_tokens: 200
related: [change-management-evidence, access-review-pattern, structured-logging]
---

# incident-evidence — SOC 2 Incident Evidence (CC7.3/CC7.4)

## Pattern Summary

SOC 2 CC7.3 (incident response) and CC7.4 (incident resolution) require structured incident records from detection through resolution. Evidence must exist for every incident that affects data availability, integrity, or confidentiality.

**Incident record schema:**
```typescript
interface IncidentRecord {
  incident_id:      string;
  title:            string;
  severity:         "P0" | "P1" | "P2" | "P3";
  status:           "open" | "mitigated" | "resolved" | "post-mortem-complete";
  detected_at:      string;    // ISO 8601 — when first alerted/discovered
  declared_at:      string;    // when incident was formally declared
  mitigated_at?:    string;    // when impact was stopped
  resolved_at?:     string;    // when root cause fixed
  affected_systems: string[];
  affected_tenants: string[];  // branch IDs — or ["all"] for platform-wide
  customer_impact:  boolean;
  data_affected:    boolean;   // if true, GDPR/HIPAA/PCI notification assessment required
  root_cause?:      string;
  remediation?:     string;
  postmortem_url?:  string;    // link to blameless postmortem doc
  timeline: { at: string; event: string; actor: string }[];
}
```

**Timeline entry rules:**
- Every significant action during the incident is a timeline entry
- Actor is user ID or "system" — never a proper name (names change)
- Entries are append-only — never edit historical entries

**Severity SLA (define upfront, reference in incident):**
```
P0: customer-facing outage or data breach — mitigate within 1 hour
P1: significant degradation — mitigate within 4 hours
P2: partial degradation — mitigate within 24 hours
P3: minor issue / no customer impact — resolve within 72 hours
```

## Full Reference

### What triggers a formal incident record
- Any P0 or P1 alert
- Any confirmed or suspected data breach
- Any compliance-relevant failure (auth bypass, encryption failure, backup failure)
- Any customer-reported outage lasting > 15 minutes

### Post-mortem requirement
P0 and P1 incidents require a blameless post-mortem within 5 business days of resolution. Link the post-mortem URL in `postmortem_url`. SOC 2 auditors look for evidence that incidents drive systemic improvements.

### Forbidden
- Resolving incidents without completing the timeline through resolution
- Skipping post-mortems for P0/P1 incidents
- Editing or deleting historical timeline entries
- Omitting `data_affected` assessment — missing this delays GDPR/HIPAA breach notification clock
