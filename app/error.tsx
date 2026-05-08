"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();

  useEffect(() => {
    // Server-side only logging should stay in route handlers; this helps local debugging.
    // eslint-disable-next-line no-console
    console.error(error);
  }, [error]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-md rounded-lg border bg-card p-6 shadow-sm">
        <h1 className="text-xl font-semibold">Something went wrong</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          An unexpected error occurred. Please try again or go back.
        </p>

        <div className="mt-5 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => router.back()}
            className="h-9 rounded-md border border-border px-3 text-sm font-medium text-slate-700 hover:bg-muted"
          >
            Go back
          </button>
          <button
            type="button"
            onClick={() => reset()}
            className="h-9 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground"
          >
            Try again
          </button>
        </div>
      </div>
    </main>
  );
}
