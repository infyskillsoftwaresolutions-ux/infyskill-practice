import { redirect } from "next/navigation";
import { CollegeScreen } from "@/components/practice/college-screen";
import { PracticeClosed } from "@/components/practice/practice-closed";
import { HOST_COLLEGE } from "@/lib/practice-host";
import { openCollege } from "@/lib/practice-site";

export const dynamic = "force-dynamic";

export default async function PracticeCollegePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
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
  if (gate.user.role === "student") redirect(gate.onHost ? "/" : "/practice");
  if (gate.onHost && id !== HOST_COLLEGE) redirect("/");
  return <CollegeScreen collegeId={gate.college.id} />;
}
