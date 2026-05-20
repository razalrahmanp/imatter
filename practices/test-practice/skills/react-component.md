# react-component — React Component Pattern

## Pattern Summary

All UI components follow this structure. Zustand for state, no prop-drilling past 2 levels.

```typescript
// src/frontend/components/orders/OrderCard.tsx
import { type FC } from "react";
import { useOrderStore } from "@/stores/orderStore";

interface OrderCardProps {
  orderId: string;
  tableLabel: string;
}

export const OrderCard: FC<OrderCardProps> = ({ orderId, tableLabel }) => {
  // State from Zustand — never useState for shared state
  const order = useOrderStore((s) => s.orders[orderId]);
  const updateStatus = useOrderStore((s) => s.updateStatus);

  if (!order) return null;

  return (
    <div className="bg-navy-900 rounded-lg p-4 font-sans">
      <p className="text-sm font-mono text-navy-300">{tableLabel}</p>
      <p className="text-base text-white">{order.status}</p>
    </div>
  );
};
```

**Typography (DM Sans + DM Mono — always loaded via next/font):**
```typescript
// src/frontend/app/layout.tsx — loaded once, applied via CSS variables
import { DM_Sans, DM_Mono } from "next/font/google";
const dmSans = DM_Sans({ subsets: ["latin"], variable: "--font-sans" });
const dmMono = DM_Mono({ weight: ["400"], subsets: ["latin"], variable: "--font-mono" });
// className: `${dmSans.variable} ${dmMono.variable}`
```

**Tailwind colour tokens (dark navy palette — defined in tailwind.config.ts):**
- `navy-900` — primary background (#0f172a)
- `navy-800` — card surface (#1e293b)
- `navy-300` — muted label text (#94a3b8)
- `accent-amber` — CTA, status badge (#f59e0b)

## Full Reference

### Zustand store shape
```typescript
// src/frontend/stores/orderStore.ts
import { create } from "zustand";

interface OrderState {
  orders: Record<string, Order>;
  updateStatus: (id: string, status: OrderStatus) => void;
}

export const useOrderStore = create<OrderState>((set) => ({
  orders: {},
  updateStatus: (id, status) =>
    set((s) => ({ orders: { ...s.orders, [id]: { ...s.orders[id], status } } })),
}));
```

### Rules
- No `useState` for data shared across components — use Zustand
- No inline styles — Tailwind classes only
- No DB imports in any file under `src/frontend/`
- Components are pure presentational or Zustand-connected — no fetch logic inside components
- Data fetching lives in `src/frontend/hooks/use{Domain}.ts` (SWR or React Query)

### Forbidden
- `import { pool } from "../../shared/db"` — frontend never touches DB
- Prop chains deeper than 2 levels — lift to Zustand
- `style={{ color: '#...' }}` — use Tailwind tokens
