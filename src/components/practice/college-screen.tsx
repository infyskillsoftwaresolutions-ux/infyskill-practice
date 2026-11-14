import { redirect } from "next/navigation";
import { CollegeDesk } from "@/components/practice/college-desk";
import { getPracticeCollege, listCollegeAdmins, listEmployees } from "@/lib/practice";
import { collegeAccessMessage, collegeReportOpen, listPracticeInvoices, readPracticeAccess } from "@/lib/practice-access";
import { listMockQuestionOptions, listMockResults, listMocks } from "@/lib/practice-mocks";
import { collegeReport } from "@/lib/practice-report";
import { listModuleCards } from "@/lib/practice-questions";
import { getPracticeUser } from "@/lib/practice-auth";
import { requestAddressRoot } from "@/lib/practice-site";

export async function CollegeScreen({ collegeId }: { collegeId: string }) {
  const user = await getPracticeUser();
  if (!user) redirect("/practice/login");
  if (user.role === "student") redirect("/practice");
  const college = getPracticeCollege(user, collegeId);
  if (!college) redirect("/practice");
  const manage = user.role === "main_admin";
  const access = readPracticeAccess(collegeId);
  return (
    <CollegeDesk
      role={user.role}
      college={college}
      collegeAdmins={manage ? listCollegeAdmins(collegeId) : []}
      employees={manage ? listEmployees() : []}
      modules={listModuleCards(user, collegeId)}
      report={collegeReport(user, collegeId)}
      access={access}
      accessMessage={collegeAccessMessage(access)}
      invoices={manage ? listPracticeInvoices(collegeId) : []}
      mocks={manage || (user.role === "college_admin" && collegeReportOpen(access)) ? listMocks(user, collegeId) : []}
      mockQuestions={manage ? listMockQuestionOptions(user, collegeId) : []}
      mockResults={manage || (user.role === "college_admin" && collegeReportOpen(access)) ? listMockResults(user, collegeId) ?? [] : []}
      addressRoot={await requestAddressRoot()}
    />
  );
}
