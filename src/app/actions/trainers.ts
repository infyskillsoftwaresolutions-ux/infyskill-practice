"use server";

import { revalidatePath } from "next/cache";
import {
  createTrainer,
  createTrainerField,
  deleteTrainer,
  deleteTrainerField,
  updateTrainer,
  updateTrainerField,
  ValidationError,
} from "@/lib/trainers";
import type { ActionResult } from "@/lib/payroll-types";

function refresh() {
  revalidatePath("/trainers", "layout");
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

export async function createTrainerAction(input: unknown): Promise<ActionResult> {
  try {
    const id = createTrainer(input);
    refresh();
    return { ok: true, id };
  } catch (error) {
    if (error instanceof ValidationError) return { ok: false, error: error.message };
    console.error(error);
    return { ok: false, error: "Something went wrong. Try again." };
  }
}

export async function saveTrainerAction(id: string, input: unknown): Promise<ActionResult> {
  return finish(() => updateTrainer(id, input));
}

export async function deleteTrainerAction(id: string): Promise<ActionResult> {
  return finish(() => deleteTrainer(id));
}

export async function createTrainerFieldAction(input: unknown): Promise<ActionResult> {
  return finish(() => createTrainerField(input));
}

export async function updateTrainerFieldAction(id: string, input: unknown): Promise<ActionResult> {
  return finish(() => updateTrainerField(id, input));
}

export async function deleteTrainerFieldAction(id: string): Promise<ActionResult> {
  return finish(() => deleteTrainerField(id));
}
