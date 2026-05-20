---
name: sdlc-pci-dss-pci-scope-reduction
description: Use when designing or auditing PCI scope — covers the segmentation, tokenization, and outsourcing patterns that minimize how much of your system needs to be PCI-compliant.
---

## Rule

PCI DSS scope = every system that stores, processes, or transmits cardholder data. The smaller the scope, the cheaper the compliance burden. Aggressive scope reduction is the #1 cost-control measure. Combine tokenization, network segmentation, and outsourced collection.

## SAQ levels — pick the lowest you can attain

| SAQ | When | Effort |
|---|---|---|
| **SAQ A** | Card data outsourced fully (iframe, hosted page); no electronic PAN storage | Lowest |
| **SAQ A-EP** | E-commerce, partial outsourcing (e.g. JavaScript on your page interacting with provider) | Low-medium |
| **SAQ B / B-IP** | Dial-out terminals or terminal POS only | Medium |
| **SAQ C / C-VT** | Payment app or virtual terminal | Medium |
| **SAQ D** | Anything else; high handling | Highest |

Goal: **SAQ A**. Anything else compounds compliance cost.

## Three pillars of scope reduction

### 1. Tokenization

PAN never enters your servers. See [[sdlc-pci-dss-card-data-tokenization]].

### 2. Network segmentation

Isolate any system that does touch card data in a separate network zone with strict ingress/egress controls:

```
+-------------------+        +---------------------+        +-----------------+
| Public web tier   | -----> | Application tier    | -----> | Database tier   |
| (no card data)    |        | (no card data)      |        | (no card data)  |
+-------------------+        +---------------------+        +-----------------+
                                       |
                                       | (separate path)
                                       v
                             +-------------------+
                             | Payment iframe    |  (hosted by provider)
                             | (out of scope)    |
                             +-------------------+
```

If your app servers don't process card data, they're out of scope even though they're adjacent. Network controls (firewalls, VPC, service mesh policies) prove they can't reach in-scope segments unauthorized.

### 3. Outsourced collection

Use a hosted payment page or iframe (Stripe Elements, Braintree Drop-in, Adyen Hosted Payment Page):

- Card data goes browser → provider (skipping your server entirely)
- Your code receives only a token
- Most of PCI moves to the provider

## What expands scope (avoid)

| Decision | Scope impact |
|---|---|
| Inline card form on your own page (not an iframe) | Your frontend hosts → scope |
| API endpoint accepting PAN from your apps | App server → scope |
| Logging full PAN anywhere | Logger / log storage → scope |
| Backups containing PAN | Backup system → scope |
| CRM showing full PAN | CRM and any sync → scope |
| Customer service tool requiring card lookup by PAN | Tool + auth + access → scope |
| File uploads with PAN in receipts / documents | Storage → scope |

Each of these multiplies your audit cost.

## Service Provider list

If you're a SaaS that handles payments, your customers may ask for your SAQ / AOC (Attestation of Compliance):

- Issue an AOC annually
- List on your Trust Center
- Include in vendor questionnaires

## Quarterly scoping exercise

Run quarterly:

1. List every system in production
2. For each: "does it store, process, or transmit cardholder data?"
3. For "yes" systems: verify they're in your in-scope list and PCI-controlled
4. For "no" systems: verify network controls prevent them from receiving PAN
5. Document the exercise; sign off

## Pattern — scope diagram

A single page showing:

- Every system that handles cardholder data (highlighted)
- Network boundaries between scope and non-scope
- Data flow arrows
- Connections to providers / processors

This is your scope documentation. Auditors love a clean diagram.

## Common findings — known scope leaks

- Customer support representative searching by PAN (puts CRM in scope)
- Old API endpoint accepting PAN for "legacy" integrations (still active, still in-scope)
- Database backups including a deprecated `card_number` column
- Debug logs from years ago that contain PAN (storage in scope)
- Email receipt with full PAN (email vendor in scope)
- Test environment using real PAN

Each is a quick win once identified.

## Anti-patterns

- ❌ "We're SAQ D because we figured it was safer" (over-scoped, over-audited)
- ❌ Inline card form on your own page (when an iframe would work)
- ❌ Customer service tooling that requires full PAN search
- ❌ Card data in test / staging environments
- ❌ No network segmentation; the entire VPC is "in scope"
- ❌ Service Provider AOC not maintained
- ❌ No quarterly scoping review

## Cross-references

- [[sdlc-pci-dss-card-data-tokenization]] — the primary scope-reduction tool
- [[sdlc-pci-dss-pan-truncation]] — display rules
- [[sdlc-pci-dss-pci-network-segmentation]] — the segmentation specifics
- [[sdlc-secret-handling]] — payment provider API keys

## Gate criteria

- Target SAQ level documented; design supports it
- Tokenization in use; iframe / hosted page for card collection
- Network segmentation: PCI scope isolated; documented
- Quarterly scope review on calendar; signed off
- Service Provider AOC (if applicable) issued and current
- Test / staging environments use test card numbers only — never real PAN
- A scope diagram exists; reviewed each quarter
- CI scanner forbids PAN-shaped patterns in code, logs, and DB columns
