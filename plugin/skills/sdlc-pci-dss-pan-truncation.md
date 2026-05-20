---
name: sdlc-pci-dss-pan-truncation
description: Use when displaying or storing card information for user-facing receipts, history, or admin tooling — covers the PCI DSS truncation rules and what is and isn't allowed.
---

## Rule

The Primary Account Number (PAN) on cards must be masked when displayed. PCI DSS Req 3.4 allows displaying at most the first six and last four digits — typically just last four. Stored truncated PAN follows specific rules. Don't reinvent — use the standard.

## The standard display

```
**** **** **** 1234
or
···· ···· ···· 1234
or
last 4: 1234
```

| What you can show | Note |
|---|---|
| Last 4 digits | Standard everywhere |
| First 6 + last 4 (BIN + last 4) | Sometimes allowed for fraud / reconciliation tooling — but check scope implications |
| Card brand (Visa, MC, Amex) | Yes |
| Expiration month/year | Yes — typically considered SAD (sensitive auth data) only at certain times |
| Cardholder name | Yes |

What you cannot show:
- Full PAN
- More than first 6 + last 4
- CVV / CVC (ever — even briefly, after auth)
- PIN
- Full magnetic stripe data

## Storage — truncation vs hashing

PCI DSS Req 3.3 + 3.4: PAN must be rendered unreadable when stored:

| Method | Allowed? | Notes |
|---|---|---|
| **Strong encryption** | Yes | With proper key management; expands scope |
| **Truncation** | Yes | Specific rules apply (next section) |
| **One-way hash** (strong, salted) | Yes | But brute-forcing 16-digit PAN search space is feasible without strong salt |
| **Tokenization** | Yes — preferred | See [[sdlc-pci-dss-card-data-tokenization]] |
| **Plaintext** | No | Ever |

If using truncation: only the displayable digits stored (first 6 + last 4 max, typically last 4 only). The rest must be irrecoverable — no chain back to full PAN.

## Common patterns

```ts
function maskPan(pan: string): string {
  if (!pan || pan.length < 4) throw new Error("invalid pan length");
  return `**** **** **** ${pan.slice(-4)}`;
}

// For storage, never persist this — use the provider's token instead.
```

For display only. For storage, use the payment provider's token (token, card_id, source ID).

## Receipts and emails

```
Receipt #INV-1234
Total: ₹500
Paid with: Visa ending in 1234
```

Receipt:
- Card brand: ok
- Last 4 only
- Never: full PAN, expiration, CVV, full name without other consent

If receipt is emailed: the email vendor (SendGrid, etc.) is also handling the truncated data. Document the data flow.

## Admin / fraud tooling — special considerations

Sometimes admins need to see first-6 + last-4 to verify which card was used (e.g. customer disputes). Allowed under PCI but:

- Limited access (RBAC)
- Audit log on every access
- Only for legitimate business need
- Auditor will sample these accesses

## Tokenized environments — no truncation needed

If you tokenized (recommended path), you have no PAN to truncate. The provider stores the relationship between token and last-4:

```ts
const card = await stripe.paymentMethods.retrieve(paymentMethodId);
// card.card.last4 = "1234"
// card.card.brand = "visa"
```

You display these from the provider's response — never from your DB.

## SAD — sensitive authentication data

The full PAN, CVV, magnetic stripe, PIN block, and similar. Per PCI:

- Cannot be stored after authorization (even encrypted)
- Card issuers and acquirers have different rules
- For merchants: never store SAD post-auth, full stop

The payment provider may store some of it (per their own PCI compliance) for short windows. You: never.

## Anti-patterns

- ❌ Storing the full PAN encrypted "for refunds" (use the provider's token / card_id instead)
- ❌ Displaying full PAN to admins for "their convenience"
- ❌ Showing CVV anywhere ever
- ❌ Logging PAN in any form (truncated PAN in logs creates incident risk)
- ❌ Sending full PAN via email or SMS
- ❌ Concatenating BIN + last-4 in URL paths (logged everywhere upstream)
- ❌ Building your own truncation when the payment provider supplies the truncated value
- ❌ Different masking conventions in different parts of the app (asterisks here, dots there, mixed lengths)

## Cross-references

- [[sdlc-pci-dss-card-data-tokenization]] — preferred alternative
- [[sdlc-pci-dss-pci-scope-reduction]] — broader scope reduction
- [[sdlc-pii-handling]] — adjacent (cardholder data overlaps with PII)
- [[sdlc-audit-logging]] — admin access to truncated PAN is audit-worthy

## Gate criteria

- Display masking applied consistently (last 4 only, or last 4 + brand)
- No code in the codebase stores full PAN (grep for card-shaped patterns; CI scanner)
- Receipts and emails show only last 4 + brand
- Admin tooling that shows BIN + last-4 is RBAC-gated + audit-logged
- No CVV / PIN / magstripe storage anywhere
- Migration plan documented if legacy stored PAN exists
- Provider tokenization in place for new card capture
