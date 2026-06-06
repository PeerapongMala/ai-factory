/**
 * บทเรียนสะสมข้ามรอบ (persist ผ่าน GitHub Actions Cache)
 *
 * config/agents/*.json memory[] = ความรู้ baseline (commit ไว้)
 * logs/agent_lessons.json       = บทเรียนใหม่ที่ได้ระหว่างรัน 24/7 (cache, ไม่ push git)
 *
 * brains.ts จะรวม 2 แหล่งนี้เข้า prompt → พนักงานเก่งขึ้นจริงข้ามรอบ
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";

const LOGS_DIR = join(__dirname, "../../logs");
const LESSONS_FILE = join(LOGS_DIR, "agent_lessons.json");

export interface Lesson { date: string; from: string; feedback: string }
type LessonMap = Record<string, Lesson[]>; // key = agent file

const MAX_PER_AGENT = 20;

function readAll(): LessonMap {
  try {
    if (!existsSync(LESSONS_FILE)) return {};
    return JSON.parse(readFileSync(LESSONS_FILE, "utf8")) || {};
  } catch {
    return {};
  }
}

function writeAll(m: LessonMap): void {
  try {
    mkdirSync(LOGS_DIR, { recursive: true });
    writeFileSync(LESSONS_FILE, JSON.stringify(m, null, 2));
  } catch { /* best-effort */ }
}

export function addLesson(file: string, feedback: string, from = "PM (AI)"): void {
  const m = readAll();
  const list = m[file] || [];
  list.push({ date: new Date().toISOString(), from, feedback });
  m[file] = list.slice(-MAX_PER_AGENT);
  writeAll(m);
}

export function listLessons(file: string): Lesson[] {
  return readAll()[file] || [];
}

// แปลงเป็น prompt ต่อท้าย systemPrompt
export function getLessonsPrompt(file: string): string {
  const list = listLessons(file);
  if (list.length === 0) return "";
  const lines = list.map(l => `- ${typeof l.feedback === "string" ? l.feedback : JSON.stringify(l.feedback)}`).join("\n");
  return `\n\n[บทเรียนล่าสุดที่เพิ่งเรียนรู้ระหว่างทำงาน - ต้องทำตามอย่างเคร่งครัด]\n${lines}`;
}
