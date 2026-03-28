/**
 * AI Provider Adapter
 * พนักงานแต่ละคนเลือกใช้ AI ตัวไหนก็ได้ แค่แก้ใน agent JSON
 * รองรับ: gemini, openai, claude (เพิ่มได้ง่าย)
 */
import { GoogleGenerativeAI } from "@google/generative-ai";
import OpenAI from "openai";

export interface AIRequest {
  prompt: string;
  systemPrompt?: string;
  maxTokens?: number;
  temperature?: number;
  jsonMode?: boolean;
}

export interface AIResponse {
  text: string;
  parsed?: any;
}

export interface ProviderConfig {
  provider: string;       // "gemini" | "openai" | "claude"
  model: string;
  apiKeyEnv?: string;     // env var name, default per provider
  baseUrl?: string;       // custom base URL (Groq, Ollama, etc.)
}

const DEFAULT_API_KEY_ENV: Record<string, string> = {
  gemini: "GEMINI_API_KEY",
  openai: "OPENAI_API_KEY",
  claude: "ANTHROPIC_API_KEY",
};

function getApiKey(config: ProviderConfig): string {
  const envName = config.apiKeyEnv || DEFAULT_API_KEY_ENV[config.provider];
  const key = process.env[envName];
  if (!key) {
    throw new Error(`Missing API key: set ${envName} in environment`);
  }
  return key;
}

// ===== Gemini =====
async function callGemini(config: ProviderConfig, req: AIRequest): Promise<AIResponse> {
  const genAI = new GoogleGenerativeAI(getApiKey(config));
  const model = genAI.getGenerativeModel({
    model: config.model,
    systemInstruction: req.systemPrompt || undefined,
    generationConfig: {
      maxOutputTokens: req.maxTokens || 1024,
      temperature: req.temperature || 0.85,
      ...(req.jsonMode ? { responseMimeType: "application/json" } : {}),
    },
  });

  const result = await model.generateContent(req.prompt);
  const text = result.response.text();
  return { text, parsed: tryParseJSON(text) };
}

// ===== OpenAI (+ compatible: Groq, Together, Ollama) =====
async function callOpenAI(config: ProviderConfig, req: AIRequest): Promise<AIResponse> {
  const client = new OpenAI({
    apiKey: getApiKey(config),
    ...(config.baseUrl ? { baseURL: config.baseUrl } : {}),
  });

  const messages: any[] = [];
  if (req.systemPrompt) {
    messages.push({ role: "system", content: req.systemPrompt });
  }
  messages.push({ role: "user", content: req.prompt });

  const completion = await client.chat.completions.create({
    model: config.model,
    messages,
    max_tokens: req.maxTokens || 1024,
    temperature: req.temperature || 0.85,
    ...(req.jsonMode ? { response_format: { type: "json_object" } } : {}),
  });

  const text = completion.choices[0]?.message?.content || "";
  return { text, parsed: tryParseJSON(text) };
}

// ===== Claude =====
async function callClaude(config: ProviderConfig, req: AIRequest): Promise<AIResponse> {
  // ใช้ OpenAI SDK ผ่าน Anthropic Messages API compatible endpoint
  // หรือ fetch ตรง
  const apiKey = getApiKey(config);
  const body: any = {
    model: config.model,
    max_tokens: req.maxTokens || 1024,
    temperature: req.temperature || 0.85,
    messages: [{ role: "user", content: req.prompt }],
  };
  if (req.systemPrompt) {
    body.system = req.systemPrompt;
  }

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Claude API error ${res.status}: ${err}`);
  }

  const data = await res.json();
  const text = data.content?.[0]?.text || "";
  return { text, parsed: tryParseJSON(text) };
}

// ===== Router =====
const PROVIDERS: Record<string, (config: ProviderConfig, req: AIRequest) => Promise<AIResponse>> = {
  gemini: callGemini,
  openai: callOpenAI,
  claude: callClaude,
};

export async function generateContent(config: ProviderConfig, req: AIRequest): Promise<AIResponse> {
  const handler = PROVIDERS[config.provider];
  if (!handler) {
    throw new Error(`Unknown AI provider: "${config.provider}". Available: ${Object.keys(PROVIDERS).join(", ")}`);
  }
  return handler(config, req);
}

// ===== Retry wrapper =====
export async function generateWithRetry(
  config: ProviderConfig,
  req: AIRequest,
  maxRetries = 3,
  delayMs = 30_000
): Promise<AIResponse> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await generateContent(config, req);
    } catch (err: any) {
      const isRetryable = err.message?.includes("429") || err.message?.includes("529") || err.message?.includes("overloaded") || err.message?.includes("quota") || err.message?.includes("rate") || err.message?.includes("503") || err.message?.includes("500");
      if (isRetryable && attempt < maxRetries) {
        console.error(`[AI] Rate limited (${config.provider}). Retry ${attempt}/${maxRetries} in ${delayMs / 1000}s...`);
        await Bun.sleep(delayMs);
        continue;
      }
      throw err;
    }
  }
  throw new Error("generateWithRetry: should not reach here");
}

function tryParseJSON(text: string): any {
  try {
    return JSON.parse(text);
  } catch {
    // ลอง extract JSON จาก text
    const match = text.match(/\{[\s\S]*\}/);
    if (match) {
      try { return JSON.parse(match[0]); } catch { /* ignore */ }
    }
    return null;
  }
}
