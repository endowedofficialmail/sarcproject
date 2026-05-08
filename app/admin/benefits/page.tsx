import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const RESET_PERIODS = [
  { value: "one_time", label: "One-time" },
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "yearly", label: "Yearly" },
] as const;

function buildErrorRedirect(message: string) {
  return `/admin/benefits?error=${encodeURIComponent(message)}`;
}

async function addBenefit(formData: FormData) {
  "use server";

  const supabase = createClient();

  const instituteId = String(formData.get("institute_id") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const validUntil = String(formData.get("valid_until") ?? "").trim();
  const resetPeriod = String(formData.get("reset_period") ?? "").trim();

  if (!instituteId) redirect(buildErrorRedirect("Institute is required."));
  if (!title) redirect(buildErrorRedirect("Benefit title is required."));
  if (!validUntil) redirect(buildErrorRedirect("Valid until date is required."));
  if (!resetPeriod) redirect(buildErrorRedirect("Reset period is required."));

  const { error } = await supabase.from("benefits").insert({
    institute_id: instituteId,
    title,
    description: description || null,
    valid_until: validUntil,
    reset_period: resetPeriod,
  });

  if (error) redirect(buildErrorRedirect(error.message));

  revalidatePath("/admin/benefits");
}

async function updateBenefit(formData: FormData) {
  "use server";

  const supabase = createClient();

  const id = String(formData.get("id") ?? "").trim();
  const instituteId = String(formData.get("institute_id") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const validUntil = String(formData.get("valid_until") ?? "").trim();
  const resetPeriod = String(formData.get("reset_period") ?? "").trim();

  if (!id) redirect(buildErrorRedirect("Benefit id is required."));
  if (!instituteId) redirect(buildErrorRedirect("Institute is required."));
  if (!title) redirect(buildErrorRedirect("Benefit title is required."));
  if (!validUntil) redirect(buildErrorRedirect("Valid until date is required."));
  if (!resetPeriod) redirect(buildErrorRedirect("Reset period is required."));

  const { error } = await supabase
    .from("benefits")
    .update({
      institute_id: instituteId,
      title,
      description: description || null,
      valid_until: validUntil,
      reset_period: resetPeriod,
    })
    .eq("id", id);

  if (error) redirect(buildErrorRedirect(error.message));

  revalidatePath("/admin/benefits");
}

async function deleteBenefit(formData: FormData) {
  "use server";

  const supabase = createClient();
  const id = String(formData.get("id") ?? "").trim();

  if (!id) redirect(buildErrorRedirect("Benefit id is required."));

  const { count: claimsCount, error: claimsCheckError } = await supabase
    .from("benefit_claims")
    .select("id", { head: true, count: "exact" })
    .eq("benefit_id", id);

  if (claimsCheckError) {
    redirect(buildErrorRedirect(claimsCheckError.message));
  }

  if ((claimsCount ?? 0) > 0) {
    redirect(
      buildErrorRedirect(
        "Cannot delete this benefit because claim history exists. Keep it for audit history.",
      ),
    );
  }

  const { error } = await supabase.from("benefits").delete().eq("id", id);
  if (error) redirect(buildErrorRedirect(error.message));

  revalidatePath("/admin/benefits");
}

export default async function AdminBenefitsPage({
  searchParams,
}: {
  searchParams?: { error?: string };
}) {
  const supabase = createClient();
  const errorMessage = searchParams?.error;

  const [{ data: institutes, error: institutesError }, { data: benefits, error: benefitsError }] =
    await Promise.all([
      supabase.from("institutes").select("id, name").order("name"),
      supabase
        .from("benefits")
        .select("id, institute_id, title, description, valid_until, reset_period, institutes(name)")
        .order("created_at", { ascending: false }),
    ]);

  if (institutesError || benefitsError) {
    return (
      <main className="mx-auto max-w-6xl p-6">
        <h1 className="text-2xl font-semibold">Benefits</h1>
        <div className="mt-4 rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          Failed to load benefits: {benefitsError?.message ?? institutesError?.message}
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-6xl p-6">
      <h1 className="text-2xl font-semibold">Benefits</h1>

      {errorMessage ? (
        <div className="mt-4 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {errorMessage}
        </div>
      ) : null}

      <section className="mt-6 rounded-lg border bg-card p-4">
        <h2 className="text-lg font-medium">Add Benefit</h2>
        <form action={addBenefit} className="mt-4 grid gap-3 md:grid-cols-2">
          <select
            name="institute_id"
            required
            defaultValue=""
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="" disabled>
              Select institute
            </option>
            {institutes?.map((institute) => (
              <option key={institute.id} value={institute.id}>
                {institute.name}
              </option>
            ))}
          </select>
          <input
            name="title"
            placeholder="Benefit title"
            required
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          />
          <textarea
            name="description"
            placeholder="Description"
            className="min-h-20 rounded-md border border-input bg-background px-3 py-2 text-sm md:col-span-2"
          />
          <input
            name="valid_until"
            type="date"
            required
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          />
          <select
            name="reset_period"
            required
            defaultValue=""
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="" disabled>
              Select reset period
            </option>
            {RESET_PERIODS.map((period) => (
              <option key={period.value} value={period.value}>
                {period.label}
              </option>
            ))}
          </select>
          <div className="md:col-span-2">
            <button
              type="submit"
              className="h-10 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground"
            >
              Add Benefit
            </button>
          </div>
        </form>
      </section>

      <section className="mt-6 overflow-x-auto rounded-lg border bg-card">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b bg-muted/40">
            <tr>
              <th className="p-3 font-medium">Title</th>
              <th className="p-3 font-medium">Institute</th>
              <th className="p-3 font-medium">Valid Until</th>
              <th className="p-3 font-medium">Reset Period</th>
              <th className="p-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {benefits?.map((benefit) => (
              <tr key={benefit.id} className="border-b align-top">
                <td className="p-3">
                  <form action={updateBenefit} className="space-y-2">
                    <input type="hidden" name="id" value={benefit.id} />
                    <input
                      name="title"
                      defaultValue={benefit.title}
                      required
                      className="h-9 w-56 rounded-md border border-input bg-background px-2 text-sm"
                    />
                    <select
                      name="institute_id"
                      defaultValue={benefit.institute_id}
                      required
                      className="h-9 w-56 rounded-md border border-input bg-background px-2 text-sm"
                    >
                      {institutes?.map((institute) => (
                        <option key={institute.id} value={institute.id}>
                          {institute.name}
                        </option>
                      ))}
                    </select>
                    <textarea
                      name="description"
                      defaultValue={benefit.description ?? ""}
                      className="min-h-16 w-56 rounded-md border border-input bg-background px-2 py-1.5 text-sm"
                    />
                    <input
                      name="valid_until"
                      type="date"
                      defaultValue={benefit.valid_until}
                      required
                      className="h-9 w-56 rounded-md border border-input bg-background px-2 text-sm"
                    />
                    <select
                      name="reset_period"
                      defaultValue={benefit.reset_period}
                      required
                      className="h-9 w-56 rounded-md border border-input bg-background px-2 text-sm"
                    >
                      {RESET_PERIODS.map((period) => (
                        <option key={period.value} value={period.value}>
                          {period.label}
                        </option>
                      ))}
                    </select>
                    <button
                      type="submit"
                      className="h-8 rounded-md border px-3 text-xs font-medium hover:bg-muted"
                    >
                      Edit
                    </button>
                  </form>
                </td>
                <td className="p-3 text-muted-foreground">
                  {Array.isArray(benefit.institutes)
                    ? (benefit.institutes[0]?.name ?? "—")
                    : (benefit.institutes as { name?: string } | null)?.name ?? "—"}
                </td>
                <td className="p-3 text-muted-foreground">{benefit.valid_until}</td>
                <td className="p-3 text-muted-foreground">{benefit.reset_period}</td>
                <td className="p-3">
                  <form action={deleteBenefit}>
                    <input type="hidden" name="id" value={benefit.id} />
                    <button
                      type="submit"
                      className="h-8 rounded-md border border-destructive/40 px-3 text-xs font-medium text-destructive hover:bg-destructive/10"
                    >
                      Delete
                    </button>
                  </form>
                </td>
              </tr>
            ))}
            {!benefits?.length ? (
              <tr>
                <td colSpan={5} className="p-4 text-center text-muted-foreground">
                  No benefits found.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>
    </main>
  );
}
