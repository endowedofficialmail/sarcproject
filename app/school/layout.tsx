import { DashboardShell } from "@/components/dashboard-shell";
import { getDashboardUserContext } from "@/lib/dashboard/context";

const schoolNav = [
  { href: "/school", label: "Overview" },
  { href: "/school/students", label: "Students" },
  { href: "/school/institutes", label: "Institutes" },
];

export default async function SchoolLayout({ children }: { children: React.ReactNode }) {
  const user = await getDashboardUserContext("school");

  return (
    <DashboardShell roleLabel="School" displayName={user.displayName} email={user.email} navItems={schoolNav}>
      {children}
    </DashboardShell>
  );
}
