"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  addCollegeAdmin,
  addEmployee,
  addStudent,
  authenticate,
  importStudents,
  createPracticeCollege,
  ensureMainAdmin,
  removeCollegeAdmin,
  removeStudent,
  setEmployeeAccess,
  setPracticeWebAddress,
  ValidationError,
} from "@/lib/practice";
import { linkPracticeInvoice } from "@/lib/practice-access";
import { removeCollegeLogo, saveCollegeLogo } from "@/lib/practice-logo";
import { endPracticeSession, getPracticeUser, startPracticeSession } from "@/lib/practice-auth";
import { canUsePracticeSite, readPracticeSite } from "@/lib/practice-site";
import type { ActionResult } from "@/lib/payroll-types";

function refresh() {
  revalidatePath("/practice", "layout");
}

async function mainAdmin() {
  const user = await getPracticeUser();
  if (!user || user.role !== "main_admin") return null;
  return user;
}

function failed(error: unknown): ActionResult {
  if (error instanceof ValidationError) return { ok: false, error: error.message };
  console.error(error);
  return { ok: false, error: "Something went wrong. Try again." };
}

export async function loginAction(input: unknown): Promise<ActionResult> {
  try {
    ensureMainAdmin();
    if (!input || typeof input !== "object" || Array.isArray(input)) {
      return { ok: false, error: "Email and password are required." };
    }
    const record = input as Record<string, unknown>;
    const site = await readPracticeSite();
    if (site && !site.college) return { ok: false, error: "This address is not set up." };
    const userId = authenticate(record.email, record.password);
    if (site?.college && !canUsePracticeSite(userId, site.college.id)) {
      return { ok: false, error: `This address is for ${site.college.name}.` };
    }
    await startPracticeSession(userId);
    return { ok: true };
  } catch (error) {
    return failed(error);
  }
}

export async function logoutAction() {
  const site = await readPracticeSite();
  await endPracticeSession();
  redirect(site ? "/login" : "/practice/login");
}

export async function setPracticeWebAddressAction(collegeId: string, slug: string): Promise<ActionResult> {
  try {
    if (!(await mainAdmin())) return { ok: false, error: "Only the main admin can set a web address." };
    setPracticeWebAddress(collegeId, slug);
    refresh();
    return { ok: true };
  } catch (error) {
    return failed(error);
  }
}

export async function createPracticeCollegeAction(name: string): Promise<ActionResult> {
  try {
    if (!(await mainAdmin())) return { ok: false, error: "Only the main admin can add a college." };
    const id = createPracticeCollege(name);
    refresh();
    return { ok: true, id };
  } catch (error) {
    return failed(error);
  }
}

export async function addStudentAction(collegeId: string, input: unknown): Promise<ActionResult> {
  try {
    if (!(await mainAdmin())) return { ok: false, error: "Only the main admin can add students." };
    const id = addStudent(collegeId, input);
    refresh();
    return { ok: true, id };
  } catch (error) {
    return failed(error);
  }
}

export async function importStudentsAction(
  collegeId: string,
  source: string,
): Promise<{ ok: true; count: number } | { ok: false; error: string }> {
  try {
    if (!(await mainAdmin())) return { ok: false, error: "Only the main admin can add students." };
    const count = importStudents(collegeId, source);
    refresh();
    return { ok: true, count };
  } catch (error) {
    if (error instanceof ValidationError) return { ok: false, error: error.message };
    console.error(error);
    return { ok: false, error: "Something went wrong. Try again." };
  }
}

export async function removeStudentAction(collegeId: string, userId: string): Promise<ActionResult> {
  try {
    if (!(await mainAdmin())) return { ok: false, error: "Only the main admin can remove students." };
    removeStudent(collegeId, userId);
    refresh();
    return { ok: true };
  } catch (error) {
    return failed(error);
  }
}

export async function addCollegeAdminAction(collegeId: string, input: unknown): Promise<ActionResult> {
  try {
    if (!(await mainAdmin())) return { ok: false, error: "Only the main admin can add a college admin." };
    const id = addCollegeAdmin(collegeId, input);
    refresh();
    return { ok: true, id };
  } catch (error) {
    return failed(error);
  }
}

export async function removeCollegeAdminAction(collegeId: string, userId: string): Promise<ActionResult> {
  try {
    if (!(await mainAdmin())) return { ok: false, error: "Only the main admin can remove a college admin." };
    removeCollegeAdmin(collegeId, userId);
    refresh();
    return { ok: true };
  } catch (error) {
    return failed(error);
  }
}

export async function addEmployeeAction(input: unknown): Promise<ActionResult> {
  try {
    if (!(await mainAdmin())) return { ok: false, error: "Only the main admin can add an employee." };
    const id = addEmployee(input);
    refresh();
    return { ok: true, id };
  } catch (error) {
    return failed(error);
  }
}

export async function linkPracticeInvoiceAction(collegeId: string, invoiceId: string, endsOn: string): Promise<ActionResult> {
  try {
    if (!(await mainAdmin())) return { ok: false, error: "Only the main admin can link an invoice." };
    linkPracticeInvoice(collegeId, invoiceId, endsOn);
    refresh();
    return { ok: true };
  } catch (error) {
    return failed(error);
  }
}

export async function saveCollegeLogoAction(collegeId: string, formData: FormData): Promise<ActionResult> {
  try {
    if (!(await mainAdmin())) return { ok: false, error: "Only the main admin can set a college logo." };
    const file = formData.get("logo");
    if (!(file instanceof File) || file.size === 0) return { ok: false, error: "Choose a logo image." };
    saveCollegeLogo(collegeId, Buffer.from(await file.arrayBuffer()));
    refresh();
    return { ok: true };
  } catch (error) {
    return failed(error);
  }
}

export async function removeCollegeLogoAction(collegeId: string): Promise<ActionResult> {
  try {
    if (!(await mainAdmin())) return { ok: false, error: "Only the main admin can remove a college logo." };
    removeCollegeLogo(collegeId);
    refresh();
    return { ok: true };
  } catch (error) {
    return failed(error);
  }
}

export async function setEmployeeAccessAction(collegeId: string, userId: string, allowed: boolean): Promise<ActionResult> {
  try {
    if (!(await mainAdmin())) return { ok: false, error: "Only the main admin can change employee access." };
    setEmployeeAccess(collegeId, userId, allowed);
    refresh();
    return { ok: true };
  } catch (error) {
    return failed(error);
  }
}
