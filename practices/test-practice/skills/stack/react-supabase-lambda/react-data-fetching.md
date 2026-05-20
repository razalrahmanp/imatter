---
id: react-data-fetching
title: "React data fetching — SWR pattern, optimistic updates, error boundary integration"
layer: stack
stack: react-supabase-lambda
tags: [react, swr, data-fetching, optimistic-update, loading-state, next-js]
applies_to:
  task_types: [add-component, add-page, modify-component]
  stages: [3, 5]
size_tokens: 210
related: [react-component, react-state-management, react-error-boundary]
---

# react-data-fetching — React Data Fetching Pattern

## Pattern Summary

Use SWR for all server state. Never store server data in useState. Use optimistic updates for mutations. Handle loading and error states explicitly — never let a spinner hang indefinitely.

**SWR fetcher setup (shared utility):**
```typescript
// src/frontend/lib/fetcher.ts
export const fetcher = async <T>(url: string): Promise<T> => {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${getSessionToken()}` },
  });
  if (!res.ok) {
    const error = await res.json().catch(() => ({ message: res.statusText }));
    throw Object.assign(new Error(error.message), { status: res.status, info: error });
  }
  return res.json();
};
```

**Data fetching hook:**
```typescript
import useSWR from "swr";

export function useOrders(branchId: string) {
  const { data, error, isLoading, mutate } = useSWR<Order[]>(
    branchId ? `/api/orders?branch_id=${branchId}` : null,  // null = don't fetch
    fetcher,
    { refreshInterval: 30_000 }  // auto-refresh every 30s for real-time-ish data
  );
  return { orders: data ?? [], error, isLoading, mutate };
}
```

**Optimistic mutation:**
```typescript
async function cancelOrder(orderId: string) {
  // Optimistic update — update UI immediately
  await mutate(
    (current) => current?.filter((o) => o.id !== orderId),
    { revalidate: false }  // don't re-fetch until confirmed
  );
  try {
    await fetch(`/api/orders/${orderId}/cancel`, { method: "POST", headers: authHeaders() });
    await mutate();  // re-fetch to confirm server state
  } catch (err) {
    await mutate();  // revert — re-fetch real server state on failure
    throw err;
  }
}
```

## Full Reference

### Loading states
Always render a skeleton or spinner when `isLoading`. Never show an empty state that looks like "no data" when data is still loading — users will think the page is broken.

### Error states
`error` from useSWR is the thrown Error object. Check `error.status` for 401/403 to redirect to login vs show an error message.

### Forbidden
- `useEffect` + `useState` for data fetching (use SWR)
- `mutate()` without error handling (failed mutations must revert or show error)
- Fetching data without authentication headers
