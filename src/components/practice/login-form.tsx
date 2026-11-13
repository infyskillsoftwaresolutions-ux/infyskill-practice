"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { loginAction } from "@/app/actions/practice";
import { CollegeMark } from "@/components/practice/college-mark";
import { Wordmark } from "@/components/practice/marks";

const inputClass =
  "w-full rounded-lg border border-line bg-background px-3 py-2 text-sm text-ink outline-none focus:border-accent";

export function LoginForm({
  hint = null,
  home,
  college = null,
  missing = false,
}: {
  hint?: { email: string; password: string } | null;
  home: string;
  college?: { id: string; name: string; hasLogo: boolean; logoAt: string } | null;
  missing?: boolean;
}) {
  const router = useRouter();
  const [email, setEmail] = useState(hint?.email ?? "");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    startTransition(async () => {
      const result = await loginAction({ email, password });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      router.replace(home);
      router.refresh();
    });
  }

  return (
    <main className="mx-auto flex min-h-full w-full max-w-md flex-col justify-center px-4 py-16">
      <Wordmark />
      <div className="mt-6 flex items-center gap-3">
        {college ? <CollegeMark collegeId={college.id} name={college.name} hasLogo={college.hasLogo} logoAt={college.logoAt} onHost /> : null}
        <h1 className="text-3xl font-semibold tracking-tight text-ink">{college ? college.name : "Sign in"}</h1>
      </div>
      <p className="mt-2 text-sm leading-6 text-muted">
        {missing
          ? "This address is not set up."
          : college
            ? "Sign in to practice."
            : "Students, college admins, and InfySkill employees each see only the colleges they were given."}
      </p>
      {missing ? null : (
        <form onSubmit={submit} className="mt-6 grid gap-4 rounded-2xl border border-line bg-card p-5">
          {error ? <p className="rounded-lg bg-[#fdecec] px-3 py-2 text-sm text-danger">{error}</p> : null}
          <label>
            <span className="mb-1.5 block text-sm font-medium text-ink">Email</span>
            <input
              className={inputClass}
              type="email"
              autoComplete="username"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </label>
          <label>
            <span className="mb-1.5 block text-sm font-medium text-ink">Password</span>
            <input
              className={inputClass}
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </label>
          <button
            type="submit"
            disabled={pending}
            className="rounded-lg bg-accent px-3.5 py-2 text-sm font-medium text-white hover:bg-[#3e5ae0] disabled:opacity-60"
          >
            {pending ? "Signing in…" : "Sign in"}
          </button>
        </form>
      )}
      {hint ? (
        <p className="mt-4 text-sm leading-6 text-muted">
          Local main admin: {hint.email} / {hint.password}
        </p>
      ) : null}
    </main>
  );
}
