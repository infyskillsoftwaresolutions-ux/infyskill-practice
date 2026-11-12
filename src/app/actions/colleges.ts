"use server";

import { revalidatePath } from "next/cache";
import {
  createCollege,
  createCollegeField,
  createProgram,
  createProgramField,
  deleteCollege,
  deleteCollegeField,
  deleteProgram,
  deleteProgramField,
  updateCollegeDetails,
  updateCollegeField,
  updateProgram,
  updateProgramField,
  ValidationError,
} from "@/lib/colleges";
import type { ActionResult } from "@/lib/payroll-types";

function refresh() {
  revalidatePath("/colleges", "layout");
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

export async function createCollegeAction(input: unknown): Promise<ActionResult> {
  try {
    const id = createCollege(input);
    refresh();
    return { ok: true, id };
  } catch (error) {
    if (error instanceof ValidationError) return { ok: false, error: error.message };
    console.error(error);
    return { ok: false, error: "Something went wrong. Try again." };
  }
}

export async function saveCollegeDetailsAction(id: string, input: unknown): Promise<ActionResult> {
  return finish(() => updateCollegeDetails(id, input));
}

export async function deleteCollegeAction(id: string): Promise<ActionResult> {
  return finish(() => deleteCollege(id));
}

export async function createCollegeFieldAction(input: unknown): Promise<ActionResult> {
  return finish(() => createCollegeField(input));
}

export async function updateCollegeFieldAction(id: string, input: unknown): Promise<ActionResult> {
  return finish(() => updateCollegeField(id, input));
}

export async function deleteCollegeFieldAction(id: string): Promise<ActionResult> {
  return finish(() => deleteCollegeField(id));
}

export async function saveProgramAction(
  collegeId: string,
  programId: string | null,
  input: unknown,
): Promise<ActionResult> {
  return finish(() => {
    if (programId) updateProgram(programId, input);
    else createProgram(collegeId, input);
  });
}

export async function deleteProgramAction(collegeId: string, programId: string): Promise<ActionResult> {
  return finish(() => deleteProgram(programId));
}

export async function createProgramFieldAction(input: unknown): Promise<ActionResult> {
  return finish(() => createProgramField(input));
}

export async function updateProgramFieldAction(id: string, input: unknown): Promise<ActionResult> {
  return finish(() => updateProgramField(id, input));
}

export async function deleteProgramFieldAction(id: string): Promise<ActionResult> {
  return finish(() => deleteProgramField(id));
}
