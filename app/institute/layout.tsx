import { DashboardShell } from "@/components/dashboard-shell";
import { getDashboardUserContext } from "@/lib/dashboard/context";

const instituteNav = [
  { href: "/institute", label: "Student Verification" },
  { href: "/institute/benefits", label: "My Benefits" },
];

export default async function InstituteLayout({ children }: { children: React.ReactNode }) {
  const user = await getDashboardUserContext("institute");

  return (
    <DashboardShell
      roleLabel="Institute"
      displayName={user.displayName}
      email={user.email}
      navItems={instituteNav}
    >
      {children}
    </DashboardShell>
  );
}
