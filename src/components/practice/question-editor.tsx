"use client";

import Link from "next/link";
import { CollegeMark } from "@/components/practice/college-mark";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { copyQuestionAction, saveQuestionAction } from "@/app/actions/practice-questions";
import { usePracticeSite } from "@/components/practice/practice-site";
import { moduleHref, questionHref } from "@/lib/practice-host";
import type { PracticeModuleKind, QuestionChoice, QuestionDetail, QuestionSample, SqlPart } from "@/lib/practice-questions";

const inputClass =
  "w-full rounded-lg border border-line bg-background px-3 py-2 text-sm text-ink outline-none focus:border-accent";
const areaClass = `${inputClass} min-h-28`;

export function QuestionEditor({
  collegeId,
  collegeName,
  hasLogo,
  logoAt,
  moduleKey,
  moduleLabel,
  kind,
  question,
  copyTargets,
  canPublish,
}: {
  collegeId: string;
  collegeName: string;
  hasLogo: boolean;
  logoAt: string;
  moduleKey: string;
  moduleLabel: string;
  kind: PracticeModuleKind;
  question: QuestionDetail | null;
  copyTargets: { id: string; name: string }[];
  canPublish: boolean;
}) {
  const router = useRouter();
  const [title, setTitle] = useState(question?.title ?? "");
  const [difficultyScore, setDifficultyScore] = useState(String(question?.difficultyScore ?? 0));
  const [timeMinutes, setTimeMinutes] = useState(String(question?.timeMinutes ?? 0));
  const [lockCopy, setLockCopy] = useState(question?.lockCopy ?? false);
  const [lockPaste, setLockPaste] = useState(question?.lockPaste ?? false);
  const [body, setBody] = useState(question?.body ?? "");
  const [inputDescription, setInputDescription] = useState(question?.inputDescription ?? "");
  const [outputDescription, setOutputDescription] = useState(question?.outputDescription ?? "");
  const [templateCode, setTemplateCode] = useState(question?.templateCode ?? "");
  const [hints, setHints] = useState(question?.hints ?? "");
  const [samples, setSamples] = useState<QuestionSample[]>(question?.samples.length ? question.samples : [{ input: "", output: "" }]);
  const [hiddenTests, setHiddenTests] = useState<QuestionSample[]>(question?.hiddenTests.length ? question.hiddenTests : [{ input: "", output: "" }]);
  const [setupSql, setSetupSql] = useState(question?.setupSql ?? "");
  const [webExpect, setWebExpect] = useState(question?.webExpect ?? "");
  const [sqlParts, setSqlParts] = useState<SqlPart[]>(
    question?.sqlParts.length ? question.sqlParts : [{ prompt: "", mode: "read", checkSql: "" }],
  );
  const [choices, setChoices] = useState<QuestionChoice[]>(
    question?.choices.length ? question.choices : [
      { text: "", correct: true },
      { text: "", correct: false },
      { text: "", correct: false },
      { text: "", correct: false },
    ],
  );
  const [targetCollegeId, setTargetCollegeId] = useState(copyTargets[0]?.id ?? "");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState("");
  const [pending, startTransition] = useTransition();
  const { onHost } = usePracticeSite();
  const listHref = moduleHref(collegeId, moduleKey, onHost);

  function payload(publish: boolean) {
    return {
      title,
      difficultyScore: Number(difficultyScore),
      timeMinutes: Number(timeMinutes),
      lockCopy,
      lockPaste,
      body,
      inputDescription,
      outputDescription,
      templateCode,
      hints,
      samples,
      choices,
      hiddenTests,
      sqlParts,
      setupSql,
      webExpect,
      publish,
    };
  }

  function save(publish: boolean) {
    setError("");
    setCopied("");
    startTransition(async () => {
      const result = await saveQuestionAction(collegeId, moduleKey, question?.id ?? null, payload(publish));
      if (!result.ok) {
        setError(result.error);
        return;
      }
      if (!question?.id && result.id) router.replace(questionHref(collegeId, result.id, onHost));
      else router.refresh();
    });
  }

  function copy() {
    if (!question || !targetCollegeId) return;
    setError("");
    setCopied("");
    startTransition(async () => {
      const result = await copyQuestionAction(collegeId, question.id, targetCollegeId);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      if (result.id && onHost) {
        const target = copyTargets.find((college) => college.id === targetCollegeId);
        setCopied(`The copy is a draft at ${target?.name ?? "the other college"}. Open it from the shared practice address.`);
        return;
      }
      if (result.id) router.push(`/practice/colleges/${targetCollegeId}/questions/${result.id}`);
    });
  }

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-6 sm:px-6">
      <header>
        <Link href={listHref} className="text-sm text-accent">
          {collegeName} · {moduleLabel}
        </Link>
        <div className="mt-2 flex items-center gap-3">
          <CollegeMark collegeId={collegeId} name={collegeName} hasLogo={hasLogo} logoAt={logoAt} />
          <h1 className="text-2xl font-semibold tracking-tight text-ink">{question ? question.title : "New question"}</h1>
        </div>
        <p className="mt-1 text-sm text-muted">
          {question?.status === "published" ? "Published. Students can see this question." : "Draft. Students cannot see this until it is published."}
        </p>
      </header>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          save(false);
        }}
        className="grid gap-4 rounded-2xl border border-line bg-card p-4"
      >
        {error ? <p className="rounded-lg bg-[#fdecec] px-3 py-2 text-sm text-danger">{error}</p> : null}
        {copied ? <p className="rounded-lg bg-accent-soft px-3 py-2 text-sm text-accent">{copied}</p> : null}
        <label>
          <span className="mb-1.5 block text-sm font-medium text-ink">Question name</span>
          <input className={inputClass} value={title} onChange={(event) => setTitle(event.target.value)} required />
        </label>
        <label>
          <span className="mb-1.5 block text-sm font-medium text-ink">Difficulty score (0 to 1)</span>
          <input
            className={inputClass}
            type="number"
            min={0}
            max={1}
            step={0.01}
            value={difficultyScore}
            onChange={(event) => setDifficultyScore(event.target.value)}
            required
          />
          <span className="mt-1 block text-xs text-muted">Easy is 0–0.39, Medium is 0.40–0.69, Hard is 0.70–1. Points are the score times 100.</span>
        </label>
        <fieldset className="grid gap-3 rounded-xl border border-line bg-background p-3">
          <legend className="px-1 text-sm font-medium text-ink">Settings</legend>
          <label>
            <span className="mb-1.5 block text-sm font-medium text-ink">Timer (minutes)</span>
            <input
              className={inputClass}
              type="number"
              min={0}
              max={180}
              step={1}
              value={timeMinutes}
              onChange={(event) => setTimeMinutes(event.target.value)}
            />
            <span className="mt-1 block text-xs text-muted">
              0 means no timer. The clock starts when the student opens the question and keeps running if they refresh. A mock uses its own clock.
            </span>
          </label>
          <label className="flex items-start gap-2 text-sm text-ink">
            <input type="checkbox" className="mt-1" checked={lockCopy} onChange={(event) => setLockCopy(event.target.checked)} />
            <span>Students cannot copy the question</span>
          </label>
          <label className="flex items-start gap-2 text-sm text-ink">
            <input type="checkbox" className="mt-1" checked={lockPaste} onChange={(event) => setLockPaste(event.target.checked)} />
            <span>Students cannot paste an answer</span>
          </label>
          {moduleKey === "coding" ? (
            <p className="text-xs text-muted">Hidden tests stay off the student page. Students see how many there are. Submit checks those cases.</p>
          ) : null}
        </fieldset>
        <label>
          <span className="mb-1.5 block text-sm font-medium text-ink">Question</span>
          <textarea className={areaClass} value={body} onChange={(event) => setBody(event.target.value)} />
        </label>
        {kind === "code" ? (
          <>
            <label>
              <span className="mb-1.5 block text-sm font-medium text-ink">Input description</span>
              <textarea className={areaClass} value={inputDescription} onChange={(event) => setInputDescription(event.target.value)} />
            </label>
            <label>
              <span className="mb-1.5 block text-sm font-medium text-ink">Output description</span>
              <textarea className={areaClass} value={outputDescription} onChange={(event) => setOutputDescription(event.target.value)} />
            </label>
            <label>
              <span className="mb-1.5 block text-sm font-medium text-ink">Starter code</span>
              <textarea className={`${areaClass} font-mono`} value={templateCode} onChange={(event) => setTemplateCode(event.target.value)} />
            </label>
            {moduleKey === "coding" ? <div className="grid gap-3">
              <p className="text-sm font-medium text-ink">Sample cases</p>
              {samples.map((sample, index) => (
                <div key={index} className="grid gap-3 sm:grid-cols-2">
                  <label>
                    <span className="mb-1.5 block text-sm text-muted">Sample input {index + 1}</span>
                    <textarea
                      className={areaClass}
                      value={sample.input}
                      onChange={(event) => setSamples(samples.map((item, itemIndex) => (itemIndex === index ? { ...item, input: event.target.value } : item)))}
                    />
                  </label>
                  <label>
                    <span className="mb-1.5 block text-sm text-muted">Sample output {index + 1}</span>
                    <textarea
                      className={areaClass}
                      value={sample.output}
                      onChange={(event) => setSamples(samples.map((item, itemIndex) => (itemIndex === index ? { ...item, output: event.target.value } : item)))}
                    />
                  </label>
                </div>
              ))}
              {samples.length < 5 ? (
                <button
                  type="button"
                  onClick={() => setSamples([...samples, { input: "", output: "" }])}
                  className="justify-self-start text-sm text-accent"
                >
                  Add sample
                </button>
              ) : null}
            </div> : null}
            {moduleKey === "coding" ? (
              <div className="grid gap-3">
                <p className="text-sm font-medium text-ink">Hidden tests</p>
                <p className="text-xs text-muted">Students do not see these. Submit passes only when every hidden test matches.</p>
                {hiddenTests.map((test, index) => (
                  <div key={index} className="grid gap-3 sm:grid-cols-2">
                    <label>
                      <span className="mb-1.5 block text-sm text-muted">Hidden input {index + 1}</span>
                      <textarea
                        className={areaClass}
                        value={test.input}
                        onChange={(event) =>
                          setHiddenTests(hiddenTests.map((item, itemIndex) => (itemIndex === index ? { ...item, input: event.target.value } : item)))
                        }
                      />
                    </label>
                    <label>
                      <span className="mb-1.5 block text-sm text-muted">Hidden output {index + 1}</span>
                      <textarea
                        className={areaClass}
                        value={test.output}
                        onChange={(event) =>
                          setHiddenTests(hiddenTests.map((item, itemIndex) => (itemIndex === index ? { ...item, output: event.target.value } : item)))
                        }
                      />
                    </label>
                  </div>
                ))}
                {hiddenTests.length < 8 ? (
                  <button type="button" onClick={() => setHiddenTests([...hiddenTests, { input: "", output: "" }])} className="justify-self-start text-sm text-accent">
                    Add hidden test
                  </button>
                ) : null}
              </div>
            ) : null}
            {moduleKey === "sql" ? (
              <div className="grid gap-3">
                <label>
                  <span className="mb-1.5 block text-sm font-medium text-ink">Setup SQL</span>
                  <textarea className={`${areaClass} font-mono`} value={setupSql} onChange={(event) => setSetupSql(event.target.value)} />
                  <span className="mt-1 block text-xs text-muted">Tables and seed rows. This runs before each task, in a new database.</span>
                </label>
                {sqlParts.map((part, index) => (
                  <div key={index} className="grid gap-3 rounded-xl border border-line p-3">
                    <label>
                      <span className="mb-1.5 block text-sm text-muted">Task {index + 1}</span>
                      <textarea
                        className={areaClass}
                        value={part.prompt}
                        onChange={(event) =>
                          setSqlParts(sqlParts.map((item, itemIndex) => (itemIndex === index ? { ...item, prompt: event.target.value } : item)))
                        }
                      />
                    </label>
                    <label>
                      <span className="mb-1.5 block text-sm text-muted">Task type</span>
                      <select
                        className={inputClass}
                        value={part.mode}
                        onChange={(event) =>
                          setSqlParts(
                            sqlParts.map((item, itemIndex) =>
                              itemIndex === index ? { ...item, mode: event.target.value === "change" ? "change" : "read" } : item,
                            ),
                          )
                        }
                      >
                        <option value="read">Read — student rows must match the check query</option>
                        <option value="change">Change — check query must return 1</option>
                      </select>
                    </label>
                    <label>
                      <span className="mb-1.5 block text-sm text-muted">Check query</span>
                      <textarea
                        className={`${areaClass} font-mono`}
                        value={part.checkSql}
                        onChange={(event) =>
                          setSqlParts(sqlParts.map((item, itemIndex) => (itemIndex === index ? { ...item, checkSql: event.target.value } : item)))
                        }
                      />
                    </label>
                  </div>
                ))}
                {sqlParts.length < 6 ? (
                  <button
                    type="button"
                    onClick={() => setSqlParts([...sqlParts, { prompt: "", mode: "read", checkSql: "" }])}
                    className="justify-self-start text-sm text-accent"
                  >
                    Add task
                  </button>
                ) : null}
              </div>
            ) : null}
            {moduleKey === "web" ? (
              <label>
                <span className="mb-1.5 block text-sm font-medium text-ink">Expected text</span>
                <input className={inputClass} value={webExpect} onChange={(event) => setWebExpect(event.target.value)} />
                <span className="mt-1 block text-xs text-muted">Submit passes when the page source contains this text. The page itself runs only in the browser.</span>
              </label>
            ) : null}
          </>
        ) : (
          <fieldset className="grid gap-3">
            <legend className="text-sm font-medium text-ink">Choices</legend>
            {choices.map((choice, index) => (
              <div key={index} className="flex items-center gap-3">
                <input
                  type="radio"
                  name="correct-choice"
                  checked={choice.correct}
                  onChange={() => setChoices(choices.map((item, itemIndex) => ({ ...item, correct: itemIndex === index })))}
                  aria-label={`Correct choice ${index + 1}`}
                />
                <input
                  className={inputClass}
                  value={choice.text}
                  placeholder={`Choice ${index + 1}`}
                  onChange={(event) =>
                    setChoices(choices.map((item, itemIndex) => (itemIndex === index ? { ...item, text: event.target.value } : item)))
                  }
                />
              </div>
            ))}
            <p className="text-xs text-muted">Select the correct choice. Publishing needs at least two choices and one correct answer.</p>
          </fieldset>
        )}
        <label>
          <span className="mb-1.5 block text-sm font-medium text-ink">Hints</span>
          <textarea className={areaClass} value={hints} onChange={(event) => setHints(event.target.value)} />
        </label>
        <div className="flex flex-wrap gap-2">
          <button
            type="submit"
            disabled={pending}
            className="rounded-lg border border-line px-3.5 py-2 text-sm font-medium text-ink hover:bg-background disabled:opacity-60"
          >
            {pending ? "Saving…" : question?.status === "published" ? "Save" : "Save draft"}
          </button>
          {canPublish ? (
            <button
              type="button"
              disabled={pending}
              onClick={() => save(true)}
              className="rounded-lg bg-accent px-3.5 py-2 text-sm font-medium text-white hover:bg-[#3e5ae0] disabled:opacity-60"
            >
              Save and publish
            </button>
          ) : null}
        </div>
      </form>
      {question && canPublish && copyTargets.length > 0 ? (
        <section className="grid gap-3 rounded-2xl border border-line bg-card p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
          <label>
            <span className="mb-1.5 block text-sm font-medium text-ink">Copy to another college</span>
            <select className={inputClass} value={targetCollegeId} onChange={(event) => setTargetCollegeId(event.target.value)}>
              {copyTargets.map((college) => (
                <option key={college.id} value={college.id}>
                  {college.name}
                </option>
              ))}
            </select>
            <span className="mt-1 block text-xs text-muted">The copy is a new draft. Changing it does not change this question.</span>
          </label>
          <button
            type="button"
            disabled={pending}
            onClick={copy}
            className="rounded-lg border border-line px-3.5 py-2 text-sm font-medium text-ink hover:bg-background disabled:opacity-60"
          >
            Copy
          </button>
        </section>
      ) : null}
    </main>
  );
}
