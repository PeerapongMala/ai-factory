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
import { execSync } from "child_process";

const STICKER_GOOD = join(__dirname, "../../assets/sticker Pang good rm bg.png");
const STICKER_FAIL = join(__dirname, "../../assets/sticker Pang fail rm bg.png");
const DEFAULT_BG = join(__dirname, "../../assets/Pang game.png"); // ภาพแบรนด์น้องปัง ใช้เป็น default เมื่อข่าวไม่มีรูป
const OUTPUT_DIR = join(__dirname, "../../tmp");

if (!existsSync(OUTPUT_DIR)) mkdirSync(OUTPUT_DIR, { recursive: true });

// ติดตั้ง font ไทยให้ fontconfig + Pango หาเจอ (Railway)
const FONTS_DIR = join(__dirname, "../../assets/fonts");
try {
  if (process.platform === "linux") {
    // copy fonts ไปหลายที่เพื่อให้ libvips/pango หาเจอ
    const fontDirs = ["/usr/share/fonts/truetype/custom", "/usr/local/share/fonts", join(process.env.HOME || "/root", ".fonts")];
    for (const d of fontDirs) {
      execSync(`mkdir -p "${d}" && cp -f ${FONTS_DIR}/*.ttf "${d}/" 2>/dev/null || true`, { timeout: 5000 });
    }
    execSync("fc-cache -fv 2>/dev/null || true", { timeout: 10000 });
    const fonts = execSync("fc-list :lang=th 2>/dev/null || echo 'no Thai fonts'", { timeout: 5000 }).toString().trim();
    console.log(`[Font] Thai fonts: ${fonts.includes("Noto") || fonts.includes("Thai") ? "OK" : fonts}`);
    // Debug: vips version + text support
    try {
      const vipsInfo = execSync("vips --version 2>/dev/null || echo 'no vips'", { timeout: 3000 }).toString().trim();
      console.log(`[Font] vips: ${vipsInfo}`);
    } catch {}
  }
} catch (e: any) { console.log("[Font] Setup error:", e.message); }

export async function createTextBuffer(text: string, maxWidth: number, maxHeight = 250): Promise<Buffer> {
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

  // ย่อขนาดฟอนต์ลงทีละสเต็ปจนข้อความ "พอดีกล่อง" ทั้งแนวนอนและแนวตั้ง
  // - width + wrap:"word-char" → ตัดบรรทัดได้แม้ภาษาไทยที่ไม่มีเว้นวรรค (กันล้นออกขอบขวา)
  // - วัดความสูงจริง ถ้ายังเกิน maxHeight ค่อยลดฟอนต์ (กันล้นลงไปทับรูป)
  let last: Buffer | null = null;
  for (const size of [64, 56, 50, 44, 38, 33, 28]) {
    try {
      const buf = await sharp({
        text: {
          text: `<span foreground="white" font_desc="Sans Bold ${size}">${escaped}</span>`,
          rgba: true,
          width: maxWidth,
          align: "left",
          wrap: "word-char",
        } as any
      }).png().toBuffer();
      const h = (await sharp(buf).metadata()).height || 0;
      last = buf;
      if (h <= maxHeight) return buf;
    } catch {
      break; // libvips text ใช้ไม่ได้ → ไป fallback SVG
    }
  }
  if (last) return last; // ยาวจริงๆ จนฟอนต์เล็กสุดก็ยังเกิน → ใช้ตัวเล็กสุดที่ได้ (ดีกว่าโยน error)

  // Fallback SVG (กรณี libvips text ใช้ไม่ได้เลย)
  const trimmed = text.length > 60 ? text.slice(0, 57) + "..." : text;
  const esc2 = trimmed.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const svg = `<svg width="${maxWidth}" height="160" xmlns="http://www.w3.org/2000/svg">
      <text x="0" y="70" font-family="sans-serif" font-size="56" font-weight="bold"
        fill="white">${esc2}</text>
    </svg>`;
  return await sharp(Buffer.from(svg)).png().toBuffer();
}

