import Link from "next/link";
import { CollegeMark } from "@/components/practice/college-mark";
import { ModuleRail } from "@/components/practice/module-rail";
import { homeHref, mockHref } from "@/lib/practice-host";
import type { StudentMock } from "@/lib/practice-mocks";
import type { ModuleCard } from "@/lib/practice-questions";

export function StudentHome({
  college,
  modules,
  mocks,
  onHost,
}: {
  college: { id: string; name: string; hasLogo: boolean; logoAt: string } | null;
  modules: ModuleCard[];
  mocks: StudentMock[];
  onHost: boolean;
}) {
  return (
    <div className="lg:grid lg:grid-cols-[260px_minmax(0,1fr)] lg:items-start">
      {college ? (
        <ModuleRail role="student" collegeId={college.id} modules={modules} homeHref={homeHref(onHost)} homeLabel="Practice" />
      ) : (
        <div />
      )}
      <main className="mx-auto flex w-full max-w-4xl flex-col gap-4 px-4 py-6 sm:px-6 lg:px-8">
      <div className="flex items-center gap-3">
        {college ? <CollegeMark collegeId={college.id} name={college.name} hasLogo={college.hasLogo} logoAt={college.logoAt} onHost={onHost} /> : null}
        <h1 className="text-2xl font-semibold tracking-tight text-ink">{college ? college.name : "No college assigned"}</h1>
      </div>
      <p className="max-w-xl text-sm leading-6 text-muted">
        {college ? "Choose a module on the left and answer the published questions." : "Ask your college to confirm that this email was added as a student."}
      </p>
      {mocks.length > 0 && college ? (
        <section className="mt-4 grid gap-3">
          <h2 className="text-base font-semibold text-ink">Mocks</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {mocks.map((mock) => (
              <Link key={mock.id} href={mockHref(college.id, mock.id, onHost)} className="rounded-2xl border border-line bg-card px-4 py-4 hover:border-accent">
                <p className="text-base font-semibold text-ink">{mock.title}</p>
                <p className="mt-1 text-sm text-muted">
                  {mock.minutes} minutes · {mock.questionCount} questions
                  {mock.state === "finished" ? ` · ${mock.solved} solved · ${mock.points} points` : mock.state === "open" ? " · In progress" : ""}
                </p>
              </Link>
            ))}
          </div>
        </section>
      ) : null}
      </main>
    </div>
  );
}
