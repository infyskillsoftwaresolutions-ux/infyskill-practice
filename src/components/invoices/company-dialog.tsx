"use client";

import { useEffect, useState, useTransition } from "react";
import { saveInvoiceSettingsAction } from "@/app/actions/invoices";
import { Dialog } from "@/components/dialog";
import type { InvoiceSettings } from "@/lib/invoice-shared";

const inputClass =
  "w-full rounded-lg border border-line bg-background px-3 py-2 text-sm text-ink outline-none focus:border-accent";
const labelClass = "mb-1.5 block text-sm font-medium text-ink";

export function CompanyDialog({
  open,
  settings,
  onClose,
}: {
  open: boolean;
  settings: InvoiceSettings;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState(settings);
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    setDraft(settings);
    setError("");
  }, [open, settings]);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    startTransition(async () => {
      const result = await saveInvoiceSettingsAction(draft);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onClose();
    });
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Company details"
      description="These details print on every invoice. Set them once, then change them only when the business details change."
    >
      <form onSubmit={submit} className="grid gap-4">
        {error ? <p className="rounded-lg bg-[#fdecec] px-3 py-2 text-sm text-danger">{error}</p> : null}
        <label>
          <span className={labelClass}>Company name</span>
          <input
            className={inputClass}
            value={draft.companyName}
            onChange={(event) => setDraft((current) => ({ ...current, companyName: event.target.value }))}
            required
          />
        </label>
        <label>
          <span className={labelClass}>Address</span>
          <textarea
            className={`${inputClass} min-h-20 resize-y`}
            value={draft.address}
            onChange={(event) => setDraft((current) => ({ ...current, address: event.target.value }))}
          />
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label>
            <span className={labelClass}>Email</span>
            <input
              className={inputClass}
              value={draft.email}
              onChange={(event) => setDraft((current) => ({ ...current, email: event.target.value }))}
            />
          </label>
          <label>
            <span className={labelClass}>Phone</span>
            <input
              className={inputClass}
              value={draft.phone}
              onChange={(event) => setDraft((current) => ({ ...current, phone: event.target.value }))}
            />
          </label>
        </div>
        <label>
          <span className={labelClass}>Payment details</span>
          <textarea
            className={`${inputClass} min-h-20 resize-y`}
            value={draft.paymentDetails}
            placeholder="Bank name, account number, IFSC, or UPI"
            onChange={(event) => setDraft((current) => ({ ...current, paymentDetails: event.target.value }))}
          />
        </label>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-line bg-background px-3.5 py-2 text-sm font-medium text-ink hover:bg-background"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={pending}
            className="rounded-lg bg-accent px-3.5 py-2 text-sm font-medium text-white hover:bg-[#3e5ae0] disabled:opacity-60"
          >
            {pending ? "Saving…" : "Save details"}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
