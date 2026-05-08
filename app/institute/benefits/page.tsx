import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function InstituteBenefitsPage() {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <main className="rounded-lg border bg-card p-6 text-sm text-destructive">
        Unable to load user session.
      </main>
    );
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("institute_id")
    .eq("id", user.id)
    .eq("role", "institute")
    .maybeSingle();

  if (!profile?.institute_id) {
    return (
      <main className="rounded-lg border bg-card p-6 text-sm text-destructive">
        Unable to resolve institute profile.
      </main>
    );
  }

  const { data: benefits, error } = await supabase
    .from("benefits")
    .select("id, title, description, valid_until, reset_period")
    .eq("institute_id", profile.institute_id)
    .order("created_at", { ascending: false });

  if (error) {
    return (
      <main className="rounded-lg border bg-card p-6 text-sm text-destructive">
        Failed to load benefits: {error.message}
      </main>
    );
  }

  return (
    <main className="rounded-lg border bg-card">
      <div className="border-b px-4 py-3 text-sm font-medium">My Benefits</div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b bg-muted/40">
            <tr>
              <th className="p-3 font-medium">Title</th>
              <th className="p-3 font-medium">Description</th>
              <th className="p-3 font-medium">Valid Until</th>
              <th className="p-3 font-medium">Reset Period</th>
            </tr>
          </thead>
          <tbody>
            {benefits?.map((benefit) => (
              <tr key={benefit.id} className="border-b">
                <td className="p-3">{benefit.title}</td>
                <td className="p-3 text-muted-foreground">{benefit.description ?? "—"}</td>
                <td className="p-3 text-muted-foreground">{benefit.valid_until}</td>
                <td className="p-3 text-muted-foreground">{benefit.reset_period}</td>
              </tr>
            ))}
            {!benefits?.length ? (
              <tr>
                <td colSpan={4} className="p-4 text-center text-muted-foreground">
                  No benefits found.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </main>
  );
}
