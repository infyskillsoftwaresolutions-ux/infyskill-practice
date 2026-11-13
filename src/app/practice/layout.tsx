import type { Metadata } from "next";
import { readPracticeSite } from "@/lib/practice-site";

export async function generateMetadata(): Promise<Metadata> {
  const site = await readPracticeSite();
  const title = site?.college ? `${site.college.name} · InfySkill Practice` : "InfySkill Practice";
  return {
    title,
    description: "Coding, SQL, web development, aptitude, reasoning, and verbal practice for your college.",
  };
}

export default function PracticeLayout({ children }: { children: React.ReactNode }) {
  return <div className="practice min-h-full">{children}</div>;
}
