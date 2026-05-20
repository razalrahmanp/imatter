---
id: baa-pattern
title: "HIPAA BAA pattern — Business Associate Agreement requirements, vendor checklist"
layer: compliance
compliance_module: hipaa
tags: [hipaa, baa, business-associate, vendor, compliance]
applies_to:
  task_types: [add-integration, add-vendor]
  stages: [2, 6, 10]
size_tokens: 195
related: [phi-handling, phi-access-logging, breach-notification]
---

# baa-pattern — HIPAA Business Associate Agreement Pattern

## Pattern Summary

Any vendor or subcontractor that creates, receives, maintains, or transmits PHI on your behalf is a Business Associate and must sign a BAA before PHI flows to them. No BAA = no PHI.

**Business Associate definition — you need a BAA if the vendor:**
```
• Stores PHI (cloud storage, backup services)
• Processes PHI (analytics, AI/ML services, billing)
• Transmits PHI (messaging, email, fax services)
• Provides services that give them incidental PHI access (IT support, managed services)

NOT a business associate (no BAA needed):
• Postal services (incidental to mail)
• Internet service providers (conduit exception)
• Researchers who receive de-identified data only
```

**BAA mandatory elements (45 CFR §164.504(e)):**
```
□ Permitted uses and disclosures of PHI
□ BA will not use/disclose PHI except as permitted by agreement or required by law
□ BA will use appropriate safeguards (administrative, physical, technical)
□ BA will report breaches / security incidents to you
□ BA will ensure any sub-BAs have equivalent protections
□ At termination: return or destroy PHI, or certify destruction
□ Make records available to HHS for compliance audits
□ Implement HIPAA Security Rule (if electronic PHI)
```

**BAA registry:**
```typescript
interface BaaRecord {
  vendor_name:      string;
  vendor_contact:   string;
  signed_at:        string;
  expires_at:       string | null;
  phi_categories:   string[];   // what PHI types they handle
  hipaa_compliant_certified: boolean;
  baa_document_url: string;     // S3 link — not public
  sub_bas:          string[];   // vendors your BA is allowed to use
}
```

## Full Reference

### Common vendors requiring BAAs
AWS (AWS BAA available via console — must activate per-service), Google Cloud, Azure, Salesforce Health Cloud, Twilio (for health-related messaging), SendGrid (if transmitting PHI in emails).

### AWS BAA note
AWS provides a BAA but it covers only specific services. Confirm each service you use is covered: https://aws.amazon.com/compliance/hipaa-eligible-services-reference/

### Termination and data destruction
When a vendor relationship ends: request and retain their PHI destruction certificate. Must confirm destruction within 60 days of termination.

### Forbidden
- Transmitting PHI to a cloud provider without an active BAA
- Assuming a vendor is HIPAA-compliant because they advertise it — require a signed BAA
- Using covered services outside the BAA's scope (e.g. using non-HIPAA-eligible AWS services for PHI)
