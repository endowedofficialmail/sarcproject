import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

async function getCount(supabase: ReturnType<typeof createClient>, table: string) {
  const { count, error } = await supabase
    .from(table)
    .select("*", { count: "exact", head: true });

  if (error) throw error;
  return count ?? 0;
}

function getErrorMessage(err: unknown) {
  if (err instanceof Error) return err.message;
  if (typeof err === "object" && err !== null) {
    const maybeError = err as { message?: string; details?: string; hint?: string; code?: string };
    return (
      maybeError.message ||
      maybeError.details ||
      maybeError.hint ||
      maybeError.code ||
      JSON.stringify(maybeError)
    );
  }
  return String(err);
}

export default async function AdminOverviewPage() {
  const supabase = createClient();

  try {
    const [totalSchools, totalInstitutes, totalStudents, activeBenefits] =
      await Promise.all([
        getCount(supabase, "schools"),
        getCount(supabase, "institutes"),
        getCount(supabase, "students"),
        (async () => {
          // Treat "active benefits" as unexpired benefits (valid_until >= today).
          // This avoids relying on a nullable/optional is_active column.
          const today = new Date().toISOString().slice(0, 10);
          const { count, error } = await supabase
            .from("benefits")
            .select("*", { count: "exact", head: true })
            .gte("valid_until", today);

          if (error) throw error;
          return count ?? 0;
        })(),
      ]);

    return (
      <main className="mx-auto max-w-6xl p-6">
        <h1 className="text-2xl font-semibold">Overview</h1>

        <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Total Schools" value={totalSchools} />
          <StatCard label="Total Institutes" value={totalInstitutes} />
          <StatCard label="Total Students" value={totalStudents} />
          <StatCard label="Total Active Benefits" value={activeBenefits} />
        </section>
      </main>
    );
  } catch (err: unknown) {
    const message = getErrorMessage(err);

    return (
      <main className="mx-auto max-w-3xl p-6">
        <h1 className="text-2xl font-semibold">Overview</h1>
        <div className="mt-6 rounded-lg border border-destructive/30 bg-destructive/10 p-4">
          <div className="text-sm font-medium text-destructive">Failed to load overview stats</div>
          <pre className="mt-2 overflow-auto text-xs text-destructive/90">{message}</pre>
        </div>
      </main>
    );
  }
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className="mt-2 text-3xl font-semibold">{value.toLocaleString("en-US")}</div>
    </div>
  );
}

