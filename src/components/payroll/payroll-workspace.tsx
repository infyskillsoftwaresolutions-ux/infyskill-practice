"use client";

import { useMemo, useState, useTransition } from "react";
import { deleteEmployeeAction } from "@/app/actions/payroll";
import { EmployeeDialog } from "@/components/payroll/employee-dialog";
import { FieldsDialog } from "@/components/payroll/fields-dialog";
import { formatDate, formatMoney, formatSalary } from "@/lib/format";
import type { CustomValue, Employee, FieldDefinition } from "@/lib/payroll-types";

type SortKey = "name" | "salary" | "newest";

function displayCustom(field: FieldDefinition, value: CustomValue | undefined) {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (field.type === "number" && typeof value === "number") {
    return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(value);
  }
  if (field.type === "date" && typeof value === "string") return formatDate(value) || value;
  return String(value);
}

function monthlyTotals(employees: Employee[]) {
  const totals = new Map<string, number>();
  let hourly = 0;
  for (const employee of employees) {
    if (employee.status !== "active") continue;
    if (employee.payFrequency === "hourly") {
      hourly += 1;
      continue;
    }
    const monthly = employee.payFrequency === "yearly" ? employee.salary / 12 : employee.salary;
    totals.set(employee.currency, (totals.get(employee.currency) ?? 0) + monthly);
  }
  return { totals: [...totals.entries()], hourly };
}

