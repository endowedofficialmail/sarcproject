import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import { z } from "zod";

import {
  clearFailedAttempts,
  getClientIp,
  isRateLimited,
  recordFailedAttempt,
} from "@/app/api/_lib/rate-limit";

const loginSchema = z.object({
  email: z.string().trim().email("Please enter a valid email."),
  password: z.string().trim().min(1, "Password is required."),
});

type AppRole = "super_admin" | "school" | "institute" | "student";

const DASHBOARD_BY_ROLE: Record<AppRole, string> = {
  super_admin: "/admin",
  school: "/school",
  institute: "/institute",
  student: "/student",
};

export async function POST(request: Request) {
  try {
    const ip = getClientIp(request);

    if (isRateLimited(ip)) {
      return NextResponse.json({ error: "Too many attempts, try again later" }, { status: 429 });
    }

    const rawBody = (await request.json()) as Record<string, unknown>;
    const parsed = loginSchema.safeParse({
      email: String(rawBody.email ?? ""),
      password: String(rawBody.password ?? ""),
    });

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid login input." }, { status: 400 });
    }

    const response = NextResponse.json({ ok: true });
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            const cookieHeader = request.headers.get("cookie") ?? "";
            return cookieHeader
              .split(";")
              .map((part) => part.trim())
              .filter(Boolean)
              .map((cookie) => {
                const [name, ...rest] = cookie.split("=");
                return { name, value: rest.join("=") };
              });
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              response.cookies.set(name, value, options);
            });
          },
        },
      },
    );

    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
      email: parsed.data.email,
      password: parsed.data.password,
    });

    if (signInError || !signInData.user) {
      recordFailedAttempt(ip);
      return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", signInData.user.id)
      .maybeSingle();

    if (profileError || !profile?.role) {
      recordFailedAttempt(ip);
      return NextResponse.json(
        { error: "No profile role was found for this account. Contact administrator." },
        { status: 403 },
      );
    }

    const role = profile.role as AppRole;
    if (!(role in DASHBOARD_BY_ROLE)) {
      recordFailedAttempt(ip);
      return NextResponse.json({ error: "This account has an unsupported role." }, { status: 403 });
    }

    clearFailedAttempts(ip);
    return NextResponse.json({ redirectTo: DASHBOARD_BY_ROLE[role] }, { headers: response.headers });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(err);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 },
    );
  }
}
