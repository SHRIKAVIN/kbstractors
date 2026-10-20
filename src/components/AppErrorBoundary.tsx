import { Component, type ErrorInfo, type ReactNode } from 'react';

interface State {
  error: Error | null;
}

/**
 * Catches render crashes so the app never goes to a blank screen. Shows the
 * actual error (so it can be reported) with a way to reload.
 */
export class AppErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('App crashed:', error, info.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <div className="kbs-app flex min-h-screen flex-col items-center justify-center px-6 text-center">
        <img src="/icons/kbs-tractors-96.png" alt="" className="h-16 w-16 rounded-full ring-1 ring-line/15" />
        <h1 className="mt-6 text-[19px] font-semibold tracking-tight">Something went wrong</h1>
        <p className="mt-2 max-w-sm text-[13.5px] text-fog/55">ஏதோ தவறு நடந்துவிட்டது. மீண்டும் ஏற்றவும்.</p>
        <pre className="mt-5 max-h-40 w-full max-w-sm overflow-auto whitespace-pre-wrap break-words rounded-2xl bg-line/[0.05] p-3 text-left font-mono text-[11.5px] text-coral-300 ring-1 ring-inset ring-line/10">
          {error.message || String(error)}
        </pre>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="kbs-press mt-6 h-12 rounded-full bg-brand px-6 text-[14px] font-semibold text-brand-fg"
        >
          Reload
        </button>
      </div>
    );
  }
}
