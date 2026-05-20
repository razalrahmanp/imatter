---
name: sdlc-compaction-checkpoint
description: Use when working in Claude Code and conversation context approaches the token budget — captures durable state to disk before auto-compaction so the next session does not lose work.
---

## Rule

When the context window approaches the model's limit, Claude's runtime auto-compacts the conversation: prior messages are summarized into a short brief, freeing tokens for new work. The summary preserves intent but loses fidelity. Anything that *must* survive compaction must be written to disk before it happens.

## Why this matters

| What auto-compaction keeps | What it loses |
|---|---|
| The high-level task | Exact file paths and line numbers |
| Major decisions | The reasoning behind decisions |
| The current goal | Intermediate findings the user hasn't seen yet |
| Recent turns (~last few) | Mid-conversation grep results, agent outputs |

The compaction summary is a Claude-written narrative — useful, but lossier than the actual transcript. State you need verbatim must be persisted.

## What to persist before compaction

| State | Persist to |
|---|---|
| Current task progress | TodoWrite |
| Sub-agent findings | `sdlc_agent_write` (this plugin), or write a markdown findings file |
| Decisions taken | `log_decision` (this plugin) → Section 15 of SDLC doc, or `docs/adr/` |
| Open items / non-blocking issues | `log_open_item` → Section 16, or a TODO file |
| Session log entry | `update_session_log` → Section 18 (always before session ends) |
| Inventory of what's built vs. what's left | `sdlc-validate-inventory.md` or similar tracking doc |
| Verbatim findings the user hasn't seen | Display to user *before* compaction triggers |

## Signs you're approaching the threshold

| Signal | Action |
|---|---|
| Many large file reads in this conversation | Persist working notes now |
| Many sub-agent dispatches with large outputs | Confirm findings are written to disk, not just in chat |
| Long search/discovery phase before any writes | Summarize findings into a doc before next phase |
| User mentions "remember earlier when we…" | Memory is becoming load-bearing — write it down |

You usually won't get explicit warning. **Treat any session with > ~50 turns as compaction-risk and persist proactively.**

## Pattern — end-of-phase checkpoint

After completing a logical phase (gate audit, set of skill files, feature implementation), do:

1. **Update the inventory / tracking doc** with what's built and what's deferred (file paths, statuses)
2. **Call `update_session_log`** with a one-line summary of work done + next step
3. **Log decisions** that emerged this session via `log_decision`
4. **Confirm any agent findings** are written via `sdlc_agent_write` (not just in the chat)
5. **Tell the user**: "Checkpoint saved. Safe to compact or end session."

This makes compaction a transition, not a memory loss.

## Pattern — handing off to the next session

The next session reads:
1. `CLAUDE.md` at repo root (auto-loaded)
2. `MEMORY.md` if memory system is in use (auto-loaded)
3. `.sdlc-state.json` for cursor and gate history
4. `SDLC_VALIDATION.md` Section 18 (Session Log) for last session's notes
5. `sdlc-validate-inventory.md` (or equivalent tracking doc) for build state

If those five sources tell a complete story, the next session can pick up seamlessly. If any one is stale or missing, the next session re-derives context — slower and risks divergence.

## Anti-patterns

- ❌ Treating chat as durable storage ("I'll remember to do X later")
- ❌ Sub-agent findings only shown in chat, never written to disk (lost on compaction)
- ❌ Long search phases without a periodic "what have we learned" write-up
- ❌ Inventory docs that lag the actual work by days (catch up at session end becomes a chore)
- ❌ Letting compaction surprise you — proactively checkpoint at logical milestones
- ❌ Cramming everything into the chat right before close — write durable state, then summarize

## Gate criteria

- Every session ends with a Section 18 (Session Log) entry written
- Decisions made during the session are in Section 15 / ADR directory, not just in chat
- Sub-agent findings are written via `sdlc_agent_write` (or equivalent), not just displayed
- Long-running tracking docs (inventory, roadmap) are updated within the same session as work happens
- The next session, with no prior chat context, can read `.sdlc-state.json` + Session Log + inventory and resume productively
