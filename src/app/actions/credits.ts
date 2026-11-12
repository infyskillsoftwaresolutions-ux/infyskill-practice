"use server";

import { revalidatePath } from "next/cache";
import {
  createCredit,
  createCreditField,
  deleteCredit,
  deleteCreditField,
  updateCredit,
  updateCreditField,
  ValidationError,
} from "@/lib/credits";
import type { ActionResult } from "@/lib/payroll-types";

function finish(action: () => void): ActionResult {
  try {
    action();
    revalidatePath("/credits");
    revalidatePath("/");
    return { ok: true };
  } catch (error) {
    if (error instanceof ValidationError) return { ok: false, error: error.message };
    console.error(error);
    return { ok: false, error: "Something went wrong. Try again." };
  }
}

export async function saveCreditAction(id: string | null, input: unknown): Promise<ActionResult> {
  return finish(() => {
    if (id) updateCredit(id, input);
    else createCredit(input);
  });
}

export async function deleteCreditAction(id: string): Promise<ActionResult> {
  return finish(() => deleteCredit(id));
}

export async function createCreditFieldAction(input: unknown): Promise<ActionResult> {
  return finish(() => createCreditField(input));
}

export async function updateCreditFieldAction(id: string, input: unknown): Promise<ActionResult> {
  return finish(() => updateCreditField(id, input));
}

export async function deleteCreditFieldAction(id: string): Promise<ActionResult> {
  return finish(() => deleteCreditField(id));
}
