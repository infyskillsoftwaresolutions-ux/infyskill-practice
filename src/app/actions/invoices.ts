"use server";

import { revalidatePath } from "next/cache";
import {
  createInvoice,
  createInvoiceField,
  deleteInvoice,
  deleteInvoiceField,
  updateInvoice,
  updateInvoiceField,
  updateInvoiceSettings,
  ValidationError,
} from "@/lib/invoices";
import type { ActionResult } from "@/lib/payroll-types";

function refresh() {
  revalidatePath("/invoices", "layout");
}

function finish(action: () => void): ActionResult {
  try {
    action();
    refresh();
    return { ok: true };
  } catch (error) {
    if (error instanceof ValidationError) return { ok: false, error: error.message };
    console.error(error);
    return { ok: false, error: "Something went wrong. Try again." };
  }
}

export async function createInvoiceAction(): Promise<ActionResult> {
  try {
    const id = createInvoice();
    refresh();
    return { ok: true, id };
  } catch (error) {
    if (error instanceof ValidationError) return { ok: false, error: error.message };
    console.error(error);
    return { ok: false, error: "Something went wrong. Try again." };
  }
}

export async function saveInvoiceAction(id: string, input: unknown): Promise<ActionResult> {
  return finish(() => updateInvoice(id, input));
}

export async function deleteInvoiceAction(id: string): Promise<ActionResult> {
  return finish(() => deleteInvoice(id));
}

export async function saveInvoiceSettingsAction(input: unknown): Promise<ActionResult> {
  try {
    updateInvoiceSettings(input);
    revalidatePath("/invoices", "layout");
    revalidatePath("/quotations", "layout");
    return { ok: true };
  } catch (error) {
    if (error instanceof ValidationError) return { ok: false, error: error.message };
    console.error(error);
    return { ok: false, error: "Something went wrong. Try again." };
  }
}

export async function createInvoiceFieldAction(input: unknown): Promise<ActionResult> {
  return finish(() => createInvoiceField(input));
}

export async function updateInvoiceFieldAction(id: string, input: unknown): Promise<ActionResult> {
  return finish(() => updateInvoiceField(id, input));
}

export async function deleteInvoiceFieldAction(id: string): Promise<ActionResult> {
  return finish(() => deleteInvoiceField(id));
}
