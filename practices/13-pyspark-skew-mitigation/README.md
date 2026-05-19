# Drill 13 — PySpark: Skew Mitigation

## What this drill covers

Diagnosing and fixing data skew — the most common root cause of slow or failing Spark jobs, and a Principal-level signal in interviews.

## Core concepts

### What skew is
- A small number of keys account for a disproportionate share of rows
- The partition(s) holding those keys take much longer than all others — the job stalls waiting for the stragglers
- Visible in the Spark UI: one task takes 10× longer than the median

### Detection
- `df.groupBy("skewed_key").count().orderBy(F.desc("count")).show(20)` — find the heavy hitters
- Spark UI → Stages → look for a task with duration far above the median

### Mitigation techniques

| Technique | When to use |
|---|---|
| **Broadcast join** | One side is small enough to fit in executor memory |
| **Salting** | Large-to-large join or groupBy where one key is extremely hot; append a random salt prefix to the hot-side key, replicate the other side |
| **Skew hint** (`SKEW JOIN` or AQE) | Spark 3+ Adaptive Query Execution — enable `spark.sql.adaptive.enabled=true`; Spark detects and splits skewed partitions automatically |
| **Filter and union** | Isolate the hot keys, process them separately with a broadcast, union back |
| **Repartition on a higher-cardinality column** | Distribute load more evenly before the heavy operation |

### Salting pattern (know this cold)
```python
import pyspark.sql.functions as F

salt_factor = 10
# Hot side: append random salt
hot = hot_df.withColumn("salt", (F.rand() * salt_factor).cast("int"))
hot = hot.withColumn("salted_key", F.concat(F.col("join_key"), F.lit("_"), F.col("salt")))

# Cold side: explode to match every salt value
cold = cold_df.withColumn("salt", F.explode(F.array([F.lit(i) for i in range(salt_factor)])))
cold = cold.withColumn("salted_key", F.concat(F.col("join_key"), F.lit("_"), F.col("salt")))

result = hot.join(cold, on="salted_key", how="inner")
```

## Problem shapes to expect

- "Your job processes 1 TB of orders but always stalls at the last 1% of tasks. What do you do?"
- "How would you join a 500 GB user-events table to a 1 GB user-profile table?"
- "Explain data skew and two ways to handle it."

## What interviewers probe

- Can you diagnose skew from symptoms?
- Do you know more than one mitigation technique?
- Can you explain the salting pattern without prompting?

## Interview context

PySpark hard. This is a Principal differentiator — it shows operational depth, not just syntax knowledge.

## How to use SDLC_VALIDATION.md

Write a `skew_demo.py` that creates a deliberately skewed dataset, runs a groupBy, and demonstrates the salting fix. Log the salt-factor choice in Section 15 of `SDLC_VALIDATION.md`.
