/**
 * ระบบ "พัฒนาการพนักงาน" — เก็บสถิติการทำงาน + เลเวล + บทเรียน
 * ทำให้ owner เห็นว่าพนักงานเก่งขึ้นจริง (retry น้อยลง, ความแม่นยำสูงขึ้น)
 *
 * เก็บที่ logs/agent_stats.json → persist ข้ามรอบด้วย GitHub Actions Cache
 * (ไม่ commit กลับ git → ปลอดภัย ฟรี ทำงาน 24/7)
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { join } from "path";

const LOGS_DIR = join(__dirname, "../../logs");
const STATS_FILE = join(LOGS_DIR, "agent_stats.json");

export interface AgentStat {
  runs: number;        // จำนวนงานที่ทำเสร็จ (ผ่านการตรวจ)
  passes: number;      // ผ่านการตรวจรอบแรก (ไม่ต้องแก้)
  retries: number;     // จำนวนครั้งที่ต้องแก้สะสม
  lessons: number;     // บทเรียนที่ถูกเทรนสะสม
  xp: number;          // แต้มประสบการณ์
  lastActive?: string; // ISO timestamp ทำงานล่าสุด
}

export type StatsMap = Record<string, AgentStat>; // key = agent file เช่น "writer.json"

const EMPTY: AgentStat = { runs: 0, passes: 0, retries: 0, lessons: 0, xp: 0 };

// แต้ม XP ต่อเหตุการณ์
const XP_PASS = 10;       // งานผ่าน
const XP_FIRST_PASS = 6;  // โบนัสผ่านรอบแรก (ไม่ต้องแก้) = ฝีมือดี
const XP_REVISE = 2;      // แก้งานสำเร็จก็ได้ความพยายาม
const XP_LESSON = 5;      // ได้บทเรียนใหม่ = เรียนรู้
const XP_PER_LEVEL = 100;

const LEVEL_TITLES = ["ฝึกงาน", "จูเนียร์", "ซีเนียร์", "หัวหน้าทีม", "ผู้เชี่ยวชาญ", "ตำนาน"];

export function readStats(): StatsMap {
  try {
    if (!existsSync(STATS_FILE)) return {};
    return JSON.parse(readFileSync(STATS_FILE, "utf8")) || {};
  } catch {
    return {};
  }
}

function writeStats(s: StatsMap): void {
  try {
    mkdirSync(LOGS_DIR, { recursive: true });
    writeFileSync(STATS_FILE, JSON.stringify(s, null, 2));
  } catch { /* best-effort */ }
}

export function getStat(file: string): AgentStat {
  const s = readStats();
  return { ...EMPTY, ...(s[file] || {}) };
}

export function levelFromXp(xp: number): { level: number; title: string; into: number; need: number; pct: number } {
  const level = Math.floor(xp / XP_PER_LEVEL) + 1;
  const into = xp % XP_PER_LEVEL;
  const title = LEVEL_TITLES[Math.min(level - 1, LEVEL_TITLES.length - 1)];
  return { level, title, into, need: XP_PER_LEVEL, pct: Math.round((into / XP_PER_LEVEL) * 100) };
}

// ความแม่นยำ = ผ่านรอบแรก / งานทั้งหมด (ยิ่งสูง = เก่งขึ้น)
export function accuracy(stat: AgentStat): number {
  if (stat.runs === 0) return 0;
  return Math.round((stat.passes / stat.runs) * 100);
}

/**
 * บันทึกผลการทำงาน 1 ชิ้น
 * @param file       agent file เช่น "writer.json"
 * @param ev.passed       งานนี้ผ่านในที่สุดมั้ย
 * @param ev.firstPass    ผ่านตั้งแต่รอบแรก (ไม่ต้องแก้)
 * @param ev.retries      จำนวนครั้งที่แก้ในงานนี้
 * @param ev.gainedLesson ได้บทเรียนใหม่มั้ย
 */
export function recordWork(
  file: string,
  ev: { passed: boolean; firstPass?: boolean; retries?: number; gainedLesson?: boolean }
): AgentStat {
  const all = readStats();
  const cur: AgentStat = { ...EMPTY, ...(all[file] || {}) };

  if (ev.passed) {
    cur.runs += 1;
    cur.xp += XP_PASS;
    if (ev.firstPass) { cur.passes += 1; cur.xp += XP_FIRST_PASS; }
  }
  if (ev.retries && ev.retries > 0) {
    cur.retries += ev.retries;
    cur.xp += XP_REVISE * ev.retries;
  }
  if (ev.gainedLesson) {
    cur.lessons += 1;
    cur.xp += XP_LESSON;
  }
  cur.lastActive = new Date().toISOString();

  all[file] = cur;
  writeStats(all);
  return cur;
}

// บันทึกงานของพนักงาน mechanical (นักข่าว/กราฟิก/โพสต์) — ได้ XP จากการทำงานเสร็จ
export function recordMechanical(file: string): AgentStat {
  return recordWork(file, { passed: true, firstPass: true });
}

// สรุปสถิติทุกคน พร้อม level (ให้ dashboard/อ่านง่าย)
export function statsSummary(): Record<string, AgentStat & { level: number; title: string; xpPct: number; accuracy: number }> {
  const all = readStats();
  const out: any = {};
  for (const [file, stat] of Object.entries(all)) {
    const lv = levelFromXp(stat.xp);
    out[file] = { ...stat, level: lv.level, title: lv.title, xpPct: lv.pct, accuracy: accuracy(stat) };
  }
  return out;
}
