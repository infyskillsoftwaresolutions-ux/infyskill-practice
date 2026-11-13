import { readCollegeLogo, readCollegeLogoFile } from "@/lib/practice-logo";
import { getPracticeUser } from "@/lib/practice-auth";
import { readPracticeSite, resolveCollegeId } from "@/lib/practice-site";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: rawId } = await params;
  const collegeId = await resolveCollegeId(rawId);
  if (!collegeId) return new Response("Not found.", { status: 404 });
  const site = await readPracticeSite();
  const user = await getPracticeUser();
  const onThisAddress = site?.college?.id === collegeId;
  if (!user && !onThisAddress) return new Response("Sign in required.", { status: 401 });
  const logo = onThisAddress ? readCollegeLogoFile(collegeId) : user ? readCollegeLogo(user, collegeId) : null;
  if (!logo) return new Response("Not found.", { status: 404 });
  return new Response(new Uint8Array(logo.bytes), {
    headers: {
      "Content-Type": logo.contentType,
      "Cache-Control": "private, max-age=3600",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
