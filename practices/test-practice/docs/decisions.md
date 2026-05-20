# Tea Shop Project — Architecture Decision Records

---

| Date | Stage | Decision | Rationale | Alternatives considered | Approved by |
|---|---|---|---|---|---|
| 2026-05-19 | 1 | AWS as cloud provider | User confirmed existing AWS stack | GCP, Vercel + Supabase | razalrahmanp |
| 2026-05-19 | 1 | Next.js on AWS Amplify for frontend | Single codebase for all 4 UIs; Amplify handles CDN + CI/CD natively | React SPA on S3+CloudFront, separate apps per role | razalrahmanp |
| 2026-05-19 | 1 | API Gateway + Lambda for backend | Serverless, scales to burst, no server management at tea shop scale | ECS Fargate, EC2, App Runner | razalrahmanp |
| 2026-05-19 | 1 | RDS PostgreSQL (Multi-AZ) for database | Relational model fits order/table/branch structure; RLS enables tenant isolation at DB layer | DynamoDB (no RLS, harder for relational queries), Aurora Serverless | razalrahmanp |
| 2026-05-19 | 2 | API Gateway WebSockets for real-time | Native AWS, no extra broker, sufficient for 50 concurrent orders | AWS AppSync subscriptions, SNS+SQS polling, third-party (Pusher) | razalrahmanp |
| 2026-05-19 | 2 | Shared schema + RLS for multi-tenancy | Simplest to operate in v1; PostgreSQL RLS is mature and enforced at DB layer | Schema-per-tenant (complex migrations), DB-per-tenant (expensive) | razalrahmanp |
| 2026-05-19 | 2 | Two Cognito pools (staff + admin) | Separates owner privileges from staff; each pool scoped to one branch via custom attribute | Single pool with role claims, IAM Identity Center | razalrahmanp |
| 2026-05-19 | 2 | Anonymous table token for customers | No customer account required; frictionless for walk-in tea shop use | Guest Cognito identity, no auth (unsafe for order integrity) | razalrahmanp |
| 2026-05-19 | 2 | Razorpay as payment gateway | Best UPI + card support in India; QR collect API matches table payment flow; mature Node.js SDK | PhonePe Business (UPI only), Stripe (limited UPI), PayU | razalrahmanp |
| 2026-05-19 | 2 | FCM (GCP) for push notifications | Cross-platform push without managing a notification server; existing GCP dependency acceptable | AWS SNS (limited browser push), OneSignal, in-app polling only | razalrahmanp |
| 2026-05-19 | 2 | SendGrid (GCP) for email | Reliable transactional delivery; existing GCP dependency acceptable | AWS SES (more setup), Mailgun | razalrahmanp |
| 2026-05-19 | 2 | Provisioned concurrency on order Lambda | Protects < 2s p95 NFR for order placement against Lambda cold starts | Accept cold starts (risk to NFR), move to ECS (over-engineered) | razalrahmanp |
