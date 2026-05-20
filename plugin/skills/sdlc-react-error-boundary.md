---
name: sdlc-react-error-boundary
description: Use when adding error boundaries to a React app — covers where to place them, what they can and can't catch, and how to report errors without losing user context.
---

## What error boundaries do

Catch errors in the React render tree below them. Show fallback UI instead of unmounting the whole app. Report errors to an error tracker.

## What error boundaries do NOT catch

- Errors in event handlers (`onClick`, `onChange`, etc.) — wrap those in try/catch yourself
- Errors in async code (`setTimeout`, fetch callbacks) — same
- Errors during server-side rendering (RSC, Next.js SSR) — separate handling
- Errors thrown in the error boundary itself

## Pattern — class boundary (no functional API yet)

```tsx
import { Component, ErrorInfo, ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback: (error: Error, retry: () => void) => ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Report to Sentry / Bugsnag / etc.
    reportError(error, { componentStack: info.componentStack });
  }

  retry = () => this.setState({ error: null });

  render() {
    if (this.state.error) return this.props.fallback(this.state.error, this.retry);
    return this.props.children;
  }
}
```

Or use `react-error-boundary` library (cleaner API):

```tsx
import { ErrorBoundary } from "react-error-boundary";

<ErrorBoundary
  fallback={<div>Something went wrong. <button onClick={resetBoundary}>Try again</button></div>}
  onError={(error, info) => reportError(error, info)}
>
  <FlakyFeature />
</ErrorBoundary>
```

## Where to place boundaries

| Level | Purpose |
|---|---|
| **Root (App)** | Catch-all so the app doesn't go blank |
| **Per-route** | Failed route doesn't take down the app |
| **Per-feature widget** | One widget on the dashboard fails; the rest works |
| **Inside risky third-party** | Iframe-like isolation around code you don't fully trust |

**Don't put a boundary around every component.** Boundaries are for *significant unit failures* — when isolation has user-visible value.

## Fallback design

| Severity | Fallback |
|---|---|
| Root level | Generic "Something went wrong" page with reload button |
| Route level | "This page failed to load" with link back to home |
| Widget level | "Couldn't load this section" with retry button |

Always include:
- What happened ("Couldn't load orders")
- What the user can do (retry, refresh, contact support)
- A way to recover (button, link)
- A request ID so support can look up logs

```tsx
<ErrorBoundary
  fallback={(error, retry) => (
    <div role="alert">
      <h2>Couldn't load orders</h2>
      <p>Try again, or refresh the page. If this keeps happening, contact support and mention ID {error.requestId}.</p>
      <button onClick={retry}>Retry</button>
    </div>
  )}
>
  <OrderList />
</ErrorBoundary>
```

## Reporting — give Sentry enough context

```tsx
componentDidCatch(error: Error, info: ErrorInfo) {
  Sentry.withScope((scope) => {
    scope.setTag("component", "OrderList");
    scope.setExtra("componentStack", info.componentStack);
    scope.setUser({ id: currentUser?.id });  // safe ID, not PII
    Sentry.captureException(error);
  });
}
```

Configure Sentry's `beforeSend` to strip PII from `event.exception.values[].stacktrace` if local variables contain it.

## Suspense + error boundaries

In React with Suspense for data fetching:

```tsx
<ErrorBoundary fallback={...}>
  <Suspense fallback={<Spinner />}>
    <FeatureThatSuspends />
  </Suspense>
</ErrorBoundary>
```

Order matters: `ErrorBoundary` outside `Suspense`. Errors thrown during suspended fetches bubble up to the nearest error boundary.

## Server-side handling

Error boundaries work in SSR too, but Next.js has its own pattern:

- `app/error.tsx` — per-route error boundary (Next.js App Router)
- `app/global-error.tsx` — root-level (replaces the entire HTML)

For RSC: errors thrown in async server components bubble to the `error.tsx` file in the same route segment.

## Anti-patterns

- ❌ One boundary at the root only (any error shows the same generic page)
- ❌ Boundary around every component (over-defensive; obscures real issues)
- ❌ Hiding errors with empty fallback (`fallback={null}`) — users see broken UI with no explanation
- ❌ Not reporting to error tracker (boundary catches; you never know it fired)
- ❌ Including PII in the reported error context
- ❌ Boundary that re-throws or doesn't actually catch (broken)
- ❌ No retry mechanism in fallback (user has to refresh)
- ❌ Catching event-handler errors with a boundary (it can't; use try/catch)

## Gate criteria

- An ErrorBoundary at the root of the app
- Boundaries per major route or per major feature widget
- Fallback UI includes a retry button and a way to contact support
- Errors reported to a tracker (Sentry / Bugsnag / Rollbar) with component stack and user ID
- `beforeSend` filter strips PII
- Suspense boundaries are wrapped by ErrorBoundary
- A test exists that throws inside a boundary and verifies fallback renders + tracker called
