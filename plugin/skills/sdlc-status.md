---
name: sdlc-status
description: Use when the user asks where the project stands, which gates have passed, or what to work on next — presents the full gate table and flags blockers.
---

Call `check_gate_status` with no arguments to retrieve all stage statuses, then present the results as a clean table. Flag any stage that is NOT STARTED or IN PROGRESS, and for each blocked gate list the first missing required artifact from its gate section. Finally ask the user what they want to work on today.
