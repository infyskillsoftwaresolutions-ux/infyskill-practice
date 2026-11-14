export const HOST_COLLEGE = "host";

export const PRACTICE_MODULE_KEYS = ["coding", "sql", "web", "aptitude", "reasoning", "verbal"] as const;

export const RESERVED_SLUGS = new Set<string>([
  "www",
  "app",
  "api",
  "practice",
  "admin",
  "mail",
  "localhost",
  "infyskill",
  "static",
  "login",
  "questions",
  "mocks",
  "logo",
  "report",
  "mock-report",
  "students",
  "team",
  "host",
  "site",
  "missing",
  ...PRACTICE_MODULE_KEYS,
]);

export function slugFromHost(host: string | null) {
  if (!host) return null;
  const hostname = host.split(":")[0].toLowerCase().replace(/\.$/, "");
  if (!hostname || hostname === "localhost" || hostname === "127.0.0.1") return null;
  let sub = "";
  if (hostname.endsWith(".localhost")) {
    sub = hostname.slice(0, -".localhost".length);
  } else {
    const root = (process.env.PRACTICE_ROOT_HOST || "infyskill.com").toLowerCase();
    if (hostname === root || hostname === `www.${root}`) return null;
    if (!hostname.endsWith(`.${root}`)) return null;
    sub = hostname.slice(0, -(root.length + 1));
  }
  if (!sub || sub.includes(".")) return null;
  return sub;
}

export function addressRoot(host: string | null) {
  const value = host || "localhost";
  const [hostname, port] = value.split(":");
  const lower = hostname.toLowerCase();
  const bare =
    lower === "localhost" || lower === "127.0.0.1" || lower.endsWith(".localhost")
      ? "localhost"
      : (process.env.PRACTICE_ROOT_HOST || "infyskill.com").toLowerCase();
  return port ? `${bare}:${port}` : bare;
}

export function homeHref(onHost: boolean) {
  return onHost ? "/" : "/practice";
}

export function collegeHref(collegeId: string, onHost: boolean) {
  return onHost ? "/" : `/practice/colleges/${collegeId}`;
}

export function moduleHref(collegeId: string, moduleKey: string, onHost: boolean) {
  return onHost ? `/${moduleKey}` : `/practice/colleges/${collegeId}/modules/${moduleKey}`;
}

export function moduleImportHref(collegeId: string, moduleKey: string, onHost: boolean) {
  return onHost ? `/${moduleKey}/import` : `/practice/colleges/${collegeId}/modules/${moduleKey}/import`;
}

export function moduleNewHref(collegeId: string, moduleKey: string, onHost: boolean) {
  return onHost ? `/${moduleKey}/new` : `/practice/colleges/${collegeId}/modules/${moduleKey}/new`;
}

export function questionHref(collegeId: string, key: string, onHost: boolean, mockId = "") {
  const path = onHost ? `/questions/${key}` : `/practice/colleges/${collegeId}/questions/${key}`;
  return mockId ? `${path}?mock=${encodeURIComponent(mockId)}` : path;
}

export function studentsHref(collegeId: string, onHost: boolean, view: "" | "add" | "upload" = "") {
  const tail = view ? `/${view}` : "";
  return onHost ? `/students${tail}` : `/practice/colleges/${collegeId}/students${tail}`;
}

export function mockHref(collegeId: string, mockId: string, onHost: boolean) {
  return onHost ? `/mocks/${mockId}` : `/practice/colleges/${collegeId}/mocks/${mockId}`;
}

export function logoHref(collegeId: string, logoAt: string, onHost: boolean) {
  const base = onHost ? "/logo" : `/practice/colleges/${collegeId}/logo`;
  return `${base}?v=${encodeURIComponent(logoAt)}`;
}

export function reportHref(collegeId: string, onHost: boolean) {
  return onHost ? "/report" : `/practice/colleges/${collegeId}/report`;
}

export function mockReportHref(collegeId: string, onHost: boolean) {
  return onHost ? "/mock-report" : `/practice/colleges/${collegeId}/mock-report`;
}

const MODULE_PATH = "(coding|sql|web|aptitude|reasoning|verbal)";

export function collegeHostRoute(pathname: string): { kind: "next" | "redirect" | "rewrite"; path: string } {
  if (pathname === "/practice" || pathname === "/practice/") return { kind: "redirect", path: "/" };
  if (pathname === "/practice/login") return { kind: "redirect", path: "/login" };
  if (pathname === "/practice/site" || pathname === "/practice/missing") return { kind: "redirect", path: "/" };

  const internal = pathname.match(/^\/practice\/colleges\/host(\/.*)?$/);
  if (internal) {
    const rest = internal[1] ?? "";
    if (rest === "" || rest === "/") return { kind: "redirect", path: "/" };
    if (rest === "/logo") return { kind: "redirect", path: "/logo" };
    if (rest === "/report") return { kind: "redirect", path: "/report" };
    if (rest === "/mock-report") return { kind: "redirect", path: "/mock-report" };
    if (rest === "/students" || rest === "/students/add" || rest === "/students/upload") return { kind: "redirect", path: rest };
    const modulePath = rest.match(new RegExp(`^\\/modules\\/${MODULE_PATH}(\\/new|\\/import)?$`));
    if (modulePath) return { kind: "redirect", path: `/${modulePath[1]}${modulePath[2] ?? ""}` };
    const question = rest.match(/^\/questions\/([^/]+)$/);
    if (question) return { kind: "redirect", path: `/questions/${question[1]}` };
    const mock = rest.match(/^\/mocks\/([^/]+)$/);
    if (mock) return { kind: "redirect", path: `/mocks/${mock[1]}` };
    return { kind: "redirect", path: "/" };
  }

  if (pathname.startsWith("/practice/")) return { kind: "next", path: pathname };
  if (pathname === "/") return { kind: "rewrite", path: "/practice/site" };
  if (pathname === "/login") return { kind: "rewrite", path: "/practice/login" };
  if (pathname === "/logo") return { kind: "rewrite", path: "/practice/colleges/host/logo" };
  if (pathname === "/report") return { kind: "rewrite", path: "/practice/colleges/host/report" };
  if (pathname === "/mock-report") return { kind: "rewrite", path: "/practice/colleges/host/mock-report" };
  if (pathname === "/students" || pathname === "/students/add" || pathname === "/students/upload") {
    return { kind: "rewrite", path: `/practice/colleges/host${pathname}` };
  }

  const question = pathname.match(/^\/questions\/([^/]+)$/);
  if (question) return { kind: "rewrite", path: `/practice/colleges/host/questions/${question[1]}` };
  const mock = pathname.match(/^\/mocks\/([^/]+)$/);
  if (mock) return { kind: "rewrite", path: `/practice/colleges/host/mocks/${mock[1]}` };
  const modulePath = pathname.match(new RegExp(`^\\/${MODULE_PATH}(\\/new|\\/import)?$`));
  if (modulePath) return { kind: "rewrite", path: `/practice/colleges/host/modules/${modulePath[1]}${modulePath[2] ?? ""}` };
  return { kind: "rewrite", path: "/practice/missing" };
}
