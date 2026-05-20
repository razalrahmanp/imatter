---
id: react-error-boundary
title: "React error boundary — per-section boundaries, fallback UI, error logging"
layer: stack
stack: react-supabase-lambda
tags: [react, error-boundary, error-handling, fallback, next-js]
applies_to:
  task_types: [add-component, add-page, modify-component]
  stages: [3, 5]
size_tokens: 195
related: [react-component, react-data-fetching, react-state-management, structured-logging]
---

# react-error-boundary — React Error Boundary Pattern

## Pattern Summary

Wrap each independent page section in its own error boundary. A failure in one section should not blank the whole page. Log errors to your error tracking service on catch.

**Shared error boundary component:**
```tsx
// src/frontend/components/ErrorBoundary.tsx
"use client";
import { Component, ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  section?: string;  // for error logging context
}
interface State { hasError: boolean; error?: Error }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    // Log to your error tracking (Sentry, CloudWatch, etc.)
    console.error("ui_component_error", {
      section: this.props.section,
      message: error.message,
      stack: info.componentStack,
    });
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback ?? (
        <div className="bg-navy-900 border border-navy-700 rounded p-4 text-navy-300 font-sans text-sm">
          Something went wrong loading this section.
          <button onClick={() => this.setState({ hasError: false })}
                  className="ml-2 text-gold-400 underline">
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
```

**Usage — wrap independent sections:**
```tsx
<ErrorBoundary section="order-list" fallback={<OrderListSkeleton />}>
  <OrderList branchId={branchId} />
</ErrorBoundary>

<ErrorBoundary section="revenue-chart">
  <RevenueChart branchId={branchId} />
</ErrorBoundary>
```

## Full Reference

### Next.js error.tsx
For route-level errors: create `app/(dashboard)/error.tsx` — Next.js uses this as the error boundary for the entire route segment. Use the class `ErrorBoundary` above for sub-section granularity within a route.

### What error boundaries DON'T catch
- Event handler errors (use try/catch in the handler)
- Async errors outside render (SWR `error` state handles fetch errors)
- Server component errors (Next.js `error.tsx` handles those)

### Forbidden
- One global error boundary wrapping the entire app — hides which section failed
- Error boundaries that swallow errors without logging
