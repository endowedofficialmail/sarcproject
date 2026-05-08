import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function buildErrorRedirect(message: string) {
  return `/admin/schools?error=${encodeURIComponent(message)}`;
}

async function updateSchool(formData: FormData) {
  "use server";

  const supabase = createClient();

  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  const address = String(formData.get("address") ?? "").trim();
  const contactInfo = String(formData.get("contact_info") ?? "").trim();
  const isActive = formData.get("is_active") === "on";

  if (!id) redirect(buildErrorRedirect("School id is required."));
  if (!name) redirect(buildErrorRedirect("School name is required."));

  const { error } = await supabase
    .from("schools")
    .update({
      name,
      address: address || null,
      contact_info: contactInfo || null,
      is_active: isActive,
    })
    .eq("id", id);

  if (error) redirect(buildErrorRedirect(error.message));

  revalidatePath("/admin/schools");
}

async function deleteSchool(formData: FormData) {
  "use server";

  const supabase = createClient();
  const id = String(formData.get("id") ?? "");

  if (!id) redirect(buildErrorRedirect("School id is required."));

  const [{ count: studentsCount, error: studentsCheckError }, { count: schoolProfilesCount, error: profilesCheckError }] =
    await Promise.all([
      supabase.from("students").select("id", { head: true, count: "exact" }).eq("school_id", id),
      supabase
        .from("profiles")
        .select("id", { head: true, count: "exact" })
        .eq("role", "school")
        .eq("school_id", id),
    ]);

  if (studentsCheckError || profilesCheckError) {
    redirect(buildErrorRedirect(studentsCheckError?.message ?? profilesCheckError?.message ?? "Delete check failed."));
  }

  if ((studentsCount ?? 0) > 0) {
    redirect(
      buildErrorRedirect(
        "Cannot delete this school because students are still assigned. Delete or move the students first.",
      ),
    );
  }

  if ((schoolProfilesCount ?? 0) > 0) {
    redirect(
      buildErrorRedirect(
        "Cannot delete this school because a school login profile is linked. Remove the account first.",
      ),
    );
  }

  const { error } = await supabase.from("schools").delete().eq("id", id);
  if (error) redirect(buildErrorRedirect(error.message));

  revalidatePath("/admin/schools");
}

export default async function AdminSchoolsPage({
  searchParams,
}: {
  searchParams?: { error?: string };
}) {
  const supabase = createClient();
  const errorMessage = searchParams?.error;

  const { data: schools, error } = await supabase
    .from("schools")
    .select("id, name, address, contact_info, is_active")
    .order("created_at", { ascending: false });

  if (error) {
    return (
      <main className="mx-auto max-w-6xl p-6">
        <h1 className="text-2xl font-semibold">Schools</h1>
        <div className="mt-4 rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          Failed to load schools: {error.message}
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-6xl p-6">
      <h1 className="text-2xl font-semibold">Schools</h1>

      {errorMessage ? (
        <div className="mt-4 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {errorMessage}
        </div>
      ) : null}

      <section className="mt-6 rounded-lg border bg-card p-4">
        <h2 className="text-lg font-medium">Add School</h2>
        <form action="/api/admin/schools" method="post" className="mt-4 grid gap-3 md:grid-cols-2">
          <input
            name="name"
            placeholder="School name"
            required
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          />
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
              Add School
            </button>
          </div>
        </form>
      </section>

      <section className="mt-6 overflow-x-auto rounded-lg border bg-card">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b bg-muted/40">
            <tr>
              <th className="p-3 font-medium">Name</th>
              <th className="p-3 font-medium">Address</th>
              <th className="p-3 font-medium">Contact</th>
              <th className="p-3 font-medium">Active</th>
              <th className="p-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {schools?.map((school) => (
              <tr key={school.id} className="border-b align-top">
                <td className="p-3">
                  <form action={updateSchool} className="space-y-2">
                    <input type="hidden" name="id" value={school.id} />
                    <input
                      name="name"
                      defaultValue={school.name}
                      required
                      className="h-9 w-56 rounded-md border border-input bg-background px-2 text-sm"
                    />
                    <input
                      name="address"
                      defaultValue={school.address ?? ""}
                      className="h-9 w-56 rounded-md border border-input bg-background px-2 text-sm"
                    />
                    <input
                      name="contact_info"
                      defaultValue={school.contact_info ?? ""}
                      className="h-9 w-56 rounded-md border border-input bg-background px-2 text-sm"
                    />
                    <label className="flex items-center gap-2 text-xs text-muted-foreground">
                      <input
                        type="checkbox"
                        name="is_active"
                        defaultChecked={school.is_active}
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
                <td className="p-3 text-muted-foreground">{school.address ?? "—"}</td>
                <td className="p-3 text-muted-foreground">{school.contact_info ?? "—"}</td>
                <td className="p-3">
                  {school.is_active ? (
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
                  <form action={deleteSchool}>
                    <input type="hidden" name="id" value={school.id} />
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
            {!schools?.length ? (
              <tr>
                <td colSpan={5} className="p-4 text-center text-muted-foreground">
                  No schools found.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>
    </main>
  );
}
