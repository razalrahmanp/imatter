# Tea Shop Project — Architecture

Version: 1.0 | Date: 2026-05-19 | Owner: razalrahmanp

---

## System Overview

A multi-branch tea shop ordering platform. Each branch is a fully isolated tenant. Customers scan a table QR code, browse the menu, and place orders. Staff (bearer, kitchen) receive real-time alerts. The owner monitors their branch live. Payment is collected at the table via Razorpay.

---

## Component Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        AWS Cloud                                 │
│                                                                  │
│  ┌──────────────┐    ┌─────────────────────────────────────┐    │
│  │ AWS Amplify  │    │         API Gateway                  │    │
│  │  (Next.js)   │───▶│  REST API  │  WebSocket API          │    │
│  │              │    └─────┬──────┴────────┬────────────────┘    │
│  │  - Menu page │          │               │                     │
│  │  - Order UI  │    ┌─────▼──────┐ ┌─────▼──────┐             │
│  │  - Bearer UI │    │   Lambda   │ │   Lambda   │             │
│  │  - Kitchen   │    │  (REST)    │ │ (WebSocket)│             │
│  │  - Owner     │    └─────┬──────┘ └─────┬──────┘             │
│  └──────────────┘          │               │                     │
│                       ┌────▼───────────────▼────┐               │
│  ┌──────────────┐     │    RDS PostgreSQL        │               │
│  │ AWS Cognito  │     │    (Multi-AZ)            │               │
│  │              │     │    Row Level Security     │               │
│  │ - Staff pool │     └─────────────────────────┘               │
│  │ - Admin pool │                                                │
│  └──────────────┘                                                │
└─────────────────────────────────────────────────────────────────┘
         │                          │
         ▼                          ▼
┌─────────────────┐      ┌──────────────────────┐
│    Razorpay     │      │   GCP Services        │
│ (Payment API)   │      │  FCM (push alerts)    │
│                 │      │  SendGrid (email)     │
└─────────────────┘      └──────────────────────┘
```

---

## Technology Choices

| Layer | Technology | Rationale |
|---|---|---|
| Frontend | Next.js on AWS Amplify | Single codebase for all 4 UIs (customer, bearer, kitchen, owner); Amplify handles CI/CD and CDN |
| Backend API | API Gateway + Lambda (Node.js/TypeScript) | Serverless scales to bursts without provisioning; cost-effective at tea shop scale |
| Real-time | API Gateway WebSockets + Lambda | Native AWS push to connected clients; no extra broker needed |
| Database | Amazon RDS PostgreSQL (Multi-AZ) | Relational model fits order/table/branch relationships; RLS enforces tenant isolation at DB layer |
| Auth | AWS Cognito | Staff pool (bearer + kitchen) and Admin pool (owner) scoped to branch; anonymous customers get a signed table token |
| Payment | Razorpay | Best-in-class India payment support: UPI, cards, wallets, QR collect; mature Node.js SDK |
| Push notifications | Firebase Cloud Messaging (GCP) | Cross-platform push to bearer/kitchen/customer mobile browsers |
| Email | SendGrid (GCP) | Staff account invitation emails; transactional delivery |

---

## Multi-Tenancy & Data Isolation

Every table in the database carries a `branch_id` column. PostgreSQL Row Level Security (RLS) policies enforce that every query only touches rows belonging to the authenticated branch.

**How it works end-to-end:**
1. Owner/staff log in via Cognito → JWT includes `custom:branch_id` claim
2. Lambda reads `branch_id` from the verified JWT and sets a Postgres session variable: `SET LOCAL app.branch_id = '<id>'`
3. RLS policies on every table: `USING (branch_id = current_setting('app.branch_id'))`
4. No application-level WHERE clause needed — the DB enforces the boundary

**Customer sessions:**
- No Cognito login; customers get a short-lived signed token generated from the QR scan URL
- Token contains `branch_id` + `table_id`, signed with a Lambda secret
- All order writes use the `branch_id` from this token, enforced by RLS

---

## Authentication Flow

```
Owner/Staff login:
  User → Cognito User Pool → JWT (contains branch_id, role)
  JWT → API Gateway Authorizer → Lambda → DB (RLS uses branch_id)

Customer (anonymous):
  QR scan → Amplify page → Lambda issues signed table token
  Table token → API Gateway → Lambda → DB (branch_id from token)
```

**Cognito pools:**
- `tea-shop-staff-pool` — bearer + kitchen staff; attribute: `custom:branch_id`, `custom:role`
- `tea-shop-admin-pool` — owners; attribute: `custom:branch_id`

---

## Module & Service Boundaries

```
src/
├── functions/
│   ├── auth/           ← Cognito triggers (pre-signup, post-confirmation)
│   ├── menu/           ← GET menu items, owner CRUD
│   ├── orders/         ← place order, update status, get order list
│   ├── payments/       ← Razorpay initiate, webhook handler
│   ├── notifications/  ← FCM push, WebSocket connection manager
│   └── branches/       ← branch setup, table QR generation
├── shared/
│   ├── db.ts           ← RDS connection, RLS session setup
│   ├── auth.ts         ← JWT verification, branch_id extraction
│   └── types.ts        ← shared TypeScript interfaces
└── frontend/           ← Next.js app (all 4 UIs)
```

Each Lambda function owns one domain. No cross-domain direct DB access — all inter-module communication is via API calls or event triggers.

---

## API Contract Shape

All REST endpoints follow this pattern:

```
Authorization: Bearer <cognito-jwt | table-token>

GET    /branches/{branchId}/menu
POST   /branches/{branchId}/orders
GET    /branches/{branchId}/orders
PATCH  /branches/{branchId}/orders/{orderId}/status
POST   /branches/{branchId}/payments/initiate
POST   /payments/webhook          ← Razorpay webhook (no auth, verified by signature)
GET    /branches/{branchId}/tables/{tableId}/token  ← generate anonymous table token
```

WebSocket events:
```
→ client sends:   { action: "subscribe", branchId, role }
← server pushes:  { event: "ORDER_PLACED", order: {...} }
← server pushes:  { event: "ORDER_READY",  orderId: "..." }
```

---

## External Dependency Failure Modes

| Dependency | Failure scenario | Fallback |
|---|---|---|
| Razorpay API down | Payment initiation fails | Show "payment temporarily unavailable — pay at counter"; order remains in `PENDING_PAYMENT` state |
| Razorpay webhook missed | Payment confirmed by Razorpay but webhook not received | Razorpay dashboard retry + manual reconciliation via owner dashboard |
| FCM unavailable | Push alerts not delivered | Bearer and kitchen UIs poll order status every 10s as fallback; no silent failure |
| SendGrid unavailable | Staff invite emails not sent | Retry queue via SQS; invite link available in owner dashboard as fallback |
| RDS primary fails | DB unreachable | Multi-AZ standby promotes automatically (typically < 60s); Lambda retries with exponential backoff |
| Lambda cold start | First request slow | Provisioned concurrency on `orders/place` function to protect < 2s p95 NFR |
| API Gateway WebSocket disconnect | Client loses real-time connection | Client auto-reconnects on disconnect event; missed events replayed from DB on reconnect |
