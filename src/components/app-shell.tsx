"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/", label: "Dashboard", hint: "Month and year totals" },
  { href: "/payroll", label: "Payroll", hint: "People and salaries" },
  { href: "/trainers", label: "Trainers", hint: "Profiles, skills, budgets" },
  { href: "/expenses", label: "Expenses", hint: "Description, cost, custom fields" },
  { href: "/credits", label: "Credits", hint: "Money received" },
  { href: "/colleges", label: "Colleges", hint: "Collaborations, programs, price" },
  { href: "/invoices", label: "Invoices", hint: "Generate and print" },
  { href: "/quotations", label: "Quotations", hint: "Quote and print" },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-full md:grid md:grid-cols-[240px_minmax(0,1fr)]">
      <aside className="border-b border-line bg-white print:hidden md:sticky md:top-0 md:h-screen md:overflow-y-auto md:border-b-0 md:border-r">
        <Link href="/" aria-label="Infyskill EduTech, dashboard" className="block px-5 py-5">
          <img
            src="/infyskill-logo.png"
            alt="Infyskill EduTech Pvt. Ltd."
            className="h-12 w-auto max-w-full object-contain object-left"
          />
        </Link>
        <nav className="flex gap-2 overflow-x-auto px-3 pb-3 md:block md:px-3 md:pb-6">
          {items.map((item) => {
            const active = item.href === "/" ? pathname === "/" : pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`block min-w-40 rounded-xl px-3 py-2.5 md:mb-1 md:min-w-0 ${
                  active ? "bg-accent-soft text-accent" : "text-ink hover:bg-background"
                }`}
              >
                <span className="block text-sm font-medium">{item.label}</span>
                <span className={`block text-xs ${active ? "text-accent/80" : "text-muted"}`}>{item.hint}</span>
              </Link>
            );
          })}
        </nav>
      </aside>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
