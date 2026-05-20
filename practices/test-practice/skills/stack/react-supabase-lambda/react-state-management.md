---
id: react-state-management
title: "React state management — Zustand for UI state, SWR for server state, no Redux"
layer: stack
stack: react-supabase-lambda
tags: [react, zustand, state-management, ui-state, next-js]
applies_to:
  task_types: [add-component, add-page, modify-component]
  stages: [3, 5]
size_tokens: 200
related: [react-component, react-data-fetching, react-error-boundary]
---

# react-state-management — React State Management Pattern

## Pattern Summary

State is split by ownership: SWR owns server state; Zustand owns client-only UI state. Never duplicate server state into Zustand — it creates sync bugs.

**State type → tool mapping:**
```
Server state (orders, menu, branch config)  → SWR  (see react-data-fetching skill)
UI state (drawer open, selected filter, toast queue) → Zustand
Form state                                   → React Hook Form (local, not global)
Ephemeral component state (hover, focus)    → useState
```

**Zustand store pattern:**
```typescript
// src/frontend/store/ui.ts
import { create } from "zustand";

interface UiStore {
  // Drawer
  drawerOpen:   boolean;
  drawerContent: React.ReactNode | null;
  openDrawer:   (content: React.ReactNode) => void;
  closeDrawer:  () => void;

  // Toast queue
  toasts: { id: string; message: string; type: "success" | "error" }[];
  addToast:    (message: string, type?: "success" | "error") => void;
  removeToast: (id: string) => void;
}

export const useUiStore = create<UiStore>((set) => ({
  drawerOpen: false,
  drawerContent: null,
  openDrawer:  (content) => set({ drawerOpen: true, drawerContent: content }),
  closeDrawer: ()        => set({ drawerOpen: false, drawerContent: null }),

  toasts: [],
  addToast: (message, type = "success") =>
    set((s) => ({ toasts: [...s.toasts, { id: crypto.randomUUID(), message, type }] })),
  removeToast: (id) =>
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));
```

**Consuming the store:**
```typescript
// Use selectors to avoid unnecessary re-renders
const drawerOpen = useUiStore((s) => s.drawerOpen);
const closeDrawer = useUiStore((s) => s.closeDrawer);
```

## Full Reference

### What NOT to put in Zustand
- Data fetched from the server (use SWR)
- Form field values (use React Hook Form)
- Auth state (use a dedicated auth context or SWR with a session key)

### Store organisation
Keep stores small and domain-scoped: `useUiStore` for shell chrome, `useKitchenStore` for kitchen-display-specific state. One giant store becomes a maintenance problem.

### Forbidden
- Putting server data in Zustand and manually syncing with the API
- Using Redux (no Redux in this stack — Zustand is the standard)
