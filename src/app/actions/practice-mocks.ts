"use server";

import { revalidatePath } from "next/cache";
import { saveMock, startMock } from "@/lib/practice-mocks";
import { ValidationError } from "@/lib/practice";
import { getPracticeUser } from "@/lib/practice-auth";
import type { ActionResult } from "@/lib/payroll-types";

function failed(error: unknown): ActionResult {
  if (error instanceof ValidationError) return { ok: false, error: error.message };
  console.error(error);
  return { ok: false, error: "Something went wrong. Try again." };
}

export async function saveMockAction(collegeId: string, mockId: string | null, input: unknown): Promise<ActionResult> {
  try {
    const user = await getPracticeUser();
    if (!user) return { ok: false, error: "Sign in to continue." };
    const id = saveMock(user, collegeId, mockId, input);
    revalidatePath("/practice", "layout");
    return { ok: true, id };
  } catch (error) {
    return failed(error);
  }
}

export async function startMockAction(collegeId: string, mockId: string): Promise<ActionResult> {
  try {
    const user = await getPracticeUser();
    if (!user) return { ok: false, error: "Sign in to continue." };
    startMock(user, collegeId, mockId);
    revalidatePath("/practice", "layout");
    return { ok: true };
  } catch (error) {
    return failed(error);
  }
}
