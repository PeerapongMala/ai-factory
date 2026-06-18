/**
 * Role: The PM (Project Manager) — AI Brain (Mistral)
 * ศูนย์กลางสั่งงาน รับรายงาน แก้ปัญหา คิดเอง
 * พนักงานทุกคนรายงานตรงกับ PM เท่านั้น ไม่ต้องรู้จักกัน
 */
import { $ } from "bun";
import { train, listMemory, listAgents, loadAgent, getMemoryPrompt } from "./agents/memory";
import { generateWithRetry, buildProviderConfig, type ProviderConfig } from "./ai/provider";
import { writeCaption, reviseCaption, guardianReview, pmVerdict, type Script, type NewsItem } from "./agents/brains";
import { recordWork, recordMechanical } from "./agents/stats";
import { addLesson } from "./agents/lessons";

// จำนวนรอบแก้งานสูงสุดต่อ 1 โพสต์ (real management loop)
const MAX_REVISE = Number(process.env.MAX_REVISE) || 2;

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
// Discord webhook — ให้ OpenClaw bot (และมือถือ) เห็นรายงานทุก run แบบ 24/7 (GitHub Actions ยิงเอง ไม่ต้องเปิดเครื่อง)
const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;

// แปลง HTML (ของ Telegram) → Discord markdown
function toDiscordMarkdown(html: string): string {
  return html
    .replace(/<b>(.*?)<\/b>/gs, "**$1**")
    .replace(/<i>(.*?)<\/i>/gs, "*$1*")
    .replace(/<code>(.*?)<\/code>/gs, "`$1`")
    .replace(/<[^>]+>/g, "")
    .trim();
}

async function sendDiscord(message: string) {
  if (!DISCORD_WEBHOOK_URL) return;
  try {
    await fetch(DISCORD_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: "PM · Pang News",
        content: toDiscordMarkdown(message).slice(0, 1900), // Discord จำกัด 2000 ตัวอักษร
      }),
    });
  } catch {
    log("PM", "ส่ง Discord ไม่ได้ ข้ามไป");
  }
}

// === CTA ทิ้งท้าย: ต้องเป๊ะเสมอ ห้ามเชื่อ LLM (เคยเพี้ยนเป็น "เกมถูกบอกด้วย v.3") ===
const CTA_CANONICAL = "ติดตามเพจใหม่เพื่อรับข่าวสารเพิ่มเติมได้ที่นี่ เกมปังv2";
function normalizeCTA(caption: string): string {
  if (typeof caption !== "string" || !caption.trim()) return "";
  const lines = caption.split("\n");
  // ตัดบรรทัดท้ายที่เป็น CTA/ชื่อเพจที่นักเขียนเขียนเอง (ทุกเวอร์ชัน เพี้ยน/ถูกก็ตัด) ออกให้หมด
  while (lines.length) {
    const last = lines[lines.length - 1].trim();
    if (last === "" || last === "." || last.includes("ติดตามเพจ") || last.includes("เกมปัง") || last.includes("เกมถูกบอก")) {
      lines.pop();
    } else break;
  }
  // ⛔ ตัด CTA แล้วไม่เหลือเนื้อข่าวจริง (ตัดแท็กหมวดออกด้วย) → คืน "" ให้ปลายทางตัดทิ้ง
  // ห้ามปั้น CTA ลอยๆ — เคยหลุดเป็นโพสต์เหลือแต่ "ติดตามเพจ..." ไม่มีข่าว
  const body = lines.join("\n").trim();
  if (body.replace(/\[(News|Deal|Update)\]/gi, "").trim().length < 10) return "";
  return body + "\n\n" + CTA_CANONICAL;
}

// โหมดโพสต์: "auto" = โพสต์เลย, "approve" = ส่งตรวจก่อน
function getPostMode(): "auto" | "approve" {
  try {
    const { readFileSync } = require("fs");
    const { join } = require("path");
    const modeFile = join(__dirname, "../tmp/post_mode.txt");
    return readFileSync(modeFile, "utf8").trim() as any || "auto";
  } catch { return "auto"; }
}

function ts(): string {
  return new Date().toLocaleString("th-TH", { timeZone: "Asia/Bangkok" });
}

