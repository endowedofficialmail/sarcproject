"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building2, LogOut, Menu, ShieldCheck, UserRound } from "lucide-react";
import { useState } from "react";

import { logout } from "@/app/actions/auth";
import { cn } from "@/lib/utils";

type NavItem = {
  href: string;
  label: string;
};

type DashboardShellProps = {
  roleLabel: string;
  displayName: string;
  email?: string;
  navItems: NavItem[];
  children: React.ReactNode;
};

const PAGE_TITLES: Record<string, string> = {
  "/admin": "Super Admin Overview",
  "/admin/schools": "Schools",
  "/admin/institute-types": "Institute Types",
  "/admin/institutes": "Institutes",
  "/admin/benefits": "Benefits",
  "/admin/students": "Students",
  "/school": "School Overview",
  "/school/students": "My Students",
  "/school/institutes": "Institutes & Benefits",
  "/institute": "Student Verification",
  "/institute/benefits": "My Benefits",
  "/student": "Institutes & Benefits",
  "/student/my-claims": "My Claims",
};

function getPageTitle(pathname: string) {
  return PAGE_TITLES[pathname] ?? "Dashboard";
}

export function DashboardShell({
  roleLabel,
  displayName,
  email,
  navItems,
  children,
}: DashboardShellProps) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      {mobileOpen ? (
        <button
          type="button"
          className="fixed inset-0 z-30 bg-slate-900/40 lg:hidden"
          onClick={() => setMobileOpen(false)}
          aria-label="Close navigation overlay"
        />
      ) : null}

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-72 flex-col border-r border-border/80 bg-white shadow-sm transition-transform",
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0",
        )}
      >
        <div className="border-b border-border/80 px-5 py-5">
          <div className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" />
            <div>
              <div className="text-sm font-semibold tracking-wide text-slate-900">SARC Benefits</div>
              <div className="text-xs text-muted-foreground">Management System</div>
            </div>
          </div>
        </div>

        <nav className="flex-1 space-y-1 px-3 py-4">
          {navItems.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-primary/10 text-primary"
                    : "text-slate-700 hover:bg-muted hover:text-slate-900",
                )}
                onClick={() => setMobileOpen(false)}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-border/80 p-4">
          <div className="rounded-md bg-muted/60 p-3">
            <div className="flex items-center gap-2">
              <UserRound className="h-4 w-4 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-slate-900">{displayName}</div>
                {email ? <div className="truncate text-xs text-muted-foreground">{email}</div> : null}
              </div>
            </div>
            <div className="mt-2 inline-flex items-center gap-1 rounded-full bg-accent/20 px-2 py-1 text-xs font-medium text-accent-foreground">
              <ShieldCheck className="h-3.5 w-3.5" />
              {roleLabel}
            </div>
          </div>
          <form action={logout} className="mt-3">
            <button
              type="submit"
              className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-md border border-border bg-white px-3 text-sm font-medium text-slate-700 hover:bg-muted"
            >
              <LogOut className="h-4 w-4" />
              Logout
            </button>
          </form>
        </div>
      </aside>

      <div className="lg:pl-72">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-border/80 bg-white/95 px-4 backdrop-blur md:px-6">
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border text-slate-700 lg:hidden"
              onClick={() => setMobileOpen(true)}
              aria-label="Open navigation menu"
            >
              <Menu className="h-5 w-5" />
            </button>
            <h1 className="text-base font-semibold text-slate-900 md:text-lg">{getPageTitle(pathname)}</h1>
          </div>
        </header>

        <div className="p-4 md:p-6">{children}</div>
      </div>
    </div>
  );
}
