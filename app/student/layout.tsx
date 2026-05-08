import { DashboardShell } from "@/components/dashboard-shell";
import { getDashboardUserContext } from "@/lib/dashboard/context";

const studentNav = [
  { href: "/student", label: "Institutes" },
  { href: "/student/my-claims", label: "My Claims" },
];

export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  const user = await getDashboardUserContext("student");

  return (
    <DashboardShell roleLabel="Student" displayName={user.displayName} email={user.email} navItems={studentNav}>
      {children}
    </DashboardShell>
  );
}
