---
id: architecture-doc
title: "Architecture doc — system context, component diagram, data flow, trade-offs"
layer: practice
tags: [architecture, documentation, c4, system-design, adr]
applies_to:
  task_types: [any]
  stages: [1, 2]
size_tokens: 190
related: [decision-record, readme-structure, api-doc-pattern]
---

# architecture-doc — Architecture Documentation Pattern

## Pattern Summary

An architecture document answers: what components exist, how they connect, what data flows where, and what trade-offs were made. It is kept at the level of components, not implementation.

**C4 model — use levels appropriate to audience:**
```
Level 1 — System Context:
  Who are the users? What external systems does this interact with?
  One diagram. Boxes = people and external systems. Lines = data flows.

Level 2 — Container:
  What are the deployable units? (Lambda functions, RDS, S3 buckets, CDN)
  One diagram per system. Boxes = containers. Lines = protocols.

Level 3 — Component (optional):
  What are the major code components within a container?
  Only needed for complex containers — skip for simple Lambda handlers.
```

**Architecture doc sections:**
```markdown
## System overview
One paragraph. What does the system do? Who uses it?

## System context diagram
[Diagram or description of external actors and systems]

## Container diagram
[Diagram or description of deployable units and how they connect]

## Key data flows
Describe the 2–3 most important request flows end-to-end.
Example: "Order creation: browser → ALB → Lambda (auth) → RDS → EventBridge → Lambda (kitchen)"

## Technology choices
Link to relevant ADRs. Don't repeat the rationale here — link to it.

## Security model
Auth/authz boundaries, trust zones, encryption points.

## Known limitations and trade-offs
What does this architecture NOT handle well? What would need to change at 10× scale?
```

## Full Reference

### Diagram tools
Mermaid (in-repo, version controlled), Excalidraw (quick sketches), draw.io. Prefer tools where the diagram source is stored in the repo alongside the code.

### Update triggers
Update the architecture doc when: a new container is added, an external integration changes, a security boundary changes. Component-level changes don't require an update unless they affect the Level 2 picture.
