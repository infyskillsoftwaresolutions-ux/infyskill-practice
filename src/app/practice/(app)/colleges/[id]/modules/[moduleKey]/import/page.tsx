import { notFound, redirect } from "next/navigation";
import { QuestionImport } from "@/components/practice/question-import";
import { PracticeClosed } from "@/components/practice/practice-closed";
import { getDb } from "@/lib/db";
import { HOST_COLLEGE, homeHref, moduleImportHref } from "@/lib/practice-host";
import { moduleInfo } from "@/lib/practice-questions";
import { openCollege } from "@/lib/practice-site";

export const dynamic = "force-dynamic";

export default async function ImportQuestionsPage({ params }: { params: Promise<{ id: string; moduleKey: string }> }) {
  const { id, moduleKey } = await params;
  const gate = await openCollege(id);
  if (gate.message || !gate.college) {
    return (
      <PracticeClosed
        title={gate.siteName}
        message={gate.message}
        collegeId={gate.collegeIdForMark}
        hasLogo={gate.hasLogo}
        logoAt={gate.logoAt}
      />
    );
  }
  if (gate.user.role !== "main_admin" && gate.user.role !== "employee") redirect(homeHref(gate.onHost));
  if (gate.onHost && id !== HOST_COLLEGE) redirect(moduleImportHref(gate.college.id, moduleKey, true));
  let info;
  try {
    info = moduleInfo(moduleKey);
  } catch {
    notFound();
  }
  const enabled = getDb()
    .prepare(`SELECT id FROM practice_modules WHERE college_id = ? AND module_key = ?`)
    .get(gate.college.id, info.key);
  if (!enabled) notFound();
  return <QuestionImport collegeId={gate.college.id} collegeName={gate.college.name} moduleKey={info.key} moduleLabel={info.label} />;
}
