# Drill 10 — Python: Processing a Stream You Can't Fit in Memory

## What this drill covers

Aggregating, filtering, or transforming a dataset that is too large to load into memory — using generators, chunked reads, and streaming algorithms.

## Core concepts

- Generator functions with `yield` — produce one item at a time without materializing the full sequence
- `itertools.islice`, `itertools.groupby`, `itertools.chain` for stream composition
- Chunked file reads: `pd.read_csv(..., chunksize=N)` or manual `islice` over a generator
- Streaming aggregation: running count, running sum, approximate top-K with a heap (`heapq.nlargest`)
- Reservoir sampling for a random sample from an unknown-length stream

## Problem shapes to expect

- "Count the occurrences of each user ID in a 10 GB log file. Memory limit: 512 MB."
- "Find the top 100 most frequent URLs from a stream; you cannot sort the full list."
- "Compute the median of a stream without storing all values."

## What interviewers probe

- Do you reach for `readlines()` and load everything, or iterate?
- Can you write a generator that chains transformations?
- Do you know a streaming top-K algorithm (min-heap of size K)?
- Can you articulate the memory complexity of your solution?

## Interview context

Python round, hard. The signal is knowing that `yield` + a heap or a dict gets you to O(n) time and O(k) memory, where k is the number of distinct keys or top-K size.

## How to use SDLC_VALIDATION.md

Write `solution.py` with a generator-based approach. Add a comment stating the memory complexity. Test with a small synthetic stream. Log the algorithm choice in Section 15 of `SDLC_VALIDATION.md`.
