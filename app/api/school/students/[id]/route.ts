import { NextResponse } from "next/server";

import { createAdminClient } from "@/app/api/_lib/admin-client";
import {
  getZodErrorMessage,
  schoolStudentIdParamsSchema,
  schoolUpdateStudentSchema,
} from "@/app/api/_lib/validation";
import { createClient } from "@/lib/supabase/server";

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
    return { error: "Unauthorized", status: 401 as const, supabase: null, schoolId: null };
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("school_id")
    .eq("id", user.id)
    .eq("role", "school")
    .single();

  if (profileError || !profile?.school_id) {
    return { error: "Forbidden", status: 403 as const, supabase: null, schoolId: null };
  }

  return { error: null, status: 200 as const, supabase, schoolId: profile.school_id };
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
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

    const adminClient = createAdminClient();
    const parsedParams = schoolStudentIdParamsSchema.safeParse(params);
    if (!parsedParams.success) {
      return NextResponse.json({ error: getZodErrorMessage(parsedParams.error) }, { status: 400 });
    }
    const { id } = parsedParams.data;

    const body = (await request.json()) as Record<string, unknown>;
    const parsedBody = schoolUpdateStudentSchema.safeParse({
      fullName: String(body.fullName ?? ""),
    });
    if (!parsedBody.success) {
      return NextResponse.json({ error: getZodErrorMessage(parsedBody.error) }, { status: 400 });
    }
    const { fullName } = parsedBody.data;

    const { data, error } = await adminClient
      .from("students")
      .update({ full_name: fullName })
      .eq("id", id)
      .eq("school_id", ctx.schoolId)
      .select("id, unique_student_id, full_name, email, created_at")
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ data });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(err);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 },
    );
  }
}

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  try {
    const ctx = await getSchoolContext();
    if (ctx.error || !ctx.schoolId) {
      if (ctx.status === 401) {
        return NextResponse.json(
          {
            error: "Unauthorized",
            sessionExpired: true,
            redirectTo: getSessionExpiredRedirect(_request.url),
          },
          { status: 401 },
        );
      }
      return NextResponse.json({ error: ctx.error }, { status: ctx.status });
    }

    const adminClient = createAdminClient();
    const parsedParams = schoolStudentIdParamsSchema.safeParse(params);
    if (!parsedParams.success) {
      return NextResponse.json({ error: getZodErrorMessage(parsedParams.error) }, { status: 400 });
    }
    const { id } = parsedParams.data;

    const { data: student, error: studentError } = await adminClient
      .from("students")
      .select("id, full_name")
      .eq("id", id)
      .eq("school_id", ctx.schoolId)
      .single();

    if (studentError || !student) {
      return NextResponse.json({ error: studentError?.message ?? "Student not found." }, { status: 404 });
    }

    const { data: profile, error: profileError } = await adminClient
      .from("profiles")
      .select("id")
      .eq("student_id", id)
      .eq("role", "student")
      .maybeSingle();

    if (profileError) {
      return NextResponse.json({ error: profileError.message }, { status: 400 });
    }

    const { error: deleteStudentError } = await adminClient.from("students").delete().eq("id", id);
    if (deleteStudentError) {
      return NextResponse.json({ error: deleteStudentError.message }, { status: 400 });
    }

    if (profile?.id) {
      const { error: deleteAuthError } = await adminClient.auth.admin.deleteUser(profile.id);
      if (deleteAuthError) {
        return NextResponse.json({ error: deleteAuthError.message }, { status: 400 });
      }
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(err);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 },
    );
  }
}
