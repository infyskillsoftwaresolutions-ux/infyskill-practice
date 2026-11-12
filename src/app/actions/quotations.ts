"use server";

import { revalidatePath } from "next/cache";
import {
  createQuotation,
  createQuotationField,
  deleteQuotation,
  deleteQuotationField,
  updateQuotation,
  updateQuotationField,
  ValidationError,
} from "@/lib/quotations";
import type { ActionResult } from "@/lib/payroll-types";

function refresh() {
  revalidatePath("/quotations", "layout");
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

export async function createQuotationAction(): Promise<ActionResult> {
  try {
    const id = createQuotation();
    refresh();
    return { ok: true, id };
  } catch (error) {
    if (error instanceof ValidationError) return { ok: false, error: error.message };
    console.error(error);
    return { ok: false, error: "Something went wrong. Try again." };
  }
}

export async function saveQuotationAction(id: string, input: unknown): Promise<ActionResult> {
  return finish(() => updateQuotation(id, input));
}

export async function deleteQuotationAction(id: string): Promise<ActionResult> {
  return finish(() => deleteQuotation(id));
}

export async function createQuotationFieldAction(input: unknown): Promise<ActionResult> {
  return finish(() => createQuotationField(input));
}

export async function updateQuotationFieldAction(id: string, input: unknown): Promise<ActionResult> {
  return finish(() => updateQuotationField(id, input));
}

export async function deleteQuotationFieldAction(id: string): Promise<ActionResult> {
  return finish(() => deleteQuotationField(id));
}
