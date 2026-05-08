import { DashboardShell } from "@/components/dashboard-shell";
import { getDashboardUserContext } from "@/lib/dashboard/context";

const adminNav = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/schools", label: "Schools" },
  { href: "/admin/institute-types", label: "Institute Types" },
  { href: "/admin/institutes", label: "Institutes" },
  { href: "/admin/benefits", label: "Benefits" },
  { href: "/admin/students", label: "Students" },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getDashboardUserContext("super_admin");

  return (
    <DashboardShell
      roleLabel="Super Admin"
      displayName={user.displayName}
      email={user.email}
      navItems={adminNav}
    >
      {children}
    </DashboardShell>
  );
}
