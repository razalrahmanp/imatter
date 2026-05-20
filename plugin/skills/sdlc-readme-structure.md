---
name: sdlc-readme-structure
description: Use when writing or auditing a project README — defines the standard sections so a new contributor can be productive within 30 minutes.
---

## Rule

A README answers a small fixed set of questions in a fixed order, so a reader can skim down and find what they need without re-orienting. The target audience is a developer who just cloned the repo: get them running locally and contributing within 30 minutes.

## Required structure

```markdown
# <Project Name>

<One-paragraph: what is this, who is it for, what problem does it solve.>

## Status
<Stable / Beta / Experimental. Build status badge. Version.>

## Quick start
<10–15 lines max. From `git clone` to "it's running locally." No prose.>

```bash
git clone <url>
cd <repo>
<install deps>
<set up env>
<run>
```

## What's in this repo
<Sketch of top-level directories. Pointers to important files.>

## Documentation
<Pointers to deeper docs. README links to them; doesn't duplicate.>
- Architecture: docs/architecture.md
- Contributing: CONTRIBUTING.md
- Decisions: docs/adr/

## Development
<How to run tests, lint, build. Common dev tasks.>

```bash
npm test
npm run lint
npm run build
```

## Deployment
<How does it get to prod. Pointers, not full details.>

## License
<Identifier. Link to LICENSE file.>

## Contact / support
<Where to ask questions: issue tracker, channel, email.>
```

## Optional sections (use only when relevant)

| Section | When to include |
|---|---|
| **Why** / Motivation | Niche problem; differentiate from competitors |
| **Roadmap** | Public, multi-month plan |
| **Acknowledgments** | Open-source contributors, sponsors |
| **FAQ** | Recurring questions in the issue tracker |
| **Changelog link** | If `CHANGELOG.md` exists |
| **Comparison** | Justify "why this and not <competitor>" |
| **Sponsors / funding** | OSS funding model |
| **Examples** | Multiple use cases beyond quick start |

## Quick start — be brutal about it

This is the section most users actually read. Common mistakes:

- ❌ "Install Node 20+, Python 3.11+, Docker, then run `setup.sh` ..." (drowns the reader)
- ❌ Asking the user to make decisions before they understand what they're configuring
- ❌ Missing step that "everyone knows" (which env vars; how to start the DB)
- ❌ Quick start that takes 30+ minutes

✅ Good: `git clone → cd → npm install → cp .env.example .env → npm run dev → open http://localhost:3000`

Test it: pair with someone unfamiliar with the repo; have them follow the quick start verbatim. Time it. If it fails or takes > 15 minutes, fix the doc.

## README vs CONTRIBUTING vs CHANGELOG

| File | Purpose |
|---|---|
| **README.md** | What is this; how to use it as a user |
| **CONTRIBUTING.md** | How to contribute as a developer |
| **CHANGELOG.md** | What changed in each version |
| **LICENSE** | The license text |
| **CODE_OF_CONDUCT.md** | Community guidelines |
| **SECURITY.md** | How to report security issues |

Don't merge them. Each has a different reader and time.

## Anti-patterns

- ❌ README that's 500 lines (split into multiple docs in `docs/`)
- ❌ README written by marketing (long; no code in the first scroll)
- ❌ Quick start that doesn't work on a fresh clone (rotted)
- ❌ Code blocks without language hints (`bash`, `sh`, `ts`)
- ❌ Screenshots that drift from current UI
- ❌ No badges showing build/test status (or worse: red badges committed)
- ❌ Linking to private docs the new user can't access
- ❌ "See the wiki" — wikis rot; READMEs are version-controlled

## Gate criteria

- A README exists at the repo root
- Quick start verified by someone unfamiliar with the project; takes < 15 min
- Code blocks have language hints
- Pointers to ARCHITECTURE / CONTRIBUTING / ADR / CHANGELOG exist where applicable
- README does not duplicate content from those other files
- A badge shows build/test status
- A "last verified" date on the quick start (or a CI job that tests it)
