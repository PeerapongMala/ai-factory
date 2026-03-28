/**
 * สร้างรูปโพสต์สไตล์เพจเกมปัง
 * - รูปข่าว 80% บน
 * - แถบดำทึบ 20% ล่าง ใส่สติกเกอร์ + headline
 * - สติกเกอร์น้องปัง ซ้ายล่าง
 * - good = ข่าวดี/ดีล | fail = ข่าวแย่/เลื่อน/nerf
 */
import sharp from "sharp";
import { join } from "path";
import { existsSync, mkdirSync, readFileSync } from "fs";

const STICKER_GOOD = join(__dirname, "../../assets/sticker Pang good rm bg.png");
const STICKER_FAIL = join(__dirname, "../../assets/sticker Pang fail rm bg.png");
const OUTPUT_DIR = join(__dirname, "../../tmp");

if (!existsSync(OUTPUT_DIR)) mkdirSync(OUTPUT_DIR, { recursive: true });

async function createTextBuffer(text: string, maxWidth: number): Promise<Buffer> {
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

  try {
    const textBuf = await sharp({
      text: {
        text: `<span foreground="white" font_desc="Sans Bold 48">${escaped}</span>`,
        rgba: true,
        width: maxWidth,
        align: "left",
      }
    }).png().toBuffer();

    return textBuf;
  } catch {
    // Fallback SVG → แปลงเป็น PNG ผ่าน sharp
    const trimmed = text.length > 60 ? text.slice(0, 57) + "..." : text;
    const esc2 = trimmed.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const svg = `<svg width="${maxWidth}" height="120" xmlns="http://www.w3.org/2000/svg">
      <text x="0" y="50" font-family="sans-serif" font-size="48" font-weight="bold"
        fill="white">${esc2}</text>
    </svg>`;
    return await sharp(Buffer.from(svg)).png().toBuffer();
  }
}

/** สร้าง overlay text สำหรับแถบดำ — headline ใหญ่ + summary เล็กกว่า */
async function createOverlayText(headline: string, summary: string, maxWidth: number): Promise<Buffer> {
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  const headEsc = esc(headline);
  const sumEsc = esc(summary);

  try {
    // ตัด summary ให้สั้น (max 80 ตัวอักษร)
    const shortSum = sumEsc.length > 80 ? sumEsc.slice(0, 77) + '...' : sumEsc;
    const pango = `<span foreground="white" font_desc="Sans Bold 48">${headEsc}</span>\n<span foreground="#cccccc" font_desc="Sans 32">${shortSum}</span>`;
    const textBuf = await sharp({
      text: {
        text: pango,
        rgba: true,
        width: maxWidth,
        align: "left",
      }
    }).png().toBuffer();
    return textBuf;
  } catch {
    // Fallback: headline only
    return createTextBuffer(headline, maxWidth);
  }
}

export async function stampSticker(
  imageUrl: string,
  mood: "good" | "fail",
  headline: string,
  filename: string,
  summary?: string
): Promise<string> {
  const SIZE = 1080;
  const BAR_H = summary ? 300 : 216;         // แถบดำใหญ่ขึ้นถ้ามี summary
  const IMAGE_H = SIZE - BAR_H;              // รูปข่าวส่วนที่เหลือ

  // 1. ดาวน์โหลดรูปข่าว
  const res = await fetch(imageUrl);
  if (!res.ok) throw new Error(`Download image failed: ${res.status}`);
  const imageBuffer = Buffer.from(await res.arrayBuffer());

  // 2. Resize รูปข่าว
  const photo = await sharp(imageBuffer)
    .resize(SIZE, IMAGE_H, { fit: "cover" })
    .toBuffer();

  // 3. Resize สติกเกอร์น้องปัง — วางขวาล่าง
  const stickerSize = Math.min(BAR_H - 20, 220);
  const stickerPath = mood === "good" ? STICKER_GOOD : STICKER_FAIL;
  const sticker = await sharp(stickerPath)
    .resize(stickerSize, stickerSize, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .toBuffer();

  // 4. สร้าง text overlay (headline สีทอง + summary สีขาว ถ้ามี)
  const textPadLeft = 30;
  const stickerW = stickerSize + 20;
  const textMaxWidth = SIZE - textPadLeft - stickerW - 10;

  let textBuf: Buffer;
  if (summary) {
    textBuf = await createOverlayText(headline, summary, textMaxWidth);
  } else {
    textBuf = await createTextBuffer(headline, textMaxWidth);
  }
  const textMeta = await sharp(textBuf).metadata();
  const textH = textMeta.height || 60;

  // 5. ต่อรูป + แถบดำ + สติกเกอร์ + text
  const outputPath = join(OUTPUT_DIR, filename);

  await sharp({
    create: { width: SIZE, height: SIZE, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 255 } }
  })
    .composite([
      { input: photo, left: 0, top: 0 },
      // text ซ้าย (กลางแถบดำแนวตั้ง)
      { input: textBuf, left: textPadLeft, top: IMAGE_H + Math.round((BAR_H - textH) / 2) },
      // สติกเกอร์ขวาล่าง
      { input: sticker, left: SIZE - stickerSize - 10, top: IMAGE_H + Math.round((BAR_H - stickerSize) / 2) },
    ])
    .jpeg({ quality: 90 })
    .toFile(outputPath);

  return outputPath;
}

// Upload รูป — ลองหลายที่จนสำเร็จ
export async function uploadImage(filePath: string): Promise<string> {
  const { readFileSync } = await import("fs");
  const imageData = readFileSync(filePath);

  // 1. ลอง imgbb (ฟรี)
  try {
    const base64 = imageData.toString("base64");
    const form = new URLSearchParams();
    form.append("key", "a8be3e0dff3cbbb0c4a1f05a85a81d33"); // free anonymous key
    form.append("image", base64);
    const res = await fetch("https://api.imgbb.com/1/upload", {
      method: "POST",
      body: form,
    });
    const data = await res.json() as any;
    if (data.success) return data.data.url;
  } catch {}

  // 2. ลอง freeimage.host (ฟรี)
  try {
    const base64 = imageData.toString("base64");
    const form = new URLSearchParams();
    form.append("key", "6d207e02198a847aa98d0a2a901485a5");
    form.append("source", base64);
    form.append("format", "json");
    const res = await fetch("https://freeimage.host/api/1/upload", {
      method: "POST",
      body: form,
    });
    const data = await res.json() as any;
    if (data.status_code === 200) return data.image.url;
  } catch {}

  // 3. Fallback: serve จาก local server
  throw new Error("Upload failed: ไม่สามารถอัปโหลดรูปได้");
}
