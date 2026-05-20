---
name: sdlc-pci-dss-card-data-tokenization
description: Use when designing payment flows to reduce PCI DSS scope via tokenization — covers what tokenization is, what it isn't, and how to use payment-provider tokens to avoid handling raw PAN.
---

## Rule

PCI DSS scope (which systems must comply) is determined by what touches cardholder data (PAN, expiration, etc.). Tokenization replaces PAN with a non-sensitive token that can only be detokenized by the payment provider. Use tokens everywhere except the brief window where the card is collected and sent to the provider.

## What tokenization is

A payment provider (Stripe, Adyen, Braintree, Razorpay) issues a token in place of the actual card number:

```
Real PAN: 4242 4242 4242 4242
Stripe token: tok_1ABcDeFgHiJkLmNoPq
Stripe customer card ID: card_1xyzABC...
```

The token has no value to an attacker — it cannot be used to charge any other merchant or reconstruct the PAN. Only the provider can detokenize.

## Pattern — Stripe Elements / Adyen Drop-in

The card number never touches your server:

```
User browser → Stripe Elements (Stripe's iframe) → Stripe servers
                       │
                       ↓ returns token
                Your frontend
                       ↓
                Your backend (only has the token, never PAN)
                       ↓ "charge this token"
                Stripe servers
                       ↓ charge
                Card network
```

Your backend:
- Receives a token
- Sends `charges.create({ source: token, amount, currency })`
- Stores `card_id` (also a token) for repeat charges

The PAN was on the user's device → posted directly to Stripe via the iframe → never crossed your servers.

## What this gets you (PCI scope reduction)

If you handle PAN: full PCI DSS (~12 control families, ~300+ requirements) applies to every system touching cardholder data.

With tokenization (SAQ A — simplest level):
- You attest you don't store / process / transmit PAN
- You're responsible for site security (where the iframe is hosted), some auth/logging
- Scope is dramatically smaller

## What tokenization is NOT

- Not encryption (encrypted PAN is still PAN per PCI)
- Not hashing (hashes can be brute-forced with a finite number of valid PANs)
- Not "we'll just store the last 4 digits" (last-4 + expiration is PAN-adjacent data; truncation rules exist; see [[sdlc-pci-dss-pan-truncation]])

## Server-side tokenization (if you must)

Some integrations require server-side card handling — e.g. terminal-based POS, MOTO (mail-order/telephone-order). Provider SDKs offer server-side tokenization where:

```
Your code sends PAN to provider → provider issues token
```

The PAN passes through your servers briefly. PCI scope expands. Minimize the exposure:

- Use the provider's SDK; never write your own card-data handling
- Don't persist the PAN (provider-issued token is what you keep)
- Limit which systems see PAN (small, isolated, hardened)
- Encrypt the brief in-transit window
- Audit every access

## Card-on-file repeats

For subscription / repeat charges:

```ts
// First charge — token from frontend
await stripe.charges.create({
  source: tok_xxx,         // token from Stripe Elements
  customer: customerId,    // create customer to save card
  amount: 1000,
  currency: "usd",
});

// Subsequent — use saved card
await stripe.charges.create({
  customer: customerId,
  amount: 1000,
  currency: "usd",
});
```

The customer ID + card ID are tokens. The PAN was never on your side.

## Token storage — still secure

Tokens are not PAN, but they're sensitive. Treat them as:

- Bind to customer ID; don't expose tokens cross-customer
- HTTPS in transit always
- Audit access to token tables
- Rotate tokens if you suspect compromise (provider can re-issue)

## Cross-references

- [[sdlc-pci-dss-pan-truncation]] — when truncated PAN is and isn't allowed
- [[sdlc-pci-dss-pci-scope-reduction]] — broader scope-reduction patterns
- [[sdlc-razorpay-webhook]] — Razorpay (Indian gateway) implementation specifics
- [[sdlc-secret-handling]] — provider API keys

## Anti-patterns

- ❌ Storing PAN encrypted "just in case we need it later" (you don't; just keep the token)
- ❌ PAN passing through your server to "validate" it (provider validates; don't)
- ❌ Logging PAN even masked (don't log it at all)
- ❌ Using truncation when tokenization is available (truncation has rules; tokenization is simpler)
- ❌ Mixing PCI-in-scope code with non-scope code (broadens scope unnecessarily)
- ❌ Card data forms hosted on your domain without the provider's iframe (you're handling PAN)
- ❌ Storing CVV / CVC even briefly (prohibited by PCI DSS — provider may store it for the verification then must discard)

## Gate criteria

- Card collection uses a provider iframe (Stripe Elements, Adyen Drop-in, etc.) — PAN never crosses your servers
- Stored references are tokens, not PAN
- SAQ A (or applicable lower SAQ) attestation is the goal
- A network diagram shows where cardholder data flows and confirms it bypasses your systems
- Audit logging on token-table access
- The frontend hosting the iframe meets the relevant PCI requirements (TLS, no mixed content, etc.)
