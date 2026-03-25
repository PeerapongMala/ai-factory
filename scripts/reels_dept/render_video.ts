import { readFileSync } from "fs";

// Load Credentials
const CREATOMATE_API_KEY = process.env.CREATOMATE_API_KEY;
const TEMPLATE_ID = process.env.CREATOMATE_TEMPLATE_ID;
// We need an n8n webhook URL to receive the finished video
const WEBHOOK_URL = process.env.N8N_WEBHOOK_URL || "http://localhost:5678/webhook/creatomate-finished";

if (!CREATOMATE_API_KEY || !TEMPLATE_ID) {
  console.error(JSON.stringify({ status: "FAILED", role: "Video Renderer", error: "Missing CREATOMATE_API_KEY or TEMPLATE_ID" }, null, 2));
  process.exit(1);
}

async function run() {
  try {
    // 1. Read JSON Input (from fetch_assets.ts output)
    let inputStr = "";
    if (process.argv.length > 2) {
      inputStr = readFileSync(process.argv[2], "utf8");
    } else {
      inputStr = await Bun.stdin.text();
    }

    if (!inputStr.trim()) {
      throw new Error("No payload received from Visual Researcher.");
    }

    const inputData = JSON.parse(inputStr);

    if (inputData.status === "FAILED" || !inputData.data || inputData.data.length === 0) {
       console.log(JSON.stringify({ 
         status: "SKIPPED", 
         role: "Video Renderer", 
         msg: "No valid visual assets to render." 
       }, null, 2));
       return;
    }

    const results = [];

    // 2. Loop through and dispatch rendering tasks to Creatomate
    for (const item of inputData.data) {
        const audioPath = item.audio?.local_path;
        const pexelsVideos = item.visuals?.background_videos || [];
        const scriptJson = item.generated_script;

        if (!audioPath) {
            console.error(JSON.stringify({ status: "SKIPPED", msg: "Missing audio asset, skipping video render." }));
            continue;
        }

        // Creating FormData to securely upload local audio directly to Creatomate
        const form = new FormData();
        form.append("template_id", TEMPLATE_ID);
        form.append("webhook_url", WEBHOOK_URL);

        // Upload Voiceover Audio File using Bun.file
        form.append("modifications[Voiceover.source]", Bun.file(audioPath));

        // Background / B-Roll Visual Modifiers (Pexels Videos)
        // Matches user's exact template mappings
        if (pexelsVideos[0]) {
            form.append("modifications[Background-Video.source]", pexelsVideos[0]);
            form.append("modifications[Main-Image.source]", pexelsVideos[0]); // User template legacy support
        }
        if (pexelsVideos[1]) {
            form.append("modifications[Slide-1-Image.source]", pexelsVideos[1]);
        }
        if (pexelsVideos[2]) {
            form.append("modifications[Slide-2-Image.source]", pexelsVideos[2]);
        }

        // Dynamic Text Modifiers (AI Hook/Body)
        const reel = scriptJson.reel_script || scriptJson;
        if (reel.hook) {
            form.append("modifications[Tagline.text]", reel.concept || "BREAKING NEWS");
            form.append("modifications[Title.text]", reel.hook);
        }
        if (reel.body) {
            form.append("modifications[Start-Text.text]", reel.body);
            form.append("modifications[Slide-1-Text.text]", reel.body);
        }
        if (reel.cta) {
            form.append("modifications[Final-Text.text]", reel.cta);
        }

        // 3. Send to Creatomate Rest API v1 endpoint
        const renderRes = await fetch("https://api.creatomate.com/v1/renders", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${CREATOMATE_API_KEY}`
            },
            body: form
        });

        if (!renderRes.ok) {
            const err = await renderRes.text();
            throw new Error(`Creatomate API Render Failed: ${renderRes.status} -> ${err}`);
        }

        const renderResponseJson = await renderRes.json();

        results.push({
            ...item,
            render_job: {
                status: "processing", // Job goes to Creatomate queue
                render_id: renderResponseJson.id || renderResponseJson[0]?.id,
                expected_webhook: WEBHOOK_URL
            }
        });
    }

    // 4. Output the final pipeline context so n8n node can Wait for Webhook Callback
    console.log(JSON.stringify({
      status: "SUCCESS",
      role: "Video Renderer",
      data: results,
      timestamp: new Date().toISOString()
    }, null, 2));

  } catch (error: any) {
    console.log(JSON.stringify({
      status: "FAILED",
      role: "Video Renderer",
      error: error.message,
      timestamp: new Date().toISOString()
    }, null, 2));
  }
}

run();