function log(role: string, msg: string) {
  console.log(`[${ts()}] [${role}] ${msg}`);
}

// PM ส่งสรุปรายงานทาง Telegram
async function pmReport(message: string) {
  // Telegram (ถ้าตั้งค่าไว้)
  if (TELEGRAM_BOT_TOKEN && TELEGRAM_CHAT_ID) {
    try {
      await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: TELEGRAM_CHAT_ID,
          text: message,
          parse_mode: "HTML"
        })
      });
    } catch (e) {
      log("PM", "ส่ง Telegram ไม่ได้ ข้ามไป");
    }
  }
  // Discord — ให้ OpenClaw bot + มือถือเห็นทุกรายงาน (ทำงาน 24/7 ผ่าน GitHub Actions)
  await sendDiscord(message);
}

// === บทพูดจริงของพนักงาน (เฟส 1) — เขียนสิ่งที่ทำจริงลงไฟล์ให้ dashboard อ่าน ===
function teamSay(id: string, name: string, text: string) {
  try {
    const { readFileSync, writeFileSync, mkdirSync } = require("fs");
    const { join } = require("path");
    const dir = join(__dirname, "../tmp");
    mkdirSync(dir, { recursive: true });
    const f = join(dir, "team_chat.json");
    let arr: any[] = [];
    try { arr = JSON.parse(readFileSync(f, "utf8")); } catch {}
    arr.push({ id, name, text: String(text).slice(0, 140), t: new Date().toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" }) });
    writeFileSync(f, JSON.stringify(arr.slice(-60), null, 2));
  } catch {}
  // บทพูดรายประโยคไว้ดูใน dashboard พอ — Discord เอาแค่รายงานสรุปจบรอบจาก pmReport (เปิดกลับได้ด้วย DISCORD_TEAM_CHAT=1)
  if (process.env.DISCORD_TEAM_CHAT === "1") sendDiscord(`💬 **${name}:** ${text}`);
  log(name, `(พูด) ${text}`);
}

function clearTeamChat() {
  try {
    const { writeFileSync, mkdirSync } = require("fs");
    const { join } = require("path");
    mkdirSync(join(__dirname, "../tmp"), { recursive: true });
    writeFileSync(join(__dirname, "../tmp/team_chat.json"), "[]");
  } catch {}
}

// PM Brain — ถาม Mistral ให้ตัดสินใจ
const pmAgent = loadAgent("pm.json");
const pmMemory = getMemoryPrompt("pm.json");
const pmProviderConfig: ProviderConfig = buildProviderConfig(pmAgent, {
  provider: "openai",
  model: "mistral-large-latest",
  apiKeyEnv: "MISTRAL_API_KEY",
  baseUrl: "https://api.mistral.ai/v1",
});
const pmSystemPrompt = (pmAgent.systemPrompt || "") + pmMemory;

interface PMDecision {
  action: "proceed" | "retry" | "skip" | "train" | "alert";
  reason: string;
  trainTarget?: string;
  trainFeedback?: string;
}

async function pmThink(situation: string): Promise<PMDecision> {
  try {
    const res = await generateWithRetry(pmProviderConfig, {
      prompt: situation,
      systemPrompt: pmSystemPrompt,
      maxTokens: pmAgent.generationConfig?.maxOutputTokens || 512,
      temperature: pmAgent.generationConfig?.temperature || 0.3,
      jsonMode: true,
    });

    if (res.parsed) return res.parsed as PMDecision;
    return { action: "proceed", reason: "PM ตอบ JSON ไม่ได้ ดำเนินต่อ" };
  } catch (err: any) {
    log("PM", `AI Brain error: ${err.message} — fallback to proceed`);
    return { action: "proceed", reason: "AI Brain ล่ม ใช้ logic เดิม" };
  }
}

// PM สั่งงานพนักงานแต่ละคน
async function assignWork(role: string, command: string, inputFile?: string): Promise<{ success: boolean; output: string; data: any }> {
  try {
    log("PM", `สั่งงาน ${role}...`);

    let result: string;
    if (inputFile) {
      result = await $`bun run ${command} ${inputFile}`.text();
    } else {
      result = await $`bun run ${command}`.text();
    }

    // แยก JSON จาก output (กัน stderr ปน)
    const jsonMatch = result.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("ไม่ได้ JSON กลับมา");
    }

    const parsed = JSON.parse(jsonMatch[0]);

    if (parsed.status === "FAILED") {
      log(role, `รายงาน: FAILED - ${parsed.error || parsed.msg || "ไม่ทราบสาเหตุ"}`);
      return { success: false, output: result, data: parsed };
    }

    if (parsed.status === "SKIPPED") {
      log(role, `รายงาน: SKIPPED - ${parsed.msg || "ไม่มีงานต้องทำ"}`);
      return { success: false, output: result, data: parsed };
    }

    log(role, "รายงาน: SUCCESS");
    return { success: true, output: jsonMatch[0], data: parsed };

  } catch (error: any) {
    log(role, `ล้มเหลว: ${error.message}`);
    return { success: false, output: "", data: { status: "FAILED", error: error.message } };
  }
}

// PM ตัดสินใจ retry
async function assignWithRetry(role: string, command: string, inputFile: string | undefined, maxRetry: number): Promise<{ success: boolean; output: string; data: any }> {
  for (let attempt = 1; attempt <= maxRetry; attempt++) {
    const result = await assignWork(role, command, inputFile);
    if (result.success) return result;

    if (attempt < maxRetry) {
      const isRateLimit = result.data?.error?.includes("429") || result.data?.error?.includes("quota");
      if (isRateLimit) {
        log("PM", `${role} โดน rate limit รอ 30 วิ แล้วลองใหม่ (${attempt}/${maxRetry})`);
        await Bun.sleep(30_000);
      } else {
        log("PM", `${role} พัง PM ตัดสินใจ: ไม่ retry เพราะไม่ใช่ rate limit`);
        return result;
      }
    }
  }
  return { success: false, output: "", data: { status: "FAILED", error: "retry หมดแล้ว" } };
}

// ===== PM เริ่มทำงาน (AI Brain) =====
async function pmRun() {
  log("PM", "=== เริ่มประชุมเช้า (Real Management Loop) ===");
  clearTeamChat();
  teamSay("pm", "PM", "เริ่มประชุมเช้า สั่งทีมหาข่าวรอบใหม่กันเลย");
  teamSay("reporter", "นักข่าว", "รับทราบ ออกไปสแกนข่าวจากหลายสำนัก...");

  // 1. นักข่าว หาข่าว (mechanical)
  const news = await assignWork("นักข่าว", "scripts/fetch_news.ts");
  if (!news.success) {
    const decision = await pmThink(
      `นักข่าวรายงาน: ไม่มีข่าวใหม่\nError: ${news.data?.error || "ไม่ทราบ"}\nPM ควรทำอะไร?`
    );
    log("PM", `AI ตัดสินใจ: ${decision.action} — ${decision.reason}`);
    if (decision.action === "alert") {
      await pmReport(`⚠️ <b>PM AI</b>\n\nนักข่าวไม่มีข่าวใหม่\nPM คิด: ${decision.reason}\nเวลา: ${ts()}`);
    }
    return;
  }

  const newsItems: NewsItem[] = news.data.data || [];
  recordMechanical("reporter.json");
  const newsCount = newsItems.length;
  log("PM", `นักข่าวหาข่าวได้ ${newsCount} ข่าว`);
  const newsTitles = newsItems.map((n) => n.title).slice(0, 2).join(" / ") || "(ไม่มีหัวข้อ)";
  teamSay("reporter", "นักข่าว", `เจอข่าวน่าทำ ${newsCount} ข่าว: ${newsTitles}`);

  // 2. Real Management Loop — วนทีละข่าว: เขียน → ตรวจ → PM ตัดสิน → แก้ → เทรน → อนุมัติ
  const approvedItems: any[] = [];
  let totalRetries = 0;
  let totalLessons = 0;
  let lastError = ""; // เก็บ error จริงของนักเขียนรอบล่าสุด เพื่อรายงานเข้า Discord (เลิก fail เงียบ)

  for (const newsItem of newsItems) {
    teamSay("writer", "นักเขียน", `รับงานข่าว "${String(newsItem.title || "").slice(0, 36)}" ขอเขียนร่างแรกก่อน...`);

    let script: Script;
    try {
      script = await writeCaption(newsItem);
    } catch (e: any) {
      const reason = String(e?.message || e).slice(0, 200);
      lastError = reason;
      log("นักเขียน", `เขียนไม่ได้: ${reason}`);
      teamSay("writer", "นักเขียน", `เขียนข่าวนี้ไม่ได้ ขอข้ามไปก่อน (สาเหตุ: ${reason.slice(0, 100)})`);
      recordWork("writer.json", { passed: false });
      continue;
    }
    teamSay("writer", "นักเขียน", `ร่างแรกเสร็จ: ${script.headline}`);

    let attempt = 0;
    let approved = false;
    let gainedLesson = false;
    let lastIssues: string[] = [];

    while (true) {
      teamSay("guardian", "ตรวจสอบ", "ขอตรวจคุณภาพ caption ก่อนนะ...");
      const review = await guardianReview(newsItem, script);
      lastIssues = review.issues;

      if (review.pass) {
        teamSay("guardian", "ตรวจสอบ", `ผ่าน! (คะแนน ${review.score}) ส่งต่อได้เลย`);
        approved = true;
        break;
      }

      const issueText = review.issues.slice(0, 3).join(" | ") || review.note || "คุณภาพยังไม่ถึงเกณฑ์";
      teamSay("guardian", "ตรวจสอบ", `ยังไม่ผ่าน (${review.score}): ${issueText.slice(0, 90)}`);

      const verdict = await pmVerdict({ news: newsItem, script, review, attempt: attempt + 1, maxAttempts: MAX_REVISE });
      log("PM", `ตัดสิน: ${verdict.action} — ${verdict.reason}`);

      if (verdict.action === "approve") {
        teamSay("pm", "PM", `โอเค รับได้ ${verdict.reason || ""}`.trim());
        approved = true;
        break;
      }
      if (verdict.action === "skip") {
        teamSay("pm", "PM", `ข่าวนี้ขอข้าม: ${verdict.reason || "คุณภาพไม่พอ"}`);
        approved = false;
        break;
      }

      // revise/train — ถ้าครบรอบแล้ว → เทรนถาวร + ใช้ตัวที่ดีที่สุด (ไม่ทิ้งข่าว)
      // ⛔ ship guard: caption ว่าง/สั้นผิดปกติ = ของเสียจริง ห้ามฝืนโพสต์ (เคยหลุดโพสต์เหลือแต่ CTA เบิ้ล 2 อัน)
      if (attempt >= MAX_REVISE) {
        const lesson = verdict.feedback || issueText;
        train("writer.json", lesson, "PM (AI)");
        addLesson("writer.json", lesson, "PM (AI)");
        gainedLesson = true;
        const capText = typeof script.caption === "string" ? script.caption
          : Object.values(script.caption || {}).flat().map(String).join(" ");
        const capUsable = capText.replace(/["'\s]/g, "").length >= 30;
        if (capUsable) {
          teamSay("pm", "PM", "แก้หลายรอบแล้ว บันทึกบทเรียนให้นักเขียน คราวหน้าจะเก่งขึ้น");
          approved = true;
        } else {
          teamSay("pm", "PM", "caption ยังว่าง/ใช้ไม่ได้จริง ขอตัดข่าวนี้ทิ้ง รอบหน้าค่อยเอาใหม่");
          approved = false;
        }
        break;
      }

      const fb = verdict.feedback || issueText;
      teamSay("pm", "PM", `นักเขียนช่วยแก้ให้หน่อย: ${fb.slice(0, 80)}`);
      teamSay("writer", "นักเขียน", "รับทราบ ขอแก้ใหม่ตามที่พี่บอก...");
      try {
        script = await reviseCaption(newsItem, script, fb);
      } catch (e: any) {
        log("นักเขียน", `แก้ไม่ได้: ${e.message}`);
        break;
      }
      teamSay("writer", "นักเขียน", `แก้แล้วครับ: ${script.headline}`);
      attempt++;
    }

    // เทรนเมื่อแก้ผ่าน (ได้บทเรียน) — ทำให้รอบหน้าผ่านเร็วขึ้น
    if (approved && attempt > 0 && !gainedLesson) {
      const lesson = lastIssues[0] || "ปรับ caption ให้ผ่านเกณฑ์ตั้งแต่ร่างแรก";
      train("writer.json", lesson, "PM (AI)");
      addLesson("writer.json", lesson, "PM (AI)");
      gainedLesson = true;
    }
    if (gainedLesson) totalLessons++;
    totalRetries += attempt;
    recordWork("writer.json", { passed: approved, firstPass: approved && attempt === 0, retries: attempt, gainedLesson });
    recordMechanical("guardian.json");

    if (approved) {
      // ⛔ ship guard สุดท้าย: normalizeCTA คืน "" = ไม่เหลือเนื้อข่าวจริง → ตัดทิ้ง อย่าโพสต์ CTA ลอยๆ
      const finalCaption = normalizeCTA(script.caption);
      if (!finalCaption.trim()) {
        teamSay("pm", "PM", "caption เหลือแต่ CTA ไม่มีเนื้อข่าวจริง ขอตัดข่าวนี้ทิ้ง กันโพสต์เสีย");
        log("PM", "ตัดข่าว: caption เหลือแต่ CTA หลัง normalize");
      } else {
        approvedItems.push({
          source_article: newsItem,
          generated_script: { mood: script.mood, headline: script.headline, caption: finalCaption },
        });
      }
    }
  }

  if (approvedItems.length === 0) {
    teamSay("pm", "PM", "รอบนี้ยังไม่มีโพสต์ผ่านเกณฑ์ ขอข้ามไปก่อน");
    log("PM", "ไม่มี content ผ่าน — ปิดประชุม");
    const errLine = lastError ? `\nสาเหตุล่าสุด: ${lastError}` : "";
    await pmReport(`⚠️ <b>PM AI</b>\n\nรอบนี้ไม่มี content ผ่านเกณฑ์ (แก้ ${totalRetries} รอบ)${errLine}\nเวลา: ${ts()}`);
    return;
  }

  const reviewNote = totalRetries > 0
    ? `แก้ ${totalRetries} รอบ, เรียนรู้ ${totalLessons} บทเรียน, ผ่าน ${approvedItems.length} โพสต์`
    : `ผ่านฉลุยทุกโพสต์ตั้งแต่ร่างแรก (${approvedItems.length} โพสต์)`;
  teamSay("pm", "PM", `สรุป: ${reviewNote}`);
  teamSay("graphic", "กราฟิก", "แปะสติกเกอร์น้องปัง + headline ลงรูปให้สวยๆ");

  // contentData = ผลงานที่ผ่านการตรวจ (shape เดียวกับที่ downstream ต้องการ)
  const contentData: any = { status: "SUCCESS", role: "PM-loop", data: approvedItems, timestamp: new Date().toISOString() };
  const step2File = "/tmp/pm_step2.json";
  await Bun.write(step2File, JSON.stringify(contentData));
  const postInputFile = step2File;

  const mode = getPostMode();
  log("PM", `โหมดโพสต์: ${mode === "auto" ? "โพสต์เลย" : "ถามก่อน"}`);

  if (mode === "approve") {
    // === โหมดถามก่อน: แปะสติกเกอร์ก่อน แล้วบันทึก pending ===
    const { writeFileSync, mkdirSync } = require("fs");
    const { join } = require("path");
    const { stampSticker, uploadImage } = require("./post_dept/stamp_sticker");

    // แปะสติกเกอร์ + upload ให้ preview ดูเหมือนโพสต์จริง + เพิ่ม CTA ถ้าไม่มี
    const CTA_TEXT = "ติดตามเพจใหม่เพื่อรับข่าวสารเพิ่มเติมได้ที่นี่ เกมปังv2";
    const items = contentData.data || [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const sc = item.generated_script || {};
      let rawImageUrl = item.source_article?.image;

      // ดึง og:image ถ้าไม่มีรูป
      if (!rawImageUrl && item.source_article?.link) {
        try {
          const pageRes = await fetch(item.source_article.link, {
            headers: { "User-Agent": "Mozilla/5.0 (compatible; PangBot/1.0)" },
            redirect: "follow",
          });
          const html = await pageRes.text();
          const ogMatch = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)
            || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
          if (ogMatch?.[1]) rawImageUrl = ogMatch[1];
        } catch {}
      }

      // เพิ่ม CTA ทิ้งท้ายถ้า caption ไม่มี
      const captionStr = typeof sc.caption === "string" ? sc.caption : JSON.stringify(sc.caption || "");
      if (!captionStr.includes("ติดตามเพจ") && !captionStr.includes("เกมปังv2")) {
        if (typeof sc.caption === "string") {
          sc.caption = sc.caption.trimEnd() + "\n\n" + CTA_TEXT;
        } else if (sc.caption && typeof sc.caption === "object") {
          sc.caption.cta = CTA_TEXT;
        }
      }

      // กรอง URL ที่ไม่ใช่รูปภาพออก (YouTube, video embeds)
      if (rawImageUrl && (rawImageUrl.includes('youtube.com') || rawImageUrl.includes('youtu.be') || rawImageUrl.includes('/embed/'))) {
        log("กราฟิก", `ข้าม URL วิดีโอ: ${rawImageUrl}`);
        rawImageUrl = undefined;
      }

      { // แปะการ์ดเสมอ (ไม่มีรูปข่าว → stampSticker ใช้ภาพแบรนด์ default ให้ ไม่มี preview ไร้รูป)
        try {
          const mood = sc.mood === "fail" ? "fail" : "good";
          const headline = sc.headline || item.source_article?.title || "";
          // สร้าง summary จาก caption (2-3 บรรทัดแรก ไม่รวม CTA)
          const capStr = typeof sc.caption === "string" ? sc.caption : "";
          const summaryLines = capStr.split("\n").filter((l: string) => l.trim() && !l.includes("ติดตามเพจ") && !l.includes("เกมปังv2")).slice(0, 3);
          const summary = summaryLines.join("\n").slice(0, 200);
          const localPath = await stampSticker(rawImageUrl, mood, headline, `pending_${i}.jpg`, summary);
          const uploadedUrl = await uploadImage(localPath);
          item.preview_image = uploadedUrl;
          log("กราฟิก", `แปะสติกเกอร์ #${i + 1}: ${mood} → ${uploadedUrl}`);
        } catch (e: any) {
          log("กราฟิก", `แปะสติกเกอร์ไม่ได้: ${e.message}`);
          item.preview_image = rawImageUrl;
        }
      }
    }

    recordMechanical("graphic.json"); // กราฟิกทำงานจริง (แปะสติกเกอร์ + upload)

    const pendingDir = join(__dirname, "../tmp/pending");
    mkdirSync(pendingDir, { recursive: true });
    const pendingId = Date.now().toString() + Math.random().toString(36).slice(2, 6);
    const pendingFile = join(pendingDir, `${pendingId}.json`);
    writeFileSync(pendingFile, JSON.stringify(contentData, null, 2));

    // สรุป content ส่งให้แอดมินตรวจ
    let preview = "";
    for (const item of items) {
      const sc = item.generated_script || {};
      const headline = sc.headline || item.source_article?.title || "N/A";
      const caption = typeof sc.caption === "string" ? sc.caption.slice(0, 200) : JSON.stringify(sc.caption || "").slice(0, 200);
      preview += `\n\n<b>${headline}</b>\n${caption}...`;
    }

    await pmReport(
      `📋 <b>รอตรวจก่อนโพสต์</b>\n${preview}\n\n🔑 ID: <code>${pendingId}</code>\n✅ อนุมัติ: กดใน Dashboard\n🕐 เวลา: ${ts()}`
    );

    log("PM", `บันทึก pending #${pendingId} — รอแอดมินอนุมัติ`);
    log("PM", "=== รอตรวจ ปิดประชุม ===");
    return;
  }

  // === โหมดโพสต์เลย ===
  // 6. สั่ง โพสต์ ลง FB + IG
  const post = await assignWork("โพสต์", "scripts/post_dept/social_post.ts", postInputFile);
  if (!post.success) {
    const decision = await pmThink(
      `โพสต์ FB/IG ไม่สำเร็จ\nError: ${post.data?.error || "unknown"}\nPM ควรทำอะไร?`
    );
    log("PM", `AI ตัดสินใจ: ${decision.action} — ${decision.reason}`);
    await pmReport(`⚠️ <b>PM AI</b>\n\nโพสต์ไม่สำเร็จ\nPM คิด: ${decision.reason}\nเวลา: ${ts()}`);
    return;
  }

  recordMechanical("graphic.json");
  recordMechanical("publisher.json");
  teamSay("publisher", "โพสต์", "โพสต์ลงเพจ FB + IG เรียบร้อยแล้ว!");
  teamSay("pm", "PM", "งานดีมากทีม รอบนี้เสร็จเรียบร้อย รอฟังถ้าแอดมินอยากปรับอะไร");

  // 7. PM สรุปงาน
  log("PM", "=== งานเสร็จทั้งหมด ปิดประชุม ===");

  const titles = approvedItems.map((it: any) => it.generated_script?.headline || it.source_article?.title).join("\n• ") || "N/A";
  await pmReport(`✅ <b>PM AI Report</b>\n\n📰 ข่าวที่โพสต์:\n• ${titles}\n\n🧠 ทีมงาน: ${reviewNote}\n📱 Platforms: Facebook + Instagram\n🕐 เวลา: ${ts()}`);
}

// ===== PM เทรนพนักงาน =====
// ใช้: bun run scripts/pm.ts train นักเขียน "caption ยาวไป ให้สั้นลง"
// ใช้: bun run scripts/pm.ts memory นักเขียน
// ใช้: bun run scripts/pm.ts list
async function pmCommand() {
  const args = process.argv.slice(2);
  const command = args[0];

  if (!command || command === "run") {
    // Default: run pipeline
    await pmRun();
    return;
  }

  const AGENT_MAP: Record<string, string> = {
    "pm": "pm.json",
    "นักข่าว": "reporter.json",
    "นักเขียน": "writer.json",
    "ตรวจสอบ": "guardian.json",
    "กราฟิก": "graphic.json",
    "โพสต์": "publisher.json"
  };

  if (command === "train") {
    const agentName = args[1];
    const feedback = args[2];

    if (!agentName || !feedback) {
      console.log("ใช้: bun run scripts/pm.ts train <ชื่อพนักงาน> \"feedback\"");
      console.log("พนักงาน:", Object.keys(AGENT_MAP).join(", "));
      return;
    }

    const file = AGENT_MAP[agentName];
    if (!file) {
      console.log(`ไม่รู้จักพนักงานชื่อ "${agentName}"`);
      console.log("พนักงาน:", Object.keys(AGENT_MAP).join(", "));
      return;
    }

    const updated = train(file, feedback, "แอดมิน");
    log("PM", `เทรน ${agentName} สำเร็จ! memory ทั้งหมด ${updated.memory.length} รายการ`);
    log("PM", `feedback: "${feedback}"`);
    return;
  }

  if (command === "memory") {
    const agentName = args[1];
    if (!agentName) {
      // แสดง memory ทุกคน
      for (const [name, file] of Object.entries(AGENT_MAP)) {
        const memories = listMemory(file);
        console.log(`\n[${name}] - ${memories.length} ความจำ`);
        memories.forEach(m => console.log(`  ${m.date.slice(0,10)} [${m.from}] ${m.feedback}`));
      }
      return;
    }

    const file = AGENT_MAP[agentName];
    if (!file) {
      console.log(`ไม่รู้จักพนักงานชื่อ "${agentName}"`);
      return;
    }

    const memories = listMemory(file);
    console.log(`\n[${agentName}] - ${memories.length} ความจำ`);
    if (memories.length === 0) {
      console.log("  (ยังไม่มี feedback)");
    } else {
      memories.forEach(m => console.log(`  ${m.date.slice(0,10)} [${m.from}] ${m.feedback}`));
    }
    return;
  }

  if (command === "list") {
    console.log("\n=== พนักงาน Pang Game Company ===\n");
    for (const [name, file] of Object.entries(AGENT_MAP)) {
      const agent = loadAgent(file);
      console.log(`${name} (${agent.role}) - memory: ${agent.memory.length}`);
    }
    return;
  }

  console.log("คำสั่ง PM:");
  console.log("  bun run scripts/pm.ts              → รัน pipeline");
  console.log("  bun run scripts/pm.ts train <ชื่อ> \"feedback\"  → เทรนพนักงาน");
  console.log("  bun run scripts/pm.ts memory [ชื่อ]  → ดู memory");
  console.log("  bun run scripts/pm.ts list           → ดูพนักงานทั้งหมด");
}

pmCommand();
