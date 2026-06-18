/**
 * Role: The Researcher & The Summarizer (Memory)
 * Responsibility: Fetch daily news (with fallback), clean HTML, prevent duplicates via Hash, output JSON.
 * Runtime: Bun
 */
import { createHash } from "crypto";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join, dirname } from "path";

interface NewsItem {
  title: string;
  link: string;
  summary: string;
  source: string;
  image?: string;
}

interface ResearcherOutput {
  status: 'SUCCESS' | 'FAILED';
  role: 'Researcher';
  data: NewsItem[] | null;
  error?: string;
  timestamp: string;
}

const HASH_LOG_PATH = join(__dirname, "../logs/processed_hashes.json");

const NEWS_SOURCES = [
  // เว็บไทย
  { name: 'GamingDose', url: 'https://www.gamingdose.com/feed/' },
  { name: '4Gamers Thailand', url: 'https://www.4gamers.co.th/rss' },
  { name: 'COMPGAMER', url: 'https://compgamer.com/feed/' },
  // เว็บนอก (เร็ว + exclusive)
  { name: 'VGC', url: 'https://www.videogameschronicle.com/feed' },
  { name: 'Wccftech', url: 'https://wccftech.com/feed/' }
];

function getProcessedHashes(): Set<string> {
  if (existsSync(HASH_LOG_PATH)) {
    try {
      const arr = JSON.parse(readFileSync(HASH_LOG_PATH, "utf8"));
      return new Set(arr);
    } catch(e) {}
  }
  return new Set();
}

function saveProcessedHashes(hashSet: Set<string>) {
  const arr = Array.from(hashSet).slice(-1000); // Keep last 1000 logs
  mkdirSync(dirname(HASH_LOG_PATH), { recursive: true }); // runner สด ๆ ไม่มี logs/ → ENOENT
  writeFileSync(HASH_LOG_PATH, JSON.stringify(arr, null, 2));
}

function generateHash(text: string): string {
  return createHash("md5").update(text).digest("hex");
}

function cleanHtml(htmlStr: string): string {
  if (!htmlStr) return '';
  return htmlStr.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
                .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
                .replace(/<[^>]*>?/gm, ' ')
                .replace(/&nbsp;/g, ' ')
                .replace(/&#160;/g, ' ')
                .replace(/\s+/g, ' ')
                .trim();
}

// ตัดย่อหน้าที่เป็นเมนู/boilerplate ออก (ไม่ใช่เนื้อข่าว)
const BOILER = /(dark mode|latest news|advertise|careers|subscribe|cookie|sign ?up|log ?in|all rights|powered by|read more|share this|related|tags:|support|about us|contact|\[email)/i;

/**
 * ดึง "เนื้อหาเต็ม" จากหน้าข่าวจริง (ไม่ใช่แค่ excerpt สั้นๆ ใน RSS)
 * → นักเขียนจะได้รายละเอียดครบ (ชื่อเกม/วันที่/แพลตฟอร์ม) ไม่เขียนลอยๆ เช่น "4 เกม" แต่ไม่บอกชื่อ
 * ล้มเหลว/ช้า → คืน "" แล้วใช้ RSS summary แทน (ไม่ทำให้ pipeline พัง)
 */
async function fetchArticleText(link: string): Promise<string> {
  try {
    const res = await fetch(link, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; PangBot/1.0)" },
      redirect: "follow",
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return '';
    const html = await res.text();
    const stripped = html.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '');
    const scope = stripped.match(/<article[^>]*>([\s\S]*?)<\/article>/i)?.[1] || stripped;
    const paras = [...scope.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)]
      .map(m => cleanHtml(m[1]))
      .filter(t => t.length > 50 && !BOILER.test(t));
    let text = [...new Set(paras)].join(' ').trim();
    // เนื้อบางไป → เสริมด้วย og:description (clean เสมอ)
    const og = stripped.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i)?.[1];
    if (og && cleanHtml(og).length > text.length) text = cleanHtml(og);
    return text.slice(0, 1600).trim();
  } catch {
    return '';
  }
}

