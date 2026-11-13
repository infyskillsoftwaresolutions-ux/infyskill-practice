import { CollegeMark } from "@/components/practice/college-mark";

export function PracticeClosed({
  title,
  message,
  collegeId = "",
  hasLogo = false,
  logoAt = "",
}: {
  title: string;
  message: string;
  collegeId?: string;
  hasLogo?: boolean;
  logoAt?: string;
}) {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-4 py-10 sm:px-6 lg:px-8">
      <div className="flex items-center gap-3">
        {collegeId ? <CollegeMark collegeId={collegeId} name={title} hasLogo={hasLogo} logoAt={logoAt} /> : null}
        <h1 className="text-2xl font-semibold tracking-tight text-ink">{title}</h1>
      </div>
      <p className="max-w-xl text-sm leading-6 text-muted">{message}</p>
    </main>
  );
}
