"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import {
  createTrainerFieldAction,
  deleteTrainerAction,
  deleteTrainerFieldAction,
  saveTrainerAction,
  updateTrainerFieldAction,
} from "@/app/actions/trainers";
import { customPayload, CustomFieldInputs, valuesFromCustom } from "@/components/colleges/custom-field-inputs";
import { FieldsDialog } from "@/components/payroll/fields-dialog";
import type { FieldDefinition } from "@/lib/payroll-types";
import { TRAINER_STATUSES, TRAINER_STATUS_LABELS, type TrainerStatus } from "@/lib/trainer-shared";
import { TRAINER_SUGGESTED_FIELDS } from "@/lib/trainer-suggestions";
import type { Trainer } from "@/lib/trainers";

const inputClass =
  "w-full rounded-lg border border-line bg-background px-3 py-2 text-sm text-ink outline-none focus:border-accent";
const labelClass = "mb-1.5 block text-sm font-medium text-ink";

function amountValue(amount: number | null) {
  return amount === null ? "" : String(amount);
}

export function TrainerDetail({
  trainer,
  fields,
  skillSuggestions,
}: {
  trainer: Trainer;
  fields: FieldDefinition[];
  skillSuggestions: string[];
}) {
  const router = useRouter();
  const [name, setName] = useState(trainer.name);
  const [phone, setPhone] = useState(trainer.phone);
  const [email, setEmail] = useState(trainer.email);
  const [experience, setExperience] = useState(amountValue(trainer.experienceYears));
  const [skills, setSkills] = useState(trainer.skills);
  const [skillDraft, setSkillDraft] = useState("");
  const [address, setAddress] = useState(trainer.address);
  const [city, setCity] = useState(trainer.city);
  const [dailyBudget, setDailyBudget] = useState(amountValue(trainer.dailyBudget));
  const [weeklyBudget, setWeeklyBudget] = useState(amountValue(trainer.weeklyBudget));
  const [monthlyBudget, setMonthlyBudget] = useState(amountValue(trainer.monthlyBudget));
  const [status, setStatus] = useState<TrainerStatus>(trainer.status);
  const [notes, setNotes] = useState(trainer.notes);
  const [customFields, setCustomFields] = useState(() => valuesFromCustom(fields, trainer.customFields));
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [fieldsOpen, setFieldsOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    setName(trainer.name);
    setPhone(trainer.phone);
    setEmail(trainer.email);
    setExperience(amountValue(trainer.experienceYears));
    setSkills(trainer.skills);
    setAddress(trainer.address);
    setCity(trainer.city);
    setDailyBudget(amountValue(trainer.dailyBudget));
    setWeeklyBudget(amountValue(trainer.weeklyBudget));
    setMonthlyBudget(amountValue(trainer.monthlyBudget));
    setStatus(trainer.status);
    setNotes(trainer.notes);
    setCustomFields(valuesFromCustom(fields, trainer.customFields));
  }, [trainer.updatedAt, trainer.id, fields]);

  function markDirty() {
    setSaved(false);
  }

  function addSkill(value: string) {
    const skill = value.trim();
    if (!skill) return;
    setSkills((current) => {
      if (current.some((item) => item.toLowerCase() === skill.toLowerCase())) return current;
      return [...current, skill];
    });
    setSkillDraft("");
    markDirty();
  }

  function save(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setSaved(false);
    const pendingSkill = skillDraft.trim();
    const nextSkills =
      pendingSkill && !skills.some((item) => item.toLowerCase() === pendingSkill.toLowerCase())
        ? [...skills, pendingSkill]
        : skills;
    if (pendingSkill) {
      setSkills(nextSkills);
      setSkillDraft("");
    }
    startTransition(async () => {
      const result = await saveTrainerAction(trainer.id, {
        name,
        phone,
        email,
        experienceYears: experience.trim() === "" ? null : Number(experience),
        skills: nextSkills,
        address,
        city,
        dailyBudget: dailyBudget.trim() === "" ? null : Number(dailyBudget),
        weeklyBudget: weeklyBudget.trim() === "" ? null : Number(weeklyBudget),
        monthlyBudget: monthlyBudget.trim() === "" ? null : Number(monthlyBudget),
        status,
        notes,
        customFields: customPayload(fields, customFields),
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSaved(true);
    });
  }

  const availableSkills = skillSuggestions.filter(
    (skill) => !skills.some((item) => item.toLowerCase() === skill.toLowerCase()),
  );

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <Link href="/trainers" className="text-sm font-medium text-accent">
            All trainers
          </Link>
          <p className="mt-3 text-xs font-semibold uppercase tracking-[0.16em] text-accent">Trainer</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-ink">{trainer.name}</h1>
          <p className="mt-1 max-w-xl text-sm leading-6 text-muted">
            Contact, skills, and budgets stay on this profile. Extra fields apply to every trainer.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setFieldsOpen(true)}
          className="rounded-lg border border-line bg-card px-3.5 py-2 text-sm font-medium text-ink hover:bg-background"
        >
          Custom fields
        </button>
      </div>

      {error ? <p className="rounded-lg bg-[#fdecec] px-3 py-2 text-sm text-danger">{error}</p> : null}

      <form onSubmit={save} className="grid gap-4 rounded-2xl border border-line bg-card p-4 sm:p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <label>
            <span className={labelClass}>Name</span>
            <input className={inputClass} value={name} onChange={(event) => { setName(event.target.value); markDirty(); }} required />
          </label>
          <label>
            <span className={labelClass}>Status</span>
            <select
              className={inputClass}
              value={status}
              onChange={(event) => {
                setStatus(event.target.value as TrainerStatus);
                markDirty();
              }}
            >
              {TRAINER_STATUSES.map((item) => (
                <option key={item} value={item}>
                  {TRAINER_STATUS_LABELS[item]}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className={labelClass}>Contact</span>
            <input className={inputClass} value={phone} onChange={(event) => { setPhone(event.target.value); markDirty(); }} />
          </label>
          <label>
            <span className={labelClass}>Email</span>
            <input className={inputClass} type="email" value={email} onChange={(event) => { setEmail(event.target.value); markDirty(); }} />
          </label>
          <label>
            <span className={labelClass}>Experience (years)</span>
            <input
              className={inputClass}
              inputMode="decimal"
              value={experience}
              placeholder="5"
              onChange={(event) => { setExperience(event.target.value); markDirty(); }}
            />
          </label>
          <label>
            <span className={labelClass}>City</span>
            <input className={inputClass} value={city} onChange={(event) => { setCity(event.target.value); markDirty(); }} />
          </label>
        </div>

        <div>
          <span className={labelClass}>Skills</span>
          <div className="flex gap-2">
            <input
              className={inputClass}
              value={skillDraft}
              placeholder="Verbal, Soft Skills, ServiceNow"
              onChange={(event) => setSkillDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key !== "Enter") return;
                event.preventDefault();
                addSkill(skillDraft);
              }}
            />
            <button
              type="button"
              onClick={() => addSkill(skillDraft)}
              className="shrink-0 rounded-lg border border-line bg-background px-3.5 py-2 text-sm font-medium text-ink hover:bg-background"
            >
              Add skill
            </button>
          </div>
          {skills.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {skills.map((skill) => (
                <span key={skill} className="inline-flex items-center gap-2 rounded-full bg-accent-soft px-3 py-1 text-sm text-accent">
                  {skill}
                  <button
                    type="button"
                    className="font-medium"
                    aria-label={`Remove ${skill}`}
                    onClick={() => {
                      setSkills((current) => current.filter((item) => item !== skill));
                      markDirty();
                    }}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          ) : (
            <p className="mt-2 text-sm text-muted">Add each skill separately. Press Enter or Add skill.</p>
          )}
          {availableSkills.length > 0 ? (
            <div className="mt-3">
              <p className="text-sm text-muted">Already used</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {availableSkills.map((skill) => (
                  <button
                    key={skill}
                    type="button"
                    onClick={() => addSkill(skill)}
                    className="rounded-full border border-line bg-background px-3 py-1 text-sm text-ink hover:bg-background"
                  >
                    {skill}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        <label>
          <span className={labelClass}>Address</span>
          <textarea
            className={`${inputClass} min-h-20 resize-y`}
            value={address}
            onChange={(event) => { setAddress(event.target.value); markDirty(); }}
          />
        </label>

        <div className="grid gap-4 sm:grid-cols-3">
          <label>
            <span className={labelClass}>Daily budget (₹)</span>
            <input className={inputClass} inputMode="decimal" value={dailyBudget} onChange={(event) => { setDailyBudget(event.target.value); markDirty(); }} />
          </label>
          <label>
            <span className={labelClass}>Weekly budget (₹)</span>
            <input className={inputClass} inputMode="decimal" value={weeklyBudget} onChange={(event) => { setWeeklyBudget(event.target.value); markDirty(); }} />
          </label>
          <label>
            <span className={labelClass}>Monthly budget (₹)</span>
            <input className={inputClass} inputMode="decimal" value={monthlyBudget} onChange={(event) => { setMonthlyBudget(event.target.value); markDirty(); }} />
          </label>
        </div>
        <p className="text-sm leading-6 text-muted">Each budget is its own amount. Leave any of them blank.</p>

        <label>
          <span className={labelClass}>Notes</span>
          <textarea
            className={`${inputClass} min-h-24 resize-y`}
            value={notes}
            onChange={(event) => { setNotes(event.target.value); markDirty(); }}
          />
        </label>

        <CustomFieldInputs
          fields={fields}
          values={customFields}
          onChange={(key, value) => {
            markDirty();
            setCustomFields((current) => ({ ...current, [key]: value }));
          }}
          emptyText="No extra fields yet. Use Custom fields to add qualification, languages, PAN, or anything else."
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
                    const result = await deleteTrainerAction(trainer.id);
                    if (!result.ok) {
                      setError(result.error);
                      return;
                    }
                    router.push("/trainers");
                  });
                }}
              >
                Delete this trainer
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
              {pending ? "Saving…" : "Save trainer"}
            </button>
          </div>
        </div>
      </form>

      <FieldsDialog
        open={fieldsOpen}
        fields={fields}
        onClose={() => setFieldsOpen(false)}
        suggestions={TRAINER_SUGGESTED_FIELDS}
        description="These fields are added to every trainer."
        recordNoun="trainer"
        labelPlaceholder="Qualification"
        choicePlaceholder="Classroom, Online, Both"
        actions={{
          create: createTrainerFieldAction,
          update: updateTrainerFieldAction,
          remove: deleteTrainerFieldAction,
        }}
      />
    </main>
  );
}
