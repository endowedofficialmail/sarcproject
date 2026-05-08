import { createClient } from "@/lib/supabase/server";

export type DashboardRole = "super_admin" | "school" | "institute" | "student";

export async function getDashboardUserContext(expectedRole: DashboardRole) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const fallback = {
    displayName: "Unknown User",
    email: "",
    role: expectedRole,
  };

  if (!user) return fallback;

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, school_id, institute_id, student_id")
    .eq("id", user.id)
    .maybeSingle();

  const role = (profile?.role as DashboardRole | undefined) ?? expectedRole;
  const email = user.email ?? "";

  if (role === "school" && profile?.school_id) {
    const { data: school } = await supabase
      .from("schools")
      .select("name")
      .eq("id", profile.school_id)
      .maybeSingle();
    return { displayName: school?.name ?? email ?? "School User", email, role };
  }

  if (role === "institute" && profile?.institute_id) {
    const { data: institute } = await supabase
      .from("institutes")
      .select("name")
      .eq("id", profile.institute_id)
      .maybeSingle();
    return { displayName: institute?.name ?? email ?? "Institute User", email, role };
  }

  if (role === "student" && profile?.student_id) {
    const { data: student } = await supabase
      .from("students")
      .select("full_name")
      .eq("id", profile.student_id)
      .maybeSingle();
    return { displayName: student?.full_name ?? email ?? "Student User", email, role };
  }

  return {
    displayName: email || "Super Admin",
    email,
    role,
  };
}
