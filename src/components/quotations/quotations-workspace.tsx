"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import {
  createQuotationAction,
  createQuotationFieldAction,
  deleteQuotationAction,
  deleteQuotationFieldAction,
  updateQuotationFieldAction,
} from "@/app/actions/quotations";
import { FieldsDialog } from "@/components/payroll/fields-dialog";
import { formatDate, formatMoney } from "@/lib/format";
import { QUOTATION_SUGGESTED_FIELDS } from "@/lib/quotation-suggestions";
import { QUOTATION_STATUSES, QUOTATION_STATUS_LABELS, quotationFigures, type QuotationStatus } from "@/lib/quotation-shared";
import type { Quotation } from "@/lib/quotations";
import type { FieldDefinition } from "@/lib/payroll-types";

type SortKey = "newest" | "number" | "total";

export function QuotationsWorkspace({
  quotations,
  fields,
}: {
  quotations: Quotation[];
  fields: FieldDefinition[];
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"all" | QuotationStatus>("all");
  const [sort, setSort] = useState<SortKey>("newest");
  const [fieldsOpen, setFieldsOpen] = useState(false);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const filtered = quotations.filter((quotation) => {
      if (status !== "all" && quotation.status !== status) return false;
      if (!needle) return true;
      const custom = Object.values(quotation.customFields)
        .map((value) => (value === null || value === undefined ? "" : String(value)))
        .join(" ");
      return [quotation.number, quotation.preparedFor, quotation.body.programTitle, quotation.body.closing, custom]
        .join(" ")
        .toLowerCase()
        .includes(needle);
    });
    return filtered.sort((a, b) => {
      if (sort === "number") return b.number.localeCompare(a.number, undefined, { numeric: true });
      if (sort === "total") return (quotationFigures(b.body).total ?? 0) - (quotationFigures(a.body).total ?? 0);
      return b.createdAt.localeCompare(a.createdAt);
    });
  }, [quotations, query, sort, status]);

  function createQuotation() {
    setError("");
    startTransition(async () => {
      const result = await createQuotationAction();
      if (!result.ok) {
        setError(result.error);
        return;
      }
      if (result.id) router.push(`/quotations/${result.id}`);
    });
  }

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">Quotations</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-ink">Generate a quotation</h1>
          <p className="mt-1 max-w-xl text-sm leading-6 text-muted">
            Start a draft, fill the program and price, and print a proposal on the InfySkill letterhead.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setFieldsOpen(true)}
            className="rounded-lg border border-line bg-card px-3.5 py-2 text-sm font-medium text-ink hover:bg-background"
          >
            Custom fields
          </button>
          <button
            type="button"
            onClick={createQuotation}
            disabled={pending}
            className="rounded-lg bg-accent px-3.5 py-2 text-sm font-medium text-white hover:bg-[#3e5ae0] disabled:opacity-60"
          >
            New quotation
          </button>
        </div>
      </header>

      <section className="rounded-2xl border border-line bg-card px-4 py-4">
        <p className="text-sm text-muted">Quotations</p>
        <p className="mt-1 text-2xl font-semibold text-ink">{quotations.length}</p>
      </section>

      <section className="rounded-2xl border border-line bg-card">
        <div className="flex flex-col flex-wrap gap-3 border-b border-line px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search number, name, or a custom field"
            className="w-full rounded-lg border border-line bg-background px-3 py-2 text-sm outline-none focus:border-accent sm:max-w-md"
          />
          <label className="flex items-center gap-2 text-sm text-muted">
            Status
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value as "all" | QuotationStatus)}
              className="rounded-lg border border-line bg-background px-2 py-2 text-sm text-ink"
            >
              <option value="all">All</option>
              {QUOTATION_STATUSES.map((item) => (
                <option key={item} value={item}>
                  {QUOTATION_STATUS_LABELS[item]}
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
              <option value="number">Number</option>
              <option value="total">Total</option>
            </select>
          </label>
        </div>
        {error ? <p className="mx-4 mt-3 rounded-lg bg-[#fdecec] px-3 py-2 text-sm text-danger">{error}</p> : null}
        {quotations.length === 0 ? (
          <div className="px-4 py-14 text-center">
            <p className="text-base font-medium text-ink">No quotations yet</p>
            <p className="mx-auto mt-1 max-w-md text-sm leading-6 text-muted">
              Create the first draft. The number continues from the last quotation, and the letter uses the InfySkill header.
            </p>
            <button
              type="button"
              onClick={createQuotation}
              disabled={pending}
              className="mt-4 rounded-lg bg-accent px-3.5 py-2 text-sm font-medium text-white hover:bg-[#3e5ae0] disabled:opacity-60"
            >
              New quotation
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-muted">
                <tr className="border-b border-line">
                  <th className="px-4 py-3 font-medium">Quotation</th>
                  <th className="px-4 py-3 font-medium">College</th>
                  <th className="px-4 py-3 font-medium">Program</th>
                  <th className="px-4 py-3 font-medium">Date</th>
                  <th className="px-4 py-3 font-medium">Total</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="row-actions px-4 py-3 font-medium"> </th>
                </tr>
              </thead>
              <tbody>
                {visible.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-muted">
                      Nothing matches that search.
                    </td>
                  </tr>
                ) : (
                  visible.map((quotation) => {
                    const total = quotationFigures(quotation.body).total;
                    return (
                    <tr key={quotation.id} className="border-b border-line last:border-0">
                      <td className="px-4 py-3 align-top">
                        <Link href={`/quotations/${quotation.id}`} className="font-medium text-ink hover:text-accent">
                          {quotation.number}
                        </Link>
                      </td>
                      <td className="px-4 py-3 align-top">{quotation.preparedFor || "—"}</td>
                      <td className="px-4 py-3 align-top">{quotation.body.programTitle || "—"}</td>
                      <td className="px-4 py-3 align-top">{quotation.issuedOn ? formatDate(quotation.issuedOn) : "—"}</td>
                      <td className="px-4 py-3 align-top whitespace-nowrap">
                        {total === null ? "—" : formatMoney(total, "INR")}
                      </td>
                      <td className="px-4 py-3 align-top">{QUOTATION_STATUS_LABELS[quotation.status]}</td>
                      <td className="row-actions px-4 py-3 align-top text-right">
                        {confirmId === quotation.id ? (
                          <div className="flex justify-end gap-3">
                            <button
                              type="button"
                              disabled={pending}
                              className="font-medium text-danger"
                              onClick={() => {
                                setError("");
                                startTransition(async () => {
                                  const result = await deleteQuotationAction(quotation.id);
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
                            onClick={() => setConfirmId(quotation.id)}
                          >
                            Delete
                          </button>
                        )}
                      </td>
                    </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <FieldsDialog
        open={fieldsOpen}
        fields={fields}
        onClose={() => setFieldsOpen(false)}
        suggestions={QUOTATION_SUGGESTED_FIELDS}
        description="These fields are added to every quotation and print under Additional Details."
        recordNoun="quotation"
        labelPlaceholder="Reference"
        choicePlaceholder="New, Renewal, Pilot"
        actions={{
          create: createQuotationFieldAction,
          update: updateQuotationFieldAction,
          remove: deleteQuotationFieldAction,
        }}
      />
    </main>
  );
}
