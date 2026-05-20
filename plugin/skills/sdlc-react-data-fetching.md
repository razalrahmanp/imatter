---
name: sdlc-react-data-fetching
description: Use when fetching data in a React app — picks the right tool (React Query / SWR / RSC / Suspense) and covers the caching, refetching, and error patterns that prevent the most common data bugs.
---

## Rule

Don't fetch with raw `useEffect` + `useState` in 2026. Use a server-state library (React Query / SWR) or Server Components. They handle caching, deduplication, refetching on focus/reconnect, and loading/error states with two lines.

## Pick one tool

| Tool | When |
|---|---|
| **React Query (TanStack Query)** | Default for client-rendered apps; most ecosystem; best DX |
| **SWR** | Lighter weight; Vercel-flavored |
| **RTK Query** | Already using Redux Toolkit |
| **Next.js Server Components** | SSR / static or hybrid; data fetched on server, no client lib needed for that data |
| **Suspense + use** | Cutting edge; rough edges; expect more API churn |

## React Query — the standard pattern

```tsx
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

function OrderList() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["orders"],
    queryFn: () => fetch("/api/orders").then(r => r.json()),
    staleTime: 60_000,            // fresh for 1 min
  });

  if (isLoading) return <Spinner />;
  if (error) return <ErrorMessage error={error} />;
  return <ul>{data.map(o => <OrderRow key={o.id} order={o} />)}</ul>;
}
```

## Query keys — structured

```tsx
useQuery({ queryKey: ["orders", { status: "paid", tenantId }], queryFn: ... });
```

Keys are arrays; the library tracks them deeply. Two queries with the same key share a cache entry.

Conventional key shapes:

```
["users"]                              — list all
["users", { filter, sort }]            — filtered list
["users", userId]                      — one user
["users", userId, "orders"]            — nested resource
```

## Mutations — invalidate after

```tsx
const queryClient = useQueryClient();

const { mutate, isPending } = useMutation({
  mutationFn: (input) => fetch("/api/orders", { method: "POST", body: JSON.stringify(input) }),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ["orders"] });
  },
});

return <Button onClick={() => mutate({ ... })} loading={isPending}>Place order</Button>;
```

Invalidating queries triggers refetch. Don't update the cache by hand unless you need optimistic updates.

## Optimistic updates

```tsx
useMutation({
  mutationFn: cancelOrder,
  onMutate: async (orderId) => {
    await queryClient.cancelQueries({ queryKey: ["orders"] });
    const prev = queryClient.getQueryData(["orders"]);
    queryClient.setQueryData(["orders"], (old) =>
      old.map(o => o.id === orderId ? { ...o, status: "cancelled" } : o)
    );
    return { prev };
  },
  onError: (err, _vars, context) => {
    queryClient.setQueryData(["orders"], context.prev);
  },
  onSettled: () => {
    queryClient.invalidateQueries({ queryKey: ["orders"] });
  },
});
```

## Server Components (Next.js / RSC)

```tsx
// app/orders/page.tsx — server component, no client lib needed
export default async function OrdersPage() {
  const orders = await fetch("https://api/orders", { next: { revalidate: 60 } }).then(r => r.json());
  return <ul>{orders.map(o => <li key={o.id}>{o.id}</li>)}</ul>;
}
```

For server-rendered data: prefer RSC over client fetching. Less JS shipped to the client.

Mix: server-render the initial data, hydrate with React Query on the client (`hydrate` from `@tanstack/react-query` + RSC bridge).

## Error handling

| Layer | Handle |
|---|---|
| Network error (offline) | Library auto-retries; show offline indicator |
| 401 / 403 | Redirect to login; clear cache |
| 404 | Show "not found" UI |
| 5xx | Show error; let user retry |
| Validation 4xx | Show specific field errors |

```tsx
const { data, error } = useQuery({
  queryKey: ["orders"],
  queryFn: fetchOrders,
  retry: (failureCount, error) => {
    if (error.status === 401 || error.status === 404) return false; // don't retry these
    return failureCount < 3;
  },
});
```

## Pagination

```tsx
const { data, fetchNextPage, hasNextPage } = useInfiniteQuery({
  queryKey: ["orders"],
  queryFn: ({ pageParam }) => fetchOrders({ cursor: pageParam }),
  getNextPageParam: (lastPage) => lastPage.next_cursor,
});
```

See [[sdlc-api-endpoint-design]] for cursor-based pagination on the server.

## Anti-patterns

- ❌ Raw `useEffect` + `useState` for fetches (no caching, no dedup, no refetch)
- ❌ Single global `loading` state for the whole app (every render flashes)
- ❌ Fetching the same data in three components (without React Query they fire three requests)
- ❌ Stale data shown indefinitely (set staleTime to a sane value; refetch on focus)
- ❌ Mutating server state via React state (server-state library is the source of truth)
- ❌ Pessimistic UI on every mutation (slow feel)
- ❌ Optimistic updates without rollback on error (UI lies if the server rejects)
- ❌ Query keys that aren't unique to the data fetched (cache collisions)
- ❌ No retry policy (every transient blip shows error)

## Gate criteria

- A server-state library is in use (React Query / SWR / RTK Query) OR Server Components
- Manual `useEffect` data fetching is not in the codebase
- Query keys follow a consistent structure
- Mutations invalidate or update relevant queries
- Loading and error states handled per query, not globally
- Retry policy respects error types (don't retry 4xx)
