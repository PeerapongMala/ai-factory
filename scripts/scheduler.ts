/**
 * Pang Game Company — Auto Scheduler
 * หาข่าว + โพสต์อัตโนมัติทุก 30 นาที ผ่าน PM
 *
 * ใช้: bun run scripts/scheduler.ts
 */
import { $ } from "bun";

const INTERVAL_MINUTES = 30;
const INTERVAL_MS = INTERVAL_MINUTES * 60 * 1000;

function ts(): string {
  return new Date().toLocaleString("th-TH", { timeZone: "Asia/Bangkok" });
}

async function runPipeline() {
  console.log(`\n${"=".repeat(50)}`);
  console.log(`[${ts()}] PM เริ่มสั่งงาน...`);
  console.log(`${"=".repeat(50)}\n`);

  try {
    const result = await $`bun run scripts/pm.ts`.text();
    console.log(result);
    console.log(`[${ts()}] Pipeline เสร็จ — รอรอบถัดไป ${INTERVAL_MINUTES} นาที\n`);
  } catch (error: any) {
    console.error(`[${ts()}] Pipeline error: ${error.message}`);
  }
}

// === เริ่ม Scheduler ===
console.log(`PANG GAME COMPANY — Auto Scheduler`);
console.log(`รันทุก ${INTERVAL_MINUTES} นาที`);
console.log(`เริ่มที่: ${ts()}\n`);

// รันทันทีรอบแรก
await runPipeline();

// แล้วรันทุก 30 นาที
setInterval(runPipeline, INTERVAL_MS);
