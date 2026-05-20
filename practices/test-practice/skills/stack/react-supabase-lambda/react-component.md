---
id: react-component
title: "React component — Zustand, dark navy tokens, DM Sans/Mono"
layer: stack
stack: react-supabase-lambda
tags: [react, frontend, zustand, tailwind, typescript, ui]
applies_to:
  task_types: [add-component, modify-component, add-page, add-ui]
  stages: [3, 5]
size_tokens: 230
related: [react-data-fetching, react-state-management, pii-handling]
context7_library_id: /pmndrs/zustand
---

# react-component — React Component Pattern

## Pattern Summary

All UI components follow this structure. Zustand for state, Tailwind for styling, no prop-drilling past 2 levels.

```typescript
// src/frontend/components/orders/OrderCard.tsx
import { type FC } from "react";
import { useOrderStore } from "@/stores/orderStore";

interface OrderCardProps {
  orderId: string;
  tableLabel: string;
}

export const OrderCard: FC<OrderCardProps> = ({ orderId, tableLabel }) => {
  // Zustand — never useState for shared state
  const order  = useOrderStore((s) => s.orders[orderId]);
  const update = useOrderStore((s) => s.updateStatus);

  if (!order) return null;

  return (
    <div className="bg-navy-900 rounded-lg p-4">
      <p className="text-sm font-mono text-navy-300">{tableLabel}</p>
      <p className="text-base font-sans text-white">{order.status}</p>
    </div>
  );
};
```

**Tailwind colour tokens (dark navy palette — defined in tailwind.config.ts):**
- `navy-900` — primary background (#0f172a)
- `navy-800` — card surface (#1e293b)
- `navy-300` — muted label (#94a3b8)
- `accent-amber` — CTA, status badge (#f59e0b)

**Typography:** DM Sans (`font-sans`) + DM Mono (`font-mono`), loaded via `next/font/google` in layout.tsx.

**Rules:**
- No `useState` for data shared across components — use Zustand
- No inline styles — Tailwind classes only
- No DB imports anywhere in `src/frontend/`
- Data fetching lives in `src/frontend/hooks/use{Domain}.ts`, not inside components

## Full Reference

### Zustand store shape
```typescript
// src/frontend/stores/orderStore.ts
export const useOrderStore = create<OrderState>((set) => ({
  orders: {},
  updateStatus: (id, status) =>
    set((s) => ({ orders: { ...s.orders, [id]: { ...s.orders[id], status } } })),
}));
```

### Forbidden
- `import { pool } from "../../shared/db"` in any frontend file
- Prop chains deeper than 2 levels — lift to Zustand
- `style={{ color: '#...' }}` — use Tailwind tokens
