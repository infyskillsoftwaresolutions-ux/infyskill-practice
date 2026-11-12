"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { deleteQuotationAction, saveQuotationAction } from "@/app/actions/quotations";
import { customPayload, CustomFieldInputs, valuesFromCustom } from "@/components/colleges/custom-field-inputs";
import { QuotationSheet } from "@/components/quotations/quotation-sheet";
import type { CustomValue, FieldDefinition } from "@/lib/payroll-types";
import {
  QUOTATION_STATUSES,
  QUOTATION_STATUS_LABELS,
  emptyQuotationBody,
  type QuotationBody,
  type QuotationStatus,
  type TrainingArea,
} from "@/lib/quotation-shared";
import type { Quotation, QuotationCollegeOption } from "@/lib/quotations";

const inputClass =
  "w-full rounded-lg border border-line bg-background px-3 py-2 text-sm text-ink outline-none focus:border-accent";
const labelClass = "mb-1.5 block text-sm font-medium text-ink";

function blankArea(): TrainingArea {
  return { title: "", points: "" };
}

export function QuotationEditor({
  quotation,
  colleges,
  fields,
}: {
  quotation: Quotation;
  colleges: QuotationCollegeOption[];
  fields: FieldDefinition[];
}) {
  const router = useRouter();
  const [number, setNumber] = useState(quotation.number);
  const [collegeId, setCollegeId] = useState(quotation.collegeId);
  const [preparedFor, setPreparedFor] = useState(quotation.preparedFor);
  const [issuedOn, setIssuedOn] = useState(quotation.issuedOn);
  const [status, setStatus] = useState<QuotationStatus>(quotation.status);
  const [body, setBody] = useState<QuotationBody>(quotation.body ?? emptyQuotationBody());
  const [customFields, setCustomFields] = useState(() => valuesFromCustom(fields, quotation.customFields));
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    setNumber(quotation.number);
    setCollegeId(quotation.collegeId);
    setPreparedFor(quotation.preparedFor);
    setIssuedOn(quotation.issuedOn);
    setStatus(quotation.status);
    setBody(quotation.body ?? emptyQuotationBody());
    setCustomFields(valuesFromCustom(fields, quotation.customFields));
  }, [quotation.updatedAt, quotation.id, fields]);

  const college = colleges.find((item) => item.id === collegeId) ?? null;
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

  function patchBody(patch: Partial<QuotationBody>) {
    setSaved(false);
    setBody((current) => ({ ...current, ...patch }));
  }

  function chooseCollege(nextId: string) {
    setCollegeId(nextId);
    setSaved(false);
    const next = colleges.find((item) => item.id === nextId);
    if (next) setPreparedFor(next.name);
  }

  function save(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setSaved(false);
    startTransition(async () => {
      const result = await saveQuotationAction(quotation.id, {
        number,
        collegeId,
        preparedFor,
        issuedOn,
        status,
        body,
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
        <Link href="/quotations" className="text-sm font-medium text-accent">
          All quotations
        </Link>
        <div className="mt-3 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">Quotation</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-ink">{number || "New quotation"}</h1>
            <p className="mt-1 max-w-xl text-sm leading-6 text-muted">
              Fill the proposal. The letter below uses the InfySkill header. Print it or choose Save as PDF.
            </p>
          </div>
          <button
            type="button"
            onClick={() => window.print()}
            className="rounded-lg border border-line bg-card px-3.5 py-2 text-sm font-medium text-ink hover:bg-background"
          >
            Print or save PDF
          </button>
        </div>
      </div>

      {error ? <p className="rounded-lg bg-[#fdecec] px-3 py-2 text-sm text-danger print:hidden">{error}</p> : null}

      <form onSubmit={save} className="grid gap-4 rounded-2xl border border-line bg-card p-4 print:hidden sm:p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <label>
            <span className={labelClass}>College</span>
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
            <span className={labelClass}>College name on the letter</span>
            <input
              className={inputClass}
              value={preparedFor}
              onChange={(event) => {
                setPreparedFor(event.target.value);
                setSaved(false);
              }}
              required
            />
          </label>
          <label>
            <span className={labelClass}>Addressed to</span>
            <input className={inputClass} value={body.addressee} onChange={(event) => patchBody({ addressee: event.target.value })} />
          </label>
          <label>
            <span className={labelClass}>Program title</span>
            <input
              className={inputClass}
              value={body.programTitle}
              onChange={(event) => patchBody({ programTitle: event.target.value })}
              required
            />
          </label>
          <label>
            <span className={labelClass}>Quotation number</span>
            <input
              className={inputClass}
              value={number}
              onChange={(event) => {
                setNumber(event.target.value);
                setSaved(false);
              }}
              required
            />
          </label>
          <label>
            <span className={labelClass}>Date</span>
            <input
              className={inputClass}
              type="date"
              value={issuedOn}
              onChange={(event) => {
                setIssuedOn(event.target.value);
                setSaved(false);
              }}
              required
            />
          </label>
          <label>
            <span className={labelClass}>Status</span>
            <select
              className={inputClass}
              value={status}
              onChange={(event) => {
                setStatus(event.target.value as QuotationStatus);
                setSaved(false);
              }}
            >
              {QUOTATION_STATUSES.map((item) => (
                <option key={item} value={item}>
                  {QUOTATION_STATUS_LABELS[item]}
                </option>
              ))}
            </select>
          </label>
        </div>

        {college && college.programs.length > 0 ? (
          <div>
            <p className="text-sm font-medium text-ink">Use a program name</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {college.programs.map((program) => (
                <button
                  key={program.name}
                  type="button"
                  onClick={() => patchBody({ programTitle: program.name })}
                  className="rounded-full border border-line bg-background px-3 py-1.5 text-sm text-ink hover:bg-background"
                >
                  {program.name}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <section className="grid gap-4 rounded-xl border border-line bg-background p-4">
          <h2 className="text-sm font-semibold text-ink">Program details</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <label>
              <span className={labelClass}>Training duration</span>
              <input className={inputClass} value={body.duration} placeholder="72 Hours per batch" onChange={(event) => patchBody({ duration: event.target.value })} />
            </label>
            <label>
              <span className={labelClass}>Training mode</span>
              <input className={inputClass} value={body.mode} placeholder="Classroom Training" onChange={(event) => patchBody({ mode: event.target.value })} />
            </label>
            <label>
              <span className={labelClass}>Number of batches</span>
              <input className={inputClass} inputMode="decimal" value={body.batches} onChange={(event) => patchBody({ batches: event.target.value })} />
            </label>
            <label>
              <span className={labelClass}>Batch size</span>
              <input className={inputClass} inputMode="decimal" value={body.batchSize} onChange={(event) => patchBody({ batchSize: event.target.value })} />
            </label>
            <label>
              <span className={labelClass}>Total students</span>
              <input
                className={inputClass}
                inputMode="decimal"
                value={body.totalStudents}
                placeholder="Leave blank to use batches × batch size"
                onChange={(event) => patchBody({ totalStudents: event.target.value })}
              />
            </label>
            <label>
              <span className={labelClass}>Target audience</span>
              <input className={inputClass} value={body.audience} placeholder="BCA & BBA students" onChange={(event) => patchBody({ audience: event.target.value })} />
            </label>
          </div>
        </section>

        <section className="grid gap-3 rounded-xl border border-line bg-background p-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-ink">Training areas</h2>
            <button
              type="button"
              onClick={() => patchBody({ areas: [...body.areas, blankArea()] })}
              className="rounded-lg border border-line bg-background px-3 py-1.5 text-sm font-medium text-ink"
            >
              Add area
            </button>
          </div>
          {body.areas.length === 0 ? <p className="text-sm text-muted">Add Verbal Skills, Soft Skills, or any other area. One point per line.</p> : null}
          {body.areas.map((area, index) => (
            <div key={index} className="grid gap-2 rounded-lg border border-line bg-card p-3">
              <div className="flex items-center justify-between gap-3">
                <label className="min-w-0 flex-1">
                  <span className={labelClass}>Area title</span>
                  <input
                    className={inputClass}
                    value={area.title}
                    onChange={(event) => {
                      const title = event.target.value;
                      patchBody({
                        areas: body.areas.map((item, itemIndex) => (itemIndex === index ? { ...item, title } : item)),
                      });
                    }}
                  />
                </label>
                <button
                  type="button"
                  className="mt-6 text-sm font-medium text-danger"
                  onClick={() => patchBody({ areas: body.areas.filter((_, itemIndex) => itemIndex !== index) })}
                >
                  Remove
                </button>
              </div>
              <label>
                <span className={labelClass}>Points</span>
                <textarea
                  className={`${inputClass} min-h-24 resize-y`}
                  value={area.points}
                  placeholder={"English Grammar and Sentence Formation\nVocabulary Building and Usage"}
                  onChange={(event) => {
                    const points = event.target.value;
                    patchBody({
                      areas: body.areas.map((item, itemIndex) => (itemIndex === index ? { ...item, points } : item)),
                    });
                  }}
                />
              </label>
            </div>
          ))}
        </section>

        <section className="grid gap-4 rounded-xl border border-line bg-background p-4 sm:grid-cols-2">
          <h2 className="text-sm font-semibold text-ink sm:col-span-2">Price, deliverables, and terms</h2>
          <label>
            <span className={labelClass}>Cost per student (₹)</span>
            <input className={inputClass} inputMode="decimal" value={body.costPerStudent} onChange={(event) => patchBody({ costPerStudent: event.target.value })} />
          </label>
          <p className="self-end text-sm leading-6 text-muted">
            Batch cost and the total are calculated from the cost, batch size, and number of students.
          </p>
          <label>
            <span className={labelClass}>Deliverables</span>
            <textarea className={`${inputClass} min-h-28 resize-y`} value={body.deliverables} placeholder="One deliverable per line" onChange={(event) => patchBody({ deliverables: event.target.value })} />
          </label>
          <label>
            <span className={labelClass}>Terms and conditions</span>
            <textarea className={`${inputClass} min-h-28 resize-y`} value={body.terms} placeholder="One term per line" onChange={(event) => patchBody({ terms: event.target.value })} />
          </label>
          <label className="sm:col-span-2">
            <span className={labelClass}>Closing</span>
            <textarea className={`${inputClass} min-h-24 resize-y`} value={body.closing} onChange={(event) => patchBody({ closing: event.target.value })} />
          </label>
        </section>

        <section className="grid gap-4 rounded-xl border border-line bg-background p-4 sm:grid-cols-2">
          <h2 className="text-sm font-semibold text-ink sm:col-span-2">Signatory</h2>
          <label>
            <span className={labelClass}>Name</span>
            <input className={inputClass} value={body.signatoryName} onChange={(event) => patchBody({ signatoryName: event.target.value })} />
          </label>
          <label>
            <span className={labelClass}>Designation</span>
            <input className={inputClass} value={body.signatoryTitle} onChange={(event) => patchBody({ signatoryTitle: event.target.value })} />
          </label>
        </section>

        <CustomFieldInputs
          fields={fields}
          values={customFields}
          onChange={(key, value) => {
            setSaved(false);
            setCustomFields((current) => ({ ...current, [key]: value }));
          }}
          emptyText="No extra fields yet. Add them from Custom fields on the quotations page."
        />

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
                    const result = await deleteQuotationAction(quotation.id);
                    if (!result.ok) {
                      setError(result.error);
                      return;
                    }
                    router.push("/quotations");
                  });
                }}
              >
                Delete this quotation
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
              {pending ? "Saving…" : "Save quotation"}
            </button>
          </div>
        </div>
      </form>

      <QuotationSheet
        number={number}
        issuedOn={issuedOn}
        collegeName={preparedFor}
        body={body}
        customFields={previewCustom}
        fields={fields}
      />
    </main>
  );
}
