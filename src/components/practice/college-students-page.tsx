import { notFound, redirect } from "next/navigation";
import { StudentBoard } from "@/components/practice/student-board";
import { PracticeClosed } from "@/components/practice/practice-closed";
import { listCollegeStudents } from "@/lib/practice";
import { HOST_COLLEGE, collegeHref, studentsHref } from "@/lib/practice-host";
import { listModuleCards } from "@/lib/practice-questions";
import { openCollege } from "@/lib/practice-site";

export async function CollegeStudentsPage({
  id,
  mode,
}: {
  id: string;
  mode: "list" | "add" | "upload";
}) {
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
  if (gate.user.role === "student") redirect(gate.onHost ? "/" : "/practice");
  if (gate.onHost && id !== HOST_COLLEGE) redirect(studentsHref(college.id, true, mode === "list" ? "" : mode));
  if (gate.user.role === "employee") redirect(collegeHref(college.id, gate.onHost));
  if (gate.user.role !== "main_admin" && mode !== "list") redirect(studentsHref(college.id, gate.onHost));
  if (!college.id) notFound();
  return (
    <StudentBoard
      role={gate.user.role}
      collegeId={college.id}
      collegeName={college.name}
      hasLogo={college.hasLogo}
      logoAt={college.logoAt}
      modules={listModuleCards(gate.user, college.id)}
      students={listCollegeStudents(college.id)}
      mode={mode}
    />
  );
}
