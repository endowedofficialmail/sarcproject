import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import "@/lib/validate-env";

type AppRole = "super_admin" | "school" | "institute" | "student";

const ROLE_BY_PREFIX: Record<string, AppRole> = {
  "/admin": "super_admin",
  "/school": "school",
  "/institute": "institute",
  "/student": "student",
};

const DASHBOARD_BY_ROLE: Record<AppRole, string> = {
  super_admin: "/admin",
  school: "/school",
  institute: "/institute",
  student: "/student",
};

function getRequiredRole(pathname: string): AppRole | null {
  for (const prefix of Object.keys(ROLE_BY_PREFIX)) {
    if (pathname === prefix || pathname.startsWith(`${prefix}/`)) {
      return ROLE_BY_PREFIX[prefix];
    }
  }

  return null;
}

export async function middleware(request: NextRequest) {
  const response = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const { data: authData, error: authError } = await supabase.auth.getUser();
  const user = authData.user;
  const pathname = request.nextUrl.pathname;
  const requiredRole = getRequiredRole(pathname);

  if (!requiredRole) {
    return response;
  }

  if (!user) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    const sessionExpired =
      typeof authError?.message === "string" &&
      /(expired|jwt|invalid token|invalid jwt|session)/i.test(authError.message);
    if (sessionExpired) {
      loginUrl.searchParams.set("message", "Your session has expired. Please log in again.");
    }
    return NextResponse.redirect(loginUrl);
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  const role = profile?.role as AppRole | undefined;

  if (!role || role !== requiredRole) {
    const fallback = role ? DASHBOARD_BY_ROLE[role] : "/login";
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = fallback;
    return NextResponse.redirect(redirectUrl);
  }

  return response;
}

export const config = {
  matcher: ["/admin/:path*", "/school/:path*", "/institute/:path*", "/student/:path*"],
};
