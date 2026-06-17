/**
 * setup_cronjob.ts — สร้าง cron job บน cron-job.org ให้ยิง GitHub workflow_dispatch ทุก 30 นาที
 *
 * ต้องมีใน .env:
 *   CRONJOB_API_KEY = API key จาก console.cron-job.org > Settings > API
 *   GH_DISPATCH_PAT = GitHub fine-grained PAT (Actions: Read and write, repo ai-factory)
 *
 * รัน:  bun scripts/setup_cronjob.ts
 *
 * กันซ้ำ: ถ้ามี job ที่ยิง URL เดียวกันอยู่แล้ว จะไม่สร้างซ้ำ (รายงาน jobId เดิม)
 */

const CRONJOB_API = "https://api.cron-job.org";
const API_KEY = process.env.CRONJOB_API_KEY?.trim();
const PAT = process.env.GH_DISPATCH_PAT?.trim();

const REPO = "PeerapongMala/ai-factory";
const WORKFLOW = "pang-game-pipeline.yml";
const DISPATCH_URL = `https://api.github.com/repos/${REPO}/actions/workflows/${WORKFLOW}/dispatches`;
const JOB_TITLE = "Pang Pipeline (backup trigger)";

function fail(msg: string): never {
  console.error(`\n❌ ${msg}\n`);
  process.exit(1);
}

async function cron(path: string, method: string, body?: any): Promise<any> {
  const res = await fetch(`${CRONJOB_API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json: any = {};
  try { json = text ? JSON.parse(text) : {}; } catch { json = { raw: text }; }
  if (!res.ok) fail(`cron-job.org API ${res.status}: ${text}`);
  return json;
}

async function main() {
  if (!API_KEY) fail("ขาด CRONJOB_API_KEY ใน .env");
  if (!PAT) fail("ขาด GH_DISPATCH_PAT ใน .env");

  console.log("1/3 เช็ค job เดิม (กันสร้างซ้ำ)...");
  const list = await cron("/jobs", "GET");
  const existing = (list.jobs || []).find((j: any) => j.url === DISPATCH_URL || j.title === JOB_TITLE);
  if (existing) {
    console.log(`   ⚠ มี job อยู่แล้ว: jobId=${existing.jobId} "${existing.title}" — ไม่สร้างซ้ำ`);
    console.log(`   ถ้าอยากแก้ ลบตัวเก่าใน console.cron-job.org ก่อนแล้วรันใหม่`);
    return;
  }
  console.log("   ✓ ยังไม่มี — สร้างใหม่ได้");

  console.log("2/3 สร้าง cron job (ยิงทุก 30 นาที :08/:38 เวลาไทย)...");
  const job = {
    job: {
      url: DISPATCH_URL,
      enabled: true,
      title: JOB_TITLE,
      saveResponses: true,
      requestMethod: 1, // POST
      schedule: {
        timezone: "Asia/Bangkok",
        expiresAt: 0,
        hours: [-1],
        mdays: [-1],
        minutes: [8, 38],
        months: [-1],
        wdays: [-1],
      },
      extendedData: {
        headers: {
          Authorization: `Bearer ${PAT}`,
          Accept: "application/vnd.github+json",
          "X-GitHub-Api-Version": "2022-11-28",
          "Content-Type": "application/json",
          "User-Agent": "cron-job.org-pang-trigger",
        },
        body: JSON.stringify({ ref: "main" }),
      },
    },
  };
  const created = await cron("/jobs", "PUT", job);
  const jobId = created.jobId;
  if (!jobId) fail(`สร้างไม่สำเร็จ: ${JSON.stringify(created)}`);
  console.log(`   ✓ สร้างแล้ว jobId=${jobId}`);

  console.log("3/3 ทดสอบยิงทันที 1 ครั้ง...");
  try {
    const testRes = await fetch(`${CRONJOB_API}/jobs/${jobId}/run`, {
      method: "POST",
      headers: { Authorization: `Bearer ${API_KEY}` },
    });
    console.log(`   ${testRes.ok ? "✓ สั่งยิงทดสอบแล้ว (เช็ค GitHub Actions ว่ามี run ใหม่)" : "⚠ สั่งยิงทดสอบไม่ได้ (status " + testRes.status + ") — แต่ตัว cron สร้างสำเร็จแล้ว"}`);
  } catch (e: any) {
    console.log(`   ⚠ ยิงทดสอบไม่ได้: ${e.message} (cron ยังสร้างสำเร็จ)`);
  }

  console.log("\n✅ เสร็จ! cron-job.org จะยิง pipeline ทุก 30 นาที (:08/:38) แม้ปิดเครื่อง");
  console.log(`   จัดการ job ได้ที่ https://console.cron-job.org → jobId=${jobId}`);
}

main();
