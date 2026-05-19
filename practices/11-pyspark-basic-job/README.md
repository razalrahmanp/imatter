# Drill 11 — PySpark: Write a Small Job

## What this drill covers

The syntax floor for PySpark: reading data, applying transformations, and writing output using the DataFrame API — the minimum needed to pass a PySpark coding question.

## Core concepts

```python
spark = SparkSession.builder.appName("drill").getOrCreate()

df = spark.read.parquet("s3://bucket/path/")

result = (
    df
    .filter(df.status == "active")
    .withColumn("revenue_usd", df.amount * df.fx_rate)
    .groupBy("region")
    .agg(
        F.sum("revenue_usd").alias("total_revenue"),
        F.count("*").alias("order_count")
    )
    .orderBy(F.desc("total_revenue"))
)

result.write.mode("overwrite").parquet("s3://bucket/output/")
```

- `filter` / `where`, `select`, `withColumn`, `drop`, `alias`
- `groupBy` + `agg` with `F.sum`, `F.count`, `F.avg`, `F.max`, `F.min`, `F.countDistinct`
- `join(other, on=..., how="left"|"inner"|"outer")`
- `write.mode("overwrite"|"append").parquet(...)`

## Problem shapes to expect

- "Filter this events table to the last 7 days and compute daily active users by region."
- "Join orders to customers and compute average order value per customer segment."
- "Read a CSV, clean nulls, write as Parquet partitioned by date."

## What interviewers probe

- Can you write the job without looking up every method?
- Do you know `F.` (functions import) vs column expressions?
- Do you avoid calling `.collect()` or `.toPandas()` mid-job on large data?

## Interview context

PySpark round, medium. This is the syntax floor — know it cold so you can focus on logic, not API lookup.

## How to use SDLC_VALIDATION.md

Write `job.py` with the full PySpark job. Test it locally with a small sample file. Log any framework decision in Section 15 of `SDLC_VALIDATION.md`.
