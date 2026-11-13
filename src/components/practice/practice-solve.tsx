"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { runWorkAction, submitChoiceAction, submitWorkAction } from "@/app/actions/practice-attempts";
import { CollegeMark } from "@/components/practice/college-mark";
import { DifficultyLabel } from "@/components/practice/marks";
import { MockTimer } from "@/components/practice/mock-timer";
import { usePracticeSite } from "@/components/practice/practice-site";
import { mockHref, moduleHref, questionHref } from "@/lib/practice-host";
import type { AttemptRecord } from "@/lib/practice-attempts";
import type { QuestionDetail } from "@/lib/practice-questions";

type Pane = "description" | "editor" | "preview";
type Choice = { id: string; text: string };

const editorClass =
  "min-h-64 w-full rounded-lg border border-white/10 bg-[#14160f] px-3 py-3 font-mono text-sm leading-6 text-[#f6f5f1] outline-none focus:border-[#1b6b4a]";

export function PracticeSolve({
  collegeId,
  collegeName,
  hasLogo,
  logoAt,
  question,
  choices,
  languages,
  ready,
  previousId,
  nextId,
  attempts,
  mockId = "",
  mockEndsAt = "",
  endsAt = "",
}: {
  collegeId: string;
  collegeName: string;
  hasLogo: boolean;
  logoAt: string;
  question: QuestionDetail;
  choices: Choice[];
  languages: string[];
  ready: Record<string, boolean>;
  previousId: string | null;
  nextId: string | null;
  attempts: AttemptRecord[];
  mockId?: string;
  mockEndsAt?: string;
  endsAt?: string;
}) {
  const solved = attempts.some((attempt) => attempt.outcome === "solved");
  const router = useRouter();
  const [pane, setPane] = useState<Pane>("description");
  const [section, setSection] = useState<"problem" | "hints" | "submissions">("problem");
  const [choiceId, setChoiceId] = useState("");
  const [language, setLanguage] = useState(languages[0] ?? "Python");
  const [answer, setAnswer] = useState(question.templateCode);
  const [parts, setParts] = useState(question.sqlParts.map(() => ""));
  const [caseIndex, setCaseIndex] = useState(0);
  const [consoleText, setConsoleText] = useState(
    question.moduleKey === "web"
      ? "Preview shows the page. Submit checks the expected text."
      : "Run checks the sample cases. Submit checks the hidden tests.",
  );
  const [notice, setNotice] = useState(solved ? "Correct." : "");
  const [noticeOk, setNoticeOk] = useState(solved);
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState<"run" | "submit" | "">("");
  const clock = endsAt || mockEndsAt;
  const [expired, setExpired] = useState(Boolean(clock) && new Date(clock).getTime() <= Date.now());
  const { onHost } = usePracticeSite();
  const sample = question.samples[caseIndex];
  const preview = useMemo(() => answer || "<p></p>", [answer]);
  const back = mockId ? mockHref(collegeId, mockId, onHost) : moduleHref(collegeId, question.moduleKey, onHost);
  const questionLink = (id: string) => questionHref(collegeId, id, onHost, mockId);

  useEffect(() => {
    if (!clock) return;
    const tick = () => {
      if (new Date(clock).getTime() <= Date.now()) setExpired(true);
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [clock]);

  function blockCopy(event: { preventDefault: () => void }) {
    if (question.lockCopy) event.preventDefault();
  }

  function blockPaste(event: { preventDefault: () => void; ctrlKey?: boolean; metaKey?: boolean; key?: string }) {
    if (!question.lockPaste) return;
    if (event.key && !(event.ctrlKey || event.metaKey)) return;
    if (event.key && event.key.toLowerCase() !== "v") return;
    event.preventDefault();
  }

  function submitChoice() {
    setNotice("");
    startTransition(async () => {
      const result = await submitChoiceAction(collegeId, question.id, choiceId, mockId);
      if (!result.ok) {
        setNotice(result.error);
        setNoticeOk(false);
        return;
      }
      setNotice(result.message);
      setNoticeOk(result.outcome === "solved");
      router.refresh();
    });
  }

  function workInput() {
    return question.moduleKey === "sql" && parts.length > 0 ? { answer, language, parts } : { answer, language };
  }

  function runCode() {
    setConsoleText("Running…");
    setBusy("run");
    startTransition(async () => {
      const result = await runWorkAction(collegeId, question.id, workInput(), mockId);
      setConsoleText(result.ok ? result.console : result.error);
      setBusy("");
      if (question.moduleKey === "web") setPane("preview");
      else setPane("editor");
    });
  }

  function submitCode() {
    setNotice("");
    setBusy("submit");
    startTransition(async () => {
      const result = await submitWorkAction(collegeId, question.id, workInput(), mockId);
      if (!result.ok) {
        setNotice(result.error);
        setNoticeOk(false);
        setBusy("");
        return;
      }
      setConsoleText(result.message);
      setNotice(result.message);
      setNoticeOk(result.ok && result.outcome === "solved");
      setBusy("");
      setPane("editor");
      router.refresh();
    });
  }

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-4 sm:px-6 lg:py-6">
      <header className="flex flex-col gap-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <CollegeMark collegeId={collegeId} name={collegeName} hasLogo={hasLogo} logoAt={logoAt} />
            <div>
              <Link href={back} className="text-sm text-accent">
                {mockId ? "Mock" : question.moduleLabel}
              </Link>
              <h1
                className={`mt-1 text-xl font-semibold tracking-tight text-ink sm:text-2xl ${question.lockCopy ? "select-none" : ""}`}
                onCopy={blockCopy}
                onCut={blockCopy}
              >
                {question.title}
              </h1>
              {question.lockCopy ? <p className="mt-1 text-xs text-muted">This question cannot be copied.</p> : null}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <DifficultyLabel difficulty={question.difficulty} />
            <span className="text-sm text-muted">{question.points} pts</span>
            {mockEndsAt ? <MockTimer endsAt={mockEndsAt} /> : endsAt ? <MockTimer endsAt={endsAt} /> : null}
          </div>
        </div>
        {question.kind === "code" ? (
          <div className="grid grid-cols-2 gap-2 lg:hidden">
            <PaneButton active={pane === "description"} onClick={() => setPane("description")}>
              Description
            </PaneButton>
            <PaneButton active={pane === "editor"} onClick={() => setPane("editor")}>
              {question.moduleKey === "web" ? "Editor" : "Code Editor"}
            </PaneButton>
            {question.moduleKey === "web" ? (
              <PaneButton active={pane === "preview"} onClick={() => setPane("preview")} className="col-span-2">
                Preview
              </PaneButton>
            ) : null}
          </div>
        ) : null}
      </header>

      <div className={question.kind === "code" ? "grid gap-4 lg:grid-cols-2" : "grid gap-4"}>
        <section className={`${pane === "description" ? "block" : "hidden"} min-w-0 lg:block`}>
          <article className="overflow-hidden rounded-2xl border border-line bg-card">
            <div className="flex gap-1 border-b border-line px-3 py-2">
              <TabButton active={section === "problem"} onClick={() => setSection("problem")}>
                Problem
              </TabButton>
              <TabButton active={section === "hints"} onClick={() => setSection("hints")}>
                Hints
              </TabButton>
              <TabButton active={section === "submissions"} onClick={() => setSection("submissions")}>
                Submissions
              </TabButton>
            </div>
            <div
              className={`grid gap-4 p-4 text-sm leading-6 text-ink ${question.lockCopy ? "select-none" : ""}`}
              onCopy={blockCopy}
              onCut={blockCopy}
              onContextMenu={blockCopy}
            >
              {section === "problem" ? <Problem question={question} /> : null}
              {section === "hints" ? <p className="whitespace-pre-wrap">{question.hints || "No hints for this question."}</p> : null}
              {section === "submissions" ? <SubmissionList attempts={attempts} /> : null}
              {question.kind === "choice" && section === "problem" ? (
                <ChoiceForm
                  choices={choices}
                  choiceId={choiceId}
                  onChange={setChoiceId}
                  pending={pending}
                  expired={expired}
                  notice={expired && !notice ? "Time is up." : notice}
                  noticeOk={noticeOk}
                  onSubmit={submitChoice}
                />
              ) : null}
            </div>
          </article>
          <nav className="mt-3 flex items-center justify-between rounded-2xl border border-line bg-card px-4 py-3 text-sm">
            {previousId ? (
              <Link href={questionLink(previousId)} className="text-accent">
                Previous
              </Link>
            ) : (
              <span />
            )}
            <Link href={back} className="text-muted">
              All questions
            </Link>
            {nextId ? (
              <Link href={questionLink(nextId)} className="text-accent">
                Next
              </Link>
            ) : (
              <span />
            )}
          </nav>
        </section>

        {question.kind === "code" ? (
          <section className={`${pane === "editor" ? "flex" : "hidden"} min-w-0 flex-col gap-3 lg:flex`}>
            <article className="overflow-hidden rounded-2xl border border-[#14160f] bg-[#1c1e18] text-[#f6f5f1]">
              <div className="flex items-center justify-between gap-3 border-b border-white/10 px-3 py-2">
                <label className="text-sm text-[#f6f5f1]">
                  <span className="sr-only">Language</span>
                  <select
                    value={language}
                    onChange={(event) => setLanguage(event.target.value)}
                    className="rounded-lg border border-white/15 bg-[#14160f] px-2 py-1.5 text-sm text-[#f6f5f1]"
                  >
                    {languages.map((item) => (
                      <option key={item}>{item}</option>
                    ))}
                  </select>
                </label>
                <span className={`text-xs font-medium ${solved ? "text-[#b7e0cb]" : "text-white/50"}`}>{solved ? "Solved" : "Not solved"}</span>
              </div>
              {question.lockPaste ? <p className="border-b border-white/10 px-3 py-2 text-xs text-white/60">Paste is off for this question.</p> : null}
              {ready[language] === false && language !== "Python" ? (
                <p className="border-b border-white/10 px-3 py-2 text-xs text-white/60">
                  {language === "Java"
                    ? "Java grades when javac is installed."
                    : language === "C"
                      ? "C grades when gcc is installed."
                      : "C++ grades when g++ is installed."}
                </p>
              ) : null}
              <div className="grid gap-3 p-3">
                {question.moduleKey === "sql" && question.sqlParts.length > 0 ? (
                  question.sqlParts.map((part, index) => (
                    <label key={part.prompt + index}>
                      <span className="mb-1.5 block text-sm font-medium text-white/80">{part.prompt || `Task ${index + 1}`}</span>
                      <textarea
                        className={editorClass}
                        value={parts[index] ?? ""}
                        onChange={(event) => setParts(parts.map((item, itemIndex) => (itemIndex === index ? event.target.value : item)))}
                        onPaste={blockPaste}
                        onKeyDown={blockPaste}
                        spellCheck={false}
                      />
                    </label>
                  ))
                ) : (
                  <textarea
                    className={editorClass}
                    value={answer}
                    onChange={(event) => setAnswer(event.target.value)}
                    onPaste={blockPaste}
                    onKeyDown={blockPaste}
                    spellCheck={false}
                  />
                )}
              </div>
              {question.moduleKey !== "web" && question.samples.length > 0 ? (
                <div className="border-t border-white/10 px-3 py-3">
                  <div className="flex gap-2">
                    {question.samples.map((_, index) => (
                      <button
                        key={index}
                        type="button"
                        onClick={() => setCaseIndex(index)}
                        className={`rounded-full px-3 py-1 text-sm ${caseIndex === index ? "bg-white text-[#1c1e18]" : "border border-white/20 text-white/80"}`}
                      >
                        Case {index + 1}
                      </button>
                    ))}
                  </div>
                  {sample ? (
                    <div className="mt-3 grid gap-3">
                      <div>
                        <p className="text-sm font-medium text-white/80">Input</p>
                        <pre className="mt-1 overflow-x-auto rounded-lg bg-[#14160f] px-3 py-2 font-mono text-xs text-[#f6f5f1]">{sample.input}</pre>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-white/80">Output</p>
                        <pre className="mt-1 overflow-x-auto rounded-lg bg-[#14160f] px-3 py-2 font-mono text-xs text-[#f6f5f1]">{sample.output}</pre>
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}
              <div className="border-t border-white/10 px-3 py-3">
                <p className="text-sm font-medium text-white/80">Console</p>
                <pre className="mt-1 min-h-16 whitespace-pre-wrap rounded-lg bg-[#14160f] px-3 py-2 text-xs text-white/70">{consoleText}</pre>
              </div>
              <div className="sticky bottom-0 flex justify-end gap-2 border-t border-white/10 bg-[#1c1e18] px-3 py-3">
                <button
                  type="button"
                  disabled={pending || expired}
                  onClick={runCode}
                  className="rounded-lg border border-white/20 px-3.5 py-2 text-sm font-medium text-white"
                >
                  {busy === "run" ? "Running…" : "Run"}
                </button>
                <button
                  type="button"
                  disabled={pending || expired}
                  onClick={submitCode}
                  className="rounded-lg bg-accent px-3.5 py-2 text-sm font-medium text-white hover:bg-[#3e5ae0] disabled:opacity-60"
                >
                  {busy === "submit" ? "Saving…" : "Submit"}
                </button>
              </div>
            </article>
            {notice ? <p className={`text-sm ${noticeOk ? "text-accent" : "text-danger"}`}>{notice}</p> : null}
          </section>
        ) : null}

        {question.moduleKey === "web" ? (
          <section className={`${pane === "preview" ? "block" : "hidden"} min-w-0 lg:col-span-2 lg:block`}>
            <article className="overflow-hidden rounded-2xl border border-line bg-card">
              <p className="border-b border-line px-3 py-2 text-sm font-medium text-ink">Preview</p>
              <iframe title="Page preview" sandbox="allow-scripts" srcDoc={preview} className="h-80 w-full bg-white" />
            </article>
          </section>
        ) : null}
      </div>
    </main>
  );
}

function Problem({ question }: { question: QuestionDetail }) {
  return (
    <>
      <p className="whitespace-pre-wrap">{question.body}</p>
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
      {question.sqlParts.map((part, index) => (
        <section key={`${part.prompt}-${index}`}>
          <h2 className="font-semibold">Task {index + 1}</h2>
          <p className="mt-1 whitespace-pre-wrap">{part.prompt}</p>
        </section>
      ))}
      {question.hiddenTestCount > 0 ? (
        <p className="text-sm text-muted">
          {question.hiddenTestCount} hidden {question.hiddenTestCount === 1 ? "test" : "tests"}. Submit checks {question.hiddenTestCount === 1 ? "it" : "them"}.
        </p>
      ) : null}
      {question.kind === "choice"
        ? null
        : question.samples.map((sample, index) => (
            <section key={index} className="grid gap-3 sm:grid-cols-2">
              <div>
                <h2 className="font-semibold">Sample input</h2>
                <pre className="mt-1 overflow-x-auto rounded-lg bg-background px-3 py-2 font-mono text-xs">{sample.input}</pre>
              </div>
              <div>
                <h2 className="font-semibold">Sample output</h2>
                <pre className="mt-1 overflow-x-auto rounded-lg bg-background px-3 py-2 font-mono text-xs">{sample.output}</pre>
              </div>
            </section>
          ))}
    </>
  );
}

function ChoiceForm({
  choices,
  choiceId,
  onChange,
  pending,
  expired,
  notice,
  noticeOk,
  onSubmit,
}: {
  choices: Choice[];
  choiceId: string;
  onChange: (id: string) => void;
  pending: boolean;
  expired: boolean;
  notice: string;
  noticeOk: boolean;
  onSubmit: () => void;
}) {
  return (
    <form
      className="grid gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
    >
      {choices.map((choice) => (
        <label key={choice.id} className={`flex items-start gap-3 rounded-xl border px-4 py-3 ${choiceId === choice.id ? "border-accent bg-accent-soft" : "border-line bg-card"}`}>
          <input type="radio" name="choice" checked={choiceId === choice.id} onChange={() => onChange(choice.id)} className="mt-1" />
          <span>{choice.text}</span>
        </label>
      ))}
      {notice ? <p className={`text-sm ${noticeOk ? "text-accent" : "text-danger"}`}>{notice}</p> : null}
      <button
        type="submit"
        disabled={pending || expired || !choiceId}
        className="mt-1 justify-self-start rounded-lg bg-accent px-3.5 py-2 text-sm font-medium text-white hover:bg-[#3e5ae0] disabled:opacity-60"
      >
        {pending ? "Checking…" : "Submit"}
      </button>
    </form>
  );
}

function SubmissionList({ attempts }: { attempts: AttemptRecord[] }) {
  if (attempts.length === 0) return <p className="text-muted">No submissions yet.</p>;
  return (
    <ul className="grid gap-2">
      {attempts.map((attempt) => (
        <li key={attempt.id} className="flex items-center justify-between gap-3 rounded-lg border border-line px-3 py-2">
          <span>
            {attempt.outcome === "solved" ? "Solved" : "Not accepted"}
            {attempt.language ? ` · ${attempt.language}` : ""}
          </span>
          <time className="text-xs text-muted">{new Date(attempt.createdAt).toLocaleString()}</time>
        </li>
      ))}
    </ul>
  );
}

function PaneButton({
  active,
  onClick,
  children,
  className = "",
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-3 py-2 text-sm font-medium ${active ? "bg-ink text-white" : "border border-line bg-card text-ink"} ${className}`}
    >
      {children}
    </button>
  );
}

function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} className={`rounded-lg px-3 py-1.5 text-sm ${active ? "bg-accent-soft font-medium text-accent" : "text-muted"}`}>
      {children}
    </button>
  );
}
