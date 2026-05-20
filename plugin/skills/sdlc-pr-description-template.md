---
name: sdlc-pr-description-template
description: Use when opening any pull request — gives a stable template so reviewers find what they need (context, scope, test plan, risk) in the same place every time.
---

## Rule

A PR description is a contract between author and reviewer. It tells the reviewer what changed, why, what was tested, and what could break. A good description halves review time and catches regressions.

## Template

```markdown
## Summary
<2–4 sentences. What this PR does and why it exists. Reference the issue / spec.>

## Changes
- <Bullet list of the substantive changes. One bullet per logical change.>
- <Include file paths or modules touched.>
- <Skip the trivial: "added imports", "fixed types" don't need bullets.>

## Why
<If "Summary" already covered this, delete this section.>
<Otherwise: motivation, constraints, alternatives considered.>

## Test plan
- [ ] Unit tests added for new logic in `path/to/file`
- [ ] Integration test added covering the new flow
- [ ] Manually verified: <specific scenario, including how>
- [ ] Existing tests pass locally (`npm test`)

## Risk / impact
- **User-facing**: <what users will notice — none, new feature, bug fix>
- **Backwards compat**: <breaking? if yes, see Migration>
- **Performance**: <none / improved by X / regressed but justified>
- **Rollout**: <feature flag / direct / staged>

## Screenshots (UI changes only)
<Before / After>

## Migration (breaking changes only)
<Steps for consumers. Link to migration guide.>

## Related
- Closes #<issue>
- Depends on #<other-pr>
- Spec: <link to design doc>

## AI assistance
<If Claude Code or another AI helped, note which sections.>
```

## What each section is for

| Section | Who reads it | What they look for |
|---|---|---|
| **Summary** | Everyone, including non-reviewers scanning the PR list | Is this relevant to me? |
| **Changes** | Reviewer doing the code review | What files / modules to look at |
| **Why** | Reviewer + future archaeologist | Whether the approach makes sense |
| **Test plan** | Reviewer checking coverage | What was actually verified |
| **Risk** | Reviewer + on-call | What could go wrong in production |
| **Screenshots** | Reviewer + product / design | UI consistency |
| **Migration** | Consumers of this code | What they need to change |
| **Related** | Reviewer + project tracker | Context across PRs |

## Right-sizing

A single-line typo fix doesn't need this template. A 500-line feature does. **Default: include the template; delete what's truly N/A.** Empty sections are worse than no template at all.

### Tiny PR
```markdown
## Summary
Fix typo in welcome email subject ("Welocme" → "Welcome").

Closes #4567
```

### Medium PR
```markdown
## Summary
Add per-tenant rate limiting on the /api/exports endpoint, addressing
support tickets about one tenant DoSing the export queue.

## Changes
- New middleware `rateLimitPerTenant` in `src/middleware/rate-limit.ts`
- Wired into the exports route
- Config in `config/rate-limits.ts` (300/hr per tenant default)

## Test plan
- [x] Unit tests for the middleware
- [x] Integration test hits the limit and verifies 429 with Retry-After
- [x] Manually verified in staging — see Datadog dashboard

## Risk
- Existing customers hitting < 300/hr: no impact
- Tenant currently exceeding: will get 429 (intentional)
- Rollout: feature flag `exports_rate_limit` defaulting on

Closes #5678
```

### Large PR
Include every section. Add a checklist of "things reviewer should verify."

## Test plan — make it specific

Bad: "Tested locally"
Good:
- "Ran the script with --dry-run and verified the expected 47 rows would update"
- "Hit /api/exports 350 times in 1 minute from one tenant, observed 429s start at request 301"
- "Tested with timezone=UTC and timezone=America/Los_Angeles — both render correctly"

Reviewers learn to trust your "manually verified" claims. Don't lie.

## Risk section — be honest

If you broke backwards compat, **say so prominently**, link to the migration guide, and consider a major version bump. Reviewers should not have to discover breakage from the diff.

If performance regressed, justify why — sometimes "+5ms latency for a 10x simpler implementation" is fine. Just say it.

## Anti-patterns

- ❌ Empty description ("see commits")
- ❌ One-line description for a 500-line PR
- ❌ "Tested" with no detail of what was tested
- ❌ Risk section omitted on a database migration
- ❌ "Will fix in a follow-up" promises that never get followed up
- ❌ Reviewer requested before PR is ready (drafts are for that)
- ❌ Description that contradicts the diff (PR drifted from description after revisions)
- ❌ Linking to an external doc as the only description (descriptions should stand alone in git history)

## Tooling

- `.github/pull_request_template.md` — auto-loads the template on every PR
- PR-size limits via GitHub Action (warns above 500 lines changed)
- CODEOWNERS for routing to the right reviewer

## Gate criteria

- A `pull_request_template.md` exists in `.github/`
- The template includes Summary, Changes, Test plan, Risk
- PRs without a description (or only a stub) are flagged by a workflow
- The risk section is required for any PR that touches database schema, auth, or billing paths
- AI-assisted PRs disclose which sections
