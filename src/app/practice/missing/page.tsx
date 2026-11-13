import Link from "next/link";
import { readPracticeSite } from "@/lib/practice-site";

export const dynamic = "force-dynamic";

export default async function PracticeMissingPage() {
  const site = await readPracticeSite();
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-4 py-10 sm:px-6 lg:px-8">
      <h1 className="text-2xl font-semibold tracking-tight text-ink">That page is not on this address.</h1>
      <Link href={site ? "/" : "/practice"} className="text-sm text-accent">
        Home
      </Link>
    </main>
  );
}
