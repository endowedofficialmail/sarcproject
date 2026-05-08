import { NextResponse } from "next/server";

import { createAdminClient } from "@/app/api/_lib/admin-client";
import { adminStudentIdParamsSchema, getZodErrorMessage } from "@/app/api/_lib/validation";
import { createClient } from "@/lib/supabase/server";

async function requireSuperAdmin() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, reason: "Unauthorized" };

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.role !== "super_admin") return { ok: false as const, reason: "Forbidden" };
  return { ok: true as const };
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const sessionExpiredMessage = "Your session has expired. Please log in again.";
    const auth = await requireSuperAdmin();
    if (!auth.ok) {
      if (auth.reason === "Unauthorized") {
        const loginUrl = new URL("/login", request.url);
        loginUrl.searchParams.set("message", sessionExpiredMessage);
        return NextResponse.redirect(loginUrl);
      }
      return NextResponse.json({ error: auth.reason }, { status: 403 });
    }

    const parsedParams = adminStudentIdParamsSchema.safeParse(params);
    if (!parsedParams.success) {
      return NextResponse.json({ error: getZodErrorMessage(parsedParams.error) }, { status: 400 });
    }

    const { id } = parsedParams.data;
    const admin = createAdminClient();

    const { data: profile, error: profileLookupError } = await admin
      .from("profiles")
      .select("id")
      .eq("student_id", id)
      .eq("role", "student")
      .maybeSingle();

    if (profileLookupError) {
      return NextResponse.redirect(
        new URL(`/admin/students?error=${encodeURIComponent(profileLookupError.message)}`, request.url),
      );
    }

    const { error: studentDeleteError } = await admin.from("students").delete().eq("id", id);
    if (studentDeleteError) {
      return NextResponse.redirect(
        new URL(`/admin/students?error=${encodeURIComponent(studentDeleteError.message)}`, request.url),
      );
    }

    if (profile?.id) {
      const { error: authDeleteError } = await admin.auth.admin.deleteUser(profile.id);
      if (authDeleteError) {
        return NextResponse.redirect(
          new URL(`/admin/students?error=${encodeURIComponent(authDeleteError.message)}`, request.url),
        );
      }
    }

    return NextResponse.redirect(new URL("/admin/students", request.url));
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(err);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 },
    );
  }
}
