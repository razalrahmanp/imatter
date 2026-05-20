# Tea Shop Project — Specification

Version: 1.1 | Date: 2026-05-19 | Owner: razalrahmanp

---

## Confirmed Tech Stack

| Layer | Choice |
|---|---|
| Frontend | Next.js (React) on AWS Amplify |
| Backend | API Gateway + Lambda (Node.js/TypeScript) |
| Database | Amazon RDS PostgreSQL |
| Real-time | API Gateway WebSockets + Lambda |
| Auth | AWS Cognito (owner/staff user pools; anonymous table session for customers) |
| Cloud | AWS |

---

## Personas

| Persona | Role | Primary goal |
|---|---|---|
| Customer | Visits the tea shop, sits at a table | Scan QR, browse menu, place order, pay and give feedback |
| Bearer | Serves customers on the floor | Receive order alerts, deliver orders, confirm completion |
| Kitchen Staff | Prepares orders in the kitchen | Receive order alerts, mark orders as ready |
| Owner | Manages the shop | Monitor all active orders, manage menu, view reports |

---

## Functional Requirements

### FR-1 — QR Menu Access
| ID | Requirement | Acceptance Criteria |
|---|---|---|
| FR-1.1 | Each table has a unique QR code | Scanning the QR code opens the menu page scoped to that table |
| FR-1.2 | Menu page loads without login | Customer can browse the full menu anonymously |
| FR-1.3 | Menu is managed by the owner | Owner can add, edit, and hide menu items from the dashboard |

### FR-2 — Order Placement
| ID | Requirement | Acceptance Criteria |
|---|---|---|
| FR-2.1 | Customer can add items to a cart | Selected items and quantities persist while browsing |
| FR-2.2 | Customer can place an order | Submitting the cart creates an order record tied to the table |
| FR-2.3 | Order confirmation shown to customer | Customer sees order summary and estimated status after placing |

### FR-3 — Order Alerts
| ID | Requirement | Acceptance Criteria |
|---|---|---|
| FR-3.1 | Bearer receives real-time alert on new order | Alert appears on bearer's device within 2s of order placement |
| FR-3.2 | Kitchen staff receives real-time alert on new order | Alert appears on kitchen display within 2s of order placement |
| FR-3.3 | Owner dashboard shows all active orders | New orders appear on dashboard without page refresh |

### FR-4 — Order Ready Notification
| ID | Requirement | Acceptance Criteria |
|---|---|---|
| FR-4.1 | Kitchen marks order as ready | Kitchen staff can tap/click to mark an order ready |
| FR-4.2 | Bearer receives alert when order is ready | Real-time notification sent to bearer on order-ready event |
| FR-4.3 | Customer receives alert when order is ready | Real-time notification shown on customer's menu page |

### FR-5 — Payment & Feedback
| ID | Requirement | Acceptance Criteria |
|---|---|---|
| FR-5.1 | Bearer initiates payment at table | Bearer can trigger a payment request for a completed order |
| FR-5.2 | Customer completes payment | Payment flow presented to customer; order marked as paid on success |
| FR-5.3 | Customer submits feedback | After payment, customer is prompted to rate their order items |
| FR-5.4 | Feedback visible to owner | Owner dashboard shows feedback entries per order |

---

## Non-Functional Requirements

| ID | Requirement | Target | Percentile |
|---|---|---|---|
| NFR-1 | Menu page load (QR scan → menu visible) | < 800 ms | p95 |
| NFR-2 | Order placed → staff screen update | < 2 s | p95 |
| NFR-3 | Concurrent order handling | 50 simultaneous active orders without degradation | peak load |
| NFR-4 | Uptime | 99.5% per calendar month | monthly |

---

## In-Scope / Out-of-Scope

### In scope — v1

| Feature | FR reference |
|---|---|
| QR code per table linking to menu | FR-1.1, FR-1.2 |
| Owner menu management | FR-1.3 |
| Cart and order placement | FR-2.1, FR-2.2, FR-2.3 |
| Real-time alerts to bearer and kitchen | FR-3.1, FR-3.2 |
| Owner order dashboard | FR-3.3 |
| Order-ready notifications | FR-4.1, FR-4.2, FR-4.3 |
| Payment flow | FR-5.1, FR-5.2 |
| Feedback collection | FR-5.3, FR-5.4 |

### Out of scope — v1

| Feature | Reason deferred | Target version |
|---|---|---|
| Inventory management | Separate operational concern; adds complexity before core flow is stable | v2 |
| Accounts / bookkeeping | Requires integration with accounting software; not core to ordering flow | v2 |

---

## GA-Gate Acceptance Criteria

The following must all be true before v1 is considered shippable:

- [ ] A customer can scan a QR code, place an order, and receive a ready notification without any staff intervention in the flow
- [ ] Bearer and kitchen staff receive order alerts within 2s on a device with an active session
- [ ] Owner can view all active orders in real time on the dashboard
- [ ] Payment can be completed for any order and the order status updates accordingly
- [ ] System handles 50 concurrent active orders without degradation under load test
- [ ] Menu page loads in < 800 ms p95 under load test
- [ ] Order-to-staff-screen latency < 2 s p95 under load test
- [ ] No PII is logged; no secrets are in source code
