import { notFound, redirect } from "next/navigation";
import { QuestionEditor } from "@/components/practice/question-editor";
import { QuestionView } from "@/components/practice/question-view";
import { PracticeSolve } from "@/components/practice/practice-solve";
import { PracticeClosed } from "@/components/practice/practice-closed";
import { languagesFor, listAttempts, questionNeighbors, ensureQuestionClock } from "@/lib/practice-attempts";
import { languageReady } from "@/lib/practice-runner";
import { assertActiveMock, mockEndsAt, mockNeighbors } from "@/lib/practice-mocks";
import { collegeAccessMessage, collegeReportOpen, readPracticeAccess, studentAccessMessage, studentsCanPractice } from "@/lib/practice-access";
import { HOST_COLLEGE, mockHref, moduleHref, questionHref } from "@/lib/practice-host";
import { copyTargets, getQuestion } from "@/lib/practice-questions";
import { openCollege } from "@/lib/practice-site";

export const dynamic = "force-dynamic";

export default async function PracticeQuestionPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; questionId: string }>;
  searchParams: Promise<{ mock?: string }>;
}) {
  const { id, questionId } = await params;
  const { mock } = await searchParams;
  const gate = await openCollege(id);
  if (gate.message || !gate.college) {
    return (
      <PracticeClosed
        title={gate.siteName}
        message={gate.message}
        collegeId={gate.collegeIdForMark}
        hasLogo={gate.hasLogo}
        logoAt={gate.logoAt}
      />
    );
  }
  const user = gate.user;
  const college = gate.college;
  const access = readPracticeAccess(college.id);
  if (user.role === "student" && !studentsCanPractice(access)) {
    return (
      <PracticeClosed
        title={college.name}
        message={studentAccessMessage(college.name, access)}
        collegeId={college.id}
        hasLogo={college.hasLogo}
        logoAt={college.logoAt}
      />
    );
  }
  if (user.role === "college_admin" && !collegeReportOpen(access)) {
    return (
      <PracticeClosed
        title={college.name}
        message={collegeAccessMessage(access)}
        collegeId={college.id}
        hasLogo={college.hasLogo}
        logoAt={college.logoAt}
      />
    );
  }
  const question = getQuestion(user, college.id, questionId);
  if (!question) notFound();
  if (gate.onHost && (id !== HOST_COLLEGE || questionId !== question.slug)) {
    redirect(questionHref(college.id, question.slug, true, mock ?? ""));
  }
  const backHref = moduleHref(college.id, question.moduleKey, gate.onHost);
  const editable = user.role === "main_admin" || (user.role === "employee" && question.status === "draft");
  if (user.role === "student") {
    let previousId: string | null = null;
    let nextId: string | null = null;
    let mockClock = "";
    let questionClock = "";
    if (mock) {
      try {
        assertActiveMock(user.id, college.id, question.id, mock);
      } catch {
        redirect(mockHref(college.id, mock, gate.onHost));
      }
      const neighbors = mockNeighbors(mock, question.id);
      previousId = neighbors.previousId;
      nextId = neighbors.nextId;
      mockClock = mockEndsAt(user.id, mock);
    } else {
      const neighbors = questionNeighbors(college.id, question.moduleKey, question.id);
      previousId = neighbors.previousId;
      nextId = neighbors.nextId;
      if (question.timeMinutes > 0) questionClock = ensureQuestionClock(user.id, question.id, question.timeMinutes);
    }
    return (
      <PracticeSolve
        collegeId={college.id}
        collegeName={college.name}
        hasLogo={college.hasLogo}
        logoAt={college.logoAt}
        question={question}
        choices={question.choices.flatMap((choice) => (choice.id ? [{ id: choice.id, text: choice.text }] : []))}
        languages={languagesFor(question.moduleKey)}
        ready={question.moduleKey === "coding" ? await languageReady() : {}}
        previousId={previousId}
        nextId={nextId}
        attempts={listAttempts(user.id, question.id)}
        mockId={mock ?? ""}
        mockEndsAt={mockClock}
        endsAt={questionClock}
      />
    );
  }
  if (!editable) {
    return (
      <QuestionView
        collegeId={college.id}
        collegeName={college.name}
        hasLogo={college.hasLogo}
        logoAt={college.logoAt}
        question={question}
        backHref={backHref}
      />
    );
  }
  return (
    <QuestionEditor
      collegeId={college.id}
      collegeName={college.name}
      hasLogo={college.hasLogo}
      logoAt={college.logoAt}
      moduleKey={question.moduleKey}
      moduleLabel={question.moduleLabel}
      kind={question.kind}
      question={question}
      copyTargets={copyTargets(user, college.id)}
      canPublish={user.role === "main_admin"}
    />
  );
}
