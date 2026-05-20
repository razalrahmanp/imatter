---
name: sdlc-pgvector-pattern
description: Use when storing and searching vector embeddings in Postgres (RAG, semantic search, recommendations) — covers the pgvector setup, index choice, and the dimensionality / metric gotchas.
---

## Rule

pgvector adds a `vector` column type to Postgres and ANN indexes for fast similarity search. Pick the right index (HNSW for accuracy + dynamic data, IVFFlat for static + memory-bound), match the distance metric to how you generated embeddings, and budget for the index build time.

## Setup

```sql
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE documents (
  id          UUID PRIMARY KEY,
  tenant_id   UUID NOT NULL,
  content     TEXT NOT NULL,
  embedding   VECTOR(1536) NOT NULL,  -- match your embedding model's dimensionality
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

Common dimensions:
- OpenAI `text-embedding-3-small`: 1536 (or 512/256 with `dimensions` parameter)
- OpenAI `text-embedding-3-large`: 3072
- Cohere embed-v3: 1024
- Local sentence-transformers (e.g. `all-MiniLM-L6-v2`): 384

Vector dimensions are fixed per column. Changing models = new column or new table.

## Distance metrics — match your model

```sql
-- Cosine distance (most common; OpenAI embeddings are normalized)
SELECT *, embedding <=> query_vector AS distance
FROM documents
ORDER BY embedding <=> query_vector
LIMIT 10;

-- L2 / Euclidean distance
SELECT *, embedding <-> query_vector AS distance
FROM documents
ORDER BY embedding <-> query_vector
LIMIT 10;

-- Inner product (faster on normalized vectors; max = best)
SELECT *, (embedding <#> query_vector) * -1 AS score
FROM documents
ORDER BY embedding <#> query_vector
LIMIT 10;
```

| Operator | Metric | Use when |
|---|---|---|
| `<=>` | Cosine distance | Default; works for OpenAI, Cohere, most modern models |
| `<->` | Euclidean | Word2Vec, older models |
| `<#>` | Negative inner product | Normalized vectors; fastest |

**Pick one per table and stick to it** — the index must match the operator.

## Index choice — HNSW vs IVFFlat

| Index | Build time | Memory | Query speed | Recall | When |
|---|---|---|---|---|---|
| **HNSW** | Slow (minutes/M rows) | High | Very fast | Excellent | Dynamic data; accuracy critical |
| **IVFFlat** | Fast | Lower | Fast | Good (needs tuning) | Static / batch-loaded data; memory-bound |
| **Brute force** (no index) | None | None | Slow | Perfect | < 10k rows; testing |

```sql
-- HNSW for cosine
CREATE INDEX ON documents USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- IVFFlat for cosine
CREATE INDEX ON documents USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);  -- rule of thumb: lists = rows / 1000 (min 10)
```

Always create the index AFTER bulk-loading the data — building incrementally on a growing table is much slower.

## Query-time tuning

```sql
-- IVFFlat: how many partitions to search
SET ivfflat.probes = 10;  -- higher = better recall, slower

-- HNSW: search depth
SET hnsw.ef_search = 100;  -- higher = better recall, slower
```

Bench at multiple settings against a ground truth. There's a recall/speed knob to turn.

## Filtering — the hard part

ANN indexes don't apply WHERE filters efficiently. Naively:

```sql
SELECT * FROM documents
WHERE tenant_id = $1
ORDER BY embedding <=> $2
LIMIT 10;
```

The planner might not use the vector index if the filter is selective enough that scanning is cheaper. Or it scans the index and then filters, which is slow.

Options:
1. **Partial indexes** (one per filter cluster):
   ```sql
   CREATE INDEX ON documents USING hnsw (embedding vector_cosine_ops)
   WHERE tenant_id = 'tnt_xyz';
   ```
2. **Two-stage**: filter first with a SQL query, then re-rank with cosine in app
3. **Combined filtering via additional tables** (denormalize tenant into the vector index segment)

For multi-tenant: partial indexes per tenant are the cleanest, but only viable with few tenants.

## RAG-specific patterns

For Retrieval-Augmented Generation:

- Store the chunked source text alongside the vector (so you can return the source on hit)
- Include metadata (source URL, chunk position) for citation
- Limit chunk size (~500–1000 tokens) — bigger chunks hurt retrieval accuracy
- Re-rank with a cross-encoder if your retrieval is noisy

## Anti-patterns

- ❌ Mismatch between distance operator and index ops class
- ❌ Building HNSW on a growing table from row 1 (slow incremental builds)
- ❌ Indexing without matching to your embedding model's dimensionality
- ❌ Storing only the vector, not the source text (can't return useful results)
- ❌ Filtering before ordering when the filter is highly selective (planner needs hints)
- ❌ One huge embedding column for the whole document (chunk it; embeddings work better on focused content)
- ❌ Reusing embeddings across model versions (different models = different vector spaces; can't compare)

## Gate criteria

- Vector dimension matches the embedding model in use; documented somewhere
- Distance operator and index ops class match
- Index created after bulk-loading initial data
- Probe / ef_search settings benchmarked for the target recall
- Multi-tenant filtering strategy documented (partial indexes / two-stage / etc.)
- Source text stored alongside vectors for RAG-style return
- A test suite verifies recall against known good/bad pairs
