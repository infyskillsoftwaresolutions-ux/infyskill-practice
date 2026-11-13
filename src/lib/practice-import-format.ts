export class ImportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ImportError";
  }
}

export type ImportRow = { line: number; input: Record<string, unknown> };

const MAX_ROWS = 100;
const MAX_CHARS = 500_000;

const ALIASES: Record<string, string> = {
  title: "title",
  questionname: "title",
  difficulty: "difficulty",
  score: "difficulty",
  difficultyscore: "difficulty",
  question: "question",
  body: "question",
  hints: "hints",
  hint: "hints",
  choice1: "choice1",
  choice2: "choice2",
  choice3: "choice3",
  choice4: "choice4",
  choice5: "choice5",
  choice6: "choice6",
  answer: "answer",
  correct: "answer",
  input: "input",
  inputdescription: "input",
  output: "output",
  outputdescription: "output",
  starter: "starter",
  template: "starter",
  templatecode: "starter",
  sampleinput: "sampleInput",
  sampleoutput: "sampleOutput",
  sampleinput2: "sampleInput2",
  sampleoutput2: "sampleOutput2",
  sampleinput3: "sampleInput3",
  sampleoutput3: "sampleOutput3",
  hiddeninput: "hiddenInput",
  hiddenoutput: "hiddenOutput",
  hiddeninput2: "hiddenInput2",
  hiddenoutput2: "hiddenOutput2",
  hiddeninput3: "hiddenInput3",
  hiddenoutput3: "hiddenOutput3",
  setup: "setup",
  setupsql: "setup",
  task: "task",
  mode: "mode",
  check: "check",
  checksql: "check",
  task2: "task2",
  mode2: "mode2",
  check2: "check2",
  task3: "task3",
  mode3: "mode3",
  check3: "check3",
  expected: "expected",
  webexpect: "expected",
};

const REQUIRED: Record<string, string[]> = {
  coding: ["title", "difficulty", "question", "sampleInput", "sampleOutput", "hiddenOutput"],
  sql: ["title", "difficulty", "question", "task", "check"],
  web: ["title", "difficulty", "question", "expected"],
  aptitude: ["title", "difficulty", "question", "choice1", "choice2", "answer"],
  reasoning: ["title", "difficulty", "question", "choice1", "choice2", "answer"],
  verbal: ["title", "difficulty", "question", "choice1", "choice2", "answer"],
};

const TEMPLATES: Record<string, string> = {
  coding: [
    "title,difficulty,question,input,output,starter,sampleInput,sampleOutput,hiddenInput,hiddenOutput,hints",
    'Example: add two numbers,Easy,"Read two integers and print their sum.",Two integers.,The sum.,"a, b = map(int, input().split())",2 3,5,10 1,11,',
  ].join("\n"),
  sql: [
    "title,difficulty,question,setup,starter,task,mode,check,hints",
    'Example: count the items,Easy,How many rows are in items?,"CREATE TABLE items(n INTEGER); INSERT INTO items(n) VALUES (1),(2);",,How many rows are in items?,read,SELECT COUNT(*) AS total FROM items,',
  ].join("\n"),
  web: [
    "title,difficulty,question,starter,expected,hints",
    'Example: hello heading,Easy,Show the word Hello on the page.,"<h1>Hello</h1>",Hello,',
  ].join("\n"),
  aptitude: [
    "title,difficulty,question,choice1,choice2,choice3,choice4,choice5,choice6,answer,hints",
    'Example: two plus three,Easy,"What is 2 + 3?",4,5,6,7,,,2,',
  ].join("\n"),
  reasoning: [
    "title,difficulty,question,choice1,choice2,choice3,choice4,choice5,choice6,answer,hints",
    "Example: next number,Medium,\"What comes next: 2, 4, 6?\",7,8,9,10,,,2,",
  ].join("\n"),
  verbal: [
    "title,difficulty,question,choice1,choice2,choice3,choice4,choice5,choice6,answer,hints",
    'Example: opposite of hot,Easy,Choose the opposite of hot.,warm,cold,heat,fire,,,2,',
  ].join("\n"),
};

