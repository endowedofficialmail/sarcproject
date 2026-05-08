import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type ResetPeriod = "one_time" | "daily" | "weekly" | "monthly" | "yearly";

type EligibilityStatus = "eligible" | "already_claimed" | "expired";

function toDateInputString(date: Date) {
  return date.toISOString().slice(0, 10);
}

function isResetPeriodPassed(resetPeriod: ResetPeriod, claimedAt: string, now: Date) {
  const claimed = new Date(claimedAt);
  const diffMs = now.getTime() - claimed.getTime();

  if (resetPeriod === "one_time") return false;
  if (resetPeriod === "daily") return diffMs >= 24 * 60 * 60 * 1000;
  if (resetPeriod === "weekly") return diffMs >= 7 * 24 * 60 * 60 * 1000;
  if (resetPeriod === "monthly") return diffMs >= 30 * 24 * 60 * 60 * 1000;
  return diffMs >= 365 * 24 * 60 * 60 * 1000;
}

function getEligibilityStatus({
  validUntil,
  resetPeriod,
  latestClaimedAt,
  now,
}: {
  validUntil: string;
  resetPeriod: ResetPeriod;
  latestClaimedAt: string | null;
  now: Date;
}): EligibilityStatus {
  const today = toDateInputString(now);
  if (validUntil < today) return "expired";

  if (!latestClaimedAt) return "eligible";
  if (resetPeriod === "one_time") return "already_claimed";

  return isResetPeriodPassed(resetPeriod, latestClaimedAt, now) ? "eligible" : "already_claimed";
}

function formatResetPeriod(resetPeriod: ResetPeriod) {
  switch (resetPeriod) {
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
      return resetPeriod;
  }
}

