---
id: pci-network-segmentation
title: "PCI DSS network segmentation — CDE isolation, firewall rules, AWS VPC pattern"
layer: compliance
compliance_module: pci-dss
tags: [pci-dss, network-segmentation, vpc, firewall, cde, aws, compliance]
applies_to:
  task_types: [add-integration, add-worker, deploy]
  stages: [2, 7, 10]
size_tokens: 210
related: [pci-scope-reduction, card-data-tokenization, pan-truncation]
---

# pci-network-segmentation — PCI DSS Network Segmentation Pattern

## Pattern Summary

Network segmentation isolates the CDE from out-of-scope systems. Without segmentation, every system on the network becomes in-scope. With strong segmentation, only the isolated CDE systems require full PCI compliance.

**AWS VPC segmentation pattern for PCI:**
```
VPC: 10.0.0.0/16
│
├── Public subnet (10.0.1.0/24)
│   • Load balancer only (ALB)
│   • No PAN data passes through ALB — tokenized before arrival
│   • Security group: inbound 443 from 0.0.0.0/0 only
│
├── Application subnet (10.0.2.0/24) — OUT OF CDE SCOPE
│   • Lambda functions (via VPC attachment)
│   • API handlers — receive tokens, not PANs
│   • Security group: inbound from ALB security group only
│
└── CDE subnet (10.0.3.0/24) — IN SCOPE
    • Only if you have a system that processes PANs (unlikely with Razorpay)
    • No inbound from application subnet unless explicitly required + documented
    • Security group: allow-list of specific source IPs/SGs only
    • No internet gateway route
```

**Firewall rule documentation (required for PCI):**
```typescript
interface FirewallRule {
  rule_id:         string;
  source:          string;     // CIDR or security group ID
  destination:     string;
  port:            number | "all";
  protocol:        "tcp" | "udp" | "icmp" | "all";
  action:          "allow" | "deny";
  business_justification: string;  // mandatory for rules into CDE
  reviewed_at:     string;
  reviewed_by:     string;
}
```

**Segmentation test (required at least annually and after changes):**
- Verify that out-of-scope systems cannot reach CDE systems directly
- Use `nmap` or AWS Security Hub to confirm no unexpected open paths
- Document test results and remediate any gaps before audit

## Full Reference

### What counts as segmentation
PCI DSS requires segmentation to be tested and demonstrated — not just configured. Document: the segmentation method (VPC, security groups, NACLs), what systems are in CDE, and test evidence that out-of-scope systems cannot reach CDE.

### Razorpay webhook IPs
Razorpay sends webhooks from a fixed IP range. Add only those IPs to your webhook handler's security group inbound rules — not 0.0.0.0/0.

### Monitoring CDE access
CloudTrail + VPC Flow Logs must be enabled for CDE subnets. Logs retained ≥ 12 months (PCI DSS 10.7). Alert on any unexpected inbound connection to CDE subnet.

### Forbidden
- CDE systems with a default route to the internet (no internet gateway in CDE subnet)
- Firewall rules with "allow all" as the source for any CDE inbound rule
- Undocumented firewall rules (every rule requires a business justification)
- Treating security groups alone as sufficient segmentation without NACLs as a second layer
