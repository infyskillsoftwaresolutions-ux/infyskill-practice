"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { deleteInvoiceAction, saveInvoiceAction } from "@/app/actions/invoices";
import { customPayload, CustomFieldInputs, valuesFromCustom } from "@/components/colleges/custom-field-inputs";
import { CompanyDialog } from "@/components/invoices/company-dialog";
import { InvoiceSheet } from "@/components/invoices/invoice-sheet";
import { formatMoney } from "@/lib/format";
import {
  INVOICE_STATUSES,
  INVOICE_STATUS_LABELS,
  type InvoiceSettings,
  type InvoiceStatus,
} from "@/lib/invoice-shared";
import type { Invoice, InvoiceCollegeOption } from "@/lib/invoices";
import { CURRENCIES, type CurrencyCode, type CustomValue, type FieldDefinition } from "@/lib/payroll-types";

type LineDraft = { key: string; description: string; quantity: string; rate: string };

const inputClass =
  "w-full rounded-lg border border-line bg-background px-3 py-2 text-sm text-ink outline-none focus:border-accent";
const labelClass = "mb-1.5 block text-sm font-medium text-ink";

function blankLine(): LineDraft {
  return { key: crypto.randomUUID(), description: "", quantity: "1", rate: "" };
}

function linesFromInvoice(invoice: Invoice): LineDraft[] {
  if (invoice.lines.length === 0) return [blankLine()];
  return invoice.lines.map((line) => ({
    key: line.id,
    description: line.description,
    quantity: String(line.quantity),
    rate: String(line.rate),
  }));
}

