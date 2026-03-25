import { GoogleGenerativeAI } from "@google/generative-ai";
import { readFileSync, existsSync, readdirSync } from "fs";
import { join, extname } from "path";

// Load Environment Variables
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const PEXELS_API_KEY = process.env.PEXELS_API_KEY;

if (!GEMINI_API_KEY || !PEXELS_API_KEY) {
  console.error(JSON.stringify({ status: "FAILED", role: "Researcher(Visuals)", error: "Missing GEMINI_API_KEY or PEXELS_API_KEY" }, null, 2));
  process.exit(1);
}

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 30_000;

async function callWithRetry(fn: () => Promise<any>): Promise<any> {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      const is429 = err.message?.includes("429") || err.message?.includes("quota");
      if (is429 && attempt < MAX_RETRIES) {
        console.error(`[Guardian] Rate limited. Retry ${attempt}/${MAX_RETRIES} in ${RETRY_DELAY_MS / 1000}s...`);
        await Bun.sleep(RETRY_DELAY_MS);
        continue;
      }
      throw err;
    }
  }
}

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
const model = genAI.getGenerativeModel({
  model: "gemini-2.0-flash",
  generationConfig: {
    responseMimeType: "application/json"
  }
});

async function run() {
  try {
    // 1. Read JSON Input (from text_to_speech.ts output)
    let inputStr = "";
    if (process.argv.length > 2) {
      inputStr = readFileSync(process.argv[2], "utf8");
    } else {
      inputStr = await Bun.stdin.text();
    }

    if (!inputStr.trim()) {
      throw new Error("No input data received.");
    }

    const inputData = JSON.parse(inputStr);

    if (inputData.status === "FAILED" || !inputData.data || inputData.data.length === 0) {
       console.log(JSON.stringify({ 
         status: "SKIPPED", 
         role: "Researcher(Visuals)", 
         msg: "No valid audio payload to process." 
       }, null, 2));
       return;
    }

    const results = [];

    // 2. Process each AI Script
    for (const item of inputData.data) {
        const scriptJson = item.generated_script;
        const fullScriptText = `${scriptJson.hook || ''} ${scriptJson.body || ''} ${scriptJson.cta || ''}`;

        let keyword = "abstract technology"; // Safety fallback
        let pexelsVideos = [];

        if (fullScriptText) {
            // Use Gemini to extract a highly relevant broad English keyword for Pexels search representing gaming culture
            const prompt = `Analyze this Gaming News short-video script. Since specific game names don't exist in stock footage API, extract EXACTLY ONE highly descriptive "Gaming Culture" or "Cyberpunk" English keyword (max 2 words) to use as a background video search query on Pexels (e.g. "Gaming PC setup", "Professional gamer", "Cyberpunk city", "Playstation controller", "Neon keyboard"). Do not use specific game titles. Output strict JSON: { "keyword": "your_word" }\n\nScript: ${fullScriptText}`;
            
            try {
                const result = await callWithRetry(() => model.generateContent(prompt));
                const outputJson = JSON.parse(result.response.text());
                if (outputJson.keyword) {
                    keyword = outputJson.keyword;
                }
            } catch (e) {
                // Ignore AI hallucination, fallback keyword remains
            }
        }

        // Fetch 3 Portrait videos from Pexels using the extracted keyword
        const pexelsRes = await fetch(`https://api.pexels.com/videos/search?query=${encodeURIComponent(keyword)}&orientation=portrait&per_page=3`, {
            headers: {
                'Authorization': PEXELS_API_KEY
            }
        });

        if (pexelsRes.ok) {
            const pexelsData = await pexelsRes.json();
            if (pexelsData.videos && pexelsData.videos.length > 0) {
                pexelsData.videos.forEach((vid: any) => {
                    // Get the highest quality HD link available
                    const hdFile = vid.video_files.find((f: any) => f.quality === 'hd') || vid.video_files[0];
                    if (hdFile && hdFile.link) {
                        pexelsVideos.push(hdFile.link);
                    }
                });
            }
        }

        // If Pexels failed to return anything or API blew up (Guardian Fallback)
        if (pexelsVideos.length === 0) {
            let fallbackVideo = "https://cdn.creatomate.com/assets/fallback-video.mp4"; // Default Neon/Cyberpunk
            
            // "Pro Tip" Implementation: Scan local gameplay folder for footage!
            const gameplayDir = join(__dirname, "../assets/gameplay");
            if (existsSync(gameplayDir)) {
                const mp4Files = readdirSync(gameplayDir).filter(f => extname(f).toLowerCase() === ".mp4");
                if (mp4Files.length > 0) {
                    const randomFile = mp4Files[Math.floor(Math.random() * mp4Files.length)];
                    fallbackVideo = join(gameplayDir, randomFile);
                }
            }

            pexelsVideos = [fallbackVideo];
        }

        // Add visual assets payload
        results.push({
            ...item,
            visuals: {
                search_keyword: keyword,
                background_videos: pexelsVideos
            }
        });
    }

    // 3. Output payload for the next pipeline stage (Creatomate)
    console.log(JSON.stringify({
      status: "SUCCESS",
      role: "Researcher(Visuals)",
      data: results,
      timestamp: new Date().toISOString()
    }, null, 2));

  } catch (error: any) {
    console.log(JSON.stringify({
      status: "FAILED",
      role: "Researcher(Visuals)",
      error: error.message,
      timestamp: new Date().toISOString()
    }, null, 2));
  }
}

run();
