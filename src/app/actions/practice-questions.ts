"use server";

import { revalidatePath } from "next/cache";
import { ValidationError } from "@/lib/practice";
import {
  copyQuestion,
  disableModule,
  enableModule,
  importQuestions,
  saveQuestion,
  setPublished,
} from "@/lib/practice-questions";
import { getPracticeUser } from "@/lib/practice-auth";
import type { ActionResult } from "@/lib/payroll-types";

function refresh() {
  revalidatePath("/practice", "layout");
}

function failed(error: unknown): ActionResult {
  if (error instanceof ValidationError) return { ok: false, error: error.message };
  console.error(error);
  return { ok: false, error: "Something went wrong. Try again." };
}

async function viewer() {
  return getPracticeUser();
}

export async function enableModuleAction(collegeId: string, moduleKey: string): Promise<ActionResult> {
  try {
    const user = await viewer();
    if (!user || user.role !== "main_admin") return { ok: false, error: "Only the main admin can add a module." };
    enableModule(collegeId, moduleKey);
    refresh();
    return { ok: true };
  } catch (error) {
    return failed(error);
  }
}

export async function disableModuleAction(collegeId: string, moduleKey: string): Promise<ActionResult> {
  try {
    const user = await viewer();
    if (!user || user.role !== "main_admin") return { ok: false, error: "Only the main admin can turn a module off." };
    disableModule(collegeId, moduleKey);
    refresh();
    return { ok: true };
  } catch (error) {
    return failed(error);
  }
}

export async function saveQuestionAction(
  collegeId: string,
  moduleKey: string,
  questionId: string | null,
  input: unknown,
): Promise<ActionResult> {
  try {
    const user = await viewer();
    if (!user) return { ok: false, error: "Sign in to save a question." };
    const id = saveQuestion(user, collegeId, moduleKey, questionId, input);
    refresh();
    return { ok: true, id };
  } catch (error) {
    return failed(error);
  }
}

export async function importQuestionsAction(
  collegeId: string,
  moduleKey: string,
  source: string,
): Promise<{ ok: true; count: number } | { ok: false; error: string }> {
  try {
    const user = await viewer();
    if (!user) return { ok: false, error: "Sign in to import questions." };
    const count = importQuestions(user, collegeId, moduleKey, source);
    refresh();
    return { ok: true, count };
  } catch (error) {
    if (error instanceof ValidationError) return { ok: false, error: error.message };
    console.error(error);
    return { ok: false, error: "Something went wrong. Try again." };
  }
}

export async function setPublishedAction(collegeId: string, questionId: string, published: boolean): Promise<ActionResult> {
  try {
    const user = await viewer();
    if (!user) return { ok: false, error: "Sign in to publish a question." };
    setPublished(user, collegeId, questionId, published);
    refresh();
    return { ok: true, id: questionId };
  } catch (error) {
    return failed(error);
  }
}

export async function copyQuestionAction(collegeId: string, questionId: string, targetCollegeId: string): Promise<ActionResult> {
  try {
    const user = await viewer();
    if (!user || user.role !== "main_admin") return { ok: false, error: "Only the main admin can copy a question." };
    const id = copyQuestion(collegeId, questionId, targetCollegeId);
    refresh();
    return { ok: true, id };
  } catch (error) {
    return failed(error);
  }
}
