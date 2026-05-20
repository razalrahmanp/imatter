---
name: sdlc-simplicity-first
description: Use when designing any new function, class, or module — biases toward the minimum code that solves the problem and resists premature abstraction, clever syntax, and speculative generality.
---

## Rule

Prefer the minimum code that solves the actual problem. Three similar lines beats a premature abstraction. Explicit beats clever.

## Three-times rule for abstraction

Do not introduce an abstraction (helper function, base class, generic, utility) until the pattern has appeared **three or more times**. Two occurrences is a coincidence; three is a pattern.

```ts
// ❌ Wrong — abstracting after seeing the pattern once
function logWithTimestamp(msg: string) { console.log(`[${Date.now()}] ${msg}`); }
logWithTimestamp("user logged in");

// ✅ Right — inline until you need it elsewhere
console.log(`[${Date.now()}] user logged in`);
```

## Explicit beats clever

```ts
// ❌ Clever
const grouped = items.reduce((a, i) => ({ ...a, [i.k]: [...(a[i.k] ?? []), i] }), {});

// ✅ Explicit
const grouped: Record<string, Item[]> = {};
for (const item of items) {
  (grouped[item.k] ??= []).push(item);
}
```

The second version is longer and faster to read, debug, and modify.

## What not to add

- Error handling for cases that cannot happen
- Validation past a system boundary (trust internal callers)
- Fallbacks for branches that are unreachable
- Feature flags for code that has no opt-out
- Backwards-compat shims when you can just change the callers
- "Future-proofing" parameters that no caller passes

## When this rule does not apply

- A pattern has already repeated 3+ times — abstract it
- You're at a system boundary (user input, external API, untrusted source) — validate
- The clever version is materially faster on a hot path with a benchmark to prove it

Everything else: write less code.
