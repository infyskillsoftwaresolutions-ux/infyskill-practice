import { notFound, redirect } from "next/navigation";
import { CollegeScreen } from "@/components/practice/college-screen";
import { PracticeClosed } from "@/components/practice/practice-closed";
import { StudentHome } from "@/components/practice/student-home";
import { getPracticeCollege } from "@/lib/practice";
import { readPracticeAccess, studentAccessMessage, studentsCanPractice } from "@/lib/practice-access";
import { listStudentMocks } from "@/lib/practice-mocks";
import { listModuleCards } from "@/lib/practice-questions";
import { getPracticeUser } from "@/lib/practice-auth";
import { readPracticeSite } from "@/lib/practice-site";

export const dynamic = "force-dynamic";

export default async function PracticeSitePage() {
  const site = await readPracticeSite();
  if (!site) notFound();
  const user = await getPracticeUser();
  if (!user) redirect("/login");
  if (!site.college) {
    return <PracticeClosed title="InfySkill Practice" message="This address is not set up." />;
  }
  const college = getPracticeCollege(user, site.college.id);
  if (!college) {
    return (
      <PracticeClosed
        title={site.college.name}
        message={`This address is for ${site.college.name}.`}
        collegeId={site.college.id}
        hasLogo={site.college.hasLogo}
        logoAt={site.college.logoAt}
      />
    );
  }
  if (user.role === "student") {
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
    return (
      <StudentHome
        college={college}
        modules={listModuleCards(user, college.id)}
        mocks={listStudentMocks(user, college.id)}
        onHost
      />
    );
  }
  return <CollegeScreen collegeId={college.id} />;
}
