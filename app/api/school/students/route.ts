import { NextResponse } from "next/server";

import { createAdminClient } from "@/app/api/_lib/admin-client";
import {
  getZodErrorMessage,
  schoolCreateStudentSchema,
  schoolStudentListQuerySchema,
} from "@/app/api/_lib/validation";
import { createClient } from "@/lib/supabase/server";

const PAGE_SIZE_DEFAULT = 10;
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

    const body = (await request.json()) as Record<string, unknown>;
    const parsed = schoolCreateStudentSchema.safeParse({
      fullName: String(body.fullName ?? ""),
      email: String(body.email ?? "").toLowerCase(),
      temporaryPassword: String(body.temporaryPassword ?? ""),
    });
    if (!parsed.success) {
      return NextResponse.json({ error: getZodErrorMessage(parsed.error) }, { status: 400 });
    }
    const { fullName, email, temporaryPassword } = parsed.data;

    const adminClient = createAdminClient();
    const { data: authResult, error: authError } = await adminClient.auth.admin.createUser({
      email,
      password: temporaryPassword,
      email_confirm: true,
    });

    if (authError || !authResult.user) {
      return NextResponse.json({ error: authError?.message ?? "Failed to create auth user." }, { status: 400 });
    }

    const authUserId = authResult.user.id;

    const { data: student, error: studentError } = await adminClient
      .from("students")
      .insert({
        full_name: fullName,
        email,
        school_id: ctx.schoolId,
      })
      .select("id, unique_student_id, full_name, email, created_at")
      .single();

    if (studentError || !student) {
      await adminClient.auth.admin.deleteUser(authUserId);
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