/** สร้าง overlay text สำหรับแถบดำ — headline ใหญ่ + summary เล็กกว่า */
async function createOverlayText(headline: string, summary: string, maxWidth: number): Promise<Buffer> {
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  const headEsc = esc(headline);
  const sumEsc = esc(summary);

  try {
    // ตัด summary ให้สั้น (max 60 ตัวอักษร)
    const shortSum = sumEsc.length > 60 ? sumEsc.slice(0, 57) + '...' : sumEsc;
    const pango = `<span foreground="white" font_desc="Sans Bold 64">${headEsc}</span>\n<span foreground="#cccccc" font_desc="Sans 40">${shortSum}</span>`;
    const textBuf = await sharp({
      text: {
        text: pango,
        rgba: true,
        width: maxWidth,
        align: "left",
        wrap: "word-char",
      } as any
    }).png().toBuffer();
    return textBuf;
  } catch {
    // Fallback: headline only
    return createTextBuffer(headline, maxWidth);
  }
}

export async function stampSticker(
  imageUrl: string | null | undefined,
  mood: "good" | "fail",
  headline: string,
  filename: string,
  summary?: string
): Promise<string> {
  const SIZE = 1080;
  const BAR_H = 300;                         // แถบดำ — headline only (เนื้อหาอยู่ใน caption)
  const IMAGE_H = SIZE - BAR_H;              // รูปข่าวส่วนที่เหลือ

  // 1. ดาวน์โหลดรูปข่าว — ไม่มี/โหลดไม่ได้ → ใช้ภาพแบรนด์น้องปังเป็น default (กันโพสต์ไม่มีรูป)
  let imageBuffer: Buffer;
  try {
    if (!imageUrl) throw new Error("ไม่มี URL รูปข่าว");
    const res = await fetch(imageUrl);
    if (!res.ok) throw new Error(`โหลดรูปไม่ได้ ${res.status}`);
    imageBuffer = Buffer.from(await res.arrayBuffer());
  } catch (e: any) {
    console.error(`[Image] ใช้ภาพแบรนด์ default — ${e.message}`);
    imageBuffer = readFileSync(DEFAULT_BG);
  }

  // 2. รูปข่าว: โชว์ "เต็มภาพ" ไม่ครอปขอบ/ตัวละคร/ข้อความขาด (fit:inside = ทั้งภาพต้องอยู่ในกรอบ)
  //    เติมที่ว่างด้วยภาพเดียวกันแบบเบลอ+หรี่ → ไม่มีแถบดำน่าเกลียด ดูโปร
  const bg = await sharp(imageBuffer)
    .resize(SIZE, IMAGE_H, { fit: "cover" })
    .blur(30)
    .modulate({ brightness: 0.5 })
    .toBuffer();
  const fg = await sharp(imageBuffer)
    .resize(SIZE, IMAGE_H, { fit: "inside" })
    .toBuffer();
  const fgMeta = await sharp(fg).metadata();
  const photo = await sharp(bg)
    .composite([{
      input: fg,
      left: Math.round((SIZE - (fgMeta.width || SIZE)) / 2),
      top: Math.round((IMAGE_H - (fgMeta.height || IMAGE_H)) / 2),
    }])
    .toBuffer();

  // 3. Resize สติกเกอร์น้องปัง — วางซ้ายล่าง ใหญ่ขึ้น
  const stickerSize = Math.min(BAR_H - 20, 320);
  const stickerPath = mood === "good" ? STICKER_GOOD : STICKER_FAIL;
  const sticker = await sharp(stickerPath)
    .resize(stickerSize, stickerSize, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .toBuffer();

  // 4. สร้าง text overlay — สติกเกอร์ซ้าย text ขวา
  const stickerPadLeft = 10;
  const stickerW = stickerSize + stickerPadLeft + 10;
  const textPadLeft = stickerW + 10;
  const textMaxWidth = SIZE - textPadLeft - 20;

  // headline ตัวหนาอย่างเดียว — เนื้อหาอยู่ใน caption
  let textBuf: Buffer = await createTextBuffer(headline, textMaxWidth);
  const textMeta = await sharp(textBuf).metadata();
  const textH = textMeta.height || 60;

  // 5. ต่อรูป + แถบดำ + สติกเกอร์ + text
  const outputPath = join(OUTPUT_DIR, filename);

  await sharp({
    create: { width: SIZE, height: SIZE, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 255 } }
  })
    .composite([
      { input: photo, left: 0, top: 0 },
      // สติกเกอร์ซ้ายล่าง
      { input: sticker, left: stickerPadLeft, top: IMAGE_H + Math.round((BAR_H - stickerSize) / 2) },
      // text ขวาของสติกเกอร์ (กลางแถบดำแนวตั้ง)
      { input: textBuf, left: textPadLeft, top: IMAGE_H + Math.round((BAR_H - textH) / 2) },
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
