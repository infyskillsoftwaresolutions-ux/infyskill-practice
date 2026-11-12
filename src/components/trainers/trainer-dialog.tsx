"use client";

import { useEffect, useState, useTransition } from "react";
import { createTrainerAction } from "@/app/actions/trainers";
import { Dialog } from "@/components/dialog";

const inputClass =
  "w-full rounded-lg border border-line bg-background px-3 py-2 text-sm text-ink outline-none focus:border-accent";
const labelClass = "mb-1.5 block text-sm font-medium text-ink";

export function TrainerDialog({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    setName("");
    setError("");
  }, [open]);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    startTransition(async () => {
      const result = await createTrainerAction({ name });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      if (result.id) onCreated(result.id);
      else onClose();
    });
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Add trainer"
      description="Save the name first. Open the trainer next to add contact, skills, budgets, and any extra fields."
    >
      <form onSubmit={submit} className="grid gap-4">
        {error ? <p className="rounded-lg bg-[#fdecec] px-3 py-2 text-sm text-danger">{error}</p> : null}
        <label>
          <span className={labelClass}>Name</span>
          <input className={inputClass} value={name} onChange={(event) => setName(event.target.value)} required />
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
            {pending ? "Saving…" : "Save trainer"}
          </button>
        </div>
      </form>
    </Dialog>
  );
}
