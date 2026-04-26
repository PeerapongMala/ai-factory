/**
 * Dashboard API Server
 * เสิร์ฟ index.html + API สั่งงาน PM
 * รัน: bun run scripts/server.ts
 */
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { loadAgent, listAgents, listMemory, train, getMemoryPrompt } from "./agents/memory";
import { generateWithRetry, type ProviderConfig } from "./ai/provider";

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
      try {
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
      } catch (e: any) {
        return json({ error: "Train failed: " + e.message }, 500);
      }
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

        const res = await generateWithRetry(pmConfig, {
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

        // Fire-and-forget: stream output ทีละบรรทัดแบบ real-time
        const proc = Bun.spawn(["bun", "run", "scripts/pm.ts"], {
          cwd: ROOT,
          stdout: "pipe",
          stderr: "pipe",
        });

        const { appendFileSync } = await import("fs");

        // Stream stderr (pm.ts ใช้ console.log → stdout, แต่ sub-process อาจ stderr)
        const streamToLog = async (stream: ReadableStream<Uint8Array>) => {
          const reader = stream.getReader();
          const decoder = new TextDecoder();
          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              const text = decoder.decode(value, { stream: true });
              appendFileSync(logFile, text);
            }
          } catch {}
        };

        (async () => {
          try {
            // Stream output + รอ process จบ แบบ race กัน
            const streamDone = Promise.all([
              streamToLog(proc.stdout as ReadableStream),
              streamToLog(proc.stderr as ReadableStream),
            ]);
            const exited = proc.exited;

            // ถ้า process จบก่อน stream → รอ stream อีก 2 วิ แล้วจบ
            await Promise.race([
              streamDone,
              exited.then(() => new Promise(r => setTimeout(r, 2000))),
            ]);
            writeFileSync(statusFile, "done");
          } catch (e: any) {
            appendFileSync(logFile, `\n[ERROR] Pipeline crashed: ${e.message}\n`);
            writeFileSync(statusFile, "done");
          }
        })().catch((e) => {
          try { writeFileSync(statusFile, "done"); } catch {}
          console.error("[Pipeline] Unhandled error:", e);
        });

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
      const mode = ex(modeFile) ? rf(modeFile, "utf8").trim() : "auto";
      return json({ mode });
    }

    // POST /api/postmode — สลับโหมด
    if (path === "/api/postmode" && req.method === "POST") {
      const { mkdirSync: mk, readFileSync: rf, writeFileSync: wf, existsSync: ex } = await import("fs");
      mk(join(ROOT, "tmp"), { recursive: true });
      const modeFile = join(ROOT, "tmp", "post_mode.txt");
      const current = ex(modeFile) ? rf(modeFile, "utf8").trim() : "auto";
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
                ? item.generated_script.caption
                : JSON.stringify(item.generated_script?.caption || ""),
              image: item.preview_image || item.source_article?.image || "",
              sourceUrl: item.source_article?.link || "",
              sourceName: item.source_article?.source || "",
            })),
          };
        } catch { return null; }
      }).filter(Boolean);
      return json(pending);
    }

    // POST /api/pending/clear — ลบ pending ทั้งหมด
    if (path === "/api/pending/clear" && req.method === "POST") {
      const { existsSync: ex, readdirSync, unlinkSync } = await import("fs");
      const pendingDir = join(ROOT, "tmp", "pending");
      if (ex(pendingDir)) {
        for (const f of readdirSync(pendingDir).filter((f: string) => f.endsWith(".json"))) {
          try { unlinkSync(join(pendingDir, f)); } catch {}
        }
      }
      return json({ status: "OK", msg: "ลบ pending ทั้งหมดแล้ว" });
    }

    // POST /api/pending/:id/approve?item=0 — อนุมัติโพสต์ (per-item)
    if (path.startsWith("/api/pending/") && path.endsWith("/approve") && req.method === "POST") {
      const id = path.split("/")[3];
      if (!id || !/^[\w]+$/.test(id)) return json({ error: "Invalid pending ID" }, 400);
      const itemIdx = parseInt(url.searchParams.get("item") || "-1");
      const pendingFile = join(ROOT, "tmp", "pending", `${id}.json`);
      const { existsSync: ex, readFileSync: rf, writeFileSync: wf, unlinkSync } = await import("fs");
      if (!ex(pendingFile)) return json({ error: "ไม่เจอ pending นี้" }, 404);

      try {
        const data = JSON.parse(rf(pendingFile, "utf8"));
        let toPost = data;

        // ถ้าระบุ item → โพสต์เฉพาะ item นั้น
        if (itemIdx >= 0 && data.data) {
          toPost = { ...data, data: [data.data[itemIdx]] };
          // ลบ item ที่โพสต์แล้วออกจาก file
          data.data.splice(itemIdx, 1);
          if (data.data.length === 0) {
            try { unlinkSync(pendingFile); } catch {}
          } else {
            wf(pendingFile, JSON.stringify(data, null, 2));
          }
        } else {
          // ไม่ระบุ item → โพสต์ทั้งหมด → ลบ file
          try { unlinkSync(pendingFile); } catch {}
        }

        // เขียน tmp file สำหรับ social_post
        const tmpFile = join(ROOT, "tmp", `approve_${id}_${itemIdx}.json`);
        wf(tmpFile, JSON.stringify(toPost, null, 2));

        const proc = Bun.spawn(["bun", "run", "scripts/post_dept/social_post.ts", tmpFile], {
          cwd: ROOT, stdout: "pipe", stderr: "pipe",
        });
        const out = await new Response(proc.stdout).text();
        const err = await new Response(proc.stderr).text();
        try { unlinkSync(tmpFile); } catch {}
        return json({ status: "OK", msg: "โพสต์แล้ว", output: out || err });
      } catch (e: any) {
        return json({ status: "FAILED", error: e.message }, 500);
      }
    }

    // POST /api/pending/:id/reject?item=0 — ไม่อนุมัติ (per-item)
    if (path.startsWith("/api/pending/") && path.endsWith("/reject") && req.method === "POST") {
      const id = path.split("/")[3];
      if (!id || !/^[\w]+$/.test(id)) return json({ error: "Invalid pending ID" }, 400);
      const itemIdx = parseInt(url.searchParams.get("item") || "-1");
      const pendingFile = join(ROOT, "tmp", "pending", `${id}.json`);
      const { existsSync: ex, readFileSync: rf, writeFileSync: wf, unlinkSync } = await import("fs");
      if (!ex(pendingFile)) return json({ error: "ไม่เจอ pending นี้" }, 404);

      try {
        if (itemIdx >= 0) {
          // ลบเฉพาะ item
          const data = JSON.parse(rf(pendingFile, "utf8"));
          if (data.data) {
            data.data.splice(itemIdx, 1);
            if (data.data.length === 0) {
              try { unlinkSync(pendingFile); } catch {}
            } else {
              wf(pendingFile, JSON.stringify(data, null, 2));
            }
          }
        } else {
          // ลบทั้ง batch
          try { unlinkSync(pendingFile); } catch {}
        }
        return json({ status: "OK", msg: "ลบแล้ว" });
      } catch (e: any) {
        return json({ error: "ลบไม่ได้: " + e.message }, 500);
      }
    }

    // GET /api/analytics — ดึงยอด posts จาก Facebook
    if (path === "/api/analytics") {
      const fbToken = process.env.FB_PAGE_TOKEN;
      const fbPageId = process.env.FB_PAGE_ID;
      if (!fbToken || !fbPageId) return json({ error: "Missing FB_PAGE_TOKEN or FB_PAGE_ID" }, 400);

      try {
        const limit = url.searchParams.get("limit") || "10";

        // 1. ดึง posts พร้อม likes/comments/shares
        const res = await fetch(
          `https://graph.facebook.com/v19.0/${fbPageId}/posts?fields=id,message,created_time,permalink_url,full_picture,shares,likes.summary(true),comments.summary(true)&limit=${limit}&access_token=${fbToken}`
        );
        const data = await res.json();
        if (data.error) return json({ error: data.error.message }, 400);

        // 2. ดึง insights แต่ละโพสต์ (parallel)
        const posts = await Promise.all((data.data || []).map(async (p: any) => {
          let reach = 0, impressions = 0, engaged = 0, reactions: any = {};
          try {
            const insRes = await fetch(
              `https://graph.facebook.com/v19.0/${p.id}/insights?metric=post_impressions,post_impressions_unique,post_engaged_users,post_reactions_by_type_total&access_token=${fbToken}`
            );
            const insData = await insRes.json();
            if (insData.data) {
              for (const m of insData.data) {
                const val = m.values?.[0]?.value;
                if (m.name === "post_impressions") impressions = val || 0;
                if (m.name === "post_impressions_unique") reach = val || 0;
                if (m.name === "post_engaged_users") engaged = val || 0;
                if (m.name === "post_reactions_by_type_total") reactions = val || {};
              }
            }
          } catch {}

          return {
            id: p.id,
            message: (p.message || "").slice(0, 200),
            created_time: p.created_time,
            permalink_url: p.permalink_url,
            image: p.full_picture || "",
            likes: p.likes?.summary?.total_count || 0,
            comments: p.comments?.summary?.total_count || 0,
            shares: p.shares?.count || 0,
            reach, impressions, engaged, reactions,
          };
        }));

        return json(posts);
      } catch (e: any) {
        return json({ error: e.message }, 500);
      }
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

