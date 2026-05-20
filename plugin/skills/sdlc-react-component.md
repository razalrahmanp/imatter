---
name: sdlc-react-component
description: Use when writing a new React component — covers the shape (props, types, structure), what to extract, what to skip, and the patterns that keep components maintainable.
---

## Rule

A React component is a function that takes props, renders JSX, and may use hooks. Keep components small and focused; lift state up when needed but no further; type props strictly; separate presentational from logic-heavy when it helps.

## Shape — the standard

```tsx
import { useState } from "react";

interface ButtonProps {
  variant?: "primary" | "secondary" | "ghost";
  size?: "sm" | "md" | "lg";
  disabled?: boolean;
  loading?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
}

export function Button({
  variant = "primary",
  size = "md",
  disabled,
  loading,
  onClick,
  children,
}: ButtonProps) {
  return (
    <button
      type="button"
      className={cn("btn", `btn-${variant}`, `btn-${size}`, {
        "btn-disabled": disabled,
        "btn-loading": loading,
      })}
      disabled={disabled || loading}
      onClick={onClick}
    >
      {loading ? <Spinner /> : children}
    </button>
  );
}
```

## Naming

- `PascalCase.tsx` for component files
- Filename matches the default export (`Button.tsx` exports `Button`)
- Hooks: `useCamelCase`
- Subcomponents: same file if small; separate file if large

## State — where it lives

| Where | When |
|---|---|
| Component-local (`useState`) | UI state; no other component cares |
| Lifted to parent | Two siblings need the same state |
| Context | More than ~3 levels of prop-drilling |
| Global store (Zustand, Redux, Jotai) | App-wide state (current user, theme) |
| URL (router state) | Shareable / bookmark-able state |
| Server state (React Query, SWR, RTK Query) | Anything fetched from a server |

Default to local. Lift only when needed. Don't reach for context or Redux on day 1.

## Server state — separate from UI state

```tsx
// React Query / TanStack Query
function OrderList() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["orders"],
    queryFn: fetchOrders,
  });

  if (isLoading) return <Spinner />;
  if (error) return <ErrorMessage error={error} />;
  return <ul>{data.map(o => <OrderRow key={o.id} order={o} />)}</ul>;
}
```

Don't manually `useEffect` + `useState` for fetches. Use the library — it handles caching, refetching, deduplication.

## Effects — last resort

`useEffect` is for synchronizing with external systems (timers, subscriptions, manual DOM, server). Most code that *looks* like an effect is actually:

- A derived value → compute it inline or with `useMemo`
- An event handler → put it in the handler, not an effect
- Initial data → fetch in a server component (Next.js) or React Query

```tsx
// ❌ Wrong
const [total, setTotal] = useState(0);
useEffect(() => {
  setTotal(items.reduce((a, b) => a + b.price, 0));
}, [items]);

// ✅ Right — derived value
const total = useMemo(() => items.reduce((a, b) => a + b.price, 0), [items]);
```

## Keys

`key` is for React's reconciliation — must be stable, unique among siblings, and the same identity across renders. Use the data's ID; never index unless the list is truly never reordered or modified.

```tsx
// ❌ Wrong
{orders.map((o, i) => <Row key={i} order={o} />)}

// ✅ Right
{orders.map(o => <Row key={o.id} order={o} />)}
```

## When to split a component

Split when:
- It hits ~150 lines (split before file-size becomes painful)
- A subtree has its own state lifecycle
- A piece is reused elsewhere
- A piece is independently testable

Don't split when:
- The subtree has no independent meaning
- Splitting just makes the parent harder to read

## Anti-patterns

- ❌ `any` for props
- ❌ Inline event handlers that recreate every render (`onClick={() => setX(x + 1)}` — fine; but if passed to memoized children, breaks memo)
- ❌ `useEffect` for derived state (use `useMemo` or inline)
- ❌ `useEffect` to "make this run on mount" (often a fetch — use React Query)
- ❌ Index as key on a dynamic list
- ❌ Putting all components in `App.tsx`
- ❌ Premature memoization (`React.memo`, `useCallback`, `useMemo` everywhere — benchmark first)
- ❌ Class components for new code (functions + hooks since 2019)
- ❌ Spreading unknown props (`<button {...props}>`) — accidentally passes wrong attrs to DOM

## Gate criteria

- Components are functions, with typed Props interfaces
- State location chosen deliberately (local → lifted → context → store)
- Server state via React Query / SWR / equivalent — not manual useEffect
- Keys are stable IDs, not indexes
- Files under ~150 lines; split when bigger
- Accessibility ([[sdlc-accessibility-wcag]]) baked in: semantic HTML, ARIA where needed, keyboard support
