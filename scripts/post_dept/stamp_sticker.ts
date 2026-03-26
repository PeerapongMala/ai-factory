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
  const trimmed = text.length > 50 ? text.slice(0, 47) + "..." : text;
  const escaped = trimmed
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

  try {
    return await sharp({
      text: {
        text: `<span foreground="white" font_desc="Sans Bold 40">${escaped}</span>`,
        rgba: true,
        width: maxWidth,
        align: "left",
      }
    }).png().toBuffer();
  } catch {
    // Fallback SVG
    const svg = `<svg width="${maxWidth}" height="80" xmlns="http://www.w3.org/2000/svg">
      <text x="0" y="50" font-family="sans-serif" font-size="40" font-weight="bold"
        fill="white">${escaped}</text>
    </svg>`;
    return Buffer.from(svg);
  }
}

export async function stampSticker(
  imageUrl: string,
  mood: "good" | "fail",
  headline: string,
  filename: string
): Promise<string> {
  const SIZE = 1080;
  const IMAGE_H = Math.round(SIZE * 0.80);  // 864px รูปข่าว
  const BAR_H = SIZE - IMAGE_H;              // 216px แถบดำ

  // 1. ดาวน์โหลดรูปข่าว
  const res = await fetch(imageUrl);
  if (!res.ok) throw new Error(`Download image failed: ${res.status}`);
  const imageBuffer = Buffer.from(await res.arrayBuffer());

  // 2. Resize รูปข่าว → 1080 x 864 (80% บน)
  const photo = await sharp(imageBuffer)
    .resize(SIZE, IMAGE_H, { fit: "cover" })
    .toBuffer();

  // 3. สร้างแถบดำทึบ 1080 x 216 (20% ล่าง)
  const blackBar = await sharp({
    create: { width: SIZE, height: BAR_H, channels: 3, background: { r: 0, g: 0, b: 0 } }
  }).jpeg().toBuffer();

  // 4. Resize สติกเกอร์น้องปัง ให้พอดีแถบดำ
  const stickerSize = BAR_H - 20;  // 196px
  const stickerPath = mood === "good" ? STICKER_GOOD : STICKER_FAIL;
  const sticker = await sharp(stickerPath)
    .resize(stickerSize, stickerSize, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .toBuffer();

  // 5. สร้าง text headline (Pango — รองรับภาษาไทย)
  const textLeft = stickerSize + 30;          // ขวาสติกเกอร์
  const textMaxWidth = SIZE - textLeft - 20;  // เหลือที่ให้ text
  const textBuf = await createTextBuffer(headline, textMaxWidth);
  const textMeta = await sharp(textBuf).metadata();
  const textH = textMeta.height || 60;

  // 6. ต่อรูป + แถบดำ เป็น 1080x1080 แล้ว composite สติกเกอร์ + text
  const outputPath = join(OUTPUT_DIR, filename);

  // สร้าง canvas 1080x1080: รูปบน + ดำล่าง
  const canvas = await sharp({
    create: { width: SIZE, height: SIZE, channels: 3, background: { r: 0, g: 0, b: 0 } }
  })
    .composite([
      { input: photo, left: 0, top: 0 },
    ])
    .jpeg()
    .toBuffer();

  // composite สติกเกอร์ + text ลงบนแถบดำ
  await sharp(canvas)
    .composite([
      // สติกเกอร์ซ้ายล่าง (กลางแถบดำแนวตั้ง)
      { input: sticker, left: 10, top: IMAGE_H + Math.round((BAR_H - stickerSize) / 2) },
      // text ข้างขวาสติกเกอร์ (กลางแถบดำแนวตั้ง)
      { input: textBuf, left: textLeft, top: IMAGE_H + Math.round((BAR_H - textH) / 2) },
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
