const MARKS: Record<string, string> = {
  coding: "{ }",
  sql: "SQL",
  web: "</>",
  aptitude: "A",
  reasoning: "R",
  verbal: "V",
};

export function Wordmark({ light = false }: { light?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2">
      <span
        className={`grid h-6 w-6 place-items-center rounded-md text-[10px] font-semibold ${
          light ? "bg-white text-[#1c1e18]" : "bg-[#1c1e18] text-white"
        }`}
      >
        IS
      </span>
      <span className="text-sm font-semibold tracking-tight">InfySkill Practice</span>
    </span>
  );
}

export function ModuleMark({ moduleKey }: { moduleKey: string }) {
  return (
    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-accent-soft font-mono text-[11px] font-semibold text-accent">
      {MARKS[moduleKey] ?? "•"}
    </span>
  );
}

export function DifficultyLabel({ difficulty }: { difficulty: "Easy" | "Medium" | "Hard" }) {
  const tone = difficulty === "Easy" ? "text-[#1b6b4a]" : difficulty === "Medium" ? "text-[#8a5a12]" : "text-[#8d2f2f]";
  return <span className={`text-xs font-semibold uppercase tracking-[0.14em] ${tone}`}>{difficulty}</span>;
}