export function InvoiceEditor({
  invoice,
  colleges,
  fields,
  settings,
}: {
  invoice: Invoice;
  colleges: InvoiceCollegeOption[];
  fields: FieldDefinition[];
  settings: InvoiceSettings;
}) {
  const router = useRouter();
  const [number, setNumber] = useState(invoice.number);
  const [collegeId, setCollegeId] = useState(invoice.collegeId);
  const [billToName, setBillToName] = useState(invoice.billToName);
  const [issuedOn, setIssuedOn] = useState(invoice.issuedOn);
  const [currency, setCurrency] = useState<CurrencyCode>(invoice.currency);
  const [status, setStatus] = useState<InvoiceStatus>(invoice.status);
  const [notes, setNotes] = useState(invoice.notes);
  const [lines, setLines] = useState<LineDraft[]>(() => linesFromInvoice(invoice));
  const [customFields, setCustomFields] = useState(() => valuesFromCustom(fields, invoice.customFields));
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [companyOpen, setCompanyOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    setNumber(invoice.number);
    setCollegeId(invoice.collegeId);
    setBillToName(invoice.billToName);
    setIssuedOn(invoice.issuedOn);
    setCurrency(invoice.currency);
    setStatus(invoice.status);
    setNotes(invoice.notes);
    setLines(linesFromInvoice(invoice));
    setCustomFields(valuesFromCustom(fields, invoice.customFields));
  }, [invoice.updatedAt, invoice.id, fields]);

  const college = colleges.find((item) => item.id === collegeId) ?? null;

  const previewLines = useMemo(
    () =>
      lines.map((line) => ({
        description: line.description,
        quantity: Number(line.quantity),
        rate: Number(line.rate),
      })),
    [lines],
  );

  const previewCustom = useMemo(() => {
    const values: Record<string, CustomValue> = {};
    for (const field of fields) {
      const value = customFields[field.key];
      if (field.type === "boolean") values[field.key] = value === true;
      else if (field.type === "number") values[field.key] = typeof value === "string" && value.trim() ? Number(value) : null;
      else values[field.key] = typeof value === "string" ? value : null;
    }
    return values;
  }, [customFields, fields]);

  function chooseCollege(nextId: string) {
    setCollegeId(nextId);
    setSaved(false);
    const next = colleges.find((item) => item.id === nextId);
    if (next) setBillToName(next.name);
  }

  function addProgram(program: InvoiceCollegeOption["programs"][number]) {
    setSaved(false);
    setLines((current) => {
      const row: LineDraft = {
        key: crypto.randomUUID(),
        description: program.name,
        quantity: "1",
        rate: String(program.price),
      };
      const onlyBlank =
        current.length === 1 && current[0].description.trim() === "" && current[0].rate.trim() === "";
      return onlyBlank ? [row] : [...current, row];
    });
    const hasRate = lines.some((line) => line.rate.trim() !== "");
    if (!hasRate) setCurrency(program.currency);
  }

  function addAllPrograms() {
    if (!college || college.programs.length === 0) return;
    setSaved(false);
    setLines((current) => {
      const onlyBlank =
        current.length === 1 && current[0].description.trim() === "" && current[0].rate.trim() === "";
      const rows = college.programs.map((program) => ({
        key: crypto.randomUUID(),
        description: program.name,
        quantity: "1",
        rate: String(program.price),
      }));
      return onlyBlank ? rows : [...current, ...rows];
    });
    const hasRate = lines.some((line) => line.rate.trim() !== "");
    const currencies = new Set(college.programs.map((program) => program.currency));
    if (!hasRate && currencies.size === 1) setCurrency(college.programs[0].currency);
  }

  function save(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setSaved(false);
    const payloadLines = lines.map((line) => ({
      description: line.description,
      quantity: line.quantity.trim() === "" ? "" : Number(line.quantity),
      rate: line.rate.trim() === "" ? "" : Number(line.rate),
    }));
    startTransition(async () => {
      const result = await saveInvoiceAction(invoice.id, {
        number,
        collegeId,
        billToName,
        issuedOn,
        currency,
        status,
        notes,
        lines: payloadLines,
        customFields: customPayload(fields, customFields),
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSaved(true);
    });
  }

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 print:max-w-none print:px-0 print:py-0 sm:px-6 lg:px-8">
      <div className="print:hidden">
        <Link href="/invoices" className="text-sm font-medium text-accent">
          All invoices
        </Link>
        <div className="mt-3 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">Invoice</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-ink">{number || "New invoice"}</h1>
            <p className="mt-1 max-w-xl text-sm leading-6 text-muted">
              Fill the form, then print the page below or choose Save as PDF in the print dialog.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setCompanyOpen(true)}
              className="rounded-lg border border-line bg-card px-3.5 py-2 text-sm font-medium text-ink hover:bg-background"
            >
              Company details
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="rounded-lg border border-line bg-card px-3.5 py-2 text-sm font-medium text-ink hover:bg-background"
            >
              Print or save PDF
            </button>
          </div>
        </div>
      </div>

      {error ? <p className="rounded-lg bg-[#fdecec] px-3 py-2 text-sm text-danger print:hidden">{error}</p> : null}

      <form onSubmit={save} className="grid gap-4 rounded-2xl border border-line bg-card p-4 print:hidden sm:p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <label>
            <span className={labelClass}>Bill to</span>
            <select className={inputClass} value={collegeId} onChange={(event) => chooseCollege(event.target.value)}>
              <option value="">Type a name</option>
              {colleges.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className={labelClass}>Name on the invoice</span>
            <input className={inputClass} value={billToName} onChange={(event) => { setBillToName(event.target.value); setSaved(false); }} required />
          </label>
          <label>
            <span className={labelClass}>Invoice number</span>
            <input className={inputClass} value={number} onChange={(event) => { setNumber(event.target.value); setSaved(false); }} required />
          </label>
          <label>
            <span className={labelClass}>Date</span>
            <input className={inputClass} type="date" value={issuedOn} onChange={(event) => { setIssuedOn(event.target.value); setSaved(false); }} required />
          </label>
          <label>
            <span className={labelClass}>Currency</span>
            <select className={inputClass} value={currency} onChange={(event) => { setCurrency(event.target.value as CurrencyCode); setSaved(false); }}>
              {CURRENCIES.map((code) => (
                <option key={code} value={code}>{code}</option>
              ))}
            </select>
          </label>
          <label>
            <span className={labelClass}>Status</span>
            <select className={inputClass} value={status} onChange={(event) => { setStatus(event.target.value as InvoiceStatus); setSaved(false); }}>
              {INVOICE_STATUSES.map((item) => (
                <option key={item} value={item}>{INVOICE_STATUS_LABELS[item]}</option>
              ))}
            </select>
          </label>
        </div>

        {college && college.programs.length > 0 ? (
          <div className="rounded-xl border border-line bg-background p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-medium text-ink">Programs from {college.name}</p>
              <button type="button" onClick={addAllPrograms} className="text-sm font-medium text-accent">
                Add all
              </button>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {college.programs.map((program) => (
                <button
                  key={`${program.name}-${program.price}-${program.currency}`}
                  type="button"
                  onClick={() => addProgram(program)}
                  className="rounded-full border border-line bg-background px-3 py-1.5 text-sm text-ink hover:bg-card"
                >
                  {program.name} · {formatMoney(program.price, program.currency)}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <div className="grid gap-3">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-ink">Lines</h2>
            <button
              type="button"
              onClick={() => {
                setSaved(false);
                setLines((current) => [...current, blankLine()]);
              }}
              className="rounded-lg border border-line bg-background px-3 py-1.5 text-sm font-medium text-ink hover:bg-background"
            >
              Add line
            </button>
          </div>
          {lines.map((line, index) => (
            <div key={line.key} className="grid gap-2 rounded-lg border border-line p-3 sm:grid-cols-[minmax(0,1.4fr)_5rem_8rem_auto] sm:items-end">
              <label>
                <span className={labelClass}>Description {index + 1}</span>
                <input
                  className={inputClass}
                  value={line.description}
                  onChange={(event) => {
                    const value = event.target.value;
                    setSaved(false);
                    setLines((current) => current.map((item) => (item.key === line.key ? { ...item, description: value } : item)));
                  }}
                />
              </label>
              <label>
                <span className={labelClass}>Qty</span>
                <input
                  className={inputClass}
                  inputMode="decimal"
                  value={line.quantity}
                  onChange={(event) => {
                    const value = event.target.value;
                    setSaved(false);
                    setLines((current) => current.map((item) => (item.key === line.key ? { ...item, quantity: value } : item)));
                  }}
                />
              </label>
              <label>
                <span className={labelClass}>Rate</span>
                <input
                  className={inputClass}
                  inputMode="decimal"
                  value={line.rate}
                  onChange={(event) => {
                    const value = event.target.value;
                    setSaved(false);
                    setLines((current) => current.map((item) => (item.key === line.key ? { ...item, rate: value } : item)));
                  }}
                />
              </label>
              <button
                type="button"
                onClick={() => {
                  setSaved(false);
                  setLines((current) => (current.length === 1 ? [blankLine()] : current.filter((item) => item.key !== line.key)));
                }}
                className="rounded-lg px-2 py-2 text-sm font-medium text-danger hover:bg-[#fdecec]"
              >
                Remove
              </button>
            </div>
          ))}
        </div>

        <CustomFieldInputs
          fields={fields}
          values={customFields}
          onChange={(key, value) => {
            setSaved(false);
            setCustomFields((current) => ({ ...current, [key]: value }));
          }}
          emptyText="No extra fields yet. Add them from Custom fields on the invoices page."
        />

        <label>
          <span className={labelClass}>Notes</span>
          <textarea
            className={`${inputClass} min-h-20 resize-y`}
            value={notes}
            onChange={(event) => {
              setNotes(event.target.value);
              setSaved(false);
            }}
          />
        </label>

        <div className="sticky bottom-0 z-10 -mx-4 flex flex-wrap items-center justify-between gap-3 border-t border-line bg-card/95 px-4 py-3 backdrop-blur sm:-mx-5 sm:px-5">
          {confirmDelete ? (
            <div className="flex gap-3 text-sm">
              <button
                type="button"
                disabled={pending}
                className="font-medium text-danger"
                onClick={() => {
                  setError("");
                  startTransition(async () => {
                    const result = await deleteInvoiceAction(invoice.id);
                    if (!result.ok) {
                      setError(result.error);
                      return;
                    }
                    router.push("/invoices");
                  });
                }}
              >
                Delete this invoice
              </button>
              <button type="button" className="text-muted" onClick={() => setConfirmDelete(false)}>
                Cancel
              </button>
            </div>
          ) : (
            <button type="button" className="text-sm font-medium text-danger" onClick={() => setConfirmDelete(true)}>
              Delete
            </button>
          )}
          <div className="flex items-center gap-3">
            {saved ? <p className="text-sm text-muted">Saved</p> : null}
            <button
              type="submit"
              disabled={pending}
              className="rounded-lg bg-accent px-3.5 py-2 text-sm font-medium text-white hover:bg-[#3e5ae0] disabled:opacity-60"
            >
              {pending ? "Saving…" : "Save invoice"}
            </button>
          </div>
        </div>
      </form>

      <InvoiceSheet
        number={number}
        issuedOn={issuedOn}
        status={status}
        billToName={billToName}
        currency={currency}
        lines={previewLines.filter((line) => Number.isFinite(line.quantity) && Number.isFinite(line.rate))}
        notes={notes}
        customFields={previewCustom}
        fields={fields}
        settings={settings}
      />

      <CompanyDialog open={companyOpen} settings={settings} onClose={() => setCompanyOpen(false)} />
    </main>
  );
}
