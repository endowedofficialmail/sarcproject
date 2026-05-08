import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function SchoolOverviewPage() {
  const supabase = createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return (
      <main className="mx-auto max-w-6xl p-6">
        <h1 className="text-2xl font-semibold">School Overview</h1>
        <div className="mt-4 rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          Failed to load user session.
        </div>
      </main>
    );
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("school_id")
    .eq("id", user.id)
    .eq("role", "school")
    .maybeSingle();

  if (profileError || !profile?.school_id) {
    return (
      <main className="mx-auto max-w-6xl p-6">
        <h1 className="text-2xl font-semibold">School Overview</h1>
        <div className="mt-4 rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          Failed to load school profile.
        </div>
      </main>
    );
  }

  const [{ count: totalOwnStudents, error: studentsError }, { data: institutes, error: institutesError }] =
    await Promise.all([
      supabase
        .from("students")
        .select("id", { count: "exact", head: true })
        .eq("school_id", profile.school_id),
      supabase
        .from("institutes")
        .select("id, name, address, contact_info, institute_types(name)")
        .eq("is_active", true)
        .order("name"),
    ]);

  if (studentsError || institutesError) {
    return (
      <main className="mx-auto max-w-6xl p-6">
        <h1 className="text-2xl font-semibold">School Overview</h1>
        <div className="mt-4 rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          Failed to load overview data: {studentsError?.message ?? institutesError?.message}
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-6xl p-6">
      <h1 className="text-2xl font-semibold">School Overview</h1>

      <section className="mt-6">
        <div className="max-w-sm rounded-lg border bg-card p-4">
          <div className="text-sm text-muted-foreground">Total Own Students</div>
          <div className="mt-2 text-3xl font-semibold">{(totalOwnStudents ?? 0).toLocaleString()}</div>
        </div>
      </section>

      <section className="mt-8 rounded-lg border bg-card">
        <div className="border-b p-4">
          <h2 className="text-lg font-medium">Active Institutes</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b bg-muted/40">
              <tr>
                <th className="p-3 font-medium">Institute</th>
                <th className="p-3 font-medium">Type</th>
                <th className="p-3 font-medium">Address</th>
                <th className="p-3 font-medium">Contact</th>
              </tr>
            </thead>
            <tbody>
              {institutes?.map((institute) => (
                <tr key={institute.id} className="border-b">
                  <td className="p-3">{institute.name}</td>
                  <td className="p-3 text-muted-foreground">
                    {Array.isArray(institute.institute_types)
                      ? (institute.institute_types[0]?.name ?? "—")
                      : (institute.institute_types as { name?: string } | null)?.name ?? "—"}
                  </td>
                  <td className="p-3 text-muted-foreground">{institute.address ?? "—"}</td>
                  <td className="p-3 text-muted-foreground">{institute.contact_info ?? "—"}</td>
                </tr>
              ))}
              {!institutes?.length ? (
                <tr>
                  <td colSpan={4} className="p-4 text-center text-muted-foreground">
                    No active institutes found.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
