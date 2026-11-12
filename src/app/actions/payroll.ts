"use server";

import { revalidatePath } from "next/cache";
import {
  createEmployee,
  createField,
  deleteEmployee,
  deleteField,
  updateEmployee,
  updateField,
  ValidationError,
} from "@/lib/payroll";
import type { ActionResult } from "@/lib/payroll-types";

function finish(action: () => void): ActionResult {
  try {
    action();
    revalidatePath("/payroll");
    return { ok: true };
  } catch (error) {
    if (error instanceof ValidationError) return { ok: false, error: error.message };
    console.error(error);
    return { ok: false, error: "Something went wrong. Try again." };
  }
}

export async function saveEmployeeAction(id: string | null, input: unknown): Promise<ActionResult> {
  return finish(() => {
    if (id) updateEmployee(id, input);
    else createEmployee(input);
  });
}

export async function deleteEmployeeAction(id: string): Promise<ActionResult> {
  return finish(() => deleteEmployee(id));
}

export async function createFieldAction(input: unknown): Promise<ActionResult> {
  return finish(() => createField(input));
}

export async function updateFieldAction(id: string, input: unknown): Promise<ActionResult> {
  return finish(() => updateField(id, input));
}

export async function deleteFieldAction(id: string): Promise<ActionResult> {
  return finish(() => deleteField(id));
}
