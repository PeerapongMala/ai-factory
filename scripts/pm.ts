/**
 * Role: The PM (Project Manager)
 * ศูนย์กลางสั่งงาน รับรายงาน แก้ปัญหา
 * พนักงานทุกคนรายงานตรงกับ PM เท่านั้น ไม่ต้องรู้จักกัน
 */
import { $ } from "bun";

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

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

// ===== PM เริ่มทำงาน =====
async function pmRun() {
  log("PM", "=== เริ่มประชุมเช้า ===");

  // 1. สั่ง นักข่าว ไปหาข่าว
  const news = await assignWork("นักข่าว", "scripts/fetch_news.ts");
  if (!news.success) {
    log("PM", "ไม่มีข่าวใหม่ ปิดประชุม รอรอบถัดไป");
    return;
  }

  const newsCount = news.data.data?.length || 0;
  log("PM", `นักข่าวหาข่าวได้ ${newsCount} ข่าว`);

  // เซฟ output ไว้ส่งต่อ
  const step1File = "/tmp/pm_step1.json";
  await Bun.write(step1File, news.output);

  // 2. สั่ง นักเขียน เขียน content (ให้ PM retry ถ้าโดน rate limit)
  const content = await assignWithRetry("นักเขียน", "scripts/process_content.ts", step1File, 3);
  if (!content.success) {
    log("PM", "นักเขียนทำงานไม่ได้ PM ตัดสินใจ: แจ้ง Telegram แล้วรอรอบถัดไป");
    await pmReport(`⚠️ <b>PM Report</b>\n\nนักเขียนทำงานไม่ได้\nเหตุผล: ${content.data?.error || "unknown"}\nเวลา: ${ts()}`);
    return;
  }

  const step2File = "/tmp/pm_step2.json";
  await Bun.write(step2File, content.output);

  // 3. สั่ง ตรวจสอบ (Guardian) - เช็คว่า content ถูกต้อง
  // Guardian ตรวจอยู่ใน fetch_news แล้ว (hash + 24h) PM แค่ log
  log("ตรวจสอบ", "hash ไม่ซ้ำ + ข่าวไม่เกิน 24 ชม. ผ่าน (ตรวจตั้งแต่ขั้นนักข่าว)");

  // 4. สั่ง กราฟิก render ภาพ
  const render = await assignWork("กราฟิก", "scripts/post_dept/render_static.ts", step2File);
  if (!render.success) {
    log("PM", "กราฟิกทำภาพไม่ได้ PM ตัดสินใจ: แจ้ง Telegram");
    await pmReport(`⚠️ <b>PM Report</b>\n\nกราฟิกทำภาพไม่ได้\nเหตุผล: ${render.data?.error || "unknown"}\nเวลา: ${ts()}`);
    return;
  }

  const step3File = "/tmp/pm_step3.json";
  await Bun.write(step3File, render.output);

  // 5. สั่ง โพสต์ ลง FB + IG
  const post = await assignWork("โพสต์", "scripts/post_dept/social_post.ts", step3File);
  if (!post.success) {
    log("PM", "โพสต์ไม่สำเร็จ PM ตัดสินใจ: แจ้ง Telegram");
    await pmReport(`⚠️ <b>PM Report</b>\n\nโพสต์ FB/IG ไม่สำเร็จ\nเหตุผล: ${post.data?.error || "unknown"}\nเวลา: ${ts()}`);
    return;
  }

  // 6. PM สรุปงาน
  log("PM", "=== งานเสร็จทั้งหมด ปิดประชุม ===");

  const titles = news.data.data?.map((n: any) => n.title).join("\n• ") || "N/A";
  await pmReport(`✅ <b>PM Report - สำเร็จ!</b>\n\n📰 ข่าวที่โพสต์:\n• ${titles}\n\n📱 Platforms: Facebook + Instagram\n🕐 เวลา: ${ts()}`);
}

pmRun();
