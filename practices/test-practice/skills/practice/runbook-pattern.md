---
id: runbook-pattern
title: "Runbook pattern — operational procedures, alert-to-action, copy-paste commands"
layer: practice
tags: [runbook, operations, oncall, alert, sre]
applies_to:
  task_types: [add-monitoring, add-worker, deploy]
  stages: [7, 10]
size_tokens: 195
related: [incident-response, oncall-handoff, postmortem-blameless]
---

# runbook-pattern — Runbook Pattern

## Pattern Summary

Every alert must link to a runbook. The runbook is written for someone who has never seen this alert before. Assume the reader is at 3am, stressed, and unfamiliar with this subsystem.

**Runbook template:**
```markdown
# Runbook: <Alert name>

**Alert condition:** What triggers this alert (metric, threshold, duration)
**Severity:** P0 / P1 / P2
**Owner:** Team or individual responsible

## What it means
One paragraph. What does this alert indicate is happening? What's the user impact?

## Immediate actions (copy-paste safe)
Step-by-step. Each step is a single action. Commands are complete and runnable.

1. Check the dashboard: [link to Grafana/CloudWatch]
2. Check recent deployments:
   ```bash
   aws codedeploy list-deployments --application-name rabos-api --query 'deployments[0]'
   ```
3. Check Lambda error rate:
   ```bash
   aws cloudwatch get-metric-statistics \
     --namespace AWS/Lambda \
     --metric-name Errors \
     --dimensions Name=FunctionName,Value=rabos-orders-handler \
     --start-time $(date -u -d '30 minutes ago' +%Y-%m-%dT%H:%M:%S) \
     --end-time $(date -u +%Y-%m-%dT%H:%M:%S) \
     --period 60 --statistics Sum
   ```
4. If deployment is the cause → rollback: [link to rollback procedure]

## Escalation
If not resolved within 30 minutes: page @team-lead via [PagerDuty link]

## Known false positives
Describe any conditions that trigger this alert but are not real incidents.

## Related alerts
List alerts that commonly fire together with this one.
```

## Full Reference

### Keep runbooks close to the alert
Link the runbook URL in the alert definition itself (CloudWatch alarm description, PagerDuty note). Oncall engineers find runbooks through alerts, not through documentation portals.

### Test runbooks in staging
Run through the runbook steps during non-incident hours. Commands that don't work during a 3am incident are worse than no runbook.
