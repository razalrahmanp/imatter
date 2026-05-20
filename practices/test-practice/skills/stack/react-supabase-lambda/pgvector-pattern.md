---
id: pgvector-pattern
title: "pgvector pattern — embedding storage, HNSW index, similarity search"
layer: stack
stack: react-supabase-lambda
tags: [pgvector, embeddings, similarity-search, hnsw, postgres, supabase]
applies_to:
  task_types: [add-feature, add-worker, add-handler]
  stages: [4, 5]
size_tokens: 210
related: [supabase-migration, rds-query, bedrock-call, supabase-rls]
---

# pgvector-pattern — pgvector Embedding and Similarity Search

## Pattern Summary

Store embeddings in Postgres with pgvector. Use HNSW index for fast approximate nearest-neighbour search. Always scope similarity queries to `branch_id` — cross-tenant similarity leaks data.

**Schema:**
```sql
-- Enable pgvector (Supabase has it pre-installed)
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE document_embeddings (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id   uuid NOT NULL REFERENCES branches(id),
  source_type text NOT NULL,      -- 'menu_item' | 'order_note' | 'knowledge_base'
  source_id   uuid NOT NULL,
  content     text NOT NULL,      -- the text that was embedded
  embedding   vector(1536),       -- dimension matches your model (Titan: 1536, Nova: 1024)
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- HNSW index — better recall than IVFFlat for most cases
-- ef_construction=128 is a good default; higher = better recall, slower build
CREATE INDEX ON document_embeddings
  USING hnsw (embedding vector_cosine_ops)
  WITH (m = 16, ef_construction = 128);

-- RLS — embeddings are tenant-scoped
ALTER TABLE document_embeddings ENABLE ROW LEVEL SECURITY;
CREATE POLICY embeddings_branch ON document_embeddings
  USING (branch_id = current_setting('app.branch_id')::uuid);
```

**Similarity search (cosine distance, lower = more similar):**
```typescript
async function findSimilar(
  db: PoolClient, embedding: number[], branchId: string, limit = 5
): Promise<{ id: string; content: string; score: number }[]> {
  const { rows } = await db.query(
    `SELECT id, content, 1 - (embedding <=> $1::vector) AS score
     FROM document_embeddings
     WHERE branch_id = $2
     ORDER BY embedding <=> $1::vector
     LIMIT $3`,
    [JSON.stringify(embedding), branchId, limit]
  );
  return rows;
}
```

## Full Reference

### Embedding model dimensions
- Amazon Titan Text Embeddings V2: 256 / 512 / 1024 (configurable)
- Amazon Nova Embed: 1024
- Cohere Embed v3: 1024
Match `vector(<dim>)` to your model. Changing dimensions requires a migration + re-embedding all rows.

### When to use IVFFlat vs HNSW
HNSW: better recall, no training phase needed, preferred for < 10M vectors.
IVFFlat: lower memory, requires `VACUUM ANALYZE` after bulk inserts to update lists.

### Forbidden
- Similarity search without `branch_id` filter (leaks embeddings across tenants)
- Storing raw PII text in `content` — embed anonymised or masked versions