export function PayrollWorkspace({
  employees,
  fields,
}: {
  employees: Employee[];
  fields: FieldDefinition[];
}) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"all" | "active" | "inactive">("all");
  const [sort, setSort] = useState<SortKey>("name");
  const [formOpen, setFormOpen] = useState(false);
  const [fieldsOpen, setFieldsOpen] = useState(false);
  const [editing, setEditing] = useState<Employee | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  const activeCount = employees.filter((employee) => employee.status === "active").length;
  const totals = monthlyTotals(employees);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const filtered = employees.filter((employee) => {
      if (status !== "all" && employee.status !== status) return false;
      if (!needle) return true;
      const custom = Object.values(employee.customFields)
        .map((value) => (value === null || value === undefined ? "" : String(value)))
        .join(" ");
      return [
        employee.fullName,
        employee.email,
        employee.phone,
        employee.jobTitle,
        employee.department,
        employee.notes,
        custom,
      ]
        .join(" ")
        .toLowerCase()
        .includes(needle);
    });
    return filtered.sort((a, b) => {
      if (sort === "salary") return b.salary - a.salary;
      if (sort === "newest") return b.createdAt.localeCompare(a.createdAt);
      return a.fullName.localeCompare(b.fullName, undefined, { sensitivity: "base" });
    });
  }, [employees, query, sort, status]);

  function openCreate() {
    setEditing(null);
    setFormOpen(true);
  }

  function openEdit(employee: Employee) {
    setEditing(employee);
    setConfirmId(null);
    setFormOpen(true);
  }

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent">Payroll</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-ink">People and salaries</h1>
          <p className="mt-1 max-w-xl text-sm leading-6 text-muted">
            Keep employee details and pay in one list. Add your own fields when the standard ones are not enough.
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
            onClick={openCreate}
            className="rounded-lg bg-accent px-3.5 py-2 text-sm font-medium text-white hover:bg-[#3e5ae0]"
          >
            Add employee
          </button>
        </div>
      </header>

      <section className="grid gap-3 sm:grid-cols-3">
        <article className="rounded-2xl border border-line bg-card px-4 py-4">
          <p className="text-sm text-muted">People</p>
          <p className="mt-1 text-2xl font-semibold text-ink">{employees.length}</p>
        </article>
        <article className="rounded-2xl border border-line bg-card px-4 py-4">
          <p className="text-sm text-muted">Active</p>
          <p className="mt-1 text-2xl font-semibold text-ink">{activeCount}</p>
        </article>
        <article className="rounded-2xl border border-line bg-card px-4 py-4">
          <p className="text-sm text-muted">Active monthly payroll</p>
          {totals.totals.length === 0 ? (
            <p className="mt-1 text-lg font-semibold text-ink">—</p>
          ) : (
            <div className="mt-1 space-y-1">
              {totals.totals.map(([currency, amount]) => (
                <p key={currency} className="text-lg font-semibold text-money">
                  {formatMoney(amount, currency)}
                </p>
              ))}
            </div>
          )}
          <p className="mt-2 text-xs leading-5 text-muted">
            Yearly salaries are divided by 12.
            {totals.hourly > 0
              ? ` ${totals.hourly} hourly ${totals.hourly === 1 ? "rate is" : "rates are"} listed on each person and left out of this total.`
              : ""}
          </p>
        </article>
      </section>

      <section className="rounded-2xl border border-line bg-card">
        <div className="flex flex-col flex-wrap gap-3 border-b border-line px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search name, role, department, or a custom field"
            className="w-full rounded-lg border border-line bg-background px-3 py-2 text-sm outline-none focus:border-accent sm:max-w-md"
          />
          <label className="flex items-center gap-2 text-sm text-muted">
            Status
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value as "all" | "active" | "inactive")}
              className="rounded-lg border border-line bg-background px-2 py-2 text-sm text-ink"
            >
              <option value="all">All</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm text-muted">
            Sort
            <select
              value={sort}
              onChange={(event) => setSort(event.target.value as SortKey)}
              className="rounded-lg border border-line bg-background px-2 py-2 text-sm text-ink"
            >
              <option value="name">Name</option>
              <option value="salary">Salary</option>
              <option value="newest">Newest</option>
            </select>
          </label>
        </div>

        {error ? (
          <p className="mx-4 mt-3 rounded-lg bg-[#fdecec] px-3 py-2 text-sm text-danger">{error}</p>
        ) : null}

        {employees.length === 0 ? (
          <div className="px-4 py-14 text-center">
            <p className="text-base font-medium text-ink">No employees yet</p>
            <p className="mx-auto mt-1 max-w-md text-sm leading-6 text-muted">
              Add the first person and their salary. Custom fields are included on the form and in this table.
            </p>
            <button
              type="button"
              onClick={openCreate}
              className="mt-4 rounded-lg bg-accent px-3.5 py-2 text-sm font-medium text-white hover:bg-[#3e5ae0]"
            >
              Add employee
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-muted">
                <tr className="border-b border-line">
                  <th className="px-4 py-3 font-medium">Employee</th>
                  <th className="px-4 py-3 font-medium">Role</th>
                  <th className="px-4 py-3 font-medium">Salary</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  {fields.map((field) => (
                    <th key={field.id} className="px-4 py-3 font-medium">
                      {field.label}
                    </th>
                  ))}
                  <th className="row-actions px-4 py-3 font-medium"> </th>
                </tr>
              </thead>
              <tbody>
                {visible.length === 0 ? (
                  <tr>
                    <td colSpan={5 + fields.length} className="px-4 py-10 text-center text-muted">
                      No one matches that search.
                    </td>
                  </tr>
                ) : (
                  visible.map((employee) => (
                    <tr key={employee.id} className="border-b border-line last:border-0">
                      <td className="px-4 py-3 align-top">
                        <p className="font-medium text-ink">{employee.fullName}</p>
                        <p className="text-xs text-muted">
                          {[employee.email, employee.phone].filter(Boolean).join(" · ") || "No contact"}
                        </p>
                      </td>
                      <td className="px-4 py-3 align-top">
                        <p>{employee.jobTitle || "—"}</p>
                        <p className="text-xs text-muted">
                          {[employee.department, employee.hiredOn ? formatDate(employee.hiredOn) : ""]
                            .filter(Boolean)
                            .join(" · ") || "—"}
                        </p>
                      </td>
                      <td className="px-4 py-3 align-top whitespace-nowrap font-medium text-ink">
                        {formatSalary(employee.salary, employee.currency, employee.payFrequency)}
                      </td>
                      <td className="px-4 py-3 align-top">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                            employee.status === "active"
                              ? "bg-accent-soft text-accent"
                              : "bg-background text-muted"
                          }`}
                        >
                          {employee.status === "active" ? "Active" : "Inactive"}
                        </span>
                      </td>
                      {fields.map((field) => (
                        <td key={field.id} className="max-w-48 px-4 py-3 align-top text-ink">
                          {displayCustom(field, employee.customFields[field.key])}
                        </td>
                      ))}
                      <td className="row-actions px-4 py-3 align-top text-right">
                        {confirmId === employee.id ? (
                          <div className="flex justify-end gap-3">
                            <button
                              type="button"
                              disabled={pending}
                              className="font-medium text-danger"
                              onClick={() => {
                                setError("");
                                startTransition(async () => {
                                  const result = await deleteEmployeeAction(employee.id);
                                  if (!result.ok) setError(result.error);
                                  setConfirmId(null);
                                });
                              }}
                            >
                              Delete
                            </button>
                            <button
                              type="button"
                              className="text-muted"
                              onClick={() => setConfirmId(null)}
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <div className="flex justify-end gap-3">
                            <button
                              type="button"
                              className="font-medium text-accent"
                              onClick={() => openEdit(employee)}
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              className="font-medium text-danger"
                              onClick={() => setConfirmId(employee.id)}
                            >
                              Delete
                            </button>
                          </div>
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

      <EmployeeDialog
        open={formOpen}
        employee={editing}
        fields={fields}
        onClose={() => setFormOpen(false)}
      />
      <FieldsDialog open={fieldsOpen} fields={fields} onClose={() => setFieldsOpen(false)} />
    </main>
  );
}
