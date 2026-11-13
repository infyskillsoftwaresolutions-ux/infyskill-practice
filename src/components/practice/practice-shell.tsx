"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { logoutAction } from "@/app/actions/practice";
import { PracticeSiteProvider } from "@/components/practice/practice-site";
import { Wordmark } from "@/components/practice/marks";
import type { PracticeRole } from "@/lib/practice-auth";

const ROLE_LABEL: Record<PracticeRole, string> = {
  main_admin: "Main admin",
  employee: "Employee",
  college_admin: "College admin",
  student: "Student",
};

export function PracticeShell({
  user,
  onHost = false,
  children,
}: {
  user: { fullName: string; role: PracticeRole };
  onHost?: boolean;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const home = onHost ? "/" : "/practice";
  const links =
    user.role === "student" || onHost
      ? [{ href: home, label: "Home" }]
      : user.role === "main_admin"
        ? [
            { href: "/practice", label: "Colleges" },
            { href: "/practice/team", label: "Employees" },
          ]
        : [{ href: "/practice", label: "Colleges" }];

  return (
    <PracticeSiteProvider onHost={onHost}>
    <div className="min-h-full">
      <header className="bg-[#1c1e18] text-[#f6f5f1]">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <div className="flex items-center gap-6">
            <Link href={home} className="text-[#f6f5f1]">
              <Wordmark light />
            </Link>
            <nav className="flex gap-1">
              {links.map((link) => {
                const active = link.href === "/" || link.href === "/practice" ? pathname === link.href : pathname.startsWith(link.href);
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`rounded-full px-3 py-1.5 text-sm ${active ? "bg-white/15 text-white" : "text-white/70 hover:text-white"}`}
                  >
                    {link.label}
                  </Link>
                );
              })}
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <p className="text-sm text-white/60">
              <span className="font-medium text-white">{user.fullName}</span>
              <span className="mx-1.5">·</span>
              {ROLE_LABEL[user.role]}
            </p>
            <form action={logoutAction}>
              <button type="submit" className="rounded-full border border-white/20 px-3 py-1.5 text-sm text-white hover:bg-white/10">
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>
      {children}
    </div>
    </PracticeSiteProvider>
  );
}
