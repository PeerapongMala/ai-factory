/**
 * Dashboard API Server
 * เสิร์ฟ index.html + API สั่งงาน PM
 * รัน: bun run scripts/server.ts
 */
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { loadAgent, listAgents, listMemory, train, getMemoryPrompt } from "./agents/memory";
import { generateContent, type ProviderConfig } from "./ai/provider";

const PORT = 3000;
const ROOT = join(__dirname, "..");

// MIME types
const MIME: Record<string, string> = {
  ".html": "text/html",
  ".js": "application/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

function getMime(path: string): string {
  const ext = path.slice(path.lastIndexOf("."));
  return MIME[ext] || "application/octet-stream";
}

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
  });
}

// Agent name → file mapping
const AGENT_MAP: Record<string, string> = {
  "pm": "pm.json",
  "นักข่าว": "reporter.json",
  "นักเขียน": "writer.json",
  "ตรวจสอบ": "guardian.json",
  "กราฟิก": "graphic.json",
  "โพสต์": "publisher.json",
};

const server = Bun.serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url);
    const path = url.pathname;

    // CORS preflight
    if (req.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        },
      });
    }

    // === API Routes ===

    // GET /api/tokens — สถานะ API tokens/quota
    if (path === "/api/tokens") {
      const tokens: any[] = [];

      // Mistral — เช็คว่า key ใช้ได้มั้ย
      const mistralKey = process.env.MISTRAL_API_KEY;
      if (mistralKey) {
        try {
          const res = await fetch("https://api.mistral.ai/v1/models", {
            headers: { "Authorization": `Bearer ${mistralKey}` }
          });
          tokens.push({
            name: "Mistral Large",
            role: "PM + นักเขียน",
            status: res.ok ? "active" : "error",
            tier: "FREE",
            color: "orange",
          });
        } catch {
          tokens.push({ name: "Mistral Large", role: "PM + นักเขียน", status: "offline", tier: "FREE", color: "orange" });
        }
      } else {
        tokens.push({ name: "Mistral Large", role: "PM + นักเขียน", status: "no_key", tier: "FREE", color: "orange" });
      }

      // Ayrshare — เช็ค quota ผ่าน /user endpoint
      const ayrKey = process.env.AYRSHARE_API_KEY;
      if (ayrKey) {
        try {
          const res = await fetch("https://app.ayrshare.com/api/user", {
            headers: { "Authorization": `Bearer ${ayrKey}` }
          });
          const data = await res.json();
          const plan = data.subscription?.plan || "free";
          const postsUsed = data.monthlyUsage?.posts || 0;
          const postsLimit = data.subscription?.postLimit || 30;
          const pct = postsLimit > 0 ? Math.round(((postsLimit - postsUsed) / postsLimit) * 100) : 0;
          tokens.push({
            name: "Ayrshare",
            role: "โพสต์ FB + IG",
            status: pct > 0 ? "active" : "quota_exceeded",
            tier: plan,
            used: postsUsed,
            limit: postsLimit,
            pct,
            color: "blue",
          });
        } catch {
          tokens.push({ name: "Ayrshare", role: "โพสต์ FB + IG", status: "offline", tier: "FREE", color: "blue" });
        }
      } else {
        tokens.push({ name: "Ayrshare", role: "โพสต์ FB + IG", status: "no_key", tier: "-", color: "blue" });
      }

      // Facebook API (สำรอง)
      const fbToken = process.env.FB_PAGE_TOKEN;
      tokens.push({
        name: "Facebook API",
        role: "สำรอง (ถ้า Ayrshare หมด)",
        status: fbToken ? "active" : "no_key",
        tier: "FREE",
        color: "cyan",
      });

      // Pexels (fallback รูป gameplay)
      const pexelsKey = process.env.PEXELS_API_KEY;
      tokens.push({
        name: "Pexels",
        role: "รูป gameplay สำรอง",
        status: pexelsKey ? "active" : "no_key",
        tier: "FREE",
        color: "purple",
      });

      // RSS
      tokens.push({
        name: "RSS Feeds",
        role: "นักข่าว — ไม่จำกัด",
        status: "active",
        tier: "FREE",
        color: "teal",
      });

      return json(tokens);
    }

    // GET /api/agents — รายชื่อพนักงานทั้งหมด
    if (path === "/api/agents") {
      const files = listAgents();
      const agents = files.map((file: string) => {
        const agent = loadAgent(file);
        return {
          file,
          name: agent.name,
          role: agent.role,
          description: agent.description,
          provider: agent.provider || "gemini",
          model: agent.model || "N/A",
          memoryCount: agent.memory.length,
        };
      });
      return json(agents);
    }

    // GET /api/memory?agent=writer.json — ดู memory ของพนักงาน
    if (path === "/api/memory") {
      const agentFile = url.searchParams.get("agent");
      if (!agentFile) {
        // Return all memories
        const result: Record<string, any> = {};
        for (const [name, file] of Object.entries(AGENT_MAP)) {
          result[name] = listMemory(file);
        }
        return json(result);
      }
      const memories = listMemory(agentFile);
      return json(memories);
    }

    // POST /api/train — เทรนพนักงาน { agent: "writer.json", feedback: "..." }
    if (path === "/api/train" && req.method === "POST") {
      const body = await req.json();
      const { agent, feedback } = body;
      if (!agent || !feedback) {
        return json({ error: "ต้องส่ง agent และ feedback" }, 400);
      }
      const updated = train(agent, feedback, "แอดมิน (Dashboard)");
      return json({
        status: "OK",
        name: updated.name,
        memoryCount: updated.memory.length,
        lastFeedback: feedback,
      });
    }

    // POST /api/chat — คุยกับ PM (Mistral AI) { message: "..." }
    if (path === "/api/chat" && req.method === "POST") {
      try {
        const body = await req.json();
        const { message } = body;
        if (!message) return json({ error: "ต้องส่ง message" }, 400);

        const pmAgent = loadAgent("pm.json");
        const pmMemory = getMemoryPrompt("pm.json");
        const pmConfig: ProviderConfig = {
          provider: pmAgent.provider || "openai",
          model: pmAgent.model || "mistral-large-latest",
          apiKeyEnv: pmAgent.apiKeyEnv || "MISTRAL_API_KEY",
          baseUrl: pmAgent.baseUrl || "https://api.mistral.ai/v1",
        };

        // รวม memory ของทุกคนให้ PM รู้
        let teamMemory = "";
        for (const [name, file] of Object.entries(AGENT_MAP)) {
          const mem = listMemory(file);
          if (mem.length > 0) {
            teamMemory += `\n[${name}] ${mem.length} ความจำ: ${mem.map(m => m.feedback).join("; ")}`;
          }
        }

        const systemPrompt = (pmAgent.systemPrompt || "") + pmMemory +
          `\n\n[สถานะทีม]${teamMemory || "\nยังไม่มี feedback"}` +
          `\n\n[โหมดแชท] ตอนนี้แอดมินกำลังคุยกับคุณผ่าน Dashboard ตอบเป็นภาษาไทย สรุปสั้นๆ ถ้าแอดมินสั่งเทรนพนักงาน ให้ตอบ JSON: { "action": "train", "trainTarget": "ชื่อพนักงาน", "trainFeedback": "...", "reply": "ข้อความตอบแอดมิน" } ถ้าแค่คุยทั่วไป ตอบ JSON: { "action": "chat", "reply": "ข้อความตอบ" }`;

        const res = await generateContent(pmConfig, {
          prompt: message,
          systemPrompt,
          maxTokens: 512,
          temperature: 0.4,
          jsonMode: true,
        });

        const parsed = res.parsed || { action: "chat", reply: res.text };

        // ถ้า PM สั่งเทรน → ทำเลย
        if (parsed.action === "train" && parsed.trainTarget) {
          const targetFile = AGENT_MAP[parsed.trainTarget];
          if (targetFile && parsed.trainFeedback) {
            train(targetFile, parsed.trainFeedback, "PM (AI via Chat)");
            parsed.trained = true;
          }
        }

        return json(parsed);
      } catch (e: any) {
        return json({ action: "error", reply: `Error: ${e.message}` });
      }
    }

    // POST /api/run — รัน pipeline (spawn bun run scripts/pm.ts)
    if (path === "/api/run" && req.method === "POST") {
      try {
        const logFile = join(ROOT, "tmp", "pipeline.log");
        const statusFile = join(ROOT, "tmp", "pipeline.status");
        const { mkdirSync, writeFileSync } = await import("fs");
        mkdirSync(join(ROOT, "tmp"), { recursive: true });
        writeFileSync(statusFile, "running");
        writeFileSync(logFile, `[${new Date().toISOString()}] Pipeline started...\n`);

        // Fire-and-forget: ไม่รอให้เสร็จ
        const proc = Bun.spawn(["bun", "run", "scripts/pm.ts"], {
          cwd: ROOT,
          stdout: "pipe",
          stderr: "pipe",
        });

        // เก็บ output ใน background
        (async () => {
          try {
            const out = await new Response(proc.stdout).text();
            const err = await new Response(proc.stderr).text();
            const { appendFileSync } = await import("fs");
            appendFileSync(logFile, out + "\n" + err);
            writeFileSync(statusFile, "done");
          } catch (e: any) {
            const { writeFileSync: ws } = await import("fs");
            ws(statusFile, "error: " + e.message);
          }
        })();

        return json({ status: "OK", output: "Pipeline เริ่มรันแล้ว กำลังทำงาน..." });
      } catch (e: any) {
        return json({ status: "FAILED", error: e.message }, 500);
      }
    }

    // GET /api/run/status — เช็คสถานะ pipeline
    if (path === "/api/run/status") {
      const statusFile = join(ROOT, "tmp", "pipeline.status");
      const logFile = join(ROOT, "tmp", "pipeline.log");
      const { readFileSync, existsSync } = await import("fs");
      const status = existsSync(statusFile) ? readFileSync(statusFile, "utf8") : "idle";
      const log = existsSync(logFile) ? readFileSync(logFile, "utf8") : "";
      return json({ status, log });
    }

    // GET /api/postmode — ดูโหมดโพสต์
    if (path === "/api/postmode" && req.method === "GET") {
      const modeFile = join(ROOT, "tmp", "post_mode.txt");
      const { existsSync: ex, readFileSync: rf } = await import("fs");
      const mode = ex(modeFile) ? rf(modeFile, "utf8").trim() : "approve";
      return json({ mode });
    }

    // POST /api/postmode — สลับโหมด
    if (path === "/api/postmode" && req.method === "POST") {
      const { mkdirSync: mk, readFileSync: rf, writeFileSync: wf, existsSync: ex } = await import("fs");
      mk(join(ROOT, "tmp"), { recursive: true });
      const modeFile = join(ROOT, "tmp", "post_mode.txt");
      const current = ex(modeFile) ? rf(modeFile, "utf8").trim() : "approve";
      const newMode = current === "auto" ? "approve" : "auto";
      wf(modeFile, newMode);
      return json({ mode: newMode });
    }

    // GET /api/pending — ดูโพสต์ที่รอตรวจ
    if (path === "/api/pending") {
      const { existsSync: ex, readdirSync, readFileSync: rf } = await import("fs");
      const pendingDir = join(ROOT, "tmp", "pending");
      if (!ex(pendingDir)) return json([]);
      const files = readdirSync(pendingDir).filter((f: string) => f.endsWith(".json"));
      const pending = files.map((f: string) => {
        try {
          const data = JSON.parse(rf(join(pendingDir, f), "utf8"));
          const id = f.replace(".json", "");
          const items = data.data || [];
          return {
            id,
            time: new Date(parseInt(id)).toLocaleString("th-TH", { timeZone: "Asia/Bangkok" }),
            items: items.map((item: any) => ({
              headline: item.generated_script?.headline || item.source_article?.title || "N/A",
              mood: item.generated_script?.mood || "good",
              caption: typeof item.generated_script?.caption === "string"
                ? item.generated_script.caption.slice(0, 300)
                : JSON.stringify(item.generated_script?.caption || "").slice(0, 300),
              image: item.source_article?.image || "",
            })),
          };
        } catch { return null; }
      }).filter(Boolean);
      return json(pending);
    }

    // POST /api/pending/:id/approve — อนุมัติโพสต์
    if (path.startsWith("/api/pending/") && path.endsWith("/approve") && req.method === "POST") {
      const id = path.split("/")[3];
      const pendingFile = join(ROOT, "tmp", "pending", `${id}.json`);
      const { existsSync: ex, unlinkSync } = await import("fs");
      if (!ex(pendingFile)) return json({ error: "ไม่เจอ pending นี้" }, 404);

      try {
        const proc = Bun.spawn(["bun", "run", "scripts/post_dept/social_post.ts", pendingFile], {
          cwd: ROOT, stdout: "pipe", stderr: "pipe",
        });
        const out = await new Response(proc.stdout).text();
        const err = await new Response(proc.stderr).text();
        try { unlinkSync(pendingFile); } catch {}
        return json({ status: "OK", msg: "โพสต์แล้ว", output: out || err });
      } catch (e: any) {
        return json({ status: "FAILED", error: e.message }, 500);
      }
    }

    // POST /api/pending/:id/reject — ไม่อนุมัติ ลบทิ้ง
    if (path.startsWith("/api/pending/") && path.endsWith("/reject") && req.method === "POST") {
      const id = path.split("/")[3];
      const pendingFile = join(ROOT, "tmp", "pending", `${id}.json`);
      const { existsSync: ex, unlinkSync } = await import("fs");
      if (!ex(pendingFile)) return json({ error: "ไม่เจอ pending นี้" }, 404);
      try { unlinkSync(pendingFile); } catch {}
      return json({ status: "OK", msg: "ลบแล้ว" });
    }

    // POST /api/scheduler — เปิด/ปิด scheduler
    if (path === "/api/scheduler" && req.method === "POST") {
      const statusFile = join(ROOT, "tmp", "scheduler.pid");
      const { existsSync, readFileSync, writeFileSync, unlinkSync } = await import("fs");
      const { mkdirSync } = await import("fs");
      mkdirSync(join(ROOT, "tmp"), { recursive: true });

      // ถ้ามี pid อยู่แล้ว = กำลังรัน → ปิด
      if (existsSync(statusFile)) {
        try {
          const pid = readFileSync(statusFile, "utf8").trim();
          Bun.spawn(["taskkill", "/F", "/PID", pid]);
        } catch {}
        try { unlinkSync(statusFile); } catch {}
        return json({ status: "stopped", msg: "Scheduler หยุดแล้ว" });
      }

      // เปิด scheduler
      const proc = Bun.spawn(["bun", "run", "scripts/scheduler.ts"], {
        cwd: ROOT,
        stdout: "ignore",
        stderr: "ignore",
      });
      writeFileSync(statusFile, String(proc.pid));
      return json({ status: "running", msg: "Scheduler เริ่มแล้ว — รันทุก 30 นาที", pid: proc.pid });
    }

    // GET /api/scheduler — เช็คสถานะ scheduler
    if (path === "/api/scheduler") {
      const statusFile = join(ROOT, "tmp", "scheduler.pid");
      const { existsSync, readFileSync } = await import("fs");
      if (existsSync(statusFile)) {
        const pid = readFileSync(statusFile, "utf8").trim();
        return json({ status: "running", pid });
      }
      return json({ status: "stopped" });
    }

    // === Static Files ===
    let filePath = path === "/" ? "/index.html" : path;
    const fullPath = join(ROOT, filePath);

    if (existsSync(fullPath)) {
      const file = readFileSync(fullPath);
      return new Response(file, {
        headers: { "Content-Type": getMime(fullPath) },
      });
    }

    return new Response("Not Found", { status: 404 });
  },
});

console.log(`🎮 Pang Game Dashboard: http://localhost:${PORT}`);
