# Tea Shop Project — Roadmap

Version: 1.0 | Date: 2026-05-19

---

## v1 Scope Summary

v1 delivers the complete in-shop ordering cycle: a customer scans a table QR code, browses the menu, places an order, receives real-time status updates, pays, and leaves feedback. Staff (bearer and kitchen) receive instant alerts and can manage order state. The owner has a live dashboard of all active orders and can manage the menu.

**Core user journey (v1):**
```
Customer scans QR → browses menu → places order
    → bearer + kitchen alerted → kitchen marks ready
    → bearer + customer alerted → bearer initiates payment
    → customer pays → customer leaves feedback
```

---

## Deferral Table

| Feature | Reason deferred | Target version |
|---|---|---|
| Inventory management | Adds significant operational complexity before core ordering flow is proven | v2 |
| Accounts / bookkeeping | Requires integration with external accounting tools; not part of the ordering loop | v2 |
| Table reservation system | Out of scope for walk-in ordering model in v1 | v3 |
| Loyalty / points system | Requires customer identity persistence across sessions | v3 |
| Multi-branch support | Requires tenant isolation and per-branch config; v1 validates single-shop model first | v3 |
| Mobile app (iOS/Android) | Progressive Web App via Next.js covers mobile use in v1 | v3 |
| Kitchen display system (KDS) hardware integration | v1 uses web browser on any device; dedicated KDS hardware is a v2 operational upgrade | v2 |

---

## Version Markers

| Version | Focus | Key deliverable |
|---|---|---|
| **v1** | Core ordering loop | QR → order → alert → payment → feedback |
| **v2** | Operations | Inventory, accounts, KDS hardware |
| **v3** | Growth | Multi-branch, loyalty, reservations, native app |
