'use client';

import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Unhandled application error:', error);
  }, [error]);

  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center text-center px-6">
      <p className="text-5xl font-black cc-gradient-text mb-4">Something broke</p>
      <h1 className="text-xl font-bold mb-2">An unexpected error occurred</h1>
      <p className="text-muted mb-8 max-w-md">
        The error has been logged. You can retry, or head back home if the problem persists.
      </p>
      <div className="flex gap-3">
        <button onClick={reset} className="cc-btn-primary">Try again</button>
        <a href="/" className="cc-btn-ghost">Go home</a>
      </div>
    </div>
  );
}
