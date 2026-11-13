import { redirect } from "next/navigation";
import { TeamPanel } from "@/components/practice/team-panel";
import { listEmployees } from "@/lib/practice";
import { getPracticeUser } from "@/lib/practice-auth";

export const dynamic = "force-dynamic";

export default async function PracticeTeamPage() {
  const user = await getPracticeUser();
  if (!user) redirect("/practice/login");
  if (user.role !== "main_admin") redirect("/practice");
  return <TeamPanel employees={listEmployees()} />;
}
