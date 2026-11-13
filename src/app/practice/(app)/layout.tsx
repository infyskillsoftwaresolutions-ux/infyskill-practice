import { redirect } from "next/navigation";
import { PracticeShell } from "@/components/practice/practice-shell";
import { ensureMainAdmin } from "@/lib/practice";
import { getPracticeUser } from "@/lib/practice-auth";
import { readPracticeSite } from "@/lib/practice-site";

export const dynamic = "force-dynamic";

export default async function PracticeAppLayout({ children }: { children: React.ReactNode }) {
  ensureMainAdmin();
  const user = await getPracticeUser();
  const site = await readPracticeSite();
  if (!user) redirect(site ? "/login" : "/practice/login");
  return (
    <PracticeShell user={{ fullName: user.fullName, role: user.role }} onHost={Boolean(site)}>
      {children}
    </PracticeShell>
  );
}
