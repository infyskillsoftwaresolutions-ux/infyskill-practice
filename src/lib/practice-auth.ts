import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { getDb } from "@/lib/db";

export const PRACTICE_ROLES = ["main_admin", "employee", "college_admin", "student"] as const;
export type PracticeRole = (typeof PRACTICE_ROLES)[number];

export type PracticeViewer = {
  id: string;
  role: PracticeRole;
  fullName: string;
  email: string;
};

const COOKIE = "infyskill_practice";
const SESSION_DAYS = 14;

export function localAdminLogin() {
  const email = (process.env.PRACTICE_ADMIN_EMAIL || "admin@infyskill.local").trim().toLowerCase();
  const password = process.env.PRACTICE_ADMIN_PASSWORD || "InfyskillLocal1";
  return {
    email,
    password,
    showPassword: !process.env.PRACTICE_ADMIN_PASSWORD && process.env.NODE_ENV !== "production",
  };
}

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 32).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string) {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const actual = scryptSync(password, salt, 32);
  const expected = Buffer.from(hash, "hex");
  if (actual.length !== expected.length) return false;
  return timingSafeEqual(actual, expected);
}

type SessionRow = {
  id: string;
  role: string;
  full_name: string;
  email: string;
  status: string;
  expires_at: string;
};

function isRole(value: string): value is PracticeRole {
  return (PRACTICE_ROLES as readonly string[]).includes(value);
}

export async function getPracticeUser(): Promise<PracticeViewer | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (!token) return null;
  const row = getDb()
    .prepare(
      `SELECT u.id, u.role, u.full_name, u.email, u.status, s.expires_at
       FROM practice_sessions s
       JOIN practice_users u ON u.id = s.user_id
       WHERE s.id = ?`,
    )
    .get(token) as SessionRow | undefined;
  if (!row || row.status !== "active" || !isRole(row.role) || row.expires_at <= new Date().toISOString()) {
    if (row) getDb().prepare(`DELETE FROM practice_sessions WHERE id = ?`).run(token);
    return null;
  }
  return { id: row.id, role: row.role, fullName: row.full_name, email: row.email };
}

export async function startPracticeSession(userId: string) {
  const id = crypto.randomUUID();
  const expires = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  getDb()
    .prepare(`INSERT INTO practice_sessions (id, user_id, expires_at) VALUES (?, ?, ?)`)
    .run(id, userId, expires.toISOString());
  const jar = await cookies();
  jar.set(COOKIE, id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires,
  });
}

export async function endPracticeSession() {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) getDb().prepare(`DELETE FROM practice_sessions WHERE id = ?`).run(token);
  jar.delete({ name: COOKIE, path: "/" });
}
