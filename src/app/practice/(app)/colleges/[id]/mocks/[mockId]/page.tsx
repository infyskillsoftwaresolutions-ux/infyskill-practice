import { notFound, redirect } from "next/navigation";
import { MockSession } from "@/components/practice/mock-session";
import { PracticeClosed } from "@/components/practice/practice-closed";
import { readPracticeAccess, studentAccessMessage, studentsCanPractice } from "@/lib/practice-access";
import { HOST_COLLEGE, mockHref } from "@/lib/practice-host";
import { getMockPaper } from "@/lib/practice-mocks";
import { openCollege } from "@/lib/practice-site";

export const dynamic = "force-dynamic";

export default async function PracticeMockPage({ params }: { params: Promise<{ id: string; mockId: string }> }) {
  const { id, mockId } = await params;
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
  if (gate.user.role !== "student") notFound();
  if (gate.onHost && id !== HOST_COLLEGE) redirect(mockHref(gate.college.id, mockId, true));
  const college = gate.college;
  const access = readPracticeAccess(college.id);
  if (!studentsCanPractice(access)) {
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
  const paper = getMockPaper(gate.user, college.id, mockId);
  if (!paper) notFound();
  return <MockSession collegeId={college.id} collegeName={college.name} hasLogo={college.hasLogo} logoAt={college.logoAt} paper={paper} />;
}
