import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { CollegeDetail } from "@/components/colleges/college-detail";
import { getCollege, listCollegeFields, listProgramFields } from "@/lib/colleges";

export const dynamic = "force-dynamic";

export default async function CollegePage({ params }: PageProps<"/colleges/[id]">) {
  const { id } = await params;
  const college = getCollege(id);
  if (!college) notFound();

  return (
    <AppShell>
      <CollegeDetail college={college} fields={listCollegeFields()} programFields={listProgramFields()} />
    </AppShell>
  );
}
