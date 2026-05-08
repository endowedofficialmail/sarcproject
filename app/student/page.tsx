import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function todayDateString() {
  return new Date().toISOString().slice(0, 10);
}

export default async function StudentDashboardPage() {
  const supabase = createClient();

  const { data: institutes, error } = await supabase
    .from("institutes")
    .select("id, name, address, institute_types(name), benefits(id, title, description, valid_until)")
    .eq("is_active", true)
    .order("name");

  if (error) {
    return (
      <main className="mx-auto max-w-6xl p-6">
        <h1 className="text-2xl font-semibold">Institutes & Benefits</h1>
        <div className="mt-4 rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          Failed to load institutes: {error.message}
        </div>
      </main>
    );
  }

  const today = todayDateString();

  return (
    <main className="mx-auto max-w-6xl p-6">
      <h1 className="text-2xl font-semibold">Institutes & Benefits</h1>

      <section className="mt-6 grid gap-4 md:grid-cols-2">
        {institutes?.map((institute) => {
          const activeBenefits = (institute.benefits ?? []).filter((benefit) => benefit.valid_until >= today);

          return (
            <details key={institute.id} className="rounded-lg border bg-card p-4">
              <summary className="cursor-pointer list-none">
                <div className="text-lg font-semibold">{institute.name}</div>
                <div className="mt-1 text-sm text-muted-foreground">
                  Type:{" "}
                  {Array.isArray(institute.institute_types)
                    ? (institute.institute_types[0]?.name ?? "—")
                    : (institute.institute_types as { name?: string } | null)?.name ?? "—"}
                </div>
                <div className="text-sm text-muted-foreground">Address: {institute.address ?? "—"}</div>
                <div className="mt-2 text-xs text-muted-foreground">
                  {activeBenefits.length} active benefit{activeBenefits.length === 1 ? "" : "s"}
                </div>
              </summary>

              <div className="mt-4 space-y-3 border-t pt-3">
                {activeBenefits.length === 0 ? (
                  <div className="text-sm text-muted-foreground">No active benefits available.</div>
                ) : (
                  activeBenefits.map((benefit) => (
                    <div key={benefit.id} className="rounded-md border p-3">
                      <div className="font-medium">{benefit.title}</div>
                      <div className="mt-1 text-sm text-muted-foreground">
                        {benefit.description || "No description."}
                      </div>
                      <div className="mt-2 text-xs text-muted-foreground">
                        Valid until: {benefit.valid_until}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </details>
          );
        })}

        {!institutes?.length ? (
          <div className="rounded-lg border bg-card p-4 text-sm text-muted-foreground">
            No active institutes found.
          </div>
        ) : null}
      </section>
    </main>
  );
}
