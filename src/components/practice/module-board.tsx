"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { disableModuleAction, enableModuleAction } from "@/app/actions/practice-questions";
import { ModuleMark } from "@/components/practice/marks";
import { usePracticeSite } from "@/components/practice/practice-site";
import { moduleHref } from "@/lib/practice-host";
import type { ModuleCard } from "@/lib/practice-questions";
import type { PracticeRole } from "@/lib/practice-auth";

export function ModuleBoard({
  role,
  collegeId,
  modules,
}: {
  role: PracticeRole;
  collegeId: string;
  modules: ModuleCard[];
}) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pendingKey, setPendingKey] = useState("");
  const [pending, startTransition] = useTransition();
  const manage = role === "main_admin";
  const { onHost } = usePracticeSite();
  const visible = manage ? modules : modules.filter((module) => module.enabled);

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
    <section className="grid gap-3">
      <div>
        <h2 className="text-base font-semibold text-ink">Modules</h2>
        <p className="mt-1 text-sm text-muted">
          {manage
            ? "Turn on the modules this college needs, then add questions inside each one."
            : role === "employee"
              ? "Open a module to add questions. New questions stay in draft until the main admin publishes them."
              : "Published questions for this college."}
        </p>
      </div>
      {error ? <p className="rounded-lg bg-[#fdecec] px-3 py-2 text-sm text-danger">{error}</p> : null}
      {visible.length === 0 ? (
        <p className="rounded-2xl border border-line bg-card px-4 py-8 text-sm text-muted">No modules are turned on yet.</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((module) => {
            const href = moduleHref(collegeId, module.key, onHost);
            return (
              <article key={module.key} className="flex flex-col rounded-2xl border border-line bg-card px-4 py-4">
                <div className="flex items-center gap-3">
                  <ModuleMark moduleKey={module.key} />
                  <p className="text-base font-semibold text-ink">{module.label}</p>
                </div>
                <p className="mt-1 text-sm text-muted">
                  {module.enabled
                    ? `${module.publishedCount} published${role === "main_admin" || role === "employee" ? ` · ${module.draftCount} draft` : ""}`
                    : "Not added"}
                </p>
                <div className="mt-4 flex gap-2">
                  {module.enabled ? (
                    <Link href={href} className="rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-white hover:bg-[#3e5ae0]">
                      Open
                    </Link>
                  ) : null}
                  {manage ? (
                    <button
                      type="button"
                      disabled={pending && pendingKey === module.key}
                      onClick={() => change(module, !module.enabled)}
                      className="rounded-lg border border-line px-3 py-1.5 text-sm text-ink hover:bg-background disabled:opacity-60"
                    >
                      {module.enabled ? "Turn off" : "Add"}
                    </button>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
