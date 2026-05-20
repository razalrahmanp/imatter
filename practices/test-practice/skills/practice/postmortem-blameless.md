---
id: postmortem-blameless
title: "Blameless postmortem — timeline, contributing factors, action items"
layer: practice
tags: [postmortem, blameless, incident, sre, continuous-improvement]
applies_to:
  task_types: [any]
  stages: [7, 10]
size_tokens: 195
related: [incident-response, runbook-pattern, tech-debt-tracking]
---

# postmortem-blameless — Blameless Postmortem Pattern

## Pattern Summary

A postmortem asks WHY the system failed, not WHO caused it. People make mistakes because systems allow them to. Fix the system.

**Postmortem template:**
```markdown
# Postmortem: <Incident title>

**Date:** YYYY-MM-DD
**Severity:** P0/P1
**Duration:** HH:MM (detection to resolution)
**Author:** @name
**Reviewers:** @name, @name

## Summary (2–3 sentences)
What happened, what was the impact, what fixed it.

## Timeline
| Time (UTC) | Event |
|---|---|
| 14:32 | Alerts fired: error rate >10% on /api/orders |
| 14:35 | IC declared P1 incident |
| 14:41 | Identified deploy at 14:28 as likely cause |
| 14:43 | Rollback initiated |
| 14:51 | Error rate returned to baseline |
| 14:55 | Incident resolved |

## Contributing factors (not causes — systemic)
- No canary deployment — full traffic shifted immediately to new version
- Missing integration test for the database schema change
- Alert threshold set too high — took 3 minutes to fire

## What went well
- Rollback was fast (< 2 min) because deployment pipeline has one-click rollback
- Communication was clear and timely

## Action items
| Action | Owner | Due |
|---|---|---|
| Add canary stage to deployment pipeline | @infra | 2026-06-01 |
| Write integration test for schema migrations | @dev | 2026-05-27 |
| Lower error rate alert threshold to 2% | @oncall | 2026-05-22 |
```

## Full Reference

### Blameless means systemic
Replace "the developer deployed untested code" with "our deployment pipeline allows unreviewed code to reach production." The action item targets the pipeline, not the person.

### Action item discipline
Every action item has an owner and a due date. No owner = not an action item. Review open action items at the next postmortem or sprint planning.
