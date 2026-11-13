import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { getDb } from "@/lib/db";
import { getPracticeCollege, type PracticeCollegeSummary } from "@/lib/practice";
import { getPracticeUser, type PracticeViewer } from "@/lib/practice-auth";
import { addressRoot, HOST_COLLEGE, slugFromHost } from "@/lib/practice-host";

export type PracticeSiteCollege = {
  id: string;
  name: string;
  hasLogo: boolean;
  logoAt: string;
  webSlug: string;
};

export type PracticeSite = {
  slug: string;
  college: PracticeSiteCollege | null;
};

export type CollegeGate = {
  user: PracticeViewer;
  onHost: boolean;
  college: PracticeCollegeSummary | null;
  message: string;
  siteName: string;
  hasLogo: boolean;
  logoAt: string;
  collegeIdForMark: string;
};

type SiteRow = {
  id: string;
  name: string;
  logo_kind: string;
  logo_at: string;
  web_slug: string;
};

export async function readPracticeSite(): Promise<PracticeSite | null> {
  const slug = slugFromHost((await headers()).get("host"));
  if (!slug) return null;
  const row = getDb()
    .prepare(
      `SELECT c.id, c.name, p.logo_kind, p.logo_at, p.web_slug
       FROM practice_colleges p
       JOIN colleges c ON c.id = p.college_id
       WHERE p.web_slug = ?`,
    )
    .get(slug) as SiteRow | undefined;
  if (!row) return { slug, college: null };
  return {
    slug,
    college: {
      id: String(row.id),
      name: String(row.name),
      hasLogo: String(row.logo_kind).length > 0,
      logoAt: String(row.logo_at),
      webSlug: String(row.web_slug),
    },
  };
}

export async function requestAddressRoot() {
  return addressRoot((await headers()).get("host"));
}

export async function resolveCollegeId(rawId: string) {
  if (rawId !== HOST_COLLEGE) return rawId;
  const site = await readPracticeSite();
  return site?.college?.id ?? "";
}

export function canUsePracticeSite(userId: string, collegeId: string) {
  const row = getDb().prepare(`SELECT role FROM practice_users WHERE id = ?`).get(userId) as { role: string } | undefined;
  if (!row) return false;
  if (row.role === "main_admin") return true;
  const member = getDb().prepare(`SELECT 1 AS ok FROM practice_memberships WHERE user_id = ? AND college_id = ?`).get(userId, collegeId);
  return Boolean(member);
}

function denied(user: PracticeViewer, college: PracticeSiteCollege): CollegeGate {
  return {
    user,
    onHost: true,
    college: null,
    message: `This address is for ${college.name}.`,
    siteName: college.name,
    hasLogo: college.hasLogo,
    logoAt: college.logoAt,
    collegeIdForMark: college.id,
  };
}

export async function openCollege(rawId: string): Promise<CollegeGate> {
  const site = await readPracticeSite();
  const user = await getPracticeUser();
  if (!user) redirect(site ? "/login" : "/practice/login");
  if (site && !site.college) {
    return {
      user,
      onHost: true,
      college: null,
      message: "This address is not set up.",
      siteName: "InfySkill Practice",
      hasLogo: false,
      logoAt: "",
      collegeIdForMark: "",
    };
  }
  const collegeId = rawId === HOST_COLLEGE ? site?.college?.id ?? "" : rawId;
  if (!collegeId) notFound();
  if (site?.college && site.college.id !== collegeId) return denied(user, site.college);
  const college = getPracticeCollege(user, collegeId);
  if (!college) {
    if (site?.college) return denied(user, site.college);
    notFound();
  }
  return {
    user,
    onHost: Boolean(site?.college),
    college,
    message: "",
    siteName: college.name,
    hasLogo: college.hasLogo,
    logoAt: college.logoAt,
    collegeIdForMark: college.id,
  };
}
