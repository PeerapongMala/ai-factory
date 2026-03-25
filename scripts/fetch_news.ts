/**
 * Role: The Researcher & The Summarizer (Memory)
 * Responsibility: Fetch daily news (with fallback), clean HTML, prevent duplicates via Hash, output JSON.
 * Runtime: Bun
 */
import { createHash } from "crypto";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";

interface NewsItem {
  title: string;
  link: string;
  summary: string;
  source: string;
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
                .replace(/\s+/g, ' ')
                .trim();
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

            allNews.push({
              title: cleanHtml(rawTitle),
              link: linkMatch[1].trim(),
              summary: cleanHtml(descMatch ? descMatch[1] : ''),
              source: source.name
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
