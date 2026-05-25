import { NextResponse } from "next/server";

import { createAdminClient } from "@/app/api/_lib/admin-client";
import {
  getZodErrorMessage,
  schoolCreateStudentSchema,
  schoolStudentListQuerySchema,
} from "@/app/api/_lib/validation";
import { createClient } from "@/lib/supabase/server";

const PAGE_SIZE_DEFAULT = 10;
const PHOTO_BUCKET = "student-photos";
const MAX_PHOTO_SIZE = 5 * 1024 * 1024; // 5 MB
const SESSION_EXPIRED_MESSAGE = "Your session has expired. Please log in again.";
function getSessionExpiredRedirect(requestUrl: string) {
  const loginUrl = new URL("/login", requestUrl);
  loginUrl.searchParams.set("message", SESSION_EXPIRED_MESSAGE);
  return loginUrl.toString();
}

async function getSchoolContext() {
  const supabase = createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { error: "Unauthorized", status: 401 as const, supabase: null, schoolId: null, userId: null };
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("school_id")
    .eq("id", user.id)
    .eq("role", "school")
    .single();

  if (profileError || !profile?.school_id) {
    return { error: "Forbidden", status: 403 as const, supabase: null, schoolId: null, userId: null };
  }

  return { error: null, status: 200 as const, supabase, schoolId: profile.school_id, userId: user.id };
}

export async function GET(request: Request) {
  try {
    const ctx = await getSchoolContext();
    if (ctx.error || !ctx.supabase || !ctx.schoolId) {
      if (ctx.status === 401) {
        return NextResponse.json(
          {
            error: "Unauthorized",
            sessionExpired: true,
            redirectTo: getSessionExpiredRedirect(request.url),
          },
          { status: 401 },
        );
      }
      return NextResponse.json({ error: ctx.error }, { status: ctx.status });
    }

    const { searchParams } = new URL(request.url);
    const queryParsed = schoolStudentListQuerySchema.safeParse({
      q: searchParams.get("q") ?? "",
      page: searchParams.get("page") ?? "1",
      pageSize: searchParams.get("pageSize") ?? String(PAGE_SIZE_DEFAULT),
    });
    if (!queryParsed.success) {
      return NextResponse.json({ error: getZodErrorMessage(queryParsed.error) }, { status: 400 });
    }
    const { q, page, pageSize } = queryParsed.data;
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    let query = ctx.supabase
      .from("students")
      .select("id, unique_student_id, full_name, email, created_at", { count: "exact" })
      .eq("school_id", ctx.schoolId)
      .order("created_at", { ascending: false });

    if (q) {
      query = query.or(`full_name.ilike.%${q}%,unique_student_id.ilike.%${q}%`);
    }

    const { data, count, error } = await query.range(from, to);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({
      data: data ?? [],
      pagination: {
        page,
        pageSize,
        total: count ?? 0,
        totalPages: Math.max(1, Math.ceil((count ?? 0) / pageSize)),
      },
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(err);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const ctx = await getSchoolContext();
    if (ctx.error || !ctx.schoolId) {
      if (ctx.status === 401) {
        return NextResponse.json(
          {
            error: "Unauthorized",
            sessionExpired: true,
            redirectTo: getSessionExpiredRedirect(request.url),
          },
          { status: 401 },
        );
      }
      return NextResponse.json({ error: ctx.error }, { status: ctx.status });
    }

    const body = await request.formData();
    const parsed = schoolCreateStudentSchema.safeParse({
      fullName: String(body.get("fullName") ?? ""),
      email: String(body.get("email") ?? "").toLowerCase(),
      temporaryPassword: String(body.get("temporaryPassword") ?? ""),
      fatherName: String(body.get("fatherName") ?? ""),
      fatherCnic: String(body.get("fatherCnic") ?? ""),
    });
    if (!parsed.success) {
      return NextResponse.json({ error: getZodErrorMessage(parsed.error) }, { status: 400 });
    }
    const { fullName, email, temporaryPassword, fatherName, fatherCnic } = parsed.data;

    // Validate photo
    const photoFile = body.get("photo") as File | null;
    if (!photoFile || photoFile.size === 0) {
      return NextResponse.json({ error: "Student photo is required." }, { status: 400 });
    }
    if (!photoFile.type.startsWith("image/")) {
      return NextResponse.json(
        { error: "Student photo must be an image file (JPG, PNG, etc.)." },
        { status: 400 },
      );
    }
    if (photoFile.size > MAX_PHOTO_SIZE) {
      return NextResponse.json({ error: "Student photo must be less than 5 MB." }, { status: 400 });
    }

    const adminClient = createAdminClient();

    // Upload photo
    const ext = (photoFile.name.split(".").pop() ?? "jpg").toLowerCase();
    const photoPath = `${globalThis.crypto.randomUUID()}.${ext}`;
    const photoBuffer = Buffer.from(await photoFile.arrayBuffer());

    const { error: uploadError } = await adminClient.storage
      .from(PHOTO_BUCKET)
      .upload(photoPath, photoBuffer, { contentType: photoFile.type, upsert: false });

    if (uploadError) {
      return NextResponse.json(
        { error: `Photo upload failed: ${uploadError.message}` },
        { status: 400 },
      );
    }

    const { data: { publicUrl: photoUrl } } = adminClient.storage
      .from(PHOTO_BUCKET)
      .getPublicUrl(photoPath);

    const deletePhoto = async () => {
      await adminClient.storage.from(PHOTO_BUCKET).remove([photoPath]);
    };

    const { data: authResult, error: authError } = await adminClient.auth.admin.createUser({
      email,
      password: temporaryPassword,
      email_confirm: true,
    });

    if (authError || !authResult.user) {
      await deletePhoto();
      return NextResponse.json({ error: authError?.message ?? "Failed to create auth user." }, { status: 400 });
    }

    const authUserId = authResult.user.id;

    const { data: student, error: studentError } = await adminClient
      .from("students")
      .insert({
        full_name: fullName,
        email,
        school_id: ctx.schoolId,
        father_name: fatherName,
        father_cnic: fatherCnic,
        photo_url: photoUrl,
      })
      .select("id, unique_student_id, full_name, email, created_at")
      .single();

    if (studentError || !student) {
      await adminClient.auth.admin.deleteUser(authUserId);
      await deletePhoto();
      return NextResponse.json({ error: studentError?.message ?? "Failed to create student." }, { status: 400 });
    }

    const { error: profileError } = await adminClient.from("profiles").insert({
      id: authUserId,
      role: "student",
      student_id: student.id,
    });

    if (profileError) {
      await adminClient.from("students").delete().eq("id", student.id);
      await adminClient.auth.admin.deleteUser(authUserId);
      await deletePhoto();
      return NextResponse.json({ error: profileError.message }, { status: 400 });
    }

    return NextResponse.json({ data: student }, { status: 201 });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(err);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 },
    );
  }
}
