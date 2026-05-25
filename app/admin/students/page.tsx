import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function buildErrorRedirect(message: string) {
  return `/admin/students?error=${encodeURIComponent(message)}`;
}

export default async function AdminStudentsPage({
  searchParams,
}: {
  searchParams?: { error?: string; school?: string };
}) {
  const supabase = createClient();
  const errorMessage = searchParams?.error;
  const selectedSchoolId = searchParams?.school ?? "";

  // Build student query — optionally filtered by school
  let studentQuery = supabase
    .from("students")
    .select("id, unique_student_id, full_name, email, school_id, schools(name)")
    .order("created_at", { ascending: false });

  if (selectedSchoolId) {
    studentQuery = studentQuery.eq("school_id", selectedSchoolId);
  }

  const [{ data: schools, error: schoolsError }, { data: students, error: studentsError }] =
    await Promise.all([
      supabase.from("schools").select("id, name").order("name"),
      studentQuery,
    ]);

  if (schoolsError || studentsError) {
    return (
      <main className="mx-auto max-w-6xl p-6">
        <h1 className="text-2xl font-semibold">Students</h1>
        <div className="mt-4 rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          Failed to load students: {studentsError?.message ?? schoolsError?.message}
        </div>
      </main>
    );
  }

  const selectedSchoolName = schools?.find((s) => s.id === selectedSchoolId)?.name ?? null;

  return (
    <main className="mx-auto max-w-6xl p-6">
      <h1 className="text-2xl font-semibold">Students</h1>

      {errorMessage ? (
        <div className="mt-4 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {errorMessage}
        </div>
      ) : null}

      <section className="mt-6 rounded-lg border bg-card p-4">
        <h2 className="text-lg font-medium">Add Student</h2>
        <form
          action="/api/admin/students"
          method="post"
          encType="multipart/form-data"
          className="mt-4 grid gap-3 md:grid-cols-2"
        >
          <input
            name="full_name"
            placeholder="Student full name"
            required
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          />
          <input
            name="email"
            type="email"
            placeholder="Personal email"
            required
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          />
          <select
            name="school_id"
            required
            defaultValue=""
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="" disabled>
              Select school
            </option>
            {schools?.map((school) => (
              <option key={school.id} value={school.id}>
                {school.name}
              </option>
            ))}
          </select>
          <input
            name="temporary_password"
            type="password"
            placeholder="Temporary password (min 8 chars)"
            required
            minLength={8}
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          />
          <input
            name="father_name"
            placeholder="Father's full name"
            required
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          />
          <input
            name="father_cnic"
            placeholder="Father's CNIC e.g. 1234-1234567-8"
            required
            pattern="\d{4}-\d{7}-\d"
            title="CNIC format: 0000-0000000-0"
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          />
          <div className="space-y-1 md:col-span-2">
            <label className="text-sm font-medium text-muted-foreground">
              Student Photo <span className="text-destructive">*</span>
            </label>
            <input
              name="photo"
              type="file"
              accept="image/*"
              required
              className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm file:mr-3 file:rounded file:border-0 file:bg-primary/10 file:px-3 file:py-1 file:text-xs file:font-medium file:text-primary"
            />
            <p className="text-xs text-muted-foreground">JPG, PNG or WEBP · Max 5 MB</p>
          </div>
          <div className="md:col-span-2">
            <button
              type="submit"
              className="h-10 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground"
            >
              Add Student
            </button>
          </div>
        </form>
      </section>

      {/* School filter */}
      <section className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <form method="get" className="flex items-center gap-2">
            <label htmlFor="school-filter" className="text-sm font-medium text-muted-foreground whitespace-nowrap">
              Filter by school:
            </label>
            <select
              id="school-filter"
              name="school"
              defaultValue={selectedSchoolId}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              // Auto-submits on change; the Apply button is a no-JS fallback
              onChange="this.form.submit()"
            >
              <option value="">All Students</option>
              {schools?.map((school) => (
                <option key={school.id} value={school.id}>
                  {school.name}
                </option>
              ))}
            </select>
            <button
              type="submit"
              className="h-9 rounded-md border border-border px-3 text-sm font-medium hover:bg-muted"
            >
              Apply
            </button>
            {selectedSchoolId ? (
              <a
                href="/admin/students"
                className="h-9 inline-flex items-center rounded-md border border-border px-3 text-sm text-muted-foreground hover:bg-muted"
              >
                Clear
              </a>
            ) : null}
          </form>
        </div>
        <p className="text-sm text-muted-foreground">
          {selectedSchoolName
            ? `Showing students from: ${selectedSchoolName}`
            : `Showing all students (${students?.length ?? 0})`}
        </p>
      </section>

      <section className="mt-3 overflow-x-auto rounded-lg border bg-card">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b bg-muted/40">
            <tr>
              <th className="p-3 font-medium">Unique ID</th>
              <th className="p-3 font-medium">Name</th>
              <th className="p-3 font-medium">Email</th>
              <th className="p-3 font-medium">School</th>
              <th className="p-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {students?.map((student) => (
              <tr key={student.id} className="border-b">
                <td className="p-3 font-mono text-xs">{student.unique_student_id}</td>
                <td className="p-3">{student.full_name}</td>
                <td className="p-3 text-muted-foreground">{student.email}</td>
                <td className="p-3 text-muted-foreground">
                  {Array.isArray(student.schools)
                    ? (student.schools[0]?.name ?? "—")
                    : (student.schools as { name?: string } | null)?.name ?? "—"}
                </td>
                <td className="p-3">
                  <form action={`/api/admin/students/${student.id}`} method="post">
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
            {!students?.length ? (
              <tr>
                <td colSpan={5} className="p-4 text-center text-muted-foreground">
                  No students found.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>
    </main>
  );
}
