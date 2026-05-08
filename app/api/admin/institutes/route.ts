import { NextResponse } from "next/server";

import { createAdminClient } from "@/app/api/_lib/admin-client";
import { adminCreateInstituteSchema, getZodErrorMessage } from "@/app/api/_lib/validation";
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

export async function POST(request: Request) {
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

    const formData = await request.formData();
    const parsed = adminCreateInstituteSchema.safeParse({
      name: String(formData.get("name") ?? ""),
      institute_type_id: String(formData.get("institute_type_id") ?? ""),
      address: String(formData.get("address") ?? ""),
      contact_info: String(formData.get("contact_info") ?? ""),
      email: String(formData.get("email") ?? "").toLowerCase(),
      temporary_password: String(formData.get("temporary_password") ?? ""),
    });
    if (!parsed.success) {
      return NextResponse.json({ error: getZodErrorMessage(parsed.error) }, { status: 400 });
    }
    const { name, institute_type_id, address, contact_info, email, temporary_password } = parsed.data;

    const admin = createAdminClient();
    const { data: authUserResult, error: authCreateError } = await admin.auth.admin.createUser({
      email,
      password: temporary_password,
      email_confirm: true,
    });
    if (authCreateError || !authUserResult.user) {
      return NextResponse.redirect(
        new URL(
          `/admin/institutes?error=${encodeURIComponent(authCreateError?.message ?? "Failed to create auth user.")}`,
          request.url,
        ),
      );
    }

    const authUserId = authUserResult.user.id;
    const { data: institute, error: instituteError } = await admin
      .from("institutes")
      .insert({
        name,
        institute_type_id: institute_type_id,
        address: address || null,
        contact_info: contact_info || null,
      })
      .select("id")
      .single();

    if (instituteError || !institute) {
      await admin.auth.admin.deleteUser(authUserId);
      return NextResponse.redirect(
        new URL(
          `/admin/institutes?error=${encodeURIComponent(instituteError?.message ?? "Failed to create institute.")}`,
          request.url,
        ),
      );
    }

    const { error: profileError } = await admin.from("profiles").insert({
      id: authUserId,
      role: "institute",
      institute_id: institute.id,
    });

    if (profileError) {
      await admin.from("institutes").delete().eq("id", institute.id);
      await admin.auth.admin.deleteUser(authUserId);
      return NextResponse.redirect(
        new URL(`/admin/institutes?error=${encodeURIComponent(profileError.message)}`, request.url),
      );
    }

    return NextResponse.redirect(new URL("/admin/institutes", request.url));
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(err);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 },
    );
  }
}
