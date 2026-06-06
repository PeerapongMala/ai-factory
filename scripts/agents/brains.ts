/**
 * "สมองจริง" ของพนักงาน LLM (โมเดลฟรี: นักเขียน=Gemini, ตรวจสอบ=Mistral, PM=Mistral)
 *
 * ใช้ provider เดียวกับ pipeline → ได้ทั้ง cloud 24/7 และ OpenClaw (Claude) เมื่อ USE_OPENCLAW=1
 * ทุกฟังก์ชัน fallback แบบปลอดภัย: LLM ล่ม → ไม่ทำให้ pipeline พัง
 */
import { loadAgent, getMemoryPrompt } from "./memory";
import { getLessonsPrompt } from "./lessons";
import { generateWithRetry, buildProviderConfig, type ProviderConfig } from "../ai/provider";

export interface NewsItem { title?: string; source?: string; summary?: string; link?: string; image?: string }
export interface Script { mood: "good" | "fail"; headline: string; caption: string }
export interface Review { pass: boolean; score: number; issues: string[]; note: string }
export interface PMVerdict { action: "approve" | "revise" | "train" | "skip"; reason: string; feedback?: string }

// ---- provider configs (ฟรี + opt-in OpenClaw) ----
function writerCfg(): { cfg: ProviderConfig; system: string; gen: any } {
  const a = loadAgent("writer.json");
  const cfg = buildProviderConfig(a, { provider: "gemini", model: "gemini-2.0-flash" });
  const system = (a.systemPrompt || "") + getMemoryPrompt("writer.json") + getLessonsPrompt("writer.json");
  return { cfg, system, gen: a.generationConfig || {} };
}

function guardianCfg(): { cfg: ProviderConfig; checks: string[] } {
  const a = loadAgent("guardian.json");
  const cfg = buildProviderConfig(a, {
    provider: "openai", model: "mistral-large-latest",
    apiKeyEnv: "MISTRAL_API_KEY", baseUrl: "https://api.mistral.ai/v1",
  });
  return { cfg, checks: a.checks || [] };
}

function pmCfg(): { cfg: ProviderConfig; system: string } {
  const a = loadAgent("pm.json");
  const cfg = buildProviderConfig(a, {
    provider: "openai", model: "mistral-large-latest",
    apiKeyEnv: "MISTRAL_API_KEY", baseUrl: "https://api.mistral.ai/v1",
  });
  return { cfg, system: (a.systemPrompt || "") + getMemoryPrompt("pm.json") };
}

// แปลงค่าที่ LLM อาจคืนเป็น string / array / object ให้เป็นข้อความอ่านได้เสมอ
function coerceText(v: any): string {
  if (v == null) return "";
  if (typeof v === "string") return v.trim();
  if (Array.isArray(v)) return v.map(coerceText).filter(Boolean).join("; ");
  if (typeof v === "object") {
    if (Array.isArray(v.issues)) return v.issues.map(coerceText).filter(Boolean).join("; ");
    return Object.values(v).map(coerceText).filter(Boolean).join("; ");
  }
  return String(v);
}

function asScript(parsed: any, fallbackHeadline = ""): Script {
  const mood = parsed?.mood === "fail" ? "fail" : "good";
  const caption = typeof parsed?.caption === "string" ? parsed.caption : JSON.stringify(parsed?.caption ?? "");
  return { mood, headline: String(parsed?.headline || fallbackHeadline || "").slice(0, 80), caption };
}

// ===== นักเขียน: เขียน caption ใหม่ =====
export async function writeCaption(news: NewsItem): Promise<Script> {
  const { cfg, system, gen } = writerCfg();
  const prompt = `News Title: ${news.title}\nSource: ${news.source}\nSummary: ${news.summary}\n\nเขียน content ตามมาตรฐานในระบบ ให้น่าสนใจสำหรับผู้เล่นเกมชาวไทย`;
  const res = await generateWithRetry(cfg, {
    prompt, systemPrompt: system,
    maxTokens: gen.maxOutputTokens || 1024,
    temperature: gen.temperature ?? 0.85,
    jsonMode: true,
  });
  return asScript(res.parsed, news.title);
}

// ===== นักเขียน: แก้ caption ตาม feedback (revise จริง) =====
export async function reviseCaption(news: NewsItem, prev: Script, feedback: string): Promise<Script> {
  const { cfg, system, gen } = writerCfg();
  const prompt =
    `News Title: ${news.title}\nSource: ${news.source}\nSummary: ${news.summary}\n\n` +
    `[caption เดิมที่คุณเขียน]\nheadline: ${prev.headline}\ncaption: ${prev.caption}\n\n` +
    `[ผลตรวจจากทีม — ต้องแก้ให้หมด]\n${feedback}\n\n` +
    `แก้ caption ใหม่ให้ผ่านทุกข้อ ตอบเป็น JSON {mood, headline, caption} ตามรูปแบบเดิม`;
  const res = await generateWithRetry(cfg, {
    prompt, systemPrompt: system,
    maxTokens: gen.maxOutputTokens || 1024,
    temperature: 0.6, // แก้งานให้ตรง feedback → ลด temperature
    jsonMode: true,
  });
  return asScript(res.parsed, prev.headline);
}

