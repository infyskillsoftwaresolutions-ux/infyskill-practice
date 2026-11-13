import { listMockResults, mockResultsCsv } from "@/lib/practice-mocks";
import { collegeReportOpen, readPracticeAccess } from "@/lib/practice-access";
import { getPracticeUser } from "@/lib/practice-auth";
import { resolveCollegeId } from "@/lib/practice-site";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getPracticeUser();
  if (!user) return new Response("Sign in required.", { status: 401 });
  const id = await resolveCollegeId((await params).id);
  if (!id) return new Response("This report is not available.", { status: 404 });
  if (user.role === "college_admin" && !collegeReportOpen(readPracticeAccess(id))) {
    return new Response("This report is not available.", { status: 404 });
  }
  const rows = listMockResults(user, id);
  if (!rows) return new Response("This report is not available.", { status: 404 });
  return new Response(mockResultsCsv(rows), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="mock-results.csv"',
    },
  });
}
