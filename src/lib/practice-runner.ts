import { spawn } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "os";
import path from "path";

const OUTPUT_LIMIT = 8000;
const TIME_LIMIT_MS = 3000;

const COMPILER: Record<string, string> = {
  Python: "python",
  Java: "javac",
  C: "gcc",
  "C++": "g++",
};

let readyCheck: Promise<Record<string, boolean>> | null = null;

function commandWorks(command: string, args: string[]) {
  return new Promise<boolean>((resolve) => {
    const child = spawn(command, args, { windowsHide: true, stdio: "ignore" });
    const timer = setTimeout(() => {
      child.kill();
      resolve(false);
    }, 4000);
    child.on("error", () => {
      clearTimeout(timer);
      resolve(false);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve(code === 0);
    });
  });
}

export function languageReady() {
  readyCheck ??= Promise.all(
    Object.entries(COMPILER).map(async ([language, command]) => [language, await commandWorks(command, ["--version"])] as const),
  ).then((rows) => Object.fromEntries(rows));
  return readyCheck;
}

export function languageNote(language: string) {
  const command = COMPILER[language];
  if (!command || language === "Python") return "";
  return `${language} grades when ${command} is installed.`;
}

export type ProgramResult = { output: string; ok: boolean };

function limited(text: string) {
  return text.length > OUTPUT_LIMIT ? `${text.slice(0, OUTPUT_LIMIT)}\nOutput truncated.` : text;
}

function runCommand(command: string, args: string[], cwd: string, stdin: string) {
  return new Promise<ProgramResult>((resolve) => {
    let output = "";
    let settled = false;
    const finish = (result: ProgramResult) => {
      if (settled) return;
      settled = true;
      resolve(result);
    };
    const child = spawn(command, args, {
      cwd,
      windowsHide: true,
      stdio: "pipe",
      env: {
        PATH: process.env.PATH ?? "",
        SYSTEMROOT: process.env.SYSTEMROOT ?? "",
        PATHEXT: process.env.PATHEXT ?? "",
        TEMP: os.tmpdir(),
        TMP: os.tmpdir(),
      } as unknown as NodeJS.ProcessEnv,
    });
    const timer = setTimeout(() => {
      child.kill();
      finish({ ok: false, output: `${limited(output)}\nTime limit exceeded.`.trim() });
    }, TIME_LIMIT_MS);
    const take = (chunk: Buffer) => {
      if (output.length >= OUTPUT_LIMIT) return;
      output += chunk.toString("utf8");
    };
    child.stdout.on("data", take);
    child.stderr.on("data", take);
    child.on("error", (error) => {
      clearTimeout(timer);
      const missing = (error as NodeJS.ErrnoException).code === "ENOENT";
      const language = Object.entries(COMPILER).find(([, tool]) => tool === command)?.[0];
      finish({
        ok: false,
        output: missing && language ? languageNote(language) || `${command} is not installed.` : missing ? `${command} is not installed.` : error.message,
      });
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      finish({ ok: code === 0, output: limited(output).trim() });
    });
    child.stdin.end(stdin);
  });
}

async function withSource(filename: string, source: string, run: (dir: string) => Promise<ProgramResult>) {
  const dir = await mkdtemp(path.join(os.tmpdir(), "practice-"));
  try {
    await writeFile(path.join(dir, filename), source, "utf8");
    return await run(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

export async function executeProgram(language: string, source: string, stdin: string): Promise<ProgramResult> {
  if (language === "Python") {
    return withSource("main.py", source, (dir) => runCommand("python", ["-I", "main.py"], dir, stdin));
  }
  if (language === "Java") {
    return withSource("Main.java", source, async (dir) => {
      const compiled = await runCommand("javac", ["Main.java"], dir, "");
      if (!compiled.ok) return compiled;
      return runCommand("java", ["Main"], dir, stdin);
    });
  }
  if (language === "C") {
    return withSource("main.c", source, async (dir) => {
      const compiled = await runCommand("gcc", ["-O0", "-o", "main.exe", "main.c"], dir, "");
      if (!compiled.ok) return compiled;
      return runCommand(path.join(dir, "main.exe"), [], dir, stdin);
    });
  }
  if (language === "C++") {
    return withSource("main.cpp", source, async (dir) => {
      const compiled = await runCommand("g++", ["-O0", "-o", "main.exe", "main.cpp"], dir, "");
      if (!compiled.ok) return compiled;
      return runCommand(path.join(dir, "main.exe"), [], dir, stdin);
    });
  }
  return { ok: false, output: "That language is not available." };
}

export function outputsMatch(actual: string, expected: string) {
  return actual.replaceAll("\r\n", "\n").trimEnd() === expected.replaceAll("\r\n", "\n").trimEnd();
}
