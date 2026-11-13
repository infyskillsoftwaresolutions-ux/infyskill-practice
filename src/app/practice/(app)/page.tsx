import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { CollegeList } from "@/components/practice/college-list";
import { PracticeClosed } from "@/components/practice/practice-closed";
import { StudentHome } from "@/components/practice/student-home";
import { listPracticeColleges } from "@/lib/practice";
import { readPracticeAccess, studentAccessMessage, studentsCanPractice } from "@/lib/practice-access";
import { addressRoot } from "@/lib/practice-host";
import { listStudentMocks } from "@/lib/practice-mocks";
import { listModuleCards } from "@/lib/practice-questions";
import { getPracticeUser } from "@/lib/practice-auth";

export const dynamic = "force-dynamic";

export default async function PracticeHomePage() {
  const user = await getPracticeUser();
  if (!user) redirect("/practice/login");
  const colleges = listPracticeColleges(user);

  if (user.role === "student") {
    const college = colleges[0];
    if (college) {
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
    }
    const mocks = college ? listStudentMocks(user, college.id) : [];
    return (
      <StudentHome
        college={college ?? null}
        modules={college ? listModuleCards(user, college.id) : []}
        mocks={mocks}
        onHost={false}
      />
    );
  }

  return <CollegeList role={user.role} colleges={colleges} addressRoot={addressRoot((await headers()).get("host"))} />;
}