export function templateCsv(moduleKey: string) {
  const template = TEMPLATES[moduleKey];
  if (!template) throw new ImportError("That module is not part of InfySkill Practice.");
  return template;
}

export function questionsFromCsv(moduleKey: string, source: string): ImportRow[] {
  const required = REQUIRED[moduleKey];
  if (!required) throw new ImportError("That module is not part of InfySkill Practice.");
  if (typeof source !== "string" || !source.trim()) throw new ImportError("The file has no questions.");
  if (source.length > MAX_CHARS) throw new ImportError("This file is too large. Split it into files of 100 questions.");
  const table = parseCsv(source);
  if (table.length === 0) throw new ImportError("The file has no questions.");
  const columns = headers(table[0].cells, required);
  const rows = table.slice(1).filter((row) => row.cells.some((cell) => cell.trim()));
  if (rows.length === 0) throw new ImportError("The file has no questions.");
  if (rows.length > MAX_ROWS) throw new ImportError("Import up to 100 questions at a time.");
  return rows.map((row) => {
    const record = recordFrom(columns, row.cells);
    try {
      return { line: row.line, input: inputFor(moduleKey, record) };
    } catch (error) {
      const message = error instanceof Error ? error.message : "This row could not be read.";
      throw new ImportError(`Row ${row.line}: ${message}`);
    }
  });
}

function headers(cells: string[], required: string[]) {
  const columns: { key: string; index: number }[] = [];
  const seen = new Set<string>();
  cells.forEach((cell, index) => {
    const name = cell.trim().toLowerCase().replace(/[\s_]+/g, "");
    if (!name) return;
    const key = ALIASES[name];
    if (!key) return;
    if (seen.has(key)) throw new ImportError(`The column ${cell.trim()} is repeated.`);
    seen.add(key);
    columns.push({ key, index });
  });
  const missing = required.filter((key) => !seen.has(key));
  if (missing.length > 0) {
    throw new ImportError(`This file needs these columns: ${required.join(", ")}.`);
  }
  return columns;
}

function recordFrom(columns: { key: string; index: number }[], cells: string[]) {
  const record: Record<string, string> = {};
  columns.forEach((column) => {
    record[column.key] = cells[column.index] ?? "";
  });
  return record;
}

function difficultyScore(value: string) {
  const text = value.trim().toLowerCase();
  if (text === "easy") return 0.2;
  if (text === "medium") return 0.55;
  if (text === "hard") return 0.85;
  const score = Number(text);
  if (!Number.isFinite(score) || score < 0 || score > 1) {
    throw new ImportError("Difficulty must be Easy, Medium, Hard, or a score from 0 to 1.");
  }
  return Math.round(score * 100) / 100;
}

function inputFor(moduleKey: string, record: Record<string, string>): Record<string, unknown> {
  const title = (record.title ?? "").trim();
  const body = (record.question ?? "").trim();
  if (!title) throw new ImportError("Question name is required.");
  if (!body) throw new ImportError("Question is required.");
  const base = {
    title,
    difficultyScore: difficultyScore(record.difficulty ?? ""),
    body,
    hints: record.hints ?? "",
    publish: false,
  };
  if (moduleKey === "aptitude" || moduleKey === "reasoning" || moduleKey === "verbal") {
    return { ...base, choices: choicesFrom(record) };
  }
  if (moduleKey === "coding") {
    const samples = pairs(record, "sampleInput", "sampleOutput", "Sample");
    const hiddenTests = pairs(record, "hiddenInput", "hiddenOutput", "Hidden");
    if (!samples.some((sample) => sample.input && sample.output)) {
      throw new ImportError("Add a sample input and sample output.");
    }
    if (!hiddenTests.some((test) => test.output)) throw new ImportError("Add a hidden test.");
    return {
      ...base,
      inputDescription: record.input ?? "",
      outputDescription: record.output ?? "",
      templateCode: record.starter ?? "",
      samples,
      hiddenTests,
    };
  }
  if (moduleKey === "sql") {
    const sqlParts = sqlPartsFrom(record);
    if (!sqlParts.some((part) => part.prompt && part.checkSql)) {
      throw new ImportError("Add a task and its check query.");
    }
    return { ...base, templateCode: record.starter ?? "", setupSql: record.setup ?? "", sqlParts };
  }
  const webExpect = (record.expected ?? "").trim();
  if (!webExpect) throw new ImportError("Add the expected text.");
  return { ...base, templateCode: record.starter ?? "", webExpect };
}

