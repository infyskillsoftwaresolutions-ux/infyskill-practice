import Link from "next/link";
import { CollegeMark } from "@/components/practice/college-mark";
import type { QuestionDetail } from "@/lib/practice-questions";

export function QuestionView({
  collegeId,
  collegeName,
  hasLogo,
  logoAt,
  question,
  backHref,
}: {
  collegeId: string;
  collegeName: string;
  hasLogo: boolean;
  logoAt: string;
  question: QuestionDetail;
  backHref: string;
}) {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-6 sm:px-6">
      <header>
        <Link href={backHref} className="text-sm text-accent">
          {collegeName} · {question.moduleLabel}
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <CollegeMark collegeId={collegeId} name={collegeName} hasLogo={hasLogo} logoAt={logoAt} />
          <h1 className="text-2xl font-semibold tracking-tight text-ink">{question.title}</h1>
          <span className="rounded-full bg-accent-soft px-2.5 py-1 text-xs font-medium text-accent">{question.difficulty}</span>
          <span className="text-sm text-muted">{question.points} points</span>
        </div>
      </header>
      <article className="grid gap-4 rounded-2xl border border-line bg-card p-4 text-sm leading-6 text-ink">
        <p className="whitespace-pre-wrap">{question.body}</p>
        {question.timeMinutes > 0 || question.lockCopy || question.lockPaste || question.hiddenTestCount > 0 ? (
          <p className="text-xs text-muted">
            {[
              question.timeMinutes > 0 ? `${question.timeMinutes} minute timer` : "",
              question.lockCopy ? "students cannot copy the question" : "",
              question.lockPaste ? "students cannot paste an answer" : "",
              question.hiddenTestCount > 0 ? `${question.hiddenTestCount} hidden ${question.hiddenTestCount === 1 ? "test" : "tests"}` : "",
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        ) : null}
        {question.kind === "code" ? (
          <>
            {question.inputDescription ? (
              <section>
                <h2 className="font-semibold">Input</h2>
                <p className="mt-1 whitespace-pre-wrap">{question.inputDescription}</p>
              </section>
            ) : null}
            {question.outputDescription ? (
              <section>
                <h2 className="font-semibold">Output</h2>
                <p className="mt-1 whitespace-pre-wrap">{question.outputDescription}</p>
              </section>
            ) : null}
            {question.samples.map((sample, index) => (
              <section key={index} className="grid gap-3 sm:grid-cols-2">
                <div>
                  <h2 className="font-semibold">Sample input {index + 1}</h2>
                  <pre className="mt-1 overflow-x-auto rounded-lg bg-background px-3 py-2 font-mono text-xs">{sample.input}</pre>
                </div>
                <div>
                  <h2 className="font-semibold">Sample output {index + 1}</h2>
                  <pre className="mt-1 overflow-x-auto rounded-lg bg-background px-3 py-2 font-mono text-xs">{sample.output}</pre>
                </div>
              </section>
            ))}
            {question.templateCode ? (
              <section>
                <h2 className="font-semibold">Starter code</h2>
                <pre className="mt-1 overflow-x-auto rounded-lg bg-background px-3 py-2 font-mono text-xs">{question.templateCode}</pre>
              </section>
            ) : null}
          </>
        ) : (
          <ol className="grid gap-2">
            {question.choices.map((choice, index) => (
              <li key={index} className="rounded-lg border border-line px-3 py-2">
                {choice.text}
              </li>
            ))}
          </ol>
        )}
        {question.hints ? (
          <section>
            <h2 className="font-semibold">Hints</h2>
            <p className="mt-1 whitespace-pre-wrap">{question.hints}</p>
          </section>
        ) : null}
      </article>
      <p className="text-sm text-muted">Students answer this question from their own login.</p>
    </main>
  );
}
