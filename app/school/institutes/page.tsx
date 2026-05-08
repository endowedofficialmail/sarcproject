import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 10;

function formatDatePKT(dateStr: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Karachi",
  }).format(new Date(`${dateStr}T00:00:00+05:00`));
}

function formatDateTimePKT(dateStr: string) {
  return new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZone: "Asia/Karachi",
  }).format(new Date(dateStr));
}

function isExpiringWithin7Days(validUntil: string) {
  const end = new Date(`${validUntil}T23:59:59+05:00`).getTime();
  const now = Date.now();
  const diff = end - now;
  return diff >= 0 && diff <= 7 * 24 * 60 * 60 * 1000;
}

function formatResetPeriod(value: string) {
  switch (value) {
    case "one_time":
      return "One-time";
    case "daily":
      return "Daily";
    case "weekly":
      return "Weekly";
    case "monthly":
      return "Monthly";
    case "yearly":
      return "Yearly";
    default:
      return value;
  }
}

export default async function SchoolInstitutesPage({
  searchParams,
}: {
  searchParams?: { q?: string; page?: string };
}) {
  const supabase = createClient();
  const q = (searchParams?.q ?? "").trim().toLowerCase();
  const currentPage = Math.max(1, Number(searchParams?.page ?? "1") || 1);
  const today = new Date().toISOString().slice(0, 10);

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return (
      <main className="space-y-4 rounded-lg border bg-card p-6">
        <h2 className="text-lg font-semibold">Institutes & Benefits</h2>
        <p className="text-sm text-destructive">Failed to load user session.</p>
      </main>
    );
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("school_id")
    .eq("id", user.id)
    .eq("role", "school")
    .single();

  if (profileError || !profile?.school_id) {
    return (
      <main className="space-y-4 rounded-lg border bg-card p-6">
        <h2 className="text-lg font-semibold">Institutes & Benefits</h2>
        <p className="text-sm text-destructive">Failed to resolve school profile.</p>
      </main>
    );
  }

  const [{ data: institutes, error: institutesError }, { data: rawClaims, error: claimsError }] =
    await Promise.all([
      supabase
        .from("institutes")
        .select(
          "id, name, address, institute_types(name), benefits(id, title, description, valid_until, reset_period)",
        )
        .eq("is_active", true)
        .order("name"),
      supabase
        .from("benefit_claims")
        .select(
          "id, claimed_at, students!inner(full_name, unique_student_id, school_id), benefits(title), institutes(name)",
        )
        .eq("students.school_id", profile.school_id)
        .order("claimed_at", { ascending: false }),
    ]);

  if (institutesError || claimsError) {
    return (
      <main className="space-y-4 rounded-lg border bg-card p-6">
        <h2 className="text-lg font-semibold">Institutes & Benefits</h2>
        <p className="text-sm text-destructive">
          Failed to load data: {institutesError?.message ?? claimsError?.message}
        </p>
      </main>
    );
  }

  const filteredClaims =
    rawClaims?.filter((claim) => {
      if (!q) return true;

      const studentName = Array.isArray(claim.students)
        ? (claim.students[0]?.full_name ?? "").toLowerCase()
        : (claim.students as { full_name?: string } | null)?.full_name?.toLowerCase() ?? "";
      const instituteName = Array.isArray(claim.institutes)
        ? (claim.institutes[0]?.name ?? "").toLowerCase()
        : (claim.institutes as { name?: string } | null)?.name?.toLowerCase() ?? "";

      return studentName.includes(q) || instituteName.includes(q);
    }) ?? [];

  const totalPages = Math.max(1, Math.ceil(filteredClaims.length / PAGE_SIZE));
  const page = Math.min(currentPage, totalPages);
  const paginatedClaims = filteredClaims.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <main className="space-y-6">
      <section className="space-y-4 rounded-lg border bg-card p-5">
        <div>
          <h2 className="text-lg font-semibold">Institutes & Benefits</h2>
          <p className="text-sm text-muted-foreground">Active institutes and currently valid benefits.</p>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          {institutes?.map((institute) => {
            const activeBenefits = (institute.benefits ?? []).filter((benefit) => benefit.valid_until >= today);

            return (
              <div key={institute.id} className="rounded-lg border bg-background p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-semibold">{institute.name}</h3>
                    <p className="text-sm text-muted-foreground">{institute.address ?? "No address provided"}</p>
                  </div>
                  <span className="rounded-full bg-secondary px-2.5 py-1 text-xs font-medium text-secondary-foreground">
                    {Array.isArray(institute.institute_types)
                      ? (institute.institute_types[0]?.name ?? "Type")
                      : (institute.institute_types as { name?: string } | null)?.name ?? "Type"}
                  </span>
                </div>

                <div className="mt-4 space-y-3 border-t pt-3">
                  {activeBenefits.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No active benefits currently.</p>
                  ) : (
                    activeBenefits.map((benefit) => (
                      <div key={benefit.id} className="rounded-md border bg-card p-3">
                        <p className="font-medium">{benefit.title}</p>
                        <p className="mt-1 text-sm text-muted-foreground">{benefit.description || "No description."}</p>
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                          <span
                            className={
                              isExpiringWithin7Days(benefit.valid_until)
                                ? "font-medium text-destructive"
                                : "text-muted-foreground"
                            }
                          >
                            Valid Until: {formatDatePKT(benefit.valid_until)}
                          </span>
                          <span className="rounded-full bg-primary/10 px-2 py-0.5 font-medium text-primary">
                            {formatResetPeriod(benefit.reset_period)}
                          </span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}

          {!institutes?.length ? (
            <div className="rounded-lg border bg-background p-6 text-sm text-muted-foreground">
              No active institutes found.
            </div>
          ) : null}
        </div>
      </section>

      <section className="space-y-4 rounded-lg border bg-card p-5">
        <div>
          <h2 className="text-lg font-semibold">Claim History</h2>
          <p className="text-sm text-muted-foreground">
            Benefit usage records for students belonging to your school.
          </p>
        </div>

        <form method="get" className="flex flex-col gap-2 sm:flex-row">
          <input
            name="q"
            defaultValue={searchParams?.q ?? ""}
            placeholder="Search by student name or institute name"
            className="h-10 flex-1 rounded-md border border-input bg-background px-3 text-sm"
          />
          <button
            type="submit"
            className="h-10 rounded-md border border-border px-4 text-sm font-medium text-slate-700 hover:bg-muted"
          >
            Search
          </button>
        </form>

        <div className="overflow-x-auto rounded-lg border">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b bg-muted/40">
              <tr>
                <th className="p-3 font-medium">Student Name</th>
                <th className="p-3 font-medium">Student Unique ID</th>
                <th className="p-3 font-medium">Benefit Title</th>
                <th className="p-3 font-medium">Institute Name</th>
                <th className="p-3 font-medium">Claimed On</th>
              </tr>
            </thead>
            <tbody>
              {paginatedClaims.map((claim, idx) => {
                const student = Array.isArray(claim.students)
                  ? claim.students[0]
                  : (claim.students as { full_name?: string; unique_student_id?: string } | null);
                const benefit = Array.isArray(claim.benefits)
                  ? claim.benefits[0]
                  : (claim.benefits as { title?: string } | null);
                const institute = Array.isArray(claim.institutes)
                  ? claim.institutes[0]
                  : (claim.institutes as { name?: string } | null);

                return (
                  <tr key={claim.id} className={idx % 2 === 0 ? "border-b bg-background" : "border-b bg-muted/20"}>
                    <td className="p-3">{student?.full_name ?? "—"}</td>
                    <td className="p-3 font-mono text-xs">{student?.unique_student_id ?? "—"}</td>
                    <td className="p-3 text-muted-foreground">{benefit?.title ?? "—"}</td>
                    <td className="p-3 text-muted-foreground">{institute?.name ?? "—"}</td>
                    <td className="p-3 text-muted-foreground">{formatDateTimePKT(claim.claimed_at)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {paginatedClaims.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground">No claims recorded yet</div>
          ) : null}
        </div>

        <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
          <p className="text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </p>
          <div className="flex gap-2">
            <a
              href={`?${new URLSearchParams({
                ...(searchParams?.q ? { q: searchParams.q } : {}),
                page: String(Math.max(1, page - 1)),
              }).toString()}`}
              className={`h-9 rounded-md border px-3 text-sm ${page <= 1 ? "pointer-events-none opacity-50" : ""}`}
            >
              Previous
            </a>
            <a
              href={`?${new URLSearchParams({
                ...(searchParams?.q ? { q: searchParams.q } : {}),
                page: String(Math.min(totalPages, page + 1)),
              }).toString()}`}
              className={`h-9 rounded-md border px-3 text-sm ${
                page >= totalPages ? "pointer-events-none opacity-50" : ""
              }`}
            >
              Next
            </a>
          </div>
        </div>
      </section>
    </main>
  );
}
