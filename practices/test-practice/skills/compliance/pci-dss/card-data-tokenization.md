---
id: card-data-tokenization
title: "PCI DSS tokenization — no raw PANs, Razorpay token flow, scope reduction"
layer: compliance
compliance_module: pci-dss
tags: [pci-dss, tokenization, pan, razorpay, card-data, compliance]
applies_to:
  task_types: [add-handler, add-endpoint, add-integration]
  stages: [3, 6, 10]
size_tokens: 215
related: [pan-truncation, pci-scope-reduction, pci-network-segmentation]
---

# card-data-tokenization — PCI DSS Tokenization Pattern

## Pattern Summary

Raw PANs (Primary Account Numbers) must never enter your systems. Use a payment gateway (Razorpay) to tokenize card data client-side. Your backend only ever handles tokens and truncated PANs.

**Cardholder Data Environment (CDE) — what is in scope for PCI DSS:**
```
In scope (must meet PCI requirements):
  • Systems that store, process, or transmit PANs
  • Systems that can affect the security of the above (network devices, auth systems, logging infra)

Out of scope (the goal — keep as much here as possible):
  • Systems that only see tokens or truncated PANs
  • Isolated network segments with no CDE access
```

**Razorpay token flow — PAN never touches your server:**
```
1. Browser loads Razorpay.js SDK (served from Razorpay CDN — not your server)
2. User enters card data into Razorpay-hosted input fields (iFrame — never in your DOM)
3. Razorpay tokenizes the card, returns a razorpay_payment_id (token)
4. YOUR JS sends only the token to YOUR backend — no card numbers, no CVV
5. Your backend calls Razorpay API with the token to capture payment
6. Store only: razorpay_payment_id, razorpay_order_id, amount, status, last4, card_brand
```

**Payment record schema (PCI-safe — no raw PAN):**
```typescript
interface PaymentRecord {
  id:                  string;
  branch_id:           string;
  razorpay_order_id:   string;
  razorpay_payment_id: string;
  amount_paise:        number;    // in paise — no floats for currency
  currency:            string;    // "INR"
  status:              "created" | "authorized" | "captured" | "refunded" | "failed";
  last4:               string;    // "1234" — truncated, safe to store
  card_brand:          string;    // "Visa" / "Mastercard" etc.
  captured_at?:        string;
}
```

**Never do this:**
```typescript
// FORBIDDEN — raw PAN in your backend
const { card_number, cvv } = req.body; // never handle card fields server-side
```

## Full Reference

### Webhook signature verification
Razorpay webhooks must be verified using HMAC-SHA256 with your webhook secret before processing:
```typescript
const expectedSig = crypto.createHmac("sha256", RAZORPAY_WEBHOOK_SECRET)
  .update(rawBody).digest("hex");
if (expectedSig !== req.headers["x-razorpay-signature"]) {
  return { statusCode: 400, body: "Invalid signature" };
}
```

### What you CAN store
Razorpay payment ID, order ID, last 4 digits, card brand, expiry month/year. You cannot store: full PAN, CVV/CVC, full track data, PIN.

### Forbidden
- Any server-side form field that accepts card numbers
- Logging request bodies that might contain card data
- Storing CVV/CVC even temporarily
- Processing card data outside Razorpay's SDK
