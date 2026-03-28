/**
 * ระบบความจำของพนักงาน
 * อ่าน/เขียน memory ให้ agent แต่ละคน
 * PM ใช้ train() เพื่อสอนพนักงาน
 */
import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";

const AGENTS_DIR = join(__dirname, "../../config/agents");

export interface AgentConfig {
  name: string;
  role: string;
  description: string;
  provider?: string;      // "gemini" | "openai" | "claude"
  model?: string;
  apiKeyEnv?: string;     // custom env var name for API key
  baseUrl?: string;       // custom base URL (Groq, Ollama, etc.)
  systemPrompt?: string;
  generationConfig?: any;
  settings?: any;
  checks?: string[];
  memory: { date: string; from: string; feedback: string }[];
}

// อ่าน config ของพนักงาน
export function loadAgent(agentFile: string): AgentConfig {
  const path = join(AGENTS_DIR, agentFile);
  if (!existsSync(path)) {
    throw new Error(`ไม่พบพนักงาน: ${agentFile}`);
  }
  return JSON.parse(readFileSync(path, "utf8"));
}

// บันทึก config กลับ
export function saveAgent(agentFile: string, config: AgentConfig) {
  const path = join(AGENTS_DIR, agentFile);
  writeFileSync(path, JSON.stringify(config, null, 2));
}

// PM เทรนพนักงาน - เพิ่ม feedback เข้า memory
export function train(agentFile: string, feedback: string, from: string = "PM") {
  const config = loadAgent(agentFile);
  config.memory.push({
    date: new Date().toISOString(),
    from,
    feedback
  });
  // เก็บแค่ 50 feedback ล่าสุด กันไฟล์บวม
  if (config.memory.length > 50) {
    config.memory = config.memory.slice(-50);
  }
  saveAgent(agentFile, config);
  return config;
}

// อ่าน memory ของพนักงาน เอาไปใส่ใน prompt
export function getMemoryPrompt(agentFile: string): string {
  const config = loadAgent(agentFile);
  if (config.memory.length === 0) return "";

  // ส่ง feedback จากแอดมินก่อน + ล่าสุด 10 อัน (ไม่ให้ prompt ยาวเกิน)
  const adminFeedbacks = config.memory.filter(m => m.from && m.from.includes('แอดมิน'));
  const otherFeedbacks = config.memory.filter(m => !m.from || !m.from.includes('แอดมิน'));
  const selected = [...adminFeedbacks, ...otherFeedbacks.slice(-10)];

  const memories = selected
    .map(m => {
      const fb = typeof m.feedback === 'string' ? m.feedback : JSON.stringify(m.feedback);
      return `- [${m.from}] ${fb}`;
    })
    .join("\n");

  return `\n\n[ความจำจาก feedback ที่เคยได้รับ - ต้องทำตามอย่างเคร่งครัด]\n${memories}`;
}

// ดู memory ทั้งหมดของพนักงาน
export function listMemory(agentFile: string): { date: string; from: string; feedback: string }[] {
  const config = loadAgent(agentFile);
  return config.memory;
}

// ลบ memory ทั้งหมดของพนักงาน (reset)
export function clearMemory(agentFile: string) {
  const config = loadAgent(agentFile);
  config.memory = [];
  saveAgent(agentFile, config);
}

// ดูพนักงานทั้งหมด
export function listAgents(): string[] {
  const { readdirSync } = require("fs");
  return readdirSync(AGENTS_DIR).filter((f: string) => f.endsWith(".json"));
}
