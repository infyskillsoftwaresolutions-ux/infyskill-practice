import { redirect } from "next/navigation";
import { LoginForm } from "@/components/practice/login-form";
import { ensureMainAdmin } from "@/lib/practice";
import { getPracticeUser, localAdminLogin } from "@/lib/practice-auth";
import { readPracticeSite } from "@/lib/practice-site";

export const dynamic = "force-dynamic";

export default async function PracticeLoginPage() {
  ensureMainAdmin();
  const site = await readPracticeSite();
  const user = await getPracticeUser();
  if (user) redirect(site ? "/" : "/practice");
  if (site && !site.college) return <LoginForm home="/" missing />;
  if (site?.college) {
    return <LoginForm home="/" college={site.college} />;
  }
  const login = localAdminLogin();
  return <LoginForm home="/practice" hint={login.showPassword ? { email: login.email, password: login.password } : null} />;
}
