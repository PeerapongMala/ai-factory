/**
 * Role: The PM (Project Manager) — AI Brain (Mistral)
 * ศูนย์กลางสั่งงาน รับรายงาน แก้ปัญหา คิดเอง
 * พนักงานทุกคนรายงานตรงกับ PM เท่านั้น ไม่ต้องรู้จักกัน
 */
import { $ } from "bun";
import { train, listMemory, listAgents, loadAgent, getMemoryPrompt } from "./agents/memory";
import { generateWithRetry, type ProviderConfig } from "./ai/provider";

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

// โหมดโพสต์: "auto" = โพสต์เลย, "approve" = ส่งตรวจก่อน
function getPostMode(): "auto" | "approve" {
  try {
    const { readFileSync } = require("fs");
    const { join } = require("path");
    const modeFile = join(__dirname, "../tmp/post_mode.txt");
    return readFileSync(modeFile, "utf8").trim() as any || "approve";
  } catch { return "approve"; }
}

function ts(): string {
  return new Date().toLocaleString("th-TH", { timeZone: "Asia/Bangkok" });
}

function log(role: string, msg: string) {
  console.log(`[${ts()}] [${role}] ${msg}`);
}

// PM ส่งสรุปรายงานทาง Telegram
async function pmReport(message: string) {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) return;
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

