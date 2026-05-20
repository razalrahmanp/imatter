---
name: sdlc-trace-requirements
description: Use during Stage 4 (Test Harness) and Stage 8 (Security) gate audits — verifies every FR-x.y.z in docs/spec.md has at least one test file referencing it, and flags orphaned FRs and orphaned tests.
---

## Rule

Every functional requirement (FR-x.y.z) in `docs/spec.md` must have at least one test that references it by ID. Every test should reference at least one FR-x.y.z it covers. Gaps in either direction are a gate concern.

## Audit procedure

### Step 1 — Extract all FR IDs from the spec

```bash
grep -rh -oE "FR-[0-9]+\.[0-9]+(\.[0-9]+)?" docs/ | sort -u > /tmp/fr-ids.txt
```

This produces the canonical list of FRs the project has committed to.

### Step 2 — Extract all FR references from test files

```bash
grep -rh -oE "FR-[0-9]+\.[0-9]+(\.[0-9]+)?" \
  $(find . -type f \( -name "*.test.*" -o -name "*.spec.*" -o -path "*__tests__*" \)) \
  | sort -u > /tmp/fr-in-tests.txt
```

### Step 3 — Find the orphans

```bash
# FRs with no test coverage (gate-blocking)
comm -23 /tmp/fr-ids.txt /tmp/fr-in-tests.txt

# Test references to FRs that don't exist in the spec (cleanup item)
comm -13 /tmp/fr-ids.txt /tmp/fr-in-tests.txt
```

### Step 4 — Verify the references are meaningful

For each FR that *does* appear in a test file, open that file and confirm the FR is referenced in a `describe`/`it`/`test` block or a comment immediately above one — not buried in a string constant or unrelated comment.

## How to reference an FR in a test

```ts
// ✅ Right — FR ID in the describe block
describe("FR-2.3.1 — user can reset password via email link", () => {
  it("sends a reset email when a valid address is submitted", () => { ... });
  it("does not leak whether the email exists", () => { ... });
});

// ✅ Also right — FR ID in the test name
it("FR-2.3.1: rejects expired reset tokens", () => { ... });

// ❌ Wrong — FR mentioned only in a string literal far from any assertion
const message = "Implements FR-2.3.1";
```

## Gate verdicts

| Result | Verdict |
|---|---|
| Every FR in spec has at least one meaningful test reference | PASS |
| 1–3 FRs lack tests, all are flagged with deferred reason in Section 16 | PASS_WITH_CONCERNS |
| 4+ FRs lack tests, or any P0 FR lacks tests | FAIL |
| Tests reference FRs not in the spec (orphaned) | LOG as open items; not gate-blocking on its own |

## What this is not

- Not a coverage metric (line/branch coverage is separate)
- Not a substitute for human review of test quality
- Not a guarantee the test actually validates the FR — only that a mapping exists

## When to run this

- **Stage 4 gate** — before marking the Test Harness gate as PASSED
- **Stage 8 gate** — before marking Security as PASSED, focusing on security-relevant FRs
- **Stage 10 / pre-release** — final sweep before launch
- **Any time `docs/spec.md` changes** — rerun to catch newly added FRs without tests
