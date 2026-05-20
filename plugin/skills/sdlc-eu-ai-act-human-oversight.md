---
name: sdlc-eu-ai-act-human-oversight
description: Use when designing high-risk AI systems under the EU AI Act — covers the human-in-the-loop requirements, override mechanisms, and the operator-training obligations.
---

## Rule

High-risk AI systems must be designed for effective human oversight (Article 14). A human can monitor, intervene, override, and ultimately decide. The system gives the human enough information to do so. Operators are trained and have the authority to act on what they see.

## The five oversight measures (Art. 14(4))

The system shall enable the human to:

| Measure | What |
|---|---|
| **a) Fully understand the capacities and limitations** | The human knows what the system does and doesn't do well |
| **b) Remain aware of automation bias** | Trained not to over-trust the system |
| **c) Correctly interpret the output** | The output is understandable; calibration matches reality |
| **d) Decide not to use, or override, the output** | Human can reject the AI's recommendation |
| **e) Intervene or interrupt** | Human can stop the system mid-process |

The system *enables* these — the deployer also has to actually use them.

## Pattern — decision-support UI

For a high-risk decision support system (credit, hiring, medical triage):

```
+----------------------------------+
|  AI Recommendation: APPROVE       |
|  Confidence: 87%                  |
|  Top factors:                     |
|    - Income band: high            |
|    - Tenure: 8+ years             |
|    - Debt ratio: 0.32              |
|                                   |
|  ⚠ This is a recommendation.      |
|  You make the final decision.     |
|                                   |
|  [ Approve ] [ Reject ] [ Defer ] |
|                                   |
|  Reason required:                 |
|  [_________________________]      |
+----------------------------------+
```

Key elements:

- Clear that AI is recommending, not deciding
- The reasoning (key factors) so the human can evaluate
- Confidence calibration (the human knows when to second-guess)
- Reason field — captures the human's decision rationale
- All three options (approve, reject, defer) equally weighted in UI

## What over-trust looks like (avoid)

```
+--------------------------------------+
|  Approved!                            |
|                                       |
|  [ Click here to undo ]               |
+--------------------------------------+
```

This is automation bias by design — the system has decided; the human needs to expend effort to override.

## Override logging — see related skill

When a human overrides the AI:

- Log the original recommendation, the override, the reason
- This data feeds back into model performance monitoring
- High override rates = model drift or misalignment

See [[sdlc-eu-ai-act-system-logging]].

## Stop / intervene mechanism

For systems that operate continuously (recommendation engines, content moderation, autonomous decision-making):

- A "stop the system" button or API
- A "pause this specific instance" flag
- Authorities to invoke these clearly assigned
- Tested under realistic conditions

For real-time biometric ID systems (where allowed), the stop mechanism is critical — the system can't run while the supervising human is overwhelmed.

## Operator training

The deployer must train operators to:

- Use the system as designed
- Recognize signs of automation bias in themselves
- Understand the system's capabilities and limitations
- Know when to override
- Know the escalation path

Document the training; refresh annually.

## Two-human approval for high-stakes

For decisions with the highest stakes (medical diagnoses, criminal justice recommendations, life-affecting credit decisions):

- Two independent humans review
- Disagreement triggers a third reviewer or process change
- The system records both reviews

## Anti-patterns

- ❌ "Approve" the default action; "Reject" requires extra clicks
- ❌ AI output presented with no reasoning ("Score: 87. Decision: approve")
- ❌ Confidence absent, or always > 95% regardless of reality
- ❌ Human reviewer cannot see the input data (only the AI's summary)
- ❌ No "pause / stop" mechanism on continuously operating systems
- ❌ Operators told "trust the AI; only override if certain" — that's biased framing
- ❌ Override rates not tracked
- ❌ Training is a 30-minute video at onboarding, never refreshed

## Cross-references

- [[sdlc-eu-ai-act-risk-classification]] — when this applies (high-risk)
- [[sdlc-eu-ai-act-system-logging]] — log overrides
- [[sdlc-agent-response-contract]] — AI output as recommendation, not decision

## Gate criteria

- High-risk system UI presents AI output as a recommendation with clear reasoning
- All decision options are equally weighted (no default-approve)
- Confidence is shown and calibrated against actual outcomes
- Human override is logged with reason
- Override rates monitored; drift triggers review
- Operators are trained and the training is documented
- A stop / pause mechanism exists for continuously operating systems
- Two-human review for the highest-stakes decisions
