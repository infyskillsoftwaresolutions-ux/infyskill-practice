import { notFound, redirect } from "next/navigation";
import { PracticeClosed } from "@/components/practice/practice-closed";
import { QuestionList } from "@/components/practice/question-list";
import { collegeAccessMessage, collegeReportOpen, readPracticeAccess, studentAccessMessage, studentsCanPractice } from "@/lib/practice-access";
import { HOST_COLLEGE, moduleHref } from "@/lib/practice-host";
import { listModuleCards, listQuestions, moduleInfo } from "@/lib/practice-questions";
import { openCollege } from "@/lib/practice-site";

export const dynamic = "force-dynamic";

export default async function PracticeModulePage({ params }: { params: Promise<{ id: string; moduleKey: string }> }) {
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
  const college = gate.college;
  if (gate.onHost && id !== HOST_COLLEGE) redirect(moduleHref(college.id, moduleKey, true));
  const access = readPracticeAccess(college.id);
  if (gate.user.role === "student" && !studentsCanPractice(access)) {
    return (
      <PracticeClosed
        title={college.name}
        message={studentAccessMessage(college.name, access)}
        collegeId={college.id}
        hasLogo={college.hasLogo}
        logoAt={college.logoAt}
      />
    );
  }
  if (gate.user.role === "college_admin" && !collegeReportOpen(access)) {
    return (
      <PracticeClosed
        title={college.name}
        message={collegeAccessMessage(access)}
        collegeId={college.id}
        hasLogo={college.hasLogo}
        logoAt={college.logoAt}
      />
    );
  }
  let label = moduleKey;
  try {
    label = moduleInfo(moduleKey).label;
  } catch {
    notFound();
  }
  let questions;
  try {
    questions = listQuestions(gate.user, college.id, moduleKey);
  } catch {
    notFound();
  }
  return (
    <QuestionList
      role={gate.user.role}
      collegeId={college.id}
      collegeName={college.name}
      hasLogo={college.hasLogo}
      logoAt={college.logoAt}
      moduleKey={moduleKey}
      moduleLabel={label}
      questions={questions}
      modules={listModuleCards(gate.user, college.id)}
      studentCount={college.studentCount}
    />
  );
}
