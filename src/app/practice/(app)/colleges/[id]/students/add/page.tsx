import { CollegeStudentsPage } from "@/components/practice/college-students-page";

export const dynamic = "force-dynamic";

export default async function AddStudentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <CollegeStudentsPage id={id} mode="add" />;
}
