import { readFileSync } from "fs";
import { loadAgent, getMemoryPrompt } from "./agents/memory";
import { generateWithRetry, buildProviderConfig, type ProviderConfig } from "./ai/provider";

// 1. Load Agent Config (นักเขียน)
const agent = loadAgent("writer.json");
const memoryPrompt = getMemoryPrompt("writer.json");

// 2. สร้าง provider config จาก agent JSON (cloud โดยปริยาย; OpenClaw เมื่อ USE_OPENCLAW=1)
const providerConfig: ProviderConfig = buildProviderConfig(agent, { provider: "gemini", model: "gemini-2.0-flash" });

const systemPrompt = (agent.systemPrompt || "") + memoryPrompt;

async function run() {
  try {
    // 3. Read from Stdin or File argument
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

    // 4. Process each news item ผ่าน AI adapter
    for (const news of inputData.data) {
      const prompt = `News Title: ${news.title}\nSource: ${news.source}\nSummary: ${news.summary}\n\nPlease generate the viral short-video script based on the system instructions. Focus on making it engaging for Thai audiences.`;

      const response = await generateWithRetry(providerConfig, {
        prompt,
        systemPrompt,
        maxTokens: agent.generationConfig?.maxOutputTokens || 1024,
        temperature: agent.generationConfig?.temperature || 0.85,
        jsonMode: true,
      });

      const parsedScript = response.parsed || { rawText: response.text, error: "Failed to parse JSON from AI output" };

      results.push({
        source_article: news,
        generated_script: parsedScript
      });
    }

    // 5. Output finalized content
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
