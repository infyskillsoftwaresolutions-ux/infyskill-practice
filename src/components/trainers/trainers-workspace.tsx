"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { deleteTrainerAction } from "@/app/actions/trainers";
import { TrainerDialog } from "@/components/trainers/trainer-dialog";
import { formatMoney } from "@/lib/format";
import type { Trainer } from "@/lib/trainers";
import { TRAINER_STATUSES, TRAINER_STATUS_LABELS, type TrainerStatus } from "@/lib/trainer-shared";
import type { CustomValue, FieldDefinition } from "@/lib/payroll-types";

type SortKey = "newest" | "name" | "daily";

function customText(value: CustomValue | undefined) {
  if (value === null || value === undefined || value === "") return "";
  if (typeof value === "boolean") return value ? "yes" : "no";
  return String(value);
}

export function TrainersWorkspace({
  trainers,
  fields,
}: {
  trainers: Trainer[];
  fields: FieldDefinition[];
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"all" | TrainerStatus>("all");
  const [sort, setSort] = useState<SortKey>("newest");
  const [formOpen, setFormOpen] = useState(false);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const filtered = trainers.filter((trainer) => {
      if (status !== "all" && trainer.status !== status) return false;
      if (!needle) return true;
      const custom = fields.map((field) => customText(trainer.customFields[field.key])).join(" ");
      return [trainer.name, trainer.phone, trainer.email, trainer.city, trainer.skills.join(" "), custom]
        .join(" ")
        .toLowerCase()
        .includes(needle);
    });
    return filtered.sort((a, b) => {
      if (sort === "name") return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
      if (sort === "daily") return (b.dailyBudget ?? -1) - (a.dailyBudget ?? -1);
      return b.createdAt.localeCompare(a.createdAt);
    });
  }, [trainers, fields, query, sort, status]);

  const activeCount = trainers.filter((trainer) => trainer.status === "active").length;

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">Trainers</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-ink">Trainer management</h1>
          <p className="mt-1 max-w-xl text-sm leading-6 text-muted">
            Save a name, then open the trainer to add contact, skills, budgets, and any extra fields.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setFormOpen(true)}
          className="rounded-lg bg-accent px-3.5 py-2 text-sm font-medium text-white hover:bg-[#3e5ae0]"
        >
          Add trainer
        </button>
      </header>

      <section className="grid gap-3 sm:grid-cols-2">
        <article className="rounded-2xl border border-line bg-card px-4 py-4">
          <p className="text-sm text-muted">Trainers</p>
          <p className="mt-1 text-2xl font-semibold text-ink">{trainers.length}</p>
        </article>
        <article className="rounded-2xl border border-line bg-card px-4 py-4">
          <p className="text-sm text-muted">Active</p>
          <p className="mt-1 text-2xl font-semibold text-ink">{activeCount}</p>
        </article>
      </section>

      <section className="rounded-2xl border border-line bg-card">
        <div className="flex flex-col flex-wrap gap-3 border-b border-line px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search name, contact, or skill"
            className="w-full rounded-lg border border-line bg-background px-3 py-2 text-sm outline-none focus:border-accent sm:max-w-md"
          />
          <label className="flex items-center gap-2 text-sm text-muted">
            Status
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value as "all" | TrainerStatus)}
              className="rounded-lg border border-line bg-background px-2 py-2 text-sm text-ink"
            >
              <option value="all">All</option>
              {TRAINER_STATUSES.map((item) => (
                <option key={item} value={item}>
                  {TRAINER_STATUS_LABELS[item]}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm text-muted">
            Sort
            <select
              value={sort}
              onChange={(event) => setSort(event.target.value as SortKey)}
              className="rounded-lg border border-line bg-background px-2 py-2 text-sm text-ink"
            >
              <option value="newest">Newest</option>
              <option value="name">Name</option>
              <option value="daily">Daily budget</option>
            </select>
          </label>
        </div>
        {error ? <p className="mx-4 mt-3 rounded-lg bg-[#fdecec] px-3 py-2 text-sm text-danger">{error}</p> : null}
        {trainers.length === 0 ? (
          <div className="px-4 py-14 text-center">
            <p className="text-base font-medium text-ink">No trainers yet</p>
            <p className="mx-auto mt-1 max-w-md text-sm leading-6 text-muted">
              Save a name first. Skills, budgets, and extra fields are added after you open the trainer.
            </p>
            <button
              type="button"
              onClick={() => setFormOpen(true)}
              className="mt-4 rounded-lg bg-accent px-3.5 py-2 text-sm font-medium text-white hover:bg-[#3e5ae0]"
            >
              Add trainer
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] border-collapse text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-muted">
                <tr className="border-b border-line">
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">Skills</th>
                  <th className="px-4 py-3 font-medium">Contact</th>
                  <th className="px-4 py-3 font-medium">Daily budget</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="row-actions px-4 py-3 font-medium"> </th>
                </tr>
              </thead>
              <tbody>
                {visible.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-muted">
                      Nothing matches that search.
                    </td>
                  </tr>
                ) : (
                  visible.map((trainer) => (
                    <tr key={trainer.id} className="border-b border-line last:border-0">
                      <td className="px-4 py-3 align-top">
                        <Link href={`/trainers/${trainer.id}`} className="font-medium text-ink hover:text-accent">
                          {trainer.name}
                        </Link>
                        {trainer.city ? <p className="text-xs text-muted">{trainer.city}</p> : null}
                      </td>
                      <td className="px-4 py-3 align-top">{trainer.skills.length > 0 ? trainer.skills.join(", ") : "—"}</td>
                      <td className="px-4 py-3 align-top">
                        {trainer.phone ? (
                          <a href={`tel:${trainer.phone}`} className="hover:text-accent">
                            {trainer.phone}
                          </a>
                        ) : (
                          "—"
                        )}
                        {trainer.email ? (
                          <p className="text-xs text-muted">
                            <a href={`mailto:${trainer.email}`} className="hover:text-accent">
                              {trainer.email}
                            </a>
                          </p>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 align-top whitespace-nowrap">
                        {trainer.dailyBudget === null ? "—" : formatMoney(trainer.dailyBudget, "INR")}
                      </td>
                      <td className="px-4 py-3 align-top">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                            trainer.status === "active" ? "bg-accent-soft text-accent" : "bg-background text-muted"
                          }`}
                        >
                          {TRAINER_STATUS_LABELS[trainer.status]}
                        </span>
                      </td>
                      <td className="row-actions px-4 py-3 align-top text-right">
                        {confirmId === trainer.id ? (
                          <div className="flex justify-end gap-3">
                            <button
                              type="button"
                              disabled={pending}
                              className="font-medium text-danger"
                              onClick={() => {
                                setError("");
                                startTransition(async () => {
                                  const result = await deleteTrainerAction(trainer.id);
                                  if (!result.ok) setError(result.error);
                                  setConfirmId(null);
                                });
                              }}
                            >
                              Delete
                            </button>
                            <button type="button" className="text-muted" onClick={() => setConfirmId(null)}>
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            className="font-medium text-danger"
                            onClick={() => setConfirmId(trainer.id)}
                          >
                            Delete
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <TrainerDialog
        open={formOpen}
        onClose={() => setFormOpen(false)}
        onCreated={(id) => {
          setFormOpen(false);
          router.push(`/trainers/${id}`);
        }}
      />
    </main>
  );
}
