---
name: sdlc-eu-ai-act-risk-classification
description: Use when classifying an AI system under the EU AI Act — determines which tier (prohibited, high-risk, limited-risk, minimal-risk) applies and what obligations follow.
---

## Rule

The EU AI Act tiers AI systems by risk. The tier determines compliance burden. Classify each AI system in your product before deployment to EU users. Misclassification = enforcement risk.

## The four tiers

| Tier | What | Obligations |
|---|---|---|
| **Prohibited** | Social scoring, real-time biometric ID in public (with exceptions), manipulation, exploitation of vulnerable groups | Cannot deploy in EU at all |
| **High-risk** | Listed Annex III use cases (HR/employment, credit scoring, education access, law enforcement, migration, critical infra, biometric ID, etc.) | Full conformity assessment, risk management, data governance, transparency, human oversight, accuracy, robustness, registration |
| **Limited-risk** | Chatbots / interactive AI, emotion recognition (non-HR), synthetic content (deepfakes) | Transparency: disclose AI involvement |
| **Minimal-risk** | Spam filters, recommendation, autocomplete, video games | Voluntary codes of conduct |

## High-risk areas (Annex III, paraphrased)

Be honest about classification. The high-risk areas include:

- Biometric ID and categorization
- Critical infrastructure (transport, water, gas, electricity)
- Education and vocational training (admissions, grading)
- Employment and workers' management (CV screening, performance monitoring)
- Access to essential services (credit scoring, benefits eligibility, emergency response prioritization)
- Law enforcement
- Migration, asylum, border control
- Administration of justice and democratic processes

If your AI system makes or materially influences decisions in these areas, it's high-risk — even if you call it "decision support."

## General Purpose AI (GPAI) Models

Foundation models (LLMs, large multimodals) have separate rules:

- All GPAI: technical documentation, copyright compliance, summary of training data
- "Systemic risk" GPAI (above compute threshold, currently 10^25 FLOPs): additional model evaluation, adversarial testing, incident reporting, cybersecurity

If you're not training the model, but deploying it (using OpenAI/Anthropic/etc.): you're a deployer of the LLM. Your responsibilities flow from your deployment, not the GPAI provider's.

## Pattern — classification template

For each AI system / feature, document:

```
System name: Customer support chatbot
Description: AI-powered chat answering customer questions
Inputs: User text
Outputs: Suggested text reply (human reviews before sending)
Deployment context: EU customers
Annex III area: No (general customer service, not Annex III)
Manipulation potential: Low (informational, not behavioral nudging)
Vulnerable groups: No targeted use
Classification: Limited-risk
Required obligations:
  - Transparency: user must know they're interacting with AI ("I'm an AI assistant")
  - Synthetic content disclosure: if outputting AI-generated text, label it
```

## Transparency obligations (Limited-risk)

Even if not high-risk, you must:

- Inform users they're interacting with an AI ("I'm an AI assistant" at start of chat)
- Label AI-generated content (deepfakes, synthetic images, AI-written text used for important communication)
- Inform users when emotion recognition or biometric categorization is in use

## High-risk obligations (summary)

If you're high-risk:

| Obligation | What |
|---|---|
| Risk management system | Identify, evaluate, mitigate risks; iterate |
| Data governance | Training/validation/testing data quality, bias mitigation |
| Technical documentation | Comprehensive system description |
| Record-keeping | Logging events for traceability |
| Transparency | Instructions for use, system info |
| Human oversight | Humans can intervene, override, supervise |
| Accuracy, robustness, cybersecurity | Performance + resilience requirements |
| Conformity assessment | Before placing on market |
| Registration | In the EU database for high-risk AI systems |

This is heavy. Most teams should design to *avoid* the high-risk tier when possible — for example, by ensuring a human makes the final decision in HR or credit contexts.

## Timeline (subject to revision)

- Prohibited practices: applied 6 months after entry into force
- GPAI rules: 12 months
- High-risk: 24–36 months (most provisions)

Build compliance posture early — these dates compress fast.

## Anti-patterns

- ❌ Calling something "decision support" to avoid high-risk classification when AI actually drives the decision
- ❌ No transparency disclosure on chatbots
- ❌ Deploying an unclassified system to EU users
- ❌ Treating GPAI deployment obligations as the GPAI provider's problem (you're the deployer)
- ❌ Ignoring the synthetic content disclosure for AI-generated text/images
- ❌ Building a high-risk system without conformity assessment

## Cross-references

- [[sdlc-eu-ai-act-transparency-disclosure]] — the transparency obligations in detail
- [[sdlc-eu-ai-act-human-oversight]] — high-risk human-in-the-loop pattern
- [[sdlc-eu-ai-act-system-logging]] — the record-keeping obligation

## Gate criteria

- Every AI feature deployed to EU users has a documented classification
- Limited-risk features have transparency disclosures in the UI
- High-risk features have a documented conformity assessment path
- A register of AI systems exists, classification per system
- A change-management process exists: classification re-evaluated when AI use case changes
