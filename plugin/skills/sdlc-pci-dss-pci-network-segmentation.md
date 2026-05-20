---
name: sdlc-pci-dss-pci-network-segmentation
description: Use when implementing network controls to isolate the PCI scope — covers VPC segmentation, firewall rules, the segmentation testing requirement, and the cloud-native patterns.
---

## Rule

Network segmentation isolates the in-scope PCI environment (Cardholder Data Environment, CDE) from the rest of the network. Without segmentation, the entire network is in scope. Segmentation must be effective — proven, not assumed — and tested annually.

## Segmentation goal

```
CDE (in scope)              Non-CDE (out of scope)
+-----------+               +----------------+
| Payment   |               | Marketing site  |
| service   |               | Customer app    |
| Card data |               | Analytics       |
| tokens    | <- blocked -> | Internal tools  |
+-----------+               +----------------+
       Firewall + ingress/egress controls
```

If the marketing site or customer app cannot reach the CDE at the network level, and the CDE cannot reach them, neither is in PCI scope (assuming they don't store / process / transmit cardholder data themselves).

## Cloud patterns

### AWS

Use separate VPCs (or carefully-controlled subnets):

```
Production VPC (out of scope)
├── App subnet
└── DB subnet

CDE VPC (in scope, minimal footprint)
├── Payment-API subnet
└── Token-DB subnet (just tokens, not PAN)

VPC peering (controlled):
  Production → CDE: ALLOW specific ports (token API only)
  CDE → Production: DENY by default
```

Tools:
- Security groups (stateful)
- NACLs (stateless, on subnet boundaries)
- VPC flow logs (record traffic)
- AWS Network Firewall for inter-VPC inspection
- Transit Gateway for hub-and-spoke

### GCP / Azure

Equivalent constructs: Shared VPC + projects (GCP), VNet + NSGs (Azure). Same principles.

### Kubernetes

Network policies isolate namespaces:

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: cde-isolation
  namespace: cde
spec:
  podSelector: {}
  policyTypes: [Ingress, Egress]
  ingress:
    - from:
        - namespaceSelector:
            matchLabels:
              name: payment-frontend
  egress:
    - to:
        - namespaceSelector:
            matchLabels:
              name: provider-egress
```

CDE namespace can only be accessed from explicitly-allowed namespaces. Egress only to payment provider's IP range.

## Segmentation testing — annual

PCI DSS 4.0 requires segmentation testing at least every 12 months (every 6 months for service providers). The test attempts to verify:

- Out-of-scope systems cannot reach the CDE at the network level
- The CDE cannot reach out-of-scope systems (egress controls)
- The segmentation is robust against common attack paths

Methods:
- Internal penetration test attempting to pivot from non-CDE to CDE
- Network configuration review (firewall rules, ACLs)
- Tooling: Nessus, Nmap, OpenVAS, paid pen-test

Document the test, the findings, the fixes.

## What undermines segmentation (and re-expands scope)

| Mistake | Result |
|---|---|
| "Allow all" rule between VPC peers | Effectively no segmentation |
| Jump host / bastion in CDE accessible from anywhere | Lateral movement risk |
| Shared monitoring (Datadog agent in CDE reporting to non-CDE SaaS) | Defines a connection — auditor scrutinizes |
| Shared CI runner that can SSH into CDE | CI in scope |
| Developer laptops with VPN to CDE | Laptops in scope |
| Logging service in CDE writes to non-CDE log aggregator | Aggregator in scope |

For each, mitigate by either:
- Removing the connection
- Documenting and controlling it tightly (defined ports, monitored, no PAN flowing)

## Egress controls — the often-forgotten direction

Don't just block ingress to CDE. Block egress too:

```
CDE → Internet: ALLOW only payment provider IPs (Stripe, Adyen)
CDE → Internet: ALLOW only outbound for known package mirrors during build
CDE → Other: DENY by default
```

Egress controls prevent exfiltration if the CDE is compromised. Also: lateral movement to other systems.

## Monitoring — flow logs + intrusion detection

- VPC flow logs (AWS) / VPC Flow Logs (GCP) / NSG Flow Logs (Azure): record all traffic
- IDS (Intrusion Detection System) in the CDE: Suricata, GuardDuty
- Anomaly detection on flow patterns

## DMZ pattern — for ingress

If the CDE has any internet-facing component (e.g. webhook receiver):

```
Internet → DMZ (load balancer, WAF) → CDE (specific service only)
```

DMZ host:
- Doesn't store cardholder data (still in scope due to transmission)
- WAF in front
- Only the specific service exposed
- All ingress logged

## Anti-patterns

- ❌ One big VPC for everything ("we'll segment later")
- ❌ Security groups with `0.0.0.0/0` rules to / from CDE
- ❌ Bastion / jump host with broad SSH access
- ❌ No flow logs (can't prove segmentation works)
- ❌ Test environment with the same network topology as production but real PAN
- ❌ Skipping annual segmentation test
- ❌ Auditor identifies segmentation as "good" without ever attempting to bypass
- ❌ CI/CD pipeline runners in non-CDE network with credentials that reach CDE

## Cross-references

- [[sdlc-pci-dss-pci-scope-reduction]] — overall scope strategy
- [[sdlc-pci-dss-card-data-tokenization]] — primary scope-reduction tool
- [[sdlc-secret-handling]] — payment provider keys
- [[sdlc-soc2-access-review-pattern]] — who can access CDE

## Gate criteria

- Network topology has separate VPCs / subnets / namespaces for CDE
- Firewall / security-group rules implement default-deny; explicit allow only for documented paths
- Egress from CDE is restricted to specific provider IPs and known dependencies
- Flow logs enabled, retained, and reviewed
- Annual segmentation test performed; findings remediated
- A network diagram shows the CDE, its boundary controls, and the data flow
- Service-to-service authentication (mTLS or equivalent) used inside CDE
- Bastion / jump hosts (if any) are tightly controlled with MFA and full audit
