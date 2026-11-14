"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { disableModuleAction, enableModuleAction } from "@/app/actions/practice-questions";
import { ModuleMark } from "@/components/practice/marks";
import { usePracticeSite } from "@/components/practice/practice-site";
import { moduleHref } from "@/lib/practice-host";
import type { PracticeRole } from "@/lib/practice-auth";
import type { ModuleCard } from "@/lib/practice-questions";

export function ModuleRail({
  role,
  collegeId,
  modules,
  activeKey = "",
  homeHref,
  homeLabel,
}: {
  role: PracticeRole;
  collegeId: string;
  modules: ModuleCard[];
  activeKey?: string;
  homeHref: string;
  homeLabel: string;
}) {
  const router = useRouter();
  const { onHost } = usePracticeSite();
  const manage = role === "main_admin";
  const staff = role === "main_admin" || role === "employee";
  const visible = manage ? modules : modules.filter((module) => module.enabled);
  const [error, setError] = useState("");
  const [pendingKey, setPendingKey] = useState("");
  const [pending, startTransition] = useTransition();

  function change(module: ModuleCard, enable: boolean) {
    setError("");
    setPendingKey(module.key);
    startTransition(async () => {
      const result = enable ? await enableModuleAction(collegeId, module.key) : await disableModuleAction(collegeId, module.key);
      setPendingKey("");
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <aside className="border-b border-line bg-card lg:sticky lg:top-0 lg:max-h-screen lg:overflow-y-auto lg:border-b-0 lg:border-r">
      <div className="px-4 pb-2 pt-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted">Modules</p>
      </div>
      <nav className="flex gap-2 overflow-x-auto px-3 pb-4 lg:grid lg:gap-1 lg:overflow-visible lg:px-3 lg:pb-6">
        <Link
          href={homeHref}
          className={`flex min-w-36 shrink-0 items-center gap-3 rounded-xl px-3 py-2.5 lg:min-w-0 ${
            activeKey === "" ? "bg-accent-soft text-accent" : "text-ink hover:bg-background"
          }`}
        >
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[#1c1e18] text-[10px] font-semibold text-white">IS</span>
          <span className="min-w-0">
            <span className="block text-sm font-semibold">{homeLabel}</span>
            <span className={`block text-xs ${activeKey === "" ? "text-accent/80" : "text-muted"}`}>Overview</span>
          </span>
        </Link>
        {visible.map((module) => {
          const active = activeKey === module.key;
          const detail = !module.enabled
            ? "Off"
            : role === "student"
              ? `${module.solvedCount} of ${module.publishedCount} solved`
              : staff
                ? `${module.publishedCount} published · ${module.draftCount} draft`
                : `${module.publishedCount} published`;
          const row = (
            <>
              <ModuleMark moduleKey={module.key} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold">{module.label}</span>
                <span className={`block truncate text-xs ${active ? "text-accent/80" : "text-muted"}`}>{detail}</span>
              </span>
            </>
          );
          if (!module.enabled) {
            return (
              <div key={module.key} className="flex min-w-44 shrink-0 items-center gap-2 rounded-xl px-3 py-2.5 text-ink lg:min-w-0">
                {row}
                {manage ? (
                  <button
                    type="button"
                    disabled={pending && pendingKey === module.key}
                    onClick={() => change(module, true)}
                    className="rounded-lg bg-accent px-2.5 py-1 text-xs font-medium text-white disabled:opacity-60"
                  >
                    Add
                  </button>
                ) : null}
              </div>
            );
          }
          return (
            <div key={module.key} className={`flex min-w-44 shrink-0 items-center gap-1 rounded-xl lg:min-w-0 ${active ? "bg-accent-soft" : "hover:bg-background"}`}>
              <Link href={moduleHref(collegeId, module.key, onHost)} className={`flex min-w-0 flex-1 items-center gap-3 px-3 py-2.5 ${active ? "text-accent" : "text-ink"}`}>
                {row}
              </Link>
              {manage ? (
                <button
                  type="button"
                  disabled={pending && pendingKey === module.key}
                  onClick={() => change(module, false)}
                  className="mr-3 hidden shrink-0 text-xs text-muted hover:text-ink disabled:opacity-60 lg:inline"
                >
                  Off
                </button>
              ) : null}
            </div>
          );
        })}
      </nav>
      {error ? <p className="px-4 pb-4 text-xs text-danger">{error}</p> : null}
    </aside>
  );
}
