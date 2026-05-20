---
name: sdlc-superpowers
description: Use when in SDLC coding mode and Superpowers is installed — defines how Superpowers skills integrate with SDLC gate context and skill fetching during feature work.
---

# sdlc-superpowers

## Division of responsibility

| SDLC Validate owns | Superpowers owns |
|---|---|
| Gate status, state, stage sequencing | Brainstorming, planning, TDD, debugging |
| Compliance checks, audit evidence | Code review discipline, verification |
| Skill registry (`sdlc_skills_fetch`) | Task execution methodology |
| `.sdlc-tasks/` plan format | Sub-agent dispatch and review |

**Do not replicate Superpowers' methodology. Invoke it.**

## The coding loop — fixed sequence

```
1. sdlc-dispatcher detects coding task
2. superpowers:brainstorming  ← clarify intent, surface hidden requirements
3. superpowers:writing-plans  ← decompose to checkbox tasks in .sdlc-tasks/
4. Per task:
   a. sdlc_skills_fetch(task_type)  ← get pattern + context7 hint
   b. context7 lookup (if hint present)  ← get live API docs
   c. superpowers:test-driven-development  ← RED test first
   d. Write implementation
   e. superpowers:verification-before-completion  ← verify before claiming done
5. superpowers:requesting-code-review  ← before merge
6. superpowers:finishing-a-development-branch  ← merge/PR options
```

**Never skip a step.** Each step has a documented reason:
- Brainstorming: surfaces requirements Claude would otherwise assume
- Writing-plans: creates crash recovery; without it, session death loses progress
- sdlc_skills_fetch: gives the project-specific pattern before the sub-agent writes code
- TDD: ensures tests exist before implementation, not after
- Verification: closes the "passes in my head" gap
- Code review: ensures gate evidence is real, not rubber-stamp

## Feeding SDLC context into Superpowers

When invoking `superpowers:writing-plans`, include the current SDLC stage in the plan header:

```markdown
# T-2026-05-20-posting-rule

**SDLC stage at task start:** Stage 5 — Build & CI (in_progress)
**Gate constraint:** Do not merge until CI gate is PASSED (Stage 5)

## Tasks
- [ ] Write failing test for posting-rule logic
- [ ] Implement posting-rule (verifyToken → validate → withRls → return)
- [ ] Confirm coverage threshold still met after addition
```

This makes the gate constraint visible to every sub-agent that opens the plan.

## When Superpowers is not installed

If `superpowers:brainstorming` is unavailable, perform a manual equivalent:
- Ask: "What exactly needs to change and why? What are the edge cases?"
- Ask: "What could go wrong in production with this change?"
- Do not proceed to writing code until both are answered.

If `superpowers:writing-plans` is unavailable, write a manual plan to `.sdlc-tasks/` in the same checkbox format before writing any code.

**Never skip the planning artifact.** The file is the recovery mechanism.