async function fetchNews(): Promise<ResearcherOutput> {
  try {
    const allNews: NewsItem[] = [];
    const hashLog = getProcessedHashes();
    let latestHashes = new Set(hashLog);

    for (const source of NEWS_SOURCES) {
      if (allNews.length >= 2) break; // Limit top news overall to save Tokens

      try {
        const response = await fetch(source.url);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        
        const textData = await response.text();
        const itemRegex = /<item>([\s\S]*?)<\/item>/g;
        const titleRegex = /<title>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/title>/;
        const linkRegex = /<link>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/link>/;
        const descRegex = /<description>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/description>/;
        const pubDateRegex = /<pubDate>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/pubDate>/;

        let match;
        while ((match = itemRegex.exec(textData)) !== null) {
          if (allNews.length >= 2) break; // We just need 1-2 viral hits per execution

          const itemXml = match[1];
          const titleMatch = titleRegex.exec(itemXml);
          const linkMatch = linkRegex.exec(itemXml);
          const descMatch = descRegex.exec(itemXml);

          if (titleMatch && linkMatch) {
            const rawTitle = titleMatch[1].trim();
            const newsHash = generateHash(rawTitle);

            // [Summarizer Logic]: Prevent Duplicate Run
            if (hashLog.has(newsHash)) {
              continue; // Skip already made clipping
            }

            // [Guardian Logic]: Skip news older than 24 hours
            const pubDateMatch = pubDateRegex.exec(itemXml);
            if (pubDateMatch) {
              const pubDate = new Date(pubDateMatch[1].trim());
              const ageMs = Date.now() - pubDate.getTime();
              const MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours
              if (ageMs > MAX_AGE_MS) {
                continue; // Skip old news
              }
            }

            // ดึงรูปจาก RSS (ลอง 4 แหล่ง)
            let image: string | undefined;
            // 1. <media:content url="...">
            const mediaMatch = itemXml.match(/<media:content[^>]+url=["']([^"']+)["']/);
            if (mediaMatch) image = mediaMatch[1];
            // 2. <enclosure url="..." type="image/...">
            if (!image) {
              const encMatch = itemXml.match(/<enclosure[^>]+url=["']([^"']+)["'][^>]*type=["']image[^"']*/);
              if (encMatch) image = encMatch[1];
            }
            // 3. <media:thumbnail url="...">
            if (!image) {
              const thumbMatch = itemXml.match(/<media:thumbnail[^>]+url=["']([^"']+)["']/);
              if (thumbMatch) image = thumbMatch[1];
            }
            // 4. <img src="..."> ใน description
            if (!image && descMatch) {
              const imgMatch = descMatch[1].match(/<img[^>]+src=["']([^"']+)["']/);
              if (imgMatch) image = imgMatch[1];
            }

            const link = linkMatch[1].trim();
            const rssSummary = cleanHtml(descMatch ? descMatch[1] : '');
            // ดึงเนื้อหาเต็มจากหน้าข่าวจริง → นักเขียนได้รายละเอียดครบ (ชื่อเกม/วันที่/แพลตฟอร์ม)
            // เนื้อหาเต็มยาวกว่า excerpt → ใช้แทน, ถ้าดึงไม่ได้ค่อย fallback กลับ RSS summary
            const articleText = await fetchArticleText(link);
            const summary = (articleText && articleText.length > rssSummary.length) ? articleText : rssSummary;

            allNews.push({
              title: cleanHtml(rawTitle),
              link,
              summary,
              source: source.name,
              image
            });

            latestHashes.add(newsHash);
          }
        }
      } catch (err: any) {
         // [Fallback Logic]: If source fails, script continues to next source in array
      }
    }

    if (allNews.length === 0) {
      throw new Error(`[Guardian Alert] No NEW viral news found across all sources.`);
    }

    // Save newly generated hashes
    saveProcessedHashes(latestHashes);

    return {
      status: 'SUCCESS',
      role: 'Researcher',
      data: allNews,
      timestamp: new Date().toISOString()
    };

  } catch (error: any) {
    return {
      status: 'FAILED',
      role: 'Researcher',
      data: null,
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
}

fetchNews().then(output => {
  console.log(JSON.stringify(output, null, 2));
});