async function claimBenefit(formData: FormData) {
  "use server";

  const supabase = createClient();
  const sessionExpiredMessage = "Your session has expired. Please log in again.";

  const benefitId = String(formData.get("benefit_id") ?? "").trim();
  const studentId = String(formData.get("student_id") ?? "").trim();
  const q = String(formData.get("q") ?? "").trim();

  if (!benefitId || !studentId) {
    redirect(`/institute?${new URLSearchParams({ q, error: "Missing benefit or student id." }).toString()}`);
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?${new URLSearchParams({ message: sessionExpiredMessage }).toString()}`);
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("institute_id")
    .eq("id", user.id)
    .eq("role", "institute")
    .single();

  if (profileError || !profile?.institute_id) {
    redirect(
      `/institute?${new URLSearchParams({ q, error: "Unable to resolve institute profile." }).toString()}`,
    );
  }

  const instituteId = profile.institute_id;

  const { data: benefit, error: benefitError } = await supabase
    .from("benefits")
    .select("id")
    .eq("id", benefitId)
    .eq("institute_id", instituteId)
    .single();

  if (benefitError || !benefit) {
    redirect(
      `/institute?${new URLSearchParams({ q, error: "Benefit does not belong to your institute." }).toString()}`,
    );
  }

  const { error: insertError } = await supabase.from("benefit_claims").insert({
    benefit_id: benefitId,
    student_id: studentId,
    institute_id: instituteId,
  });

  if (insertError) {
    redirect(`/institute?${new URLSearchParams({ q, error: insertError.message }).toString()}`);
  }

  revalidatePath("/institute");
  redirect(`/institute?${new URLSearchParams({ q, success: "Benefit claim recorded." }).toString()}`);
}

export default async function InstituteSearchPage({
  searchParams,
}: {
  searchParams?: { q?: string; error?: string; success?: string };
}) {
  const supabase = createClient();
  const q = (searchParams?.q ?? "").trim();

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    const sessionExpiredMessage = "Your session has expired. Please log in again.";
    redirect(`/login?${new URLSearchParams({ message: sessionExpiredMessage }).toString()}`);
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("institute_id")
    .eq("id", user.id)
    .eq("role", "institute")
    .single();

  if (profileError || !profile?.institute_id) {
    return (
      <main className="mx-auto max-w-6xl p-6">
        <h1 className="text-2xl font-semibold">Student Verification</h1>
        <div className="mt-4 rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          Failed to resolve institute profile.
        </div>
      </main>
    );
  }

  const instituteId = profile.institute_id;

  const { data: benefits, error: benefitsError } = await supabase
    .from("benefits")
    .select("id, title, description, valid_until, reset_period")
    .eq("institute_id", instituteId)
    .order("created_at", { ascending: false });

  if (benefitsError) {
    return (
      <main className="mx-auto max-w-6xl p-6">
        <h1 className="text-2xl font-semibold">Student Verification</h1>
        <div className="mt-4 rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          Failed to load institute benefits: {benefitsError.message}
        </div>
      </main>
    );
  }

  let students:
    | Array<{
        id: string;
        full_name: string;
        unique_student_id: string;
        schools: { name?: string } | Array<{ name?: string }> | null;
      }>
    | null = [];

  if (q.length > 0) {
    const { data: foundStudents, error: studentsError } = await supabase
      .from("students")
      .select("id, full_name, unique_student_id, schools(name)")
      .or(`full_name.ilike.%${q}%,unique_student_id.ilike.%${q}%`)
      .limit(25);

    if (studentsError) {
      return (
        <main className="mx-auto max-w-6xl p-6">
          <h1 className="text-2xl font-semibold">Student Verification</h1>
          <div className="mt-4 rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
            Failed to search students: {studentsError.message}
          </div>
        </main>
      );
    }

    students = foundStudents;
  }

  const studentIds = students?.map((student) => student.id) ?? [];
  const benefitIds = benefits?.map((benefit) => benefit.id) ?? [];

  const latestClaimByPair = new Map<string, string>();

  if (studentIds.length > 0 && benefitIds.length > 0) {
    const { data: claims, error: claimsError } = await supabase
      .from("benefit_claims")
      .select("student_id, benefit_id, claimed_at")
      .eq("institute_id", instituteId)
      .in("student_id", studentIds)
      .in("benefit_id", benefitIds)
      .order("claimed_at", { ascending: false });

    if (claimsError) {
      return (
        <main className="mx-auto max-w-6xl p-6">
          <h1 className="text-2xl font-semibold">Student Verification</h1>
          <div className="mt-4 rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
            Failed to load claim history: {claimsError.message}
          </div>
        </main>
      );
    }

    for (const claim of claims ?? []) {
      const key = `${claim.student_id}:${claim.benefit_id}`;
      if (!latestClaimByPair.has(key)) {
        latestClaimByPair.set(key, claim.claimed_at);
      }
    }
  }

  const now = new Date();

  return (
    <main className="mx-auto max-w-7xl p-6">
      <h1 className="text-2xl font-semibold">Student Verification</h1>

      {searchParams?.error ? (
        <div className="mt-4 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {searchParams.error}
        </div>
      ) : null}
      {searchParams?.success ? (
        <div className="mt-4 rounded-lg border border-emerald-300/40 bg-emerald-500/10 p-3 text-sm text-emerald-700">
          {searchParams.success}
        </div>
      ) : null}

      <section className="mt-6 rounded-lg border bg-card p-4">
        <form className="flex flex-col gap-3 sm:flex-row" method="get">
          <input
            type="text"
            name="q"
            defaultValue={q}
            placeholder="Search by student name or unique ID"
            className="h-12 flex-1 rounded-md border border-input bg-background px-4 text-base"
          />
          <button
            type="submit"
            className="h-12 rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground"
          >
            Search
          </button>
        </form>
      </section>

      {q.length > 0 ? (
        <section className="mt-6 space-y-4">
          {!students?.length ? (
            <div className="rounded-lg border bg-card p-5 text-sm text-muted-foreground">
              No students found for &quot;{q}&quot;.
            </div>
          ) : null}

          {students?.map((student) => (
            <div key={student.id} className="rounded-lg border bg-card p-4">
              <div className="flex flex-col gap-1 border-b pb-3">
                <div className="text-lg font-semibold">{student.full_name}</div>
                <div className="text-sm text-muted-foreground">
                  Unique ID: <span className="font-mono">{student.unique_student_id}</span>
                </div>
                <div className="text-sm text-muted-foreground">
                  School:{" "}
                  {Array.isArray(student.schools)
                    ? (student.schools[0]?.name ?? "—")
                    : (student.schools as { name?: string } | null)?.name ?? "—"}
                </div>
              </div>

              <div className="mt-4 grid gap-3">
                {(benefits ?? []).map((benefit) => {
                  const key = `${student.id}:${benefit.id}`;
                  const latestClaimedAt = latestClaimByPair.get(key) ?? null;
                  const status = getEligibilityStatus({
                    validUntil: benefit.valid_until,
                    resetPeriod: benefit.reset_period as ResetPeriod,
                    latestClaimedAt,
                    now,
                  });

                  const disabled = status !== "eligible";
                  const buttonLabel =
                    status === "expired"
                      ? "Expired"
                      : status === "already_claimed"
                        ? "Already Claimed"
                        : "Benefitted";

                  return (
                    <div key={benefit.id} className="rounded-md border p-3">
                      <div className="font-medium">{benefit.title}</div>
                      <div className="mt-1 text-sm text-muted-foreground">
                        {benefit.description || "No description."}
                      </div>
                      <div className="mt-2 text-xs text-muted-foreground">
                        Valid until: {benefit.valid_until} | Reset:{" "}
                        {formatResetPeriod(benefit.reset_period as ResetPeriod)}
                      </div>

                      <form action={claimBenefit} className="mt-3">
                        <input type="hidden" name="benefit_id" value={benefit.id} />
                        <input type="hidden" name="student_id" value={student.id} />
                        <input type="hidden" name="q" value={q} />
                        <button
                          type="submit"
                          disabled={disabled}
                          className="h-9 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {buttonLabel}
                        </button>
                      </form>
                    </div>
                  );
                })}

                {!benefits?.length ? (
                  <div className="text-sm text-muted-foreground">
                    No benefits are configured for this institute.
                  </div>
                ) : null}
              </div>
            </div>
          ))}
        </section>
      ) : (
        <section className="mt-6 rounded-lg border bg-card p-5 text-sm text-muted-foreground">
          Enter a student name or unique ID to start verification.
        </section>
      )}
    </main>
  );
}