// ===== ตรวจสอบ (Guardian): อ่าน caption จริง → คืนปัญหา =====
export async function guardianReview(news: NewsItem, script: Script): Promise<Review> {
  const { cfg, checks } = guardianCfg();
  const rubric = [
    "ห้ามมี emoji หรือสัญลักษณ์พิเศษ (เช่น **, #, [News], ✨)",
    "ต้องจบด้วย CTA: 'ติดตามเพจใหม่เพื่อรับข่าวสารเพิ่มเติมได้ที่นี่ เกมปังv2'",
    "ภาษาไทยถูกต้อง อ่านลื่น ไม่มีคำขาด/ตัดกลางประโยค",
    "headline ตรงกับเนื้อหา caption และตรงกับข่าวต้นฉบับ",
    "กระชับ ไม่ยาวเกินจำเป็น ไม่ใช้คำสแลงเกินงาม (เช่น 'ปังขอแนะนำ')",
    "ข้อมูลตรงกับข่าวต้นฉบับ ไม่มั่ว ไม่แต่งเติม",
    ...checks,
  ].map((c, i) => `${i + 1}. ${c}`).join("\n");

  const system =
    `คุณคือ 'ตรวจสอบ' (Guardian) ของ Pang Game Company ทำหน้าที่ QA คุณภาพ caption ก่อนโพสต์ อย่างเข้มงวดและยุติธรรม\n` +
    `ตรวจตาม checklist นี้:\n${rubric}\n\n` +
    `ตอบเป็น JSON เท่านั้น: { "pass": true|false, "score": 0-100, "issues": ["ปัญหาที่ต้องแก้ ระบุให้ชัด"], "note": "สรุปสั้นๆ" }\n` +
    `pass=true เฉพาะเมื่อผ่านครบทุกข้อ (score >= 80). ถ้าไม่ผ่าน ใส่ issues ที่ actionable ให้นักเขียนแก้ได้ทันที`;

  const prompt =
    `[ข่าวต้นฉบับ]\nหัวข้อ: ${news.title}\nแหล่ง: ${news.source}\nสรุป: ${news.summary}\n\n` +
    `[caption ที่นักเขียนส่งมา]\nmood: ${script.mood}\nheadline: ${script.headline}\ncaption:\n${script.caption}\n\nตรวจแล้วรายงานผล`;

  try {
    const res = await generateWithRetry(cfg, { prompt, systemPrompt: system, maxTokens: 512, temperature: 0.2, jsonMode: true });
    const p = res.parsed;
    if (!p || typeof p.pass === "undefined") return { pass: true, score: 75, issues: [], note: "ตรวจไม่ได้ ปล่อยผ่าน" };
    return {
      pass: !!p.pass,
      score: typeof p.score === "number" ? p.score : (p.pass ? 85 : 50),
      issues: Array.isArray(p.issues) ? p.issues.map((x: any) => String(x)).slice(0, 6) : [],
      note: String(p.note || ""),
    };
  } catch {
    // guardian ล่ม → อย่าบล็อก pipeline (ปล่อยผ่าน แต่ score กลางๆ)
    return { pass: true, score: 70, issues: [], note: "guardian ล่ม ปล่อยผ่าน" };
  }
}

// ===== PM: ตัดสินใจหลังเห็นผลตรวจ =====
export async function pmVerdict(args: {
  news: NewsItem; script: Script; review: Review; attempt: number; maxAttempts: number;
}): Promise<PMVerdict> {
  const { cfg, system } = pmCfg();
  const prompt =
    `[สถานการณ์] นักเขียนส่ง caption มา และตรวจสอบ (Guardian) ตรวจแล้ว\n` +
    `รอบแก้ที่: ${args.attempt}/${args.maxAttempts}\n\n` +
    `ข่าว: ${args.news.title}\n` +
    `headline: ${args.script.headline}\ncaption:\n${args.script.caption}\n\n` +
    `ผลตรวจ: pass=${args.review.pass} score=${args.review.score}\n` +
    `ปัญหา: ${args.review.issues.join(" | ") || "(ไม่มี)"}\n\n` +
    `ในฐานะ PM ตัดสินใจ ตอบ JSON: { "action": "approve"|"revise"|"train"|"skip", "reason": "...", "feedback": "คำสั่งชัดๆ ให้นักเขียนแก้ (ถ้า revise/train)" }\n` +
    `- approve = ดีพอแล้ว ผ่านได้\n- revise = ให้นักเขียนแก้ตาม feedback (ยังมีรอบเหลือ)\n- train = แก้แล้วยังไม่ดี ครบรอบ → บันทึกบทเรียนถาวร แล้วใช้ตัวที่ดีที่สุด\n- skip = แย่เกินกู้ ข้ามข่าวนี้`;

  try {
    const res = await generateWithRetry(cfg, { prompt, systemPrompt: system, maxTokens: 400, temperature: 0.3, jsonMode: true });
    const p = res.parsed;
    if (!p || !p.action) return { action: args.review.pass ? "approve" : "revise", reason: "PM ตอบไม่ชัด", feedback: args.review.issues.join("; ") };
    const action = ["approve", "revise", "train", "skip"].includes(p.action) ? p.action : "revise";
    // feedback อาจกลับมาเป็น object (เช่น {issues:[...]}) → แปลงเป็นข้อความที่อ่านได้ ไม่ใช่ "[object Object]"
    const fb = coerceText(p.feedback) || args.review.issues.join("; ");
    return { action, reason: coerceText(p.reason), feedback: fb };
  } catch {
    return { action: args.review.pass ? "approve" : "revise", reason: "PM ล่ม ใช้ผลตรวจตัดสิน", feedback: args.review.issues.join("; ") };
  }
}
