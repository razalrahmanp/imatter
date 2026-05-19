# Drill 12 — PySpark: Execution Concepts

## What this drill covers

The "why does this job behave this way" layer: understanding what triggers a shuffle, when to use broadcast vs sort-merge join, how partitioning affects performance, and what the execution plan looks like.

## Core concepts

### Lazy evaluation and actions
- Transformations are lazy — they build a DAG but do nothing
- Actions (`count`, `collect`, `write`, `show`) trigger execution
- Each action re-evaluates the full DAG unless you `cache()` / `persist()`

### Shuffles
- Operations that require data redistribution across nodes: `groupBy`, `join` (sort-merge), `repartition`, `distinct`, `orderBy`
- Shuffles are the dominant cost in a Spark job — minimize them
- `coalesce` reduces partitions without a shuffle; `repartition` does a full shuffle

### Broadcast join vs sort-merge join
- **Broadcast join**: small table is sent to every executor — no shuffle on the large table; threshold default 10 MB (`spark.sql.autoBroadcastJoinThreshold`)
- **Sort-merge join**: both sides sorted and merged — requires a shuffle of both tables; used when neither table fits in memory
- Force a broadcast: `df.join(F.broadcast(small_df), on="key")`

### Partitioning
- Default parallelism: `spark.sql.shuffle.partitions` (default 200 — often wrong for your data size)
- `repartition("date")` co-locates all rows for the same date on the same partition
- Read partition pruning: filter on a partition column to avoid reading irrelevant files

## Problem shapes to expect

- "This join is slow. What would you check first?"
- "Explain what happens when you call `groupBy().agg()` on a 1 TB table."
- "How would you join a 1 TB fact table to a 5 MB dimension?"

## What interviewers probe

- Can you name the operations that trigger a shuffle?
- Do you know when Spark chooses broadcast vs sort-merge?
- Can you read a basic `EXPLAIN` output and identify a shuffle stage?

## Interview context

PySpark conceptual round, medium to hard. For a Principal role, knowing the execution model is more important than knowing every API method.

## How to use SDLC_VALIDATION.md

Write an `explain.py` that calls `.explain(True)` on a join and a groupBy. Read the output and annotate what each exchange/sort stage is. Log your observations in Section 15 of `SDLC_VALIDATION.md`.
