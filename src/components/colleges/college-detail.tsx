"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import {
  createCollegeFieldAction,
  createProgramFieldAction,
  deleteCollegeAction,
  deleteCollegeFieldAction,
  deleteProgramAction,
  deleteProgramFieldAction,
  saveCollegeDetailsAction,
  updateCollegeFieldAction,
  updateProgramFieldAction,
} from "@/app/actions/colleges";
import { customPayload, CustomFieldInputs, valuesFromCustom } from "@/components/colleges/custom-field-inputs";
import { ProgramDialog } from "@/components/colleges/program-dialog";
import { FieldsDialog } from "@/components/payroll/fields-dialog";
import type { College, CollegeProgram } from "@/lib/colleges";
import { COLLEGE_SUGGESTED_FIELDS, PROGRAM_SUGGESTED_FIELDS } from "@/lib/college-suggestions";
import { formatMoney } from "@/lib/format";
import type { FieldDefinition } from "@/lib/payroll-types";

export function CollegeDetail({
  college,
  fields,
  programFields,
}: {
  college: College;
  fields: FieldDefinition[];
  programFields: FieldDefinition[];
}) {
  const router = useRouter();
  const [name, setName] = useState(college.name);
  const [customFields, setCustomFields] = useState(() => valuesFromCustom(fields, college.customFields));
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [fieldsOpen, setFieldsOpen] = useState(false);
  const [programFieldsOpen, setProgramFieldsOpen] = useState(false);
  const [programOpen, setProgramOpen] = useState(false);
  const [editing, setEditing] = useState<CollegeProgram | null>(null);
  const [confirmProgramId, setConfirmProgramId] = useState<string | null>(null);
  const [confirmCollege, setConfirmCollege] = useState(false);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    setName(college.name);
    setCustomFields(valuesFromCustom(fields, college.customFields));
  }, [college.updatedAt, college.name, fields]);

  function saveDetails(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setSaved(false);
    startTransition(async () => {
      const result = await saveCollegeDetailsAction(college.id, {
        name,
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
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <div>
        <Link href="/colleges" className="text-sm font-medium text-accent">
          All colleges
        </Link>
        <p className="mt-3 text-xs font-semibold uppercase tracking-[0.16em] text-accent">College</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight text-ink">{college.name}</h1>
        <p className="mt-1 max-w-xl text-sm leading-6 text-muted">
          Save the college details first. Programs, prices, and program fields are added below.
        </p>
      </div>

      {error ? <p className="rounded-lg bg-[#fdecec] px-3 py-2 text-sm text-danger">{error}</p> : null}

      <section className="rounded-2xl border border-line bg-card p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-ink">College details</h2>
            <p className="mt-1 text-sm leading-6 text-muted">
              Custom fields here belong to the college, such as a quotation or a contact.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setFieldsOpen(true)}
            className="rounded-lg border border-line bg-background px-3.5 py-2 text-sm font-medium text-ink hover:bg-background"
          >
            Custom fields
          </button>
        </div>
        <form onSubmit={saveDetails} className="mt-4 grid gap-4">
          <label>
            <span className="mb-1.5 block text-sm font-medium text-ink">College name</span>
            <input
              className="w-full rounded-lg border border-line bg-background px-3 py-2 text-sm text-ink outline-none focus:border-accent sm:max-w-md"
              value={name}
              onChange={(event) => {
                setName(event.target.value);
                setSaved(false);
              }}
              required
            />
          </label>
          <CustomFieldInputs
            fields={fields}
            values={customFields}
            onChange={(key, value) => {
              setSaved(false);
              setCustomFields((current) => ({ ...current, [key]: value }));
            }}
            emptyText="No college fields yet. Use Custom fields to add a quotation, contact, or anything else."
          />
          <div className="flex items-center justify-end gap-3">
            {saved ? <p className="text-sm text-muted">Saved</p> : null}
            <button
              type="submit"
              disabled={pending}
              className="rounded-lg bg-accent px-3.5 py-2 text-sm font-medium text-white hover:bg-[#3e5ae0] disabled:opacity-60"
            >
              {pending ? "Saving…" : "Save details"}
            </button>
          </div>
        </form>
      </section>

      <section className="rounded-2xl border border-line bg-card">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-line px-4 py-4 sm:px-5">
          <div>
            <h2 className="text-lg font-semibold text-ink">Programs and price</h2>
            <p className="mt-1 max-w-xl text-sm leading-6 text-muted">
              Add each program with its price. Custom fields in this section are added to every program.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setProgramFieldsOpen(true)}
              className="rounded-lg border border-line bg-background px-3.5 py-2 text-sm font-medium text-ink hover:bg-background"
            >
              Custom fields
            </button>
            <button
              type="button"
              onClick={() => {
                setEditing(null);
                setProgramOpen(true);
              }}
              className="rounded-lg bg-accent px-3.5 py-2 text-sm font-medium text-white hover:bg-[#3e5ae0]"
            >
              Add program
            </button>
          </div>
        </div>
        {college.programs.length === 0 ? (
          <div className="px-4 py-12 text-center">
            <p className="text-base font-medium text-ink">No programs yet</p>
            <p className="mx-auto mt-1 max-w-md text-sm leading-6 text-muted">
              Add a program name and price. Program custom fields show on the form and in this list.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] border-collapse text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-muted">
                <tr className="border-b border-line">
                  <th className="px-4 py-3 font-medium">Program</th>
                  <th className="px-4 py-3 font-medium">Price</th>
                  {programFields.map((field) => (
                    <th key={field.id} className="px-4 py-3 font-medium">
                      {field.label}
                    </th>
                  ))}
                  <th className="row-actions px-4 py-3 font-medium"> </th>
                </tr>
              </thead>
              <tbody>
                {college.programs.map((program) => (
                  <tr key={program.id} className="border-b border-line last:border-0">
                    <td className="px-4 py-3 align-top font-medium text-ink">{program.name}</td>
                    <td className="px-4 py-3 align-top whitespace-nowrap">
                      {formatMoney(program.price, program.currency)}
                    </td>
                    {programFields.map((field) => {
                      const value = program.customFields[field.key];
                      const text =
                        value === null || value === undefined || value === ""
                          ? "—"
                          : typeof value === "boolean"
                            ? value
                              ? "Yes"
                              : "No"
                            : String(value);
                      return (
                        <td key={field.id} className="max-w-48 px-4 py-3 align-top">
                          {text}
                        </td>
                      );
                    })}
                    <td className="row-actions px-4 py-3 align-top text-right">
                      {confirmProgramId === program.id ? (
                        <div className="flex justify-end gap-3">
                          <button
                            type="button"
                            disabled={pending}
                            className="font-medium text-danger"
                            onClick={() => {
                              setError("");
                              startTransition(async () => {
                                const result = await deleteProgramAction(college.id, program.id);
                                if (!result.ok) setError(result.error);
                                setConfirmProgramId(null);
                              });
                            }}
                          >
                            Delete
                          </button>
                          <button type="button" className="text-muted" onClick={() => setConfirmProgramId(null)}>
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <div className="flex justify-end gap-3">
                          <button
                            type="button"
                            className="font-medium text-accent"
                            onClick={() => {
                              setEditing(program);
                              setConfirmProgramId(null);
                              setProgramOpen(true);
                            }}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            className="font-medium text-danger"
                            onClick={() => setConfirmProgramId(program.id)}
                          >
                            Delete
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div className="flex justify-end">
        {confirmCollege ? (
          <div className="flex gap-3 text-sm">
            <button
              type="button"
              disabled={pending}
              className="font-medium text-danger"
              onClick={() => {
                setError("");
                startTransition(async () => {
                  const result = await deleteCollegeAction(college.id);
                  if (!result.ok) {
                    setError(result.error);
                    return;
                  }
                  router.push("/colleges");
                });
              }}
            >
              Delete this college
            </button>
            <button type="button" className="text-muted" onClick={() => setConfirmCollege(false)}>
              Cancel
            </button>
          </div>
        ) : (
          <button type="button" className="text-sm font-medium text-danger" onClick={() => setConfirmCollege(true)}>
            Delete college
          </button>
        )}
      </div>

      <FieldsDialog
        open={fieldsOpen}
        fields={fields}
        onClose={() => setFieldsOpen(false)}
        suggestions={COLLEGE_SUGGESTED_FIELDS}
        description="These fields are added to every college. Program name and price stay on each program."
        recordNoun="college"
        labelPlaceholder="Quotation"
        choicePlaceholder="Proposed, Signed, On hold"
        actions={{
          create: createCollegeFieldAction,
          update: updateCollegeFieldAction,
          remove: deleteCollegeFieldAction,
        }}
      />
      <FieldsDialog
        open={programFieldsOpen}
        fields={programFields}
        onClose={() => setProgramFieldsOpen(false)}
        suggestions={PROGRAM_SUGGESTED_FIELDS}
        description="These fields are added to every program. The stored key stays the same if you rename a label."
        recordNoun="program"
        labelPlaceholder="Duration"
        choicePlaceholder="Online, Campus, Hybrid"
        actions={{
          create: createProgramFieldAction,
          update: updateProgramFieldAction,
          remove: deleteProgramFieldAction,
        }}
      />
      <ProgramDialog
        open={programOpen}
        collegeId={college.id}
        program={editing}
        fields={programFields}
        onClose={() => setProgramOpen(false)}
      />
    </main>
  );
}
