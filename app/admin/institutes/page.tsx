import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function buildErrorRedirect(message: string) {
  return `/admin/institutes?error=${encodeURIComponent(message)}`;
}

async function updateInstitute(formData: FormData) {
  "use server";

  const supabase = createClient();

  const id = String(formData.get("id") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const instituteTypeId = String(formData.get("institute_type_id") ?? "").trim();
  const address = String(formData.get("address") ?? "").trim();
  const contactInfo = String(formData.get("contact_info") ?? "").trim();
  const isActive = formData.get("is_active") === "on";

  if (!id) redirect(buildErrorRedirect("Institute id is required."));
  if (!name) redirect(buildErrorRedirect("Institute name is required."));
  if (!instituteTypeId) redirect(buildErrorRedirect("Institute type is required."));

  const { error } = await supabase
    .from("institutes")
    .update({
      name,
      institute_type_id: instituteTypeId,
      address: address || null,
      contact_info: contactInfo || null,
      is_active: isActive,
    })
    .eq("id", id);

  if (error) redirect(buildErrorRedirect(error.message));

  revalidatePath("/admin/institutes");
}

async function deleteInstitute(formData: FormData) {
  "use server";

  const supabase = createClient();
  const id = String(formData.get("id") ?? "").trim();

  if (!id) redirect(buildErrorRedirect("Institute id is required."));

  const [
    { count: benefitsCount, error: benefitsCheckError },
    { count: instituteProfilesCount, error: profilesCheckError },
    { count: claimsCount, error: claimsCheckError },
  ] = await Promise.all([
    supabase.from("benefits").select("id", { head: true, count: "exact" }).eq("institute_id", id),
    supabase
      .from("profiles")
      .select("id", { head: true, count: "exact" })
      .eq("role", "institute")
      .eq("institute_id", id),
    supabase.from("benefit_claims").select("id", { head: true, count: "exact" }).eq("institute_id", id),
  ]);

  if (benefitsCheckError || profilesCheckError || claimsCheckError) {
    redirect(
      buildErrorRedirect(
        benefitsCheckError?.message ??
          profilesCheckError?.message ??
          claimsCheckError?.message ??
          "Delete check failed.",
      ),
    );
  }

  if ((benefitsCount ?? 0) > 0) {
    redirect(
      buildErrorRedirect(
        "Cannot delete this institute because benefits are still linked. Delete the benefits first.",
      ),
    );
  }

  if ((claimsCount ?? 0) > 0) {
    redirect(
      buildErrorRedirect(
        "Cannot delete this institute because claim history exists. Keep the institute or archive it instead.",
      ),
    );
  }

  if ((instituteProfilesCount ?? 0) > 0) {
    redirect(
      buildErrorRedirect(
        "Cannot delete this institute because an institute login profile is linked. Remove the account first.",
      ),
    );
  }

  const { error } = await supabase.from("institutes").delete().eq("id", id);
  if (error) redirect(buildErrorRedirect(error.message));

  revalidatePath("/admin/institutes");
}

export default async function AdminInstitutesPage({
  searchParams,
}: {
  searchParams?: { error?: string };
}) {
  const supabase = createClient();
  const errorMessage = searchParams?.error;

  const [{ data: instituteTypes, error: instituteTypesError }, { data: institutes, error: institutesError }] =
    await Promise.all([
      supabase.from("institute_types").select("id, name").order("name"),
      supabase
        .from("institutes")
        .select("id, name, institute_type_id, address, contact_info, is_active, institute_types(name)")
        .order("created_at", { ascending: false }),
    ]);

  if (instituteTypesError || institutesError) {
    return (
      <main className="mx-auto max-w-6xl p-6">
        <h1 className="text-2xl font-semibold">Institutes</h1>
        <div className="mt-4 rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          Failed to load institutes: {institutesError?.message ?? instituteTypesError?.message}
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-6xl p-6">
      <h1 className="text-2xl font-semibold">Institutes</h1>

      {errorMessage ? (
        <div className="mt-4 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {errorMessage}
        </div>
      ) : null}

      <section className="mt-6 rounded-lg border bg-card p-4">
        <h2 className="text-lg font-medium">Add Institute</h2>
        <form action="/api/admin/institutes" method="post" className="mt-4 grid gap-3 md:grid-cols-2">
          <input
            name="name"
            placeholder="Institute name"
            required
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          />
          <select
            name="institute_type_id"
            required
            defaultValue=""
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="" disabled>
              Select institute type
            </option>
            {instituteTypes?.map((type) => (
              <option key={type.id} value={type.id}>
                {type.name}
              </option>
            ))}
          </select>
          <input
            name="address"
            placeholder="Address"
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          />
          <input
            name="contact_info"
            placeholder="Contact info"
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          />
          <input
            name="email"
            type="email"
            placeholder="Login email"
            required
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          />
          <input
            name="temporary_password"
            type="password"
            placeholder="Temporary password"
            minLength={8}
            required
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          />
          <div className="md:col-span-2">
            <button
              type="submit"
              className="h-10 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground"
            >
              Add Institute
            </button>
          </div>
        </form>
      </section>

      <section className="mt-6 overflow-x-auto rounded-lg border bg-card">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b bg-muted/40">
            <tr>
              <th className="p-3 font-medium">Name</th>
              <th className="p-3 font-medium">Type</th>
              <th className="p-3 font-medium">Address</th>
              <th className="p-3 font-medium">Contact</th>
              <th className="p-3 font-medium">Status</th>
              <th className="p-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {institutes?.map((institute) => (
              <tr key={institute.id} className="border-b align-top">
                <td className="p-3">
                  <form action={updateInstitute} className="space-y-2">
                    <input type="hidden" name="id" value={institute.id} />
                    <input
                      name="name"
                      defaultValue={institute.name}
                      required
                      className="h-9 w-56 rounded-md border border-input bg-background px-2 text-sm"
                    />
                    <select
                      name="institute_type_id"
                      defaultValue={institute.institute_type_id}
                      required
                      className="h-9 w-56 rounded-md border border-input bg-background px-2 text-sm"
                    >
                      {instituteTypes?.map((type) => (
                        <option key={type.id} value={type.id}>
                          {type.name}
                        </option>
                      ))}
                    </select>
                    <input
                      name="address"
                      defaultValue={institute.address ?? ""}
                      className="h-9 w-56 rounded-md border border-input bg-background px-2 text-sm"
                    />
                    <input
                      name="contact_info"
                      defaultValue={institute.contact_info ?? ""}
                      className="h-9 w-56 rounded-md border border-input bg-background px-2 text-sm"
                    />
                    <label className="flex items-center gap-2 text-xs text-muted-foreground">
                      <input
                        type="checkbox"
                        name="is_active"
                        defaultChecked={institute.is_active}
                        className="h-4 w-4"
                      />
                      Active
                    </label>
                    <button
                      type="submit"
                      className="h-8 rounded-md border px-3 text-xs font-medium hover:bg-muted"
                    >
                      Edit
                    </button>
                  </form>
                </td>
                <td className="p-3 text-muted-foreground">
                  {Array.isArray(institute.institute_types)
                    ? (institute.institute_types[0]?.name ?? "—")
                    : (institute.institute_types as { name?: string } | null)?.name ?? "—"}
                </td>
                <td className="p-3 text-muted-foreground">{institute.address ?? "—"}</td>
                <td className="p-3 text-muted-foreground">{institute.contact_info ?? "—"}</td>
                <td className="p-3">
                  {institute.is_active ? (
                    <span className="rounded-md bg-emerald-500/15 px-2 py-1 text-xs text-emerald-700">
                      Active
                    </span>
                  ) : (
                    <span className="rounded-md bg-zinc-500/15 px-2 py-1 text-xs text-zinc-700">
                      Inactive
                    </span>
                  )}
                </td>
                <td className="p-3">
                  <form action={deleteInstitute}>
                    <input type="hidden" name="id" value={institute.id} />
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
            {!institutes?.length ? (
              <tr>
                <td colSpan={6} className="p-4 text-center text-muted-foreground">
                  No institutes found.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>
    </main>
  );
}
