import { NextResponse } from "next/server";

import { createAdminClient } from "@/app/api/_lib/admin-client";
import { adminCreateStudentSchema, getZodErrorMessage } from "@/app/api/_lib/validation";
import { createClient } from "@/lib/supabase/server";

const PHOTO_BUCKET = "student-photos";
const MAX_PHOTO_SIZE = 5 * 1024 * 1024; // 5 MB

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

async function deletePhoto(admin: ReturnType<typeof createAdminClient>, path: string) {
  await admin.storage.from(PHOTO_BUCKET).remove([path]);
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

    // Validate text fields
    const parsed = adminCreateStudentSchema.safeParse({
      full_name: String(formData.get("full_name") ?? ""),
      email: String(formData.get("email") ?? "").toLowerCase(),
      school_id: String(formData.get("school_id") ?? ""),
      temporary_password: String(formData.get("temporary_password") ?? ""),
      father_name: String(formData.get("father_name") ?? ""),
      father_cnic: String(formData.get("father_cnic") ?? ""),
    });
    if (!parsed.success) {
      return NextResponse.redirect(
        new URL(
          `/admin/students?error=${encodeURIComponent(getZodErrorMessage(parsed.error))}`,
          request.url,
        ),
      );
    }
    const { full_name, email, school_id, temporary_password, father_name, father_cnic } = parsed.data;

    // Validate photo
    const photoFile = formData.get("photo") as File | null;
    if (!photoFile || photoFile.size === 0) {
      return NextResponse.redirect(
        new URL(`/admin/students?error=${encodeURIComponent("Student photo is required.")}`, request.url),
      );
    }
    if (!photoFile.type.startsWith("image/")) {
      return NextResponse.redirect(
        new URL(
          `/admin/students?error=${encodeURIComponent("Student photo must be an image file (JPG, PNG, etc.).")}`,
          request.url,
        ),
      );
    }
    if (photoFile.size > MAX_PHOTO_SIZE) {
      return NextResponse.redirect(
        new URL(
          `/admin/students?error=${encodeURIComponent("Student photo must be less than 5 MB.")}`,
          request.url,
        ),
      );
    }

    const admin = createAdminClient();

    // Upload photo first so we can roll back cleanly
    const ext = (photoFile.name.split(".").pop() ?? "jpg").toLowerCase();
    const photoPath = `${globalThis.crypto.randomUUID()}.${ext}`;
    const photoBuffer = Buffer.from(await photoFile.arrayBuffer());

    const { error: uploadError } = await admin.storage
      .from(PHOTO_BUCKET)
      .upload(photoPath, photoBuffer, { contentType: photoFile.type, upsert: false });

    if (uploadError) {
      return NextResponse.redirect(
        new URL(
          `/admin/students?error=${encodeURIComponent(`Photo upload failed: ${uploadError.message}`)}`,
          request.url,
        ),
      );
    }

    const { data: { publicUrl: photoUrl } } = admin.storage
      .from(PHOTO_BUCKET)
      .getPublicUrl(photoPath);

    // Create auth user
    const { data: authUserResult, error: authCreateError } = await admin.auth.admin.createUser({
      email,
      password: temporary_password,
      email_confirm: true,
    });

    if (authCreateError || !authUserResult.user) {
      await deletePhoto(admin, photoPath);
      return NextResponse.redirect(
        new URL(
          `/admin/students?error=${encodeURIComponent(authCreateError?.message ?? "Failed to create auth user.")}`,
          request.url,
        ),
      );
    }

    const authUserId = authUserResult.user.id;

    // Create student record
    const { data: student, error: studentError } = await admin
      .from("students")
      .insert({
        full_name,
        email,
        school_id,
        father_name,
        father_cnic,
        photo_url: photoUrl,
      })
      .select("id")
      .single();

    if (studentError || !student) {
      await admin.auth.admin.deleteUser(authUserId);
      await deletePhoto(admin, photoPath);
      return NextResponse.redirect(
        new URL(
          `/admin/students?error=${encodeURIComponent(studentError?.message ?? "Failed to create student.")}`,
          request.url,
        ),
      );
    }

    // Create profile
    const { error: profileError } = await admin.from("profiles").insert({
      id: authUserId,
      role: "student",
      student_id: student.id,
    });

    if (profileError) {
      await admin.from("students").delete().eq("id", student.id);
      await admin.auth.admin.deleteUser(authUserId);
      await deletePhoto(admin, photoPath);
      return NextResponse.redirect(
        new URL(`/admin/students?error=${encodeURIComponent(profileError.message)}`, request.url),
      );
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
