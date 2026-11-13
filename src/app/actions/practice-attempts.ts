"use server";

import { revalidatePath } from "next/cache";
import { runWork, submitChoice, submitWork } from "@/lib/practice-attempts";
import { ValidationError } from "@/lib/practice";
import { getPracticeUser } from "@/lib/practice-auth";

export type SubmitResult = { ok: true; outcome: "solved" | "attempted"; message: string } | { ok: false; error: string };

function failed(error: unknown): SubmitResult {
  if (error instanceof ValidationError) return { ok: false, error: error.message };
  console.error(error);
  return { ok: false, error: "Something went wrong. Try again." };
}

export async function submitChoiceAction(collegeId: string, questionId: string, choiceId: string, mockId?: string): Promise<SubmitResult> {
  try {
    const user = await getPracticeUser();
    if (!user) return { ok: false, error: "Sign in to answer." };
    const result = submitChoice(user, collegeId, questionId, choiceId, mockId);
    revalidatePath("/practice", "layout");
    return { ok: true, ...result };
  } catch (error) {
    return failed(error);
  }
}

export async function runWorkAction(
  collegeId: string,
  questionId: string,
  input: unknown,
  mockId?: string,
): Promise<{ ok: true; console: string } | { ok: false; error: string }> {
  try {
    const user = await getPracticeUser();
    if (!user) return { ok: false, error: "Sign in to answer." };
    return { ok: true, ...(await runWork(user, collegeId, questionId, input, mockId)) };
  } catch (error) {
    if (error instanceof ValidationError) return { ok: false, error: error.message };
    console.error(error);
    return { ok: false, error: "Something went wrong. Try again." };
  }
}

export async function submitWorkAction(collegeId: string, questionId: string, input: unknown, mockId?: string): Promise<SubmitResult> {
  try {
    const user = await getPracticeUser();
    if (!user) return { ok: false, error: "Sign in to answer." };
    const result = await submitWork(user, collegeId, questionId, input, mockId);
    revalidatePath("/practice", "layout");
    return { ok: true, ...result };
  } catch (error) {
    return failed(error);
  }
}
