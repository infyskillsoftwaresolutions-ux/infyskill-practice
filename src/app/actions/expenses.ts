"use server";

import { revalidatePath } from "next/cache";
import {
  createExpense,
  createExpenseField,
  deleteExpense,
  deleteExpenseField,
  updateExpense,
  updateExpenseField,
  ValidationError,
} from "@/lib/expenses";
import type { ActionResult } from "@/lib/payroll-types";

function finish(action: () => void): ActionResult {
  try {
    action();
    revalidatePath("/expenses");
    return { ok: true };
  } catch (error) {
    if (error instanceof ValidationError) return { ok: false, error: error.message };
    console.error(error);
    return { ok: false, error: "Something went wrong. Try again." };
  }
}

export async function saveExpenseAction(id: string | null, input: unknown): Promise<ActionResult> {
  return finish(() => {
    if (id) updateExpense(id, input);
    else createExpense(input);
  });
}

export async function deleteExpenseAction(id: string): Promise<ActionResult> {
  return finish(() => deleteExpense(id));
}

export async function createExpenseFieldAction(input: unknown): Promise<ActionResult> {
  return finish(() => createExpenseField(input));
}

export async function updateExpenseFieldAction(id: string, input: unknown): Promise<ActionResult> {
  return finish(() => updateExpenseField(id, input));
}

export async function deleteExpenseFieldAction(id: string): Promise<ActionResult> {
  return finish(() => deleteExpenseField(id));
}
