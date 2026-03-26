/**
 * สร้างรูปโพสต์สไตล์เพจเกมปัง
 * - รูปข่าวเป็น background
 * - ข้อความหัวข้อข่าวตัวใหญ่ (ล่างรูป)
 * - สติกเกอร์น้องปัง มุมขวาล่าง
 * - good = ข่าวดี/ดีล | fail = ข่าวแย่/เลื่อน/nerf
 */
import sharp from "sharp";
import { join } from "path";
import { existsSync, mkdirSync, readFileSync } from "fs";

const STICKER_GOOD = join(__dirname, "../../assets/sticker Pang good rm bg.png");
const STICKER_FAIL = join(__dirname, "../../assets/sticker Pang fail rm bg.png");
const OUTPUT_DIR = join(__dirname, "../../tmp");

if (!existsSync(OUTPUT_DIR)) mkdirSync(OUTPUT_DIR, { recursive: true });

function createTextSvg(text: string, width: number): Buffer {
  // ตัดข้อความยาวเกินให้เป็นหลายบรรทัด (ไม่เกิน 3 บรรทัด)
  const maxCharsPerLine = 20;
  const words = text.split('');
  const lines: string[] = [];
  let currentLine = '';

  for (const char of words) {
    if (currentLine.length >= maxCharsPerLine && char === ' ') {
      lines.push(currentLine.trim());
      currentLine = '';
      if (lines.length >= 3) break;
    } else {
      currentLine += char;
    }
  }
  if (currentLine.trim() && lines.length < 3) lines.push(currentLine.trim());

  const fontSize = 54;
  const lineHeight = fontSize + 16;
  const textBlockHeight = lines.length * lineHeight + 40;
  const yStart = 20 + fontSize;

  const textLines = lines.map((line, i) => {
    const escaped = line.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    return `<text x="${width / 2}" y="${yStart + i * lineHeight}"
      font-family="sans-serif" font-size="${fontSize}" font-weight="bold"
      fill="white" text-anchor="middle"
      stroke="black" stroke-width="3" paint-order="stroke">${escaped}</text>`;
  }).join('\n');

  const svg = `<svg width="${width}" height="${textBlockHeight}" xmlns="http://www.w3.org/2000/svg">
    ${textLines}
  </svg>`;

  return Buffer.from(svg);
}

export async function stampSticker(
  imageUrl: string,
  mood: "good" | "fail",
  headline: string,
  filename: string
): Promise<string> {
  const SIZE = 1080;

  // 1. ดาวน์โหลดรูปข่าว
  const res = await fetch(imageUrl);
  if (!res.ok) throw new Error(`Download image failed: ${res.status}`);
  const imageBuffer = Buffer.from(await res.arrayBuffer());

  // 2. Resize รูปเป็น 1080x1080
  const base = await sharp(imageBuffer)
    .resize(SIZE, SIZE, { fit: "cover" })
    .toBuffer();

  // 3. สร้าง gradient overlay ด้านล่าง (ให้อ่าน text ง่าย)
  const gradientSvg = Buffer.from(`<svg width="${SIZE}" height="${SIZE}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="black" stop-opacity="0"/>
        <stop offset="50%" stop-color="black" stop-opacity="0"/>
        <stop offset="100%" stop-color="black" stop-opacity="0.85"/>
      </linearGradient>
    </defs>
    <rect width="${SIZE}" height="${SIZE}" fill="url(#g)"/>
  </svg>`);

  // 4. สร้าง text overlay
  const textSvg = createTextSvg(headline, SIZE);
  const textMeta = await sharp(textSvg).metadata();
  const textHeight = textMeta.height || 200;

  // 5. Resize สติกเกอร์
  const stickerSize = 280;
  const stickerPath = mood === "good" ? STICKER_GOOD : STICKER_FAIL;
  const sticker = await sharp(stickerPath)
    .resize(stickerSize, stickerSize, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .toBuffer();

  // 6. Composite ทุกอย่างรวมกัน
  const outputPath = join(OUTPUT_DIR, filename);
  await sharp(base)
    .composite([
      // Gradient overlay
      { input: gradientSvg, left: 0, top: 0 },
      // ข้อความหัวข้อข่าว (ล่างสุด เหนือสติกเกอร์)
      { input: textSvg, left: 0, top: SIZE - textHeight - stickerSize - 20 },
      // สติกเกอร์น้องปัง (มุมซ้ายล่าง)
      { input: sticker, left: 10, top: SIZE - stickerSize - 10 },
    ])
    .jpeg({ quality: 90 })
    .toFile(outputPath);

  return outputPath;
}

// Upload รูปไป 0x0.st (ฟรี ไม่ต้อง key) ได้ URL กลับมา
export async function uploadImage(filePath: string): Promise<string> {
  const { $ } = await import("bun");
  const result = await $`curl -s -X POST "https://0x0.st" -F "file=@${filePath}"`.text();
  const url = result.trim();
  if (!url.startsWith("http")) throw new Error(`Upload failed: ${url}`);
  return url;
}