function choicesFrom(record: Record<string, string>) {
  const choices = [1, 2, 3, 4, 5, 6].flatMap((index) => {
    const text = (record[`choice${index}`] ?? "").trim();
    return text ? [{ text, slot: index }] : [];
  });
  if (choices.length < 2) throw new ImportError("Add at least two choices.");
  const answer = (record.answer ?? "").trim();
  const byText = choices.filter((choice) => choice.text.toLowerCase() === answer.toLowerCase());
  let correctSlot = 0;
  if (byText.length === 1) correctSlot = byText[0].slot;
  else if (byText.length > 1) throw new ImportError("Answer matches more than one choice.");
  else if (/^[1-6]$/.test(answer)) correctSlot = Number(answer);
  const marked = choices.filter((choice) => choice.slot === correctSlot);
  if (marked.length !== 1) throw new ImportError("Answer does not match a choice.");
  return choices.map((choice) => ({ text: choice.text, correct: choice.slot === correctSlot }));
}

function pairs(record: Record<string, string>, inputKey: string, outputKey: string, label: string) {
  return ["", "2", "3"].flatMap((suffix) => {
    const input = (record[`${inputKey}${suffix}`] ?? "").trim();
    const output = (record[`${outputKey}${suffix}`] ?? "").trim();
    if (!input && !output) return [];
    if (!output) throw new ImportError(`${label} output is required when ${label.toLowerCase()} input is filled.`);
    return [{ input, output }];
  });
}

function sqlPartsFrom(record: Record<string, string>) {
  return ["", "2", "3"].flatMap((suffix) => {
    const prompt = (record[`task${suffix}`] ?? "").trim();
    const checkSql = (record[`check${suffix}`] ?? "").trim();
    if (!prompt && !checkSql) return [];
    const modeText = (record[`mode${suffix}`] ?? "").trim().toLowerCase();
    if (modeText && modeText !== "read" && modeText !== "change") {
      throw new ImportError("Mode must be read or change.");
    }
    return [{ prompt, checkSql, mode: modeText === "change" ? "change" : "read" }];
  });
}

function parseCsv(source: string) {
  const text = source.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const rows: { line: number; cells: string[] }[] = [];
  let cells: string[] = [];
  let cell = "";
  let quoted = false;
  let line = 1;
  let rowLine = 1;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quoted) {
      if (char === '"') {
        if (text[index + 1] === '"') {
          cell += '"';
          index += 1;
        } else quoted = false;
      } else {
        if (char === "\n") line += 1;
        cell += char;
      }
      continue;
    }
    if (char === '"') quoted = true;
    else if (char === ",") {
      cells.push(cell);
      cell = "";
    } else if (char === "\n") {
      cells.push(cell);
      rows.push({ line: rowLine, cells });
      cells = [];
      cell = "";
      line += 1;
      rowLine = line;
    } else cell += char;
  }
  if (cell.length > 0 || cells.length > 0) {
    cells.push(cell);
    rows.push({ line, cells });
  }
  if (quoted) throw new ImportError("A quoted cell was left open.");
  return rows.filter((row) => row.cells.some((value) => value.trim()));
}
