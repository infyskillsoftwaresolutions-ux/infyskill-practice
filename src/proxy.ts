import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { collegeHostRoute, slugFromHost } from "@/lib/practice-host";

export function proxy(request: NextRequest) {
  if (!slugFromHost(request.headers.get("host"))) return NextResponse.next();
  const route = collegeHostRoute(request.nextUrl.pathname);
  if (route.kind === "next") return NextResponse.next();
  const url = request.nextUrl.clone();
  url.pathname = route.path;
  if (route.kind === "redirect") return NextResponse.redirect(url);
  return NextResponse.rewrite(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
