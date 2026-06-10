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
  provider: string;       // "gemini" | "openai" | "claude" | "openclaw"
  model: string;
  apiKeyEnv?: string;     // env var name, default per provider
  baseUrl?: string;       // custom base URL (Groq, Ollama, etc.)
  openclawAgent?: string; // openclaw: which OpenClaw agent id to run the turn
  fallback?: ProviderConfig; // used when the primary provider is unavailable/fails
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
      // gemini-2.5: thinking เปิด default และกินโควต้า maxOutputTokens จน JSON ขาดกลางคำ → ปิดทิ้ง
      ...(String(config.model).includes("2.5") ? { thinkingConfig: { thinkingBudget: 0 } } : {}),
    } as any,
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

// ===== OpenClaw (local gateway, per-agent Claude model via subscription) =====
// หมายเหตุ: รันได้เฉพาะ "เครื่อง local" ที่ gateway openclaw เปิดอยู่ (localhost:18789)
// GitHub Actions / cloud เรียกไม่ได้ → ต้องมี config.fallback เสมอ (gemini/mistral)
// เปิดใช้ด้วย env USE_OPENCLAW=1 เท่านั้น (ดู buildProviderConfig)
const OPENCLAW_TIMEOUT_S = Number(process.env.OPENCLAW_TIMEOUT_S) || 180;

async function callOpenClaw(config: ProviderConfig, req: AIRequest): Promise<AIResponse> {
  const agentId = config.openclawAgent || "main";
  const sys = req.systemPrompt ? `[บทบาท/กฎ]\n${req.systemPrompt}\n\n` : "";
  const jsonHint = req.jsonMode
    ? "\n\nสำคัญ: ตอบกลับเป็น JSON object ที่ valid เท่านั้น ห้ามมีข้อความอื่นนอก JSON"
    : "";
  const message = `${sys}[งาน]\n${req.prompt}${jsonHint}`;
  // session-key สดทุกครั้ง → เทิร์นแบบ stateless (ไม่ปนกับ session อื่นของ agent)
  const sessionKey = `agent:${agentId}:pang-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  const proc = Bun.spawn(
    [
      "openclaw", "agent",
      "--agent", agentId,
      "--model", config.model,
      "--message", message,
      "--session-key", sessionKey,
      "--json",
      "--timeout", String(OPENCLAW_TIMEOUT_S),
    ],
    { stdout: "pipe", stderr: "pipe" },
  );

  const stdout = await new Response(proc.stdout).text();
  const exitCode = await proc.exited;
  if (exitCode !== 0) {
    const stderr = await new Response(proc.stderr).text();
    throw new Error(`openclaw agent exited ${exitCode}: ${(stderr || stdout).slice(-280)}`);
  }

  const text = extractOpenClawReply(stdout);
  if (!text) throw new Error("openclaw agent returned empty reply");
  return { text, parsed: tryParseJSON(text) };
}

// --json envelope shape ของ openclaw อาจต่างเวอร์ชัน → ดึง field ที่น่าจะเป็นคำตอบแบบ defensive
function extractOpenClawReply(raw: string): string {
  const trimmed = raw.trim();
  const envelope = tryParseJSON(trimmed);
  if (envelope && typeof envelope === "object") {
    const candidates = [
      envelope.reply, envelope.text, envelope.message, envelope.content,
      envelope.output, envelope.result?.text, envelope.result?.reply,
      envelope.data?.text, envelope.response,
    ];
    for (const c of candidates) {
      if (typeof c === "string" && c.trim()) return c.trim();
    }
  }
  // ไม่ใช่ JSON envelope → คืน stdout ดิบ (อาจเป็นข้อความตรงๆ)
  return trimmed;
}

// ===== Router =====
const PROVIDERS: Record<string, (config: ProviderConfig, req: AIRequest) => Promise<AIResponse>> = {
  gemini: callGemini,
  openai: callOpenAI,
  claude: callClaude,
  openclaw: callOpenClaw,
};

/**
 * สร้าง ProviderConfig จาก agent JSON แบบรวมศูนย์
 * - ค่าเริ่มต้น: ใช้ cloud provider (gemini/mistral) → ทำงานทั้ง local + GitHub Actions 24/7
 * - ถ้า USE_OPENCLAW=1 และ agent มี block "openclaw" → route ไป OpenClaw (Claude ต่อ agent)
 *   โดยตั้ง cloud เป็น fallback อัตโนมัติ (กัน cloud/gateway ล่ม)
 */
export function buildProviderConfig(agent: any, defaults?: Partial<ProviderConfig>): ProviderConfig {
  const cloud: ProviderConfig = {
    provider: agent.provider || defaults?.provider || "gemini",
    model: agent.model || defaults?.model || "gemini-2.0-flash",
    apiKeyEnv: agent.apiKeyEnv || defaults?.apiKeyEnv,
    baseUrl: agent.baseUrl || defaults?.baseUrl,
  };

  const oc = agent.openclaw;
  if (process.env.USE_OPENCLAW === "1" && oc?.agent && oc?.model) {
    return {
      provider: "openclaw",
      model: oc.model,
      openclawAgent: oc.agent,
      fallback: cloud,
    };
  }
  return cloud;
}

export async function generateContent(config: ProviderConfig, req: AIRequest): Promise<AIResponse> {
  const handler = PROVIDERS[config.provider];
  if (!handler) {
    if (config.fallback) return generateContent(config.fallback, req);
    throw new Error(`Unknown AI provider: "${config.provider}". Available: ${Object.keys(PROVIDERS).join(", ")}`);
  }
  try {
    return await handler(config, req);
  } catch (err: any) {
    // provider หลักล่ม (เช่น openclaw gateway ไม่เปิด / cloud rate-limit) → ใช้ fallback ถ้ามี
    if (config.fallback) {
      console.error(`[AI] provider "${config.provider}" failed: ${err?.message}. Falling back to "${config.fallback.provider}".`);
      return generateContent(config.fallback, req);
    }
    throw err;
  }
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
