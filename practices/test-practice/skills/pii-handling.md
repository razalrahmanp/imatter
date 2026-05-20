# pii-handling — PII Protection Rules

## Pattern Summary

PII never appears in logs, never goes into LLM prompts, and never travels beyond the service that owns it.

```typescript
// CORRECT — log an opaque ID, never the data
log("info", { action: "customer.lookup", customerId: customer.id });

// WRONG — logging PII
log("info", { email: customer.email, phone: customer.phone, name: customer.name });

// CORRECT — pass IDs to Bedrock, not content
const prompt = `Summarise order patterns for branch ${branchId} in the last 7 days.`;

// WRONG — sending customer content to LLM
const prompt = `Customer ${customer.name} (${customer.email}) ordered: ${items.map(i => i.name).join(", ")}`;
```

**PII taxonomy for this project:**
| Data | Classification | Allowed in logs | Allowed in LLM prompt |
|------|---------------|-----------------|----------------------|
| Customer email / phone | PII | Never | Never |
| Customer name | PII | Never | Never |
| Order item contents | Sensitive | Never | Never (may include allergy info) |
| Payment amount | Financial | Never | Never |
| Session / JWT token | Secret | Never | Never |
| Branch ID (UUID) | Non-PII | Yes | Yes |
| Order ID (UUID) | Non-PII | Yes | Yes |
| Aggregate counts | Non-PII | Yes | Yes |

## Full Reference

### Redaction helper
```typescript
// src/shared/pii.ts
export function redact(value: string): string {
  return value.slice(0, 2) + "***";
}

// Use only in debug output that the user has explicitly opted into
// Never in production logs
```

### LLM prompt rules
- Prompts may reference IDs, timestamps, counts, and aggregate statistics
- Prompts must never include names, emails, phone numbers, or free-text customer input
- If you need LLM to classify customer-typed text: send category labels, not raw text
- Always log `{ action: "bedrock.call", task: "intent_classification" }` — never log the prompt body

### Storage rules
- Customer PII stored only in Cognito and RDS — not duplicated to S3, DynamoDB, or logs
- RDS columns: `customer_email`, `customer_phone` must have column-level encryption policy
- Razorpay handles raw payment data — we store only `payment_id` (opaque token)

### Incident response
If PII appears in CloudWatch, immediately:
1. Note the log group + stream + timestamp
2. Create a CloudWatch log data protection policy to mask the field going forward
3. Open a security incident — do not silently delete logs
