---
name: sdlc-context7
description: Use when writing code against a library whose API may have changed since training, or when an SDLC skill returns a context7_library_id field — fetches live docs before implementation.
---

# sdlc-context7

## Why this exists

SDLC skills (e.g. `supabase-rls.md`) teach the *pattern* — auth flow, isolation strategy, error shape. They do not guarantee the *current API* — method signatures, parameter names, options. Libraries change. Training data is months old. Context7 closes this gap.

## When to invoke

**Always invoke** if the SDLC skill returned a `context7_library_id` field:
```yaml
context7_library_id: /supabase/supabase
```

**Also invoke** when you are unsure whether an API method exists or has changed, before writing a call that uses it.

**Skip** when:
- Writing pure business logic with no external library calls
- The library is your own project code (read the source instead)
- Context7 MCP is not installed (proceed with training data, note the risk)

## Prerequisite check

If `resolve-library-id` and `query-docs` tools are available → Context7 MCP is installed. Proceed.

If not → proceed with training-data knowledge, and prepend a comment in the generated code:
```typescript
// WARNING: Context7 not available — API verified against training data only.
// Confirm method signatures before merge: <library name>
```

## The fetch sequence

```
1. resolve-library-id("<library name>")       → get canonical library ID
2. query-docs(library_id, topic, max_tokens)  → fetch relevant section
3. Read the returned docs before writing code
4. Write code using the confirmed current API
```

**max_tokens guidance:**
- For a single method or type: 2000–4000 tokens
- For a full module (e.g. Supabase RLS config): 6000–8000 tokens
- Never request more than needed — this runs in a sub-agent with a context budget

## Example — fetching Supabase RLS API before writing

```
SDLC skill: supabase-rls.md
context7_library_id: /supabase/supabase

1. resolve-library-id("Supabase")
   → /supabase/supabase

2. query-docs("/supabase/supabase", "Row Level Security createClient options", 4000)
   → returns current API: createClient(url, key, { db: { schema } })

3. Write:
   const client = createClient(url, key, { db: { schema: 'public' } });
   // Not the stale: createClient(url, key).schema('public') pattern
```

## Combining with SDLC skills

The sequence during a coding task:

```
sdlc_skills_fetch("supabase-rls")
  ↓
Pattern returned (auth flow, withRls wrapper, forbidden patterns)
  ↓
context7_library_id: /supabase/supabase returned in skill metadata
  ↓
sdlc-context7: fetch current createClient + RLS API
  ↓
Write code: pattern from skill + current API from Context7
```

The skill gives the *why and structure*. Context7 gives the *current method signatures*. Neither alone is sufficient.

## Skill freshness (periodic check)

Each SDLC skill that references a library should be verified against Context7 periodically. If the current docs contradict the skill's pattern, log an open item in SDLC_VALIDATION.md Section 16:

```
| <date> | SDLC skill `supabase-rls.md` may be stale — Context7 shows API change in <area> | Medium | |
```

Do not silently update the skill. Flag it and ask the user to review.
