/**
 * setup_fb_token.ts — แปลง token สั้นจาก Graph API Explorer ให้เป็น Page Token ไม่หมดอายุ
 *
 * ต้องมีใน .env ก่อนรัน 3 ค่า:
 *   FB_APP_ID       = App ID ของแอพ "Pang Game Bot" (การตั้งค่าแอพ > พื้นฐาน)
 *   FB_APP_SECRET   = App Secret (กด "แสดง" แล้วใส่รหัส Facebook)
 *   FB_SHORT_TOKEN  = User Token สั้น ๆ จาก Graph API Explorer (มี 5 permissions)
 *
 * รัน:  bun scripts/setup_fb_token.ts
 *
 * ทำงาน: short user token → long-lived user token → page token (ไม่หมดอายุ) → IG id
 * แล้วเขียน FB_PAGE_TOKEN / FB_PAGE_ID / IG_USER_ID กลับลง .env ให้อัตโนมัติ
 */

import { readFileSync, writeFileSync } from "fs";
import { join } from "path";

const GRAPH = "https://graph.facebook.com/v19.0";
const ENV_PATH = join(import.meta.dir, "..", ".env");

const APP_ID = process.env.FB_APP_ID?.trim();
const APP_SECRET = process.env.FB_APP_SECRET?.trim();
const SHORT_TOKEN = process.env.FB_SHORT_TOKEN?.trim();
const EXISTING_PAGE_ID = process.env.FB_PAGE_ID?.trim();

function fail(msg: string): never {
  console.error(`\n❌ ${msg}\n`);
  process.exit(1);
}

function mask(token: string): string {
  return token.length > 14 ? `${token.slice(0, 8)}…${token.slice(-4)} (${token.length} ตัว)` : "***";
}

async function api(path: string): Promise<any> {
  const res = await fetch(`${GRAPH}${path}`);
  const json = await res.json();
  if (json.error) fail(`Graph API: ${json.error.message} (code ${json.error.code})`);
  return json;
}

/** อัปเดต/เพิ่ม key ใน .env โดยไม่ทับบรรทัดอื่น */
function upsertEnv(updates: Record<string, string>) {
  let lines = readFileSync(ENV_PATH, "utf8").split(/\r?\n/);
  for (const [key, value] of Object.entries(updates)) {
    const idx = lines.findIndex((l) => l.startsWith(`${key}=`));
    if (idx >= 0) lines[idx] = `${key}=${value}`;
    else lines.push(`${key}=${value}`);
  }
  writeFileSync(ENV_PATH, lines.join("\n"), "utf8");
}

async function main() {
  if (!APP_ID || !APP_SECRET || !SHORT_TOKEN) {
    fail("ขาดค่าใน .env — ต้องมี FB_APP_ID, FB_APP_SECRET, FB_SHORT_TOKEN ครบทั้ง 3");
  }

  console.log("1/4 แลก token สั้น → token ยาว (60 วัน)...");
  const longLived = await api(
    `/oauth/access_token?grant_type=fb_exchange_token` +
      `&client_id=${APP_ID}&client_secret=${APP_SECRET}&fb_exchange_token=${SHORT_TOKEN}`
  );
  const userToken: string = longLived.access_token;
  if (!userToken) fail("แลก long-lived token ไม่ได้");
  console.log(`   ✓ ได้ user token ยาว: ${mask(userToken)}`);

  console.log("2/4 ดึงรายชื่อเพจ + page token (ไม่หมดอายุ)...");
  const accounts = await api(`/me/accounts?fields=id,name,access_token&access_token=${userToken}`);
  const pages: any[] = accounts.data || [];
  if (pages.length === 0) fail("ไม่เจอเพจที่ token นี้จัดการได้ — เช็คว่า generate token แล้วเลือกเพจเกมปังv2 + ติ๊ก permission ครบ");

  console.log(`   เจอ ${pages.length} เพจ:`);
  pages.forEach((p) => console.log(`     - ${p.name} (id=${p.id})`));

  // เลือกเพจ: ตรงกับ FB_PAGE_ID เดิม > ชื่อมี "ปัง" > เพจแรก
  const page =
    pages.find((p) => p.id === EXISTING_PAGE_ID) ||
    pages.find((p) => /ปัง|pang/i.test(p.name)) ||
    pages[0];
  console.log(`   ✓ ใช้เพจ: ${page.name} (id=${page.id})`);

  const pageToken: string = page.access_token;
  const pageId: string = page.id;

  console.log("3/4 หา Instagram business account ที่ผูกกับเพจ...");
  let igId = "";
  const igRes = await api(`/${pageId}?fields=instagram_business_account&access_token=${pageToken}`);
  if (igRes.instagram_business_account?.id) {
    igId = igRes.instagram_business_account.id;
    console.log(`   ✓ IG business account: ${igId}`);
  } else {
    console.log("   ⚠ ไม่เจอ IG business account (เพจยังไม่ผูก IG Professional) — ข้าม IG ไปก่อน โพสต์ FB ได้ปกติ");
  }

  console.log("4/4 เขียนกลับ .env...");
  const updates: Record<string, string> = {
    FB_PAGE_TOKEN: pageToken,
    FB_PAGE_ID: pageId,
  };
  if (igId) updates.IG_USER_ID = igId;
  upsertEnv(updates);

  console.log("\n✅ เสร็จ! เขียนลง .env แล้ว:");
  console.log(`   FB_PAGE_ID    = ${pageId}`);
  console.log(`   FB_PAGE_TOKEN = ${mask(pageToken)}`);
  console.log(`   IG_USER_ID    = ${igId || "(ไม่มี — โพสต์ FB อย่างเดียว)"}`);
  console.log("\nขั้นต่อไป: ดัน 3 ค่านี้ขึ้น GitHub secrets (Claude จะจัดให้)");
}

main();
