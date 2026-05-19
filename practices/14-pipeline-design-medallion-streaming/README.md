# Drill 14 — Pipeline Design: Medallion Architecture and Batch vs Streaming

## What this drill covers

Whiteboard-level system design for a data ingestion pipeline: how to layer storage, how to choose between batch and streaming, and how to reason about freshness requirements.

## Core concepts

### Medallion / lakehouse layering

| Layer | Also called | What goes here | Transformation applied |
|---|---|---|---|
| **Bronze** | Raw / landing | Exact copy of source data, as received | None — append-only, immutable |
| **Silver** | Cleaned / conformed | Deduplicated, type-cast, null-handled, schema-enforced | Light cleaning; no business logic |
| **Gold** | Mart / serving | Aggregated, business-logic-applied, ready for BI or ML | Full transformation to answer a specific question |

Key principle: each layer is independently queryable and replayable. A bad Silver transform does not corrupt Bronze.

### Batch vs streaming

| Dimension | Batch | Streaming |
|---|---|---|
| Freshness | Minutes to hours (scheduled) | Seconds to minutes (continuous) |
| Cost | Lower — amortized compute | Higher — always-on infrastructure |
| Complexity | Lower — simpler failure model | Higher — watermarks, state, exactly-once |
| Best for | Nightly aggregations, large historical loads | Real-time dashboards, fraud detection, event-driven alerts |

Decision rule: if the product does not need data fresher than the batch interval, use batch. Streaming is a complexity cost — only pay it when freshness demands it.

### Late and out-of-order data
- Events arrive after their event time due to network delays, mobile offline sync, etc.
- **Watermark**: a threshold that says "we will wait up to N minutes for late data; after that, close the window"
- Late data beyond the watermark is either dropped or written to a corrections table

## Problem shapes to expect

- "Design an ingestion pipeline for 20 source systems feeding a BI dashboard and an ML feature store."
- "Should this pipeline be batch or streaming? The dashboard refreshes every 15 minutes."
- "What does your Bronze layer look like? How is it different from Silver?"

## What interviewers probe

- Can you draw the three-layer diagram and explain each layer's purpose?
- Can you justify a batch vs streaming choice with a business freshness requirement?
- Do you know what a watermark is and why it matters?

## Interview context

Whiteboard, Principal-differentiator level. This is where judgment is graded, not syntax. Lead with the freshness requirement, derive the architecture from it.

## How to use SDLC_VALIDATION.md

Write an `architecture.md` in this folder describing a hypothetical pipeline for a specific scenario (e.g., e-commerce orders feeding a BI dashboard and a recommendation model). Draw the layers, justify the batch/streaming choice, and log the decision in Section 15 of `SDLC_VALIDATION.md`.
