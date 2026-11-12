"use client";

import { useState, useTransition } from "react";
import {
  createFieldAction,
  deleteFieldAction,
  updateFieldAction,
} from "@/app/actions/payroll";
import { Dialog } from "@/components/dialog";
import {
  FIELD_TYPES,
  FIELD_TYPE_LABELS,
  SUGGESTED_FIELDS,
  type ActionResult,
  type FieldDefinition,
  type FieldInput,
  type FieldType,
} from "@/lib/payroll-types";

type FieldActions = {
  create: (input: unknown) => Promise<ActionResult>;
  update: (id: string, input: unknown) => Promise<ActionResult>;
  remove: (id: string) => Promise<ActionResult>;
};

const inputClass =
  "w-full rounded-lg border border-line bg-background px-3 py-2 text-sm text-ink outline-none focus:border-accent";
const labelClass = "mb-1.5 block text-sm font-medium text-ink";

function splitOptions(value: string) {
  return value
    .split(",")
    .map((option) => option.trim())
    .filter(Boolean);
}

export function FieldsDialog({
  open,
  fields,
  onClose,
  suggestions = SUGGESTED_FIELDS,
  description = "These fields are added to every employee. The stored key stays the same if you rename a label, so existing answers keep working.",
  recordNoun = "employee",
  labelPlaceholder = "Campus",
  choicePlaceholder = "Full time, Contract, Visiting",
  actions,
}: {
  open: boolean;
  fields: FieldDefinition[];
  onClose: () => void;
  suggestions?: FieldInput[];
  description?: string;
  recordNoun?: string;
  labelPlaceholder?: string;
  choicePlaceholder?: string;
  actions?: FieldActions;
}) {
  const fieldActions = actions ?? {
    create: createFieldAction,
    update: updateFieldAction,
    remove: deleteFieldAction,
  };
  const [label, setLabel] = useState("");
  const [type, setType] = useState<FieldType>("text");
  const [required, setRequired] = useState(false);
  const [optionsText, setOptionsText] = useState("");
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [editRequired, setEditRequired] = useState(false);
  const [editOptions, setEditOptions] = useState("");
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const existingLabels = new Set(fields.map((field) => field.label.toLowerCase()));
  const availableSuggestions = suggestions.filter(
    (field) => !existingLabels.has(field.label.toLowerCase()),
  );

  function resetComposer() {
    setLabel("");
    setType("text");
    setRequired(false);
    setOptionsText("");
  }

  function addField(input: {
    label: string;
    type: FieldType;
    required: boolean;
    options: string[];
  }) {
    setError("");
    startTransition(async () => {
      const result = await fieldActions.create(input);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      resetComposer();
    });
  }

  function startEdit(field: FieldDefinition) {
    setEditingId(field.id);
    setEditLabel(field.label);
    setEditRequired(field.required);
    setEditOptions(field.options.join(", "));
    setConfirmId(null);
    setError("");
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Custom fields"
      description={description}
    >
      <div className="grid gap-5">
        {error ? (
          <p className="rounded-lg bg-[#fdecec] px-3 py-2 text-sm text-danger">{error}</p>
        ) : null}

        {availableSuggestions.length > 0 ? (
          <div>
            <p className="text-sm font-medium text-ink">Quick add</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {availableSuggestions.map((field) => (
                <button
                  key={field.label}
                  type="button"
                  disabled={pending}
                  onClick={() => addField(field)}
                  className="rounded-full border border-line bg-background px-3 py-1.5 text-sm text-ink hover:bg-background disabled:opacity-60"
                >
                  {field.label}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <form
          className="grid gap-3 rounded-xl border border-line bg-background p-4"
          onSubmit={(event) => {
            event.preventDefault();
            addField({
              label,
              type,
              required,
              options: type === "select" ? splitOptions(optionsText) : [],
            });
          }}
        >
          <p className="text-sm font-medium text-ink">New field</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <label>
              <span className={labelClass}>Label</span>
              <input
                className={inputClass}
                value={label}
                onChange={(event) => setLabel(event.target.value)}
                placeholder={labelPlaceholder}
                required
              />
            </label>
            <label>
              <span className={labelClass}>Type</span>
              <select
                className={inputClass}
                value={type}
                onChange={(event) => setType(event.target.value as FieldType)}
              >
                {FIELD_TYPES.map((fieldType) => (
                  <option key={fieldType} value={fieldType}>
                    {FIELD_TYPE_LABELS[fieldType]}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {type === "select" ? (
            <label>
              <span className={labelClass}>Choices, separated by commas</span>
              <input
                className={inputClass}
                value={optionsText}
                onChange={(event) => setOptionsText(event.target.value)}
                placeholder={choicePlaceholder}
                required
              />
            </label>
          ) : null}
          <label className="flex items-center gap-2 text-sm text-ink">
            <input
              type="checkbox"
              checked={required}
              onChange={(event) => setRequired(event.target.checked)}
            />
            Required on every {recordNoun}
          </label>
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={pending}
              className="rounded-lg bg-accent px-3.5 py-2 text-sm font-medium text-white hover:bg-[#3e5ae0] disabled:opacity-60"
            >
              {pending ? "Saving…" : "Add field"}
            </button>
          </div>
        </form>

        <div>
          <p className="text-sm font-medium text-ink">On the {recordNoun} form</p>
          {fields.length === 0 ? (
            <p className="mt-2 text-sm leading-6 text-muted">No custom fields yet.</p>
          ) : (
            <ul className="mt-2 divide-y divide-line rounded-xl border border-line">
              {fields.map((field) => {
                const editing = editingId === field.id;
                const confirming = confirmId === field.id;
                return (
                  <li key={field.id} className="px-3 py-3">
                    {editing ? (
                      <form
                        className="grid gap-3"
                        onSubmit={(event) => {
                          event.preventDefault();
                          setError("");
                          startTransition(async () => {
                            const result = await fieldActions.update(field.id, {
                              label: editLabel,
                              required: editRequired,
                              options: field.type === "select" ? splitOptions(editOptions) : [],
                            });
                            if (!result.ok) {
                              setError(result.error);
                              return;
                            }
                            setEditingId(null);
                          });
                        }}
                      >
                        <label>
                          <span className={labelClass}>Label</span>
                          <input
                            className={inputClass}
                            value={editLabel}
                            onChange={(event) => setEditLabel(event.target.value)}
                            required
                          />
                        </label>
                        {field.type === "select" ? (
                          <label>
                            <span className={labelClass}>Choices, separated by commas</span>
                            <input
                              className={inputClass}
                              value={editOptions}
                              onChange={(event) => setEditOptions(event.target.value)}
                              required
                            />
                          </label>
                        ) : null}
                        <label className="flex items-center gap-2 text-sm text-ink">
                          <input
                            type="checkbox"
                            checked={editRequired}
                            onChange={(event) => setEditRequired(event.target.checked)}
                          />
                          Required
                        </label>
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => setEditingId(null)}
                            className="rounded-lg px-3 py-1.5 text-sm text-muted hover:text-ink"
                          >
                            Cancel
                          </button>
                          <button
                            type="submit"
                            disabled={pending}
                            className="rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60"
                          >
                            Save
                          </button>
                        </div>
                      </form>
                    ) : (
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-medium text-ink">
                            {field.label}
                            {field.required ? (
                              <span className="ml-2 text-xs font-normal text-danger">Required</span>
                            ) : null}
                          </p>
                          <p className="text-xs text-muted">
                            {FIELD_TYPE_LABELS[field.type]}
                            {field.type === "select" && field.options.length > 0
                              ? ` · ${field.options.join(", ")}`
                              : ""}
                          </p>
                        </div>
                        {confirming ? (
                          <div className="flex items-center gap-2 text-sm">
                            <span className="text-muted">Remove this field?</span>
                            <button
                              type="button"
                              className="font-medium text-danger"
                              disabled={pending}
                              onClick={() => {
                                setError("");
                                startTransition(async () => {
                                  const result = await fieldActions.remove(field.id);
                                  if (!result.ok) setError(result.error);
                                  setConfirmId(null);
                                });
                              }}
                            >
                              Remove
                            </button>
                            <button
                              type="button"
                              className="text-muted"
                              onClick={() => setConfirmId(null)}
                            >
                              Keep
                            </button>
                          </div>
                        ) : (
                          <div className="flex gap-3 text-sm">
                            <button
                              type="button"
                              className="font-medium text-accent"
                              onClick={() => startEdit(field)}
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              className="font-medium text-danger"
                              onClick={() => {
                                setConfirmId(field.id);
                                setEditingId(null);
                              }}
                            >
                              Remove
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
          <p className="mt-2 text-xs leading-5 text-muted">
            Removing a field hides it from forms and the table. Saved answers stay in the database.
          </p>
        </div>
      </div>
    </Dialog>
  );
}
