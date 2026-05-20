---
id: ai-risk-classification
title: "EU AI Act risk classification — prohibited / high-risk / limited / minimal"
layer: compliance
compliance_module: eu-ai-act
tags: [eu-ai-act, risk-classification, high-risk, prohibited, compliance, ai]
applies_to:
  task_types: [add-feature, add-worker, add-integration]
  stages: [1, 2, 6]
size_tokens: 215
related: [ai-transparency-disclosure, ai-system-logging, ai-human-oversight]
---

# ai-risk-classification — EU AI Act Risk Classification

## Pattern Summary

Before shipping any AI feature, classify it. Classification determines your obligations. Classification is a design-time decision, not a post-hoc check.

**Risk tiers:**
```
PROHIBITED (Art. 5) — cannot build at all:
  • Social scoring systems by public authorities
  • Real-time remote biometric ID in public spaces (with narrow exceptions)
  • Subliminal manipulation exploiting vulnerabilities
  • Emotion recognition in workplace/education contexts

HIGH RISK (Annex III) — strict obligations apply:
  • Hiring / promotion / performance evaluation tools
  • Credit scoring / creditworthiness assessment
  • Benefits eligibility determination
  • Biometric categorisation
  • Critical infrastructure management
  • Law enforcement / border control tools
  → Requires: conformity assessment, risk management, data governance,
               human oversight, logging, transparency notice to users

LIMITED RISK — transparency obligations only:
  • Chatbots / conversational AI  → must disclose it's an AI
  • Deepfake / synthetic media    → must label as AI-generated
  • Emotion recognition systems   → must inform individuals

MINIMAL RISK — no specific obligations:
  • Spam filters, recommendation engines, inventory optimisation
  • Most B2B analytics, forecasting tools
```

**Classification record (required for high-risk):**
```typescript
interface AiSystemRecord {
  system_name:     string;
  version:         string;
  risk_tier:       "prohibited" | "high-risk" | "limited" | "minimal";
  annex_iii_ref?:  string;     // e.g. "Annex III (4) — employment"
  rationale:       string;     // why this tier was assigned
  reviewed_by:     string;
  reviewed_at:     string;
  next_review_at:  string;     // annually for high-risk
}
```

## Full Reference

### RABOS context
- **Atlas Insights (demand forecasting)**: minimal risk — no individual-level decisions
- **RIS Analyst (cash flow recommendations)**: limited risk — affects business decisions, but human review required → disclose AI involvement
- **Staff scheduling suggestions**: review against Annex III (4) employment category — likely high risk if determinative

### High-risk obligations checklist
```
□ Risk management system (Art. 9) — ongoing, updated at retraining
□ Data governance (Art. 10) — training data quality, bias testing
□ Technical documentation (Art. 11) — before market placement
□ Record-keeping / logging (Art. 12) — automatic logs, retained post-deployment
□ Transparency to deployers (Art. 13) — instructions for use
□ Human oversight mechanisms (Art. 14) — stop/override capability
□ Accuracy, robustness, cybersecurity (Art. 15)
□ Conformity assessment — self-assessment for most Annex III systems
□ EU Declaration of Conformity (Art. 47)
□ Registration in EU AI database (Art. 71) for high-risk
```

### Forbidden
- Deploying a prohibited system regardless of business justification
- Claiming minimal risk without documenting the classification rationale
- Skipping re-classification when the system's scope or decision impact changes
