"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
}) {
  const router = useRouter();

  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error(error);
  }, [error]);

  return (
    <html lang="en">
      <body className="min-h-screen bg-background text-foreground">
        <main className="flex min-h-screen items-center justify-center p-4">
          <div className="w-full max-w-md rounded-lg border bg-card p-6 shadow-sm">
            <h1 className="text-xl font-semibold">Something went wrong</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              An unexpected error occurred. Please try again or go back.
            </p>
            <div className="mt-5">
              <button
                type="button"
                onClick={() => router.back()}
                className="h-9 rounded-md border border-border px-3 text-sm font-medium text-slate-700 hover:bg-muted"
              >
                Go back
              </button>
            </div>
          </div>
        </main>
      </body>
    </html>
  );
}
