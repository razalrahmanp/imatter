# Contributing — Tea Shop Project

## Branching Strategy — GitHub Flow

`main` is always deployable. Every change goes through a branch and a pull request.

```
main (always deployable — auto-deploys to staging on merge)
  └── feature/add-menu-item
  └── fix/order-alert-delay
  └── chore/update-dependencies
```

### Branch naming

| Type | Pattern | Example |
|---|---|---|
| New feature | `feature/<short-description>` | `feature/qr-table-token` |
| Bug fix | `fix/<short-description>` | `fix/payment-webhook-duplicate` |
| Chore / config | `chore/<short-description>` | `chore/update-eslint` |
| DB migration | `migration/<short-description>` | `migration/add-branch-table` |

### Rules

- **No direct pushes to `main`** — all changes go through a PR
- **CI must pass before merge** — type-check, lint, tests, vulnerability scan must all be green
- **One PR per task** — keep PRs small and focused
- **Migration PRs need extra review** — any branch named `migration/*` requires the owner to review the SQL before approving

## Pull Request Checklist

Before opening a PR, confirm:

- [ ] `npm run build` passes (no TypeScript errors)
- [ ] `npm run lint` passes with no warnings
- [ ] `npm run test:coverage` passes with ≥ 80% coverage
- [ ] No secrets, credentials, or PII in code or logs
- [ ] No DB client imported in `src/frontend/`
- [ ] If this includes a migration: migration SQL reviewed and rollback plan documented in PR description

## Environments

| Environment | Trigger | AWS account |
|---|---|---|
| `dev` | Local — `npm run dev` | Your local machine |
| `staging` | Auto-deploy on merge to `main` | AWS staging account |
| `prod` | Manual approval after staging passes | AWS prod account |

**Staging → Prod requires a manual approval click** in the GitHub Actions UI. Never approve unless staging smoke test passed and you have read the migration SQL (if any).

## Secrets

All secrets are stored in AWS Secrets Manager and injected at Lambda runtime. Never put secrets in:
- Source code
- `.env` files committed to git
- GitHub Actions environment variables (use GitHub Secrets instead)

## Database Migrations

- All migrations must be reviewed before the PR is merged
- The migration hook in `.claude/settings.json` blocks Claude from running migrations without your review
- Every migration PR must include a rollback plan in the PR description
