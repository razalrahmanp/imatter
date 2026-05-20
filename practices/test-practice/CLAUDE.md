# Tea Shop Project — Claude Session Rules

## Tech Stack
- Frontend: Next.js (React) on AWS Amplify
- Backend: API Gateway + Lambda (Node.js / TypeScript)
- Database: Amazon RDS PostgreSQL (Multi-AZ)
- Real-time: API Gateway WebSockets + Lambda
- Auth: AWS Cognito (staff pool + admin pool)
- Payment: Razorpay
- Push: Firebase Cloud Messaging (GCP)
- Email: SendGrid (GCP)

## Linting & Formatting
- ESLint + Prettier enforced on every file
- Run before committing: `npm run lint && npm run format:check`
- No lint warnings allowed in CI — warnings are errors

## TypeScript
- `strict: true` — no exceptions
- `noImplicitAny: true`
- No `// @ts-ignore` without a comment explaining why

## Branching Strategy — GitHub Flow
- `main` is always deployable
- One branch per task: `feature/`, `fix/`, `chore/`
- Open a PR to merge — CI must pass before merge
- No direct pushes to `main`

## Forbidden — never do these without explicit user approval

### Security
- Never import RDS client, Prisma, or any DB module in `src/frontend/` or any Next.js page/component
- Never log customer data: order contents, table IDs, customer session tokens, payment details
- Never hardcode AWS credentials, Razorpay API keys, FCM server keys, or any secret — use AWS Secrets Manager or environment variables
- Never bypass Cognito JWT verification — every Lambda must validate the token before reading `branch_id`
- Never skip RLS session setup (`SET LOCAL app.branch_id`) before any DB query

### Database
- Never run a migration without the migration hook reviewing and the user confirming
- Never change a column type or drop a column without a user-confirmed migration plan
- Never write raw SQL with string interpolation — use parameterised queries only

### Scope
- Never add features not listed in `docs/spec.md`
- Never fix out-of-scope issues silently — log them in Section 16 (Open Items) and ask

## Folder Structure
```
src/
├── functions/         ← Lambda handlers (one folder per domain)
│   ├── auth/
│   ├── menu/
│   ├── orders/
│   ├── payments/
│   ├── notifications/
│   └── branches/
├── shared/            ← shared utilities imported by Lambda functions only
│   ├── db.ts          ← RDS connection + RLS session setup
│   ├── auth.ts        ← JWT verification, branch_id extraction
│   └── types.ts
└── frontend/          ← Next.js app (no DB imports allowed here)
```

## End-of-session duty
Append one line to Section 18 (Session Log) in `SDLC_VALIDATION.md`:
`| <date> | <what was done> | <gates changed> | <next step> |`
