# Agent Presets

Drop-in `sub_agents[]` configurations for `.sdlc-state.json`. Each preset wires one of the shipped subagents (in `plugin/agents/`) into the gate-synthesis flow used by `sdlc_dispatch_agents` and `sdlc_gate_run`.

## How to use

Open `.sdlc-state.json` in your project root. Find the `stages.<N>` entry for the stage you want to add an agent to. Paste the preset's `sub_agent` object into the `sub_agents` array and the matching `memory` key into the `memory` object.

Example — adding the spec auditor to Stage 1:

```json
{
  "stages": {
    "1": {
      "name": "Inception & Requirements",
      "sdlc_heading": "2. Stage 1 — Inception & Requirements",
      "sub_agents": [
        {
          "id": "spec-compliance-auditor",
          "type": "sdlc-spec-compliance-auditor",
          "model": "sonnet",
          "ns": "spec-compliance"
        }
      ],
      "memory": {
        "spec-compliance": null
      },
      "gate": {
        "min_passing": 1,
        "required_ns": ["spec-compliance"]
      }
    }
  }
}
```

## Preset → agent map

| Preset file | Subagent | Default ns | Use at stage |
|---|---|---|---|
| `gate-evidence-collector.json` | `sdlc-gate-evidence-collector` | `gate-evidence` | Any stage |
| `spec-compliance-auditor.json` | `sdlc-spec-compliance-auditor` | `spec-compliance` | 1 |
| `test-coverage-auditor.json` | `sdlc-test-coverage-auditor` | `test-coverage` | 4 |
| `security-reviewer.json` | `sdlc-security-reviewer` | `security` | 8 |

## Composing multiple agents

A stage can have any number of sub-agents. They run in parallel via `sdlc_dispatch_agents` and each writes to its own `ns`. The gate passes when:
- All `required_ns` namespaces have a `pass` (or `acknowledged`) finding.
- No more than the stage's `max_fail` namespaces returned `fail`.

For Stage 8 (Security), a common composition:

```json
{
  "sub_agents": [
    { "id": "security-reviewer", "type": "sdlc-security-reviewer", "model": "sonnet", "ns": "security" },
    { "id": "evidence", "type": "sdlc-gate-evidence-collector", "model": "haiku", "ns": "gate-evidence" }
  ],
  "memory": { "security": null, "gate-evidence": null },
  "gate": { "required_ns": ["security", "gate-evidence"], "max_fail": 0 }
}
```
