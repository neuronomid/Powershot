"use client";

import React from "react";

type Props = {
  children: React.ReactNode;
};

type State = {
  hasError: boolean;
};

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-[50dvh] flex-col items-center justify-center gap-6 p-8 text-center">
          <div className="flex size-16 items-center justify-center rounded-2xl bg-destructive/10">
            <span className="text-2xl" role="img" aria-label="Warning">
              ⚠️
            </span>
          </div>
          <div className="space-y-2">
            <h2 className="font-heading text-xl font-bold tracking-tight">
              Something went wrong
            </h2>
            <p className="mx-auto max-w-md text-sm font-medium text-muted-foreground">
              An unexpected error occurred. If this keeps happening, try
              reloading the page.
            </p>
          </div>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="rounded-full bg-primary px-6 py-2.5 text-sm font-bold text-primary-foreground shadow-lg transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            Reload page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
