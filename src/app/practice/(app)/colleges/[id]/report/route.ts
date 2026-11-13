import { collegeReport, collegeReportCsv, reportFileName } from "@/lib/practice-report";
import { getPracticeUser } from "@/lib/practice-auth";
import { resolveCollegeId } from "@/lib/practice-site";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getPracticeUser();
  if (!user) return new Response("Sign in required.", { status: 401 });
  const collegeId = await resolveCollegeId((await params).id);
  if (!collegeId) return new Response("This report is not available.", { status: 404 });
  const report = collegeReport(user, collegeId);
  if (!report) return new Response("This report is not available.", { status: 404 });
  return new Response(collegeReportCsv(report), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${reportFileName(report.collegeName)}"`,
    },
  });
}
