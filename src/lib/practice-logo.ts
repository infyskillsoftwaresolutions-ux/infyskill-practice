import fs from "fs";
import path from "path";
import { dataDirectory, getDb } from "@/lib/db";
import { ValidationError } from "@/lib/colleges";
import { getPracticeCollege } from "@/lib/practice";
import type { PracticeViewer } from "@/lib/practice-auth";

const KINDS = ["png", "jpeg", "webp"] as const;
type LogoKind = (typeof KINDS)[number];

const MAX_BYTES = 1_000_000;

const CONTENT_TYPE: Record<LogoKind, string> = {
  png: "image/png",
  jpeg: "image/jpeg",
  webp: "image/webp",
};

function collegeIdOf(value: string) {
  if (!/^[0-9a-f-]{36}$/i.test(value)) throw new ValidationError("That college is not on InfySkill Practice.");
  return value;
}

function logoFile(collegeId: string, kind: string) {
  return path.join(dataDirectory(), "practice-logos", `${collegeId}.${kind}`);
}

function detect(bytes: Buffer): LogoKind | null {
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "png";
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "jpeg";
  if (bytes.length >= 12 && bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP") return "webp";
  return null;
}

function clearFiles(collegeId: string) {
  for (const kind of KINDS) {
    const file = logoFile(collegeId, kind);
    if (fs.existsSync(file)) fs.unlinkSync(file);
  }
}

export function saveCollegeLogo(collegeId: string, bytes: Buffer) {
  const id = collegeIdOf(collegeId);
  const college = getDb().prepare(`SELECT college_id FROM practice_colleges WHERE college_id = ?`).get(id);
  if (!college) throw new ValidationError("That college is not on InfySkill Practice.");
  if (bytes.length === 0 || bytes.length > MAX_BYTES) {
    throw new ValidationError("Logo must be a PNG, JPEG, or WebP under 1 MB.");
  }
  const kind = detect(bytes);
  if (!kind) throw new ValidationError("Logo must be a PNG, JPEG, or WebP under 1 MB.");
  fs.mkdirSync(path.join(dataDirectory(), "practice-logos"), { recursive: true });
  clearFiles(id);
  fs.writeFileSync(logoFile(id, kind), bytes);
  getDb().prepare(`UPDATE practice_colleges SET logo_kind = ?, logo_at = ? WHERE college_id = ?`).run(kind, new Date().toISOString(), id);
}

export function removeCollegeLogo(collegeId: string) {
  const id = collegeIdOf(collegeId);
  const college = getDb().prepare(`SELECT college_id FROM practice_colleges WHERE college_id = ?`).get(id);
  if (!college) throw new ValidationError("That college is not on InfySkill Practice.");
  clearFiles(id);
  getDb().prepare(`UPDATE practice_colleges SET logo_kind = '', logo_at = '' WHERE college_id = ?`).run(id);
}

export function readCollegeLogoFile(collegeId: string) {
  const row = getDb().prepare(`SELECT logo_kind FROM practice_colleges WHERE college_id = ?`).get(collegeId) as
    | { logo_kind: string }
    | undefined;
  const kind = row?.logo_kind;
  if (kind !== "png" && kind !== "jpeg" && kind !== "webp") return null;
  const file = logoFile(collegeId, kind);
  if (!fs.existsSync(file)) return null;
  return { bytes: fs.readFileSync(file), contentType: CONTENT_TYPE[kind] };
}

export function readCollegeLogo(user: PracticeViewer, collegeId: string) {
  const college = getPracticeCollege(user, collegeId);
  if (!college?.hasLogo) return null;
  return readCollegeLogoFile(collegeId);
}