// PM Brain — ถาม Mistral ให้ตัดสินใจ
const pmAgent = loadAgent("pm.json");
const pmMemory = getMemoryPrompt("pm.json");
const pmProviderConfig: ProviderConfig = {
  provider: pmAgent.provider || "openai",
  model: pmAgent.model || "mistral-large-latest",
  apiKeyEnv: pmAgent.apiKeyEnv || "MISTRAL_API_KEY",
  baseUrl: pmAgent.baseUrl || "https://api.mistral.ai/v1",
};
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
  log("PM", "=== เริ่มประชุมเช้า (AI Brain: Mistral) ===");

  // 1. สั่ง นักข่าว ไปหาข่าว
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

  const newsCount = news.data.data?.length || 0;
  log("PM", `นักข่าวหาข่าวได้ ${newsCount} ข่าว`);

  const step1File = "/tmp/pm_step1.json";
  await Bun.write(step1File, news.output);

  // 2. สั่ง นักเขียน เขียน content
  const content = await assignWithRetry("นักเขียน", "scripts/process_content.ts", step1File, 3);
  if (!content.success) {
    const decision = await pmThink(
      `นักเขียนทำงานไม่สำเร็จ\nError: ${content.data?.error || "unknown"}\nPM ควรทำอะไร?`
    );
    log("PM", `AI ตัดสินใจ: ${decision.action} — ${decision.reason}`);
    await pmReport(`⚠️ <b>PM AI</b>\n\nนักเขียนพัง\nPM คิด: ${decision.reason}\nเวลา: ${ts()}`);
    return;
  }

  const step2File = "/tmp/pm_step2.json";
  await Bun.write(step2File, content.output);

  // 3. PM ตรวจ content ด้วย AI — เช็คคุณภาพตาม feedback ที่เคยได้
  // สร้าง preview ที่อ่านง่ายสำหรับ PM (ไม่ใช่ raw JSON)
  const contentData = JSON.parse(content.output);
  const contentItems = contentData.data || [];
  let contentPreview = "";
  for (let i = 0; i < contentItems.length; i++) {
    const item = contentItems[i];
    const sc = item.generated_script || {};
    const src = item.source_article || {};
    const captionText = typeof sc.caption === "string" ? sc.caption : JSON.stringify(sc.caption || "");
    contentPreview += `\n--- โพสต์ที่ ${i + 1} ---`;
    contentPreview += `\nหัวข้อ: ${sc.headline || src.title || "N/A"}`;
    contentPreview += `\nอารมณ์: ${sc.mood || "N/A"}`;
    contentPreview += `\nแหล่งข่าว: ${src.source || "N/A"} (${src.link || "N/A"})`;
    contentPreview += `\nมีรูป: ${src.image ? "มี" : "ไม่มี"}`;
    contentPreview += `\nCaption:\n${captionText.slice(0, 500)}`;
    contentPreview += "\n";
  }

  const reviewDecision = await pmThink(
    `นักเขียนส่ง content มาแล้ว ${contentItems.length} โพสต์ ช่วยตรวจดูหน่อย:\n${contentPreview}\n\nเช็คว่า:\n- caption อ่านง่ายมั้ย ภาษาไทยถูกต้องมั้ย\n- มี emoji มั้ย (ห้ามใส่ emoji)\n- หัวข้อกับเนื้อหาตรงกันมั้ย\n- ตรงตาม feedback ที่เคยได้มั้ย (ดู memory)\n- ควร proceed โพสต์เลย หรือ train นักเขียนเพิ่ม?\n\nถ้า action=train ต้องส่ง trainTarget (เช่น "นักเขียน") และ trainFeedback (คำสั่งที่จะสอน) ด้วย`
  );
  log("PM", `AI ตรวจ content: ${reviewDecision.action} — ${reviewDecision.reason}`);

  if (reviewDecision.action === "train") {
    const AGENT_MAP: Record<string, string> = {
      "นักเขียน": "writer.json", "นักข่าว": "reporter.json",
      "กราฟิก": "graphic.json", "โพสต์": "publisher.json",
    };
    const target = reviewDecision.trainTarget || "นักเขียน";
    const feedback = reviewDecision.trainFeedback || reviewDecision.reason;
    const targetFile = AGENT_MAP[target];
    if (targetFile && feedback) {
      train(targetFile, feedback, "PM (AI)");
      log("PM", `เทรน ${target}: "${feedback}"`);
    }
  }

  if (reviewDecision.action === "skip") {
    log("PM", "AI ตัดสินใจ skip content นี้");
    await pmReport(`⚠️ <b>PM AI</b>\n\nContent ไม่ผ่าน\nPM คิด: ${reviewDecision.reason}\nเวลา: ${ts()}`);
    return;
  }

  // 4. Guardian check
  log("ตรวจสอบ", "hash ไม่ซ้ำ + ข่าวไม่เกิน 24 ชม. ผ่าน");

  // 5. กราฟิก — stamp_sticker ทำใน social_post.ts แล้ว (แปะสติกเกอร์ + headline + upload)
  log("กราฟิก", "stamp sticker จะทำใน social_post (แปะน้องปัง + headline ลงรูป)")
  let postInputFile = step2File;

  const mode = getPostMode();
  log("PM", `โหมดโพสต์: ${mode === "auto" ? "โพสต์เลย" : "ถามก่อน"}`);

  if (mode === "approve") {
    // === โหมดถามก่อน: แปะสติกเกอร์ก่อน แล้วบันทึก pending ===
    const { writeFileSync, mkdirSync } = require("fs");
    const { join } = require("path");
    const { stampSticker, uploadImage } = require("./post_dept/stamp_sticker");

    // แปะสติกเกอร์ + upload ให้ preview ดูเหมือนโพสต์จริง + เพิ่ม CTA ถ้าไม่มี
    const CTA_TEXT = "ติดตามเพจใหม่เพื่อรับข่าวสารเพิ่มเติมได้ที่นี่ เกมปังv2";
    const contentData = JSON.parse(content.output);
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

      if (rawImageUrl) {
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

  // 7. PM สรุปงาน
  log("PM", "=== งานเสร็จทั้งหมด ปิดประชุม ===");

  const titles = news.data.data?.map((n: any) => n.title).join("\n• ") || "N/A";
  await pmReport(`✅ <b>PM AI Report</b>\n\n📰 ข่าวที่โพสต์:\n• ${titles}\n\n🧠 PM Review: ${reviewDecision.reason}\n📱 Platforms: Facebook + Instagram\n🕐 เวลา: ${ts()}`);
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
