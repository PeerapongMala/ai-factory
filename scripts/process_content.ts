import { GoogleGenerativeAI } from "@google/generative-ai";
import { readFileSync } from "fs";
import { join } from "path";

// 1. Load Config (The Guardian)
const CONFIG_PATH = join(__dirname, "../config/gemini_config.json");
const config = JSON.parse(readFileSync(CONFIG_PATH, "utf8"));

// 2. Initialize Gemini (The Executor)
const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error(JSON.stringify({ status: "FAILED", role: "Guardian", error: "Missing GEMINI_API_KEY in environment variable." }, null, 2));
  process.exit(1);
}

const genAI = new GoogleGenerativeAI(apiKey);
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 30_000; // 30 seconds

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

const model = genAI.getGenerativeModel({
  model: "gemini-2.0-flash",
  systemInstruction: config.systemInstruction,
  generationConfig: {
    maxOutputTokens: config.maxOutputTokens,
    temperature: config.temperature,
    responseMimeType: "application/json" // Enforce strictly JSON structured output
  }
});

async function run() {
  try {
    // 3. Read from Stdin or File argument (Data piped from fetch_news.ts)
    let inputStr = "";
    if (process.argv.length > 2) {
      inputStr = readFileSync(process.argv[2], "utf8");
    } else {
      inputStr = await Bun.stdin.text();
    }

    if (!inputStr.trim()) {
      throw new Error("No input data received. Provide a JSON file or pipe data via stdin.");
    }

    const inputData = JSON.parse(inputStr);

    if (inputData.status === "FAILED" || !inputData.data || inputData.data.length === 0) {
       console.log(JSON.stringify({ 
         status: "SKIPPED", 
         role: "Executor", 
         msg: "No valid news data to process.", 
         details: inputData.error || "Array is empty"
       }, null, 2));
       return;
    }

    const results = [];

    // 4. Process each viral news item
    for (const news of inputData.data) {
      const prompt = `News Title: ${news.title}\nSource: ${news.source}\nSummary: ${news.summary}\n\nPlease generate the viral short-video script based on the system instructions. Focus on making it engaging for Thai audiences.`;
      
      const result = await callWithRetry(() => model.generateContent(prompt));
      const outputText = result.response.text();
      
      let parsedScript;
      try {
        parsedScript = JSON.parse(outputText);
      } catch (e) {
        // Fallback if AI hallucinates outside JSON chunk
        parsedScript = { rawText: outputText, error: "Failed to parse rigorous JSON from Gemini output" };
      }

      results.push({
        source_article: news,
        generated_script: parsedScript
      });
    }

    // 5. Output finalized content for n8n to pick up
    console.log(JSON.stringify({
      status: "SUCCESS",
      role: "Executor",
      data: results,
      timestamp: new Date().toISOString()
    }, null, 2));

  } catch (error: any) {
    console.log(JSON.stringify({
      status: "FAILED",
      role: "Executor",
      error: error.message,
      timestamp: new Date().toISOString()
    }, null, 2));
  }
}

run();
