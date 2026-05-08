import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function StudentMyClaimsPage() {
  const supabase = createClient();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return (
      <main className="mx-auto max-w-6xl p-6">
        <h1 className="text-2xl font-semibold">My Claims</h1>
        <div className="mt-4 rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          Failed to load user session.
        </div>
      </main>
    );
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("student_id")
    .eq("id", user.id)
    .eq("role", "student")
    .single();

  if (profileError || !profile?.student_id) {
    return (
      <main className="mx-auto max-w-6xl p-6">
        <h1 className="text-2xl font-semibold">My Claims</h1>
        <div className="mt-4 rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          Failed to resolve student profile.
        </div>
      </main>
    );
  }

  const { data: claims, error: claimsError } = await supabase
    .from("benefit_claims")
    .select("id, claimed_at, benefits(title), institutes(name)")
    .eq("student_id", profile.student_id)
    .order("claimed_at", { ascending: false });

  if (claimsError) {
    return (
      <main className="mx-auto max-w-6xl p-6">
        <h1 className="text-2xl font-semibold">My Claims</h1>
        <div className="mt-4 rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          Failed to load claim history: {claimsError.message}
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-6xl p-6">
      <h1 className="text-2xl font-semibold">My Claims</h1>

      <section className="mt-6 overflow-x-auto rounded-lg border bg-card">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b bg-muted/40">
            <tr>
              <th className="p-3 font-medium">Benefit Title</th>
              <th className="p-3 font-medium">Institute Name</th>
              <th className="p-3 font-medium">Claimed Date</th>
            </tr>
          </thead>
          <tbody>
            {claims?.map((claim) => (
              <tr key={claim.id} className="border-b">
                <td className="p-3">
                  {Array.isArray(claim.benefits)
                    ? (claim.benefits[0]?.title ?? "—")
                    : (claim.benefits as { title?: string } | null)?.title ?? "—"}
                </td>
                <td className="p-3 text-muted-foreground">
                  {Array.isArray(claim.institutes)
                    ? (claim.institutes[0]?.name ?? "—")
                    : (claim.institutes as { name?: string } | null)?.name ?? "—"}
                </td>
                <td className="p-3 text-muted-foreground">
                  {new Date(claim.claimed_at).toLocaleString("en-PK", {
                    year: "numeric",
                    month: "short",
                    day: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </td>
              </tr>
            ))}
            {!claims?.length ? (
              <tr>
                <td colSpan={3} className="p-4 text-center text-muted-foreground">
                  No claims found.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>
    </main>
  );
}
