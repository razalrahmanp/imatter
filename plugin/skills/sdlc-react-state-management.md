---
name: sdlc-react-state-management
description: Use when deciding where state should live in a React app — covers the state types, the location decisions, and when to reach for a global store.
---

## Rule

State has a natural location based on who needs it. Start local; lift only when two components need it; reach for context for cross-cutting concerns; reach for a global store only when truly app-wide. Server state is its own category (see [[sdlc-react-data-fetching]]).

## State taxonomy

| Type | What | Where to put it |
|---|---|---|
| **UI state** | Local component state (open/closed, focused, hover) | `useState` in the component |
| **Form state** | Field values, validation, submission | Form library (react-hook-form, formik) or `useState` for simple |
| **Shared UI state** | Two siblings need same value | Lift to common parent; or context if deep |
| **URL state** | Route, query string | Router (`useSearchParams`, `useParams`) |
| **Server state** | Data fetched from API | React Query / SWR / RTK Query — separate from local state |
| **Auth state** | Current user, token | Context + persist to storage |
| **Theme / preferences** | Dark mode, locale, font size | Context + localStorage |
| **Cross-feature state** | Cart, recent searches, draft | Zustand / Jotai / Redux |

## Decision tree

```
Does this state belong to one component?
├─ Yes → useState in that component. Done.
└─ No →
   Do siblings need it?
   ├─ Yes (within ~3 levels deep) → Lift to common parent
   └─ Yes (deep tree) → Context
   Is it the URL?
   └─ useSearchParams / useParams
   Is it from a server?
   └─ React Query / SWR
   Is it truly app-wide cross-feature state?
   └─ Zustand / Jotai
```

## Local state — useState / useReducer

```tsx
function SearchBar() {
  const [query, setQuery] = useState("");
  return <input value={query} onChange={(e) => setQuery(e.target.value)} />;
}
```

For complex local state with multiple related fields → `useReducer`:

```tsx
function reducer(state, action) {
  switch (action.type) {
    case "set_field": return { ...state, [action.field]: action.value };
    case "reset": return initialState;
  }
}

const [state, dispatch] = useReducer(reducer, initialState);
```

## Lifted state

```tsx
function Parent() {
  const [filter, setFilter] = useState("");
  return (
    <>
      <FilterInput value={filter} onChange={setFilter} />
      <FilteredList filter={filter} />
    </>
  );
}
```

Lift only as high as needed. Lifting too high (every state in App.tsx) makes the app a re-render fest.

## Context — for cross-tree concerns

```tsx
const ThemeContext = createContext<"light" | "dark">("light");

function App() {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  return (
    <ThemeContext.Provider value={theme}>
      <Layout />
    </ThemeContext.Provider>
  );
}

function Button() {
  const theme = useContext(ThemeContext);
  return <button className={`btn-${theme}`}>Click</button>;
}
```

Context gotcha: every consumer re-renders when the value changes. Don't put rapidly-changing state in context. Split contexts (one for state, one for setters) if necessary.

## Zustand — minimal global store

```tsx
import { create } from "zustand";

const useCartStore = create((set) => ({
  items: [],
  addItem: (item) => set((state) => ({ items: [...state.items, item] })),
  removeItem: (id) => set((state) => ({ items: state.items.filter(i => i.id !== id) })),
  clear: () => set({ items: [] }),
}));

function Cart() {
  const items = useCartStore((s) => s.items);
  const remove = useCartStore((s) => s.removeItem);
  return <ul>{items.map(i => <li key={i.id} onClick={() => remove(i.id)}>{i.name}</li>)}</ul>;
}
```

Zustand is minimal, no provider boilerplate, easy to reason about. Default for new apps that need global state.

## Don't reach for Redux unless...

- The team already uses Redux extensively
- You need redux-devtools time-travel debugging in production scenarios
- You have legitimate need for middleware (saga, observable)

Otherwise Zustand or Jotai is enough.

## Persisting state

```tsx
const [theme, setTheme] = useState(() => localStorage.getItem("theme") || "light");

useEffect(() => {
  localStorage.setItem("theme", theme);
}, [theme]);
```

Or with Zustand persist middleware. Auth tokens: HttpOnly cookies (XSS-safe) preferred over localStorage.

## Anti-patterns

- ❌ Global store for state that's only used in one feature
- ❌ State in URL when it should be local (modal open state in URL = ugly)
- ❌ Local state for shared concerns (cart in CartIcon component only — other components can't see it)
- ❌ Mirror server state in client state ("sync" them manually — diverges; let React Query own it)
- ❌ One huge context with everything ("AppContext") — every consumer re-renders on any change
- ❌ Refs as state (`useRef`) when you need re-renders
- ❌ State derivation in `useEffect` (use derived computation with `useMemo` or inline)
- ❌ Storing computed/derived values (compute from source on render)

## Gate criteria

- State location chosen by the decision tree, not by habit
- Server state is in a server-state library, not in `useState`
- Context used only for genuinely tree-wide concerns
- A single global store choice (Zustand / Jotai / Redux) — don't mix
- Persisted state has a documented serialization format
- No `useEffect` for derived values
