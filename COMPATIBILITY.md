# Compatibility Matrix

What works with what. Use this to plan your upgrade timing, decide whether to take a feature release, and confirm a stack profile or compliance module is supported on your framework version.

For migration mechanics see [MIGRATION.md](MIGRATION.md). For release notes see [CHANGELOG.md](CHANGELOG.md).

---

## Framework version status

| Version | Status | Released | Supported until | LTS |
|---|---|---|---|---|
| **1.4.x** | **Current stable** | 2026-05-20 | TBD (active development) | — |
| 1.3.x | Maintenance (security patches only) | 2026-05-20 | 2026-11-20 | — |
| 1.2.x | End of life | 2026-05-20 | EOL — upgrade required | — |
| 1.1.x | End of life | 2026-05-19 | EOL — upgrade required | — |
| 1.0.x | End of life | 2026-05-18 | EOL — upgrade required | — |
| 2.0.x | Not yet released | — | — | — |

**LTS roadmap**: v1.4 is on track for LTS designation pending one calendar quarter of stability data. v2.0 will be the next LTS release after that.

> "End of life" means the version still works, but no further patches will be released — including security fixes. Upgrade to a supported version before relying on it for production work.

---

## Claude Code compatibility

The plugin requires Claude Code as the host runtime.

| Plugin version | Claude Code version | Notes |
|---|---|---|
| 1.4.x | ≥ 1.0.0 | Uses `agents` field in marketplace.json; requires Claude Code with agent loader support. |
| 1.3.x | ≥ 0.9.0 | Multi-agent dispatch requires concurrent MCP tool calls. |
| 1.2.x | ≥ 0.8.0 | First version with stable `SessionStart` hook contract. |
| 1.1.x | ≥ 0.7.0 | MCP integration via stdio transport. |
| 1.0.x | ≥ 0.7.0 | Initial release. |

The plugin uses the Model Context Protocol (MCP) — any host with MCP support and Claude API access can run the underlying server, but the slash commands and skill UI are Claude Code-specific.

---

## Stack profile support

Stack profiles live under `skills/stack/<profile>/` and provide stack-specific implementations of generic patterns. To enable, add `"stack": "<profile>"` to `.sdlc-stack.json`.

| Stack profile | Framework versions | Status | Notes |
|---|---|---|---|
| `react-supabase-lambda` | 1.0.x – 1.4.x | Stable | 28 skills covering React, Supabase RLS, Lambda handlers, Bedrock, Cognito, SQS, EventBridge, CloudFront. |
| `nextjs-postgres` | — | Not yet released | Planned for v1.5. |
| `python-fastapi-postgres` | — | Not yet released | Planned for v1.6. |

If your stack isn't listed, the `generic/` and `practice/` layers still apply — they cover language-agnostic patterns.

---

## Compliance module support

Compliance modules live under `skills/compliance/<module>/` and add jurisdiction- or standard-specific skills. To enable, add the module to `compliance: []` in `.sdlc-stack.json`.

| Module | Framework versions | Status | Skills |
|---|---|---|---|
| `gdpr` | 1.1.x – 1.4.x | Stable | 4 skills: consent management, data subject rights, cross-border transfer, DPA pattern |
| `hipaa` | 1.1.x – 1.4.x | Stable | 4 skills: BAA, breach notification, PHI access logging, PHI handling |
| `pci-dss` | 1.1.x – 1.4.x | Stable | 4 skills: card data tokenization, PAN truncation, network segmentation, scope reduction |
| `soc2` | 1.1.x – 1.4.x | Stable | 3 skills: access review, change management evidence, incident evidence |
| `eu-ai-act` | 1.2.x – 1.4.x | Stable | 4 skills: human oversight, risk classification, system logging, transparency disclosure |
| `wcag-2-1-aa` | 1.1.x – 1.4.x | Stable | Accessibility compliance for EU/US |
| `accessibility-eu` | 1.1.x – 1.4.x | Stable | EAA-specific accessibility requirements |
| `accessibility-us` | 1.1.x – 1.4.x | Stable | Section 508 / ADA Title III |
| `iso-27001` | — | Not yet released | Planned for v1.5. |
| `dpdp-india` | — | Not yet released | Planned for v1.6. |

Multiple compliance modules can be active at once. Their skills are layered with `compliance/` having highest precedence.

---

## Operating system support

| OS | Status | Notes |
|---|---|---|
| Windows 10/11 | Supported | CRLF line endings handled; PowerShell + Bash both work. |
| macOS 12+ | Supported | — |
| Linux (Debian/Ubuntu/RHEL) | Supported | — |
| WSL 2 | Supported | Recommended for Windows users needing Unix-style tooling. |

The plugin is pure JavaScript/TypeScript and has no native dependencies.

---

## Node.js runtime

| Node version | Status |
|---|---|
| Node 18 LTS | Supported |
| Node 20 LTS | Supported (recommended) |
| Node 22 | Supported |
| Node ≤ 16 | Not supported (uses `node:crypto` randomUUID and ES2022 features) |

---

## Sub-agent model compatibility

Sub-agents declared in `.sdlc-state.json` `stages.N.sub_agents[]` reference a Claude model. Supported model IDs:

| Model | Use for | Framework versions |
|---|---|---|
| `sonnet` | Default for all SDLC subagents. Cost/quality balance. | 1.0.x – 1.4.x |
| `opus` | Complex synthesis or arbitration (gate conflicts). | 1.0.x – 1.4.x |
| `haiku` | Fast read-only checks (citation collection, status). | 1.2.x – 1.4.x |

Model IDs are resolved at dispatch time. If a model becomes deprecated, the dispatcher falls back to the next-best supported model and logs a warning.

---

## Upgrade safety summary

| From | To | Safe to apply | Effort |
|---|---|---|---|
| 1.3.x | 1.4.x | ✓ automatic | `sdlc-migrate --apply` |
| 1.2.x | 1.4.x | ✓ automatic (chains 1.2 → 1.3 → 1.4) | `sdlc-migrate --apply` |
| 1.1.x | 1.4.x | ✓ automatic | `sdlc-migrate --apply` |
| 1.0.x | 1.4.x | ✓ automatic (injects region markers on first hop) | `sdlc-migrate --apply` |
| Any | 2.0.0 | Codemod required (not yet released) | See [MIGRATION.md](MIGRATION.md) when v2.0 ships |
| 1.x | 1.x older | Use `sdlc-migrate --rollback` (within 30 days) | Single command |

---

## Reporting incompatibility

If you find a combination this matrix says should work but doesn't, file an issue with:

1. Framework version (`cat .sdlc-state.json | grep sdlc_framework_version`).
2. Claude Code version (`claude --version`).
3. Stack profile and compliance modules from `.sdlc-stack.json`.
4. Node version (`node --version`).
5. The exact command that failed and its output.

We update this matrix on every release. If your config is missing from the matrix entirely, that's also worth filing — the matrix should be complete.
