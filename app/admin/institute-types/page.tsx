import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function buildErrorRedirect(message: string) {
  return `/admin/institute-types?error=${encodeURIComponent(message)}`;
}

async function addInstituteType(formData: FormData) {
  "use server";

  const supabase = createClient();
  const name = String(formData.get("name") ?? "").trim();

  if (!name) {
    redirect(buildErrorRedirect("Institute type name is required."));
  }

  const { error } = await supabase.from("institute_types").insert({ name });
  if (error) {
    redirect(buildErrorRedirect(error.message));
  }

  revalidatePath("/admin/institute-types");
}

async function updateInstituteType(formData: FormData) {
  "use server";

  const supabase = createClient();
  const id = String(formData.get("id") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();

  if (!id) {
    redirect(buildErrorRedirect("Institute type id is required."));
  }
  if (!name) {
    redirect(buildErrorRedirect("Institute type name is required."));
  }

  const { error } = await supabase.from("institute_types").update({ name }).eq("id", id);
  if (error) {
    redirect(buildErrorRedirect(error.message));
  }

  revalidatePath("/admin/institute-types");
}

async function deleteInstituteType(formData: FormData) {
  "use server";

  const supabase = createClient();
  const id = String(formData.get("id") ?? "").trim();

  if (!id) {
    redirect(buildErrorRedirect("Institute type id is required."));
  }

  const { count: inUseCount, error: inUseError } = await supabase
    .from("institutes")
    .select("id", { head: true, count: "exact" })
    .eq("institute_type_id", id);

  if (inUseError) {
    redirect(buildErrorRedirect(inUseError.message));
  }

  if ((inUseCount ?? 0) > 0) {
    redirect(
      buildErrorRedirect("Cannot delete this type because it is assigned to one or more institutes."),
    );
  }

  const { error } = await supabase.from("institute_types").delete().eq("id", id);
  if (error) {
    redirect(buildErrorRedirect(error.message));
  }

  revalidatePath("/admin/institute-types");
}

export default async function AdminInstituteTypesPage({
  searchParams,
}: {
  searchParams?: { error?: string };
}) {
  const supabase = createClient();
  const { data: instituteTypes, error } = await supabase
    .from("institute_types")
    .select("id, name, created_at")
    .order("created_at", { ascending: false });

  const errorMessage = searchParams?.error;

  if (error) {
    return (
      <main className="mx-auto max-w-5xl p-6">
        <h1 className="text-2xl font-semibold">Institute Types</h1>
        <div className="mt-4 rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          Failed to load institute types: {error.message}
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-5xl p-6">
      <h1 className="text-2xl font-semibold">Institute Types</h1>

      {errorMessage ? (
        <div className="mt-4 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {errorMessage}
        </div>
      ) : null}

      <section className="mt-6 rounded-lg border bg-card p-4">
        <h2 className="text-lg font-medium">Add Institute Type</h2>
        <form action={addInstituteType} className="mt-4 flex flex-col gap-3 sm:flex-row">
          <input
            name="name"
            placeholder="e.g. Hospital, Laboratory, Clinic"
            required
            className="h-10 flex-1 rounded-md border border-input bg-background px-3 text-sm"
          />
          <button
            type="submit"
            className="h-10 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground"
          >
            Add
          </button>
        </form>
      </section>

      <section className="mt-6 overflow-x-auto rounded-lg border bg-card">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b bg-muted/40">
            <tr>
              <th className="p-3 font-medium">Name</th>
              <th className="p-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {instituteTypes?.map((type) => (
              <tr key={type.id} className="border-b">
                <td className="p-3">
                  <form action={updateInstituteType} className="flex gap-2">
                    <input type="hidden" name="id" value={type.id} />
                    <input
                      name="name"
                      defaultValue={type.name}
                      required
                      className="h-9 w-72 rounded-md border border-input bg-background px-2 text-sm"
                    />
                    <button
                      type="submit"
                      className="h-9 rounded-md border px-3 text-xs font-medium hover:bg-muted"
                    >
                      Edit
                    </button>
                  </form>
                </td>
                <td className="p-3">
                  <form action={deleteInstituteType}>
                    <input type="hidden" name="id" value={type.id} />
                    <button
                      type="submit"
                      className="h-9 rounded-md border border-destructive/40 px-3 text-xs font-medium text-destructive hover:bg-destructive/10"
                    >
                      Delete
                    </button>
                  </form>
                </td>
              </tr>
            ))}
            {!instituteTypes?.length ? (
              <tr>
                <td colSpan={2} className="p-4 text-center text-muted-foreground">
                  No institute types found.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>
    </main>
  );
}
