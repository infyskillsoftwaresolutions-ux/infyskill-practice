import { ValidationError } from "@/lib/colleges";
import { getDb } from "@/lib/db";

export const REPORT_GRACE_DAYS = 30;

export type PracticeAccessPhase = "missing" | "draft" | "scheduled" | "open" | "grace" | "closed";

export type PracticeAccess = {
  invoiceId: string;
  invoiceNumber: string;
  status: string;
  seats: number;
  issuedOn: string;
  endsOn: string;
  graceEndsOn: string;
  phase: PracticeAccessPhase;
};

export type PracticeInvoiceOption = {
  id: string;
  number: string;
  issuedOn: string;
  status: string;
  seats: number;
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function formatAccessDate(iso: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return iso;
  return `${Number(match[3])} ${MONTHS[Number(match[2]) - 1]} ${match[1]}`;
}

function todayKey() {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

function shiftDate(iso: string, years: number, days: number) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return "";
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  if (Number.isNaN(date.getTime())) return "";
  if (years) date.setUTCFullYear(date.getUTCFullYear() + years);
  if (days) date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function emptyAccess(): PracticeAccess {
  return {
    invoiceId: "",
    invoiceNumber: "",
    status: "",
    seats: 0,
    issuedOn: "",
    endsOn: "",
    graceEndsOn: "",
    phase: "missing",
  };
}

function yearEnd(issuedOn: string) {
  return shiftDate(issuedOn, 1, 0);
}

function chosenEnd(issuedOn: string, custom: string) {
  const fullYear = yearEnd(issuedOn);
  if (!custom || !fullYear) return fullYear;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(custom) || custom < issuedOn || custom > fullYear) return fullYear;
  return custom;
}

export function readPracticeAccess(collegeId: string): PracticeAccess {
  const link = getDb()
    .prepare(`SELECT invoice_id, access_ends_on FROM practice_colleges WHERE college_id = ?`)
    .get(collegeId) as { invoice_id: string; access_ends_on: string } | undefined;
  if (!link?.invoice_id) return emptyAccess();
  const invoice = getDb()
    .prepare(
      `SELECT i.id, i.invoice_number, i.college_id, i.issued_on, i.status, COALESCE(SUM(l.quantity), 0) AS seats
       FROM invoices i
       LEFT JOIN invoice_lines l ON l.invoice_id = i.id
       WHERE i.id = ?
       GROUP BY i.id`,
    )
    .get(link.invoice_id) as
    | { id: string; invoice_number: string; college_id: string; issued_on: string; status: string; seats: number }
    | undefined;
  if (!invoice || invoice.college_id !== collegeId) return emptyAccess();
  const issuedOn = invoice.issued_on;
  const endsOn = chosenEnd(issuedOn, link.access_ends_on ?? "");
  const graceEndsOn = endsOn ? shiftDate(endsOn, 0, REPORT_GRACE_DAYS) : "";
  const today = todayKey();
  let phase: PracticeAccessPhase = "draft";
  if (invoice.status === "sent" || invoice.status === "paid") {
    if (!issuedOn || !endsOn) phase = "draft";
    else if (today < issuedOn) phase = "scheduled";
    else if (today <= endsOn) phase = "open";
    else if (graceEndsOn && today <= graceEndsOn) phase = "grace";
    else phase = "closed";
  }
  return {
    invoiceId: invoice.id,
    invoiceNumber: invoice.invoice_number,
    status: invoice.status,
    seats: Math.max(0, Math.round(Number(invoice.seats) || 0)),
    issuedOn,
    endsOn,
    graceEndsOn,
    phase,
  };
}

export function studentsCanPractice(access: PracticeAccess) {
  return access.phase === "open";
}

export function collegeReportOpen(access: PracticeAccess) {
  return access.phase === "open" || access.phase === "grace";
}

export function studentAccessMessage(collegeName: string, access: PracticeAccess) {
  if (access.phase === "grace" || access.phase === "closed") {
    return `Practice for ${collegeName} ended on ${formatAccessDate(access.endsOn)}.`;
  }
  return `Practice is not open for ${collegeName} yet.`;
}

export function collegeAccessMessage(access: PracticeAccess) {
  if (access.phase === "open") {
    return `Open through ${formatAccessDate(access.endsOn)} on invoice ${access.invoiceNumber}. ${access.seats} ${access.seats === 1 ? "seat" : "seats"}.`;
  }
  if (access.phase === "grace") {
    return `Student practice ended on ${formatAccessDate(access.endsOn)}. The report stays open through ${formatAccessDate(access.graceEndsOn)}.`;
  }
  if (access.phase === "closed") {
    return `The report closed on ${formatAccessDate(access.graceEndsOn)}. Link a new invoice to open practice again.`;
  }
  if (access.phase === "scheduled") {
    return `Invoice ${access.invoiceNumber} starts on ${formatAccessDate(access.issuedOn)}.`;
  }
  if (access.phase === "draft") {
    return `Invoice ${access.invoiceNumber} is still a draft. Mark it sent or paid to open practice.`;
  }
  return "Link a sent or paid invoice. Seats are the invoice quantities. Practice stays open for one year, or until an earlier end date.";
}

export function listPracticeInvoices(collegeId: string): PracticeInvoiceOption[] {
  const rows = getDb()
    .prepare(
      `SELECT i.id, i.invoice_number, i.issued_on, i.status, COALESCE(SUM(l.quantity), 0) AS seats
       FROM invoices i
       LEFT JOIN invoice_lines l ON l.invoice_id = i.id
       WHERE i.college_id = ?
       GROUP BY i.id
       ORDER BY i.issued_on DESC, i.invoice_number COLLATE NOCASE`,
    )
    .all(collegeId) as { id: string; invoice_number: string; issued_on: string; status: string; seats: number }[];
  return rows.map((row) => ({
    id: row.id,
    number: row.invoice_number,
    issuedOn: row.issued_on,
    status: row.status,
    seats: Math.max(0, Math.round(Number(row.seats) || 0)),
  }));
}

export function linkPracticeInvoice(collegeId: string, invoiceIdInput: unknown, endsOnInput: unknown) {
  const invoiceId = typeof invoiceIdInput === "string" ? invoiceIdInput.trim() : "";
  const college = getDb().prepare(`SELECT college_id FROM practice_colleges WHERE college_id = ?`).get(collegeId);
  if (!college) throw new ValidationError("That college is not on InfySkill Practice.");
  let accessEndsOn = "";
  if (invoiceId) {
    const invoice = getDb()
      .prepare(`SELECT id, college_id, issued_on FROM invoices WHERE id = ?`)
      .get(invoiceId) as { id: string; college_id: string; issued_on: string } | undefined;
    if (!invoice || invoice.college_id !== collegeId) {
      throw new ValidationError("Choose an invoice for this college.");
    }
    const requested = typeof endsOnInput === "string" ? endsOnInput.trim() : "";
    const fullYear = yearEnd(invoice.issued_on);
    if (requested && requested !== fullYear) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(requested) || requested < invoice.issued_on) {
        throw new ValidationError("Practice must end on or after the invoice date.");
      }
      if (!fullYear || requested > fullYear) {
        throw new ValidationError(`Practice can stay open through ${formatAccessDate(fullYear)}. Pick that date or an earlier one.`);
      }
      accessEndsOn = requested;
    }
  }
  getDb()
    .prepare(`UPDATE practice_colleges SET invoice_id = ?, access_ends_on = ? WHERE college_id = ?`)
    .run(invoiceId, accessEndsOn, collegeId);
}

export function assertStudentSeats(collegeId: string, studentCount: number) {
  const access = readPracticeAccess(collegeId);
  if (access.phase !== "open") {
    if (access.phase === "grace" || access.phase === "closed") {
      throw new ValidationError(`This invoice ended on ${formatAccessDate(access.endsOn)}. Link a new invoice before adding students.`);
    }
    if (access.phase === "draft") {
      throw new ValidationError("That invoice is still a draft. Mark it sent or paid before adding students.");
    }
    if (access.phase === "scheduled") {
      throw new ValidationError(`Practice starts on ${formatAccessDate(access.issuedOn)}.`);
    }
    throw new ValidationError("Link a sent or paid invoice before adding students.");
  }
  if (access.seats < 1 || studentCount >= access.seats) {
    throw new ValidationError(`This invoice covers ${access.seats} students. Remove one or raise the invoice quantity.`);
  }
}
