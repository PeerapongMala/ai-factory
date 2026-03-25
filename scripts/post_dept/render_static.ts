import { readFileSync } from "fs";

const CREATOMATE_API_KEY = process.env.CREATOMATE_API_KEY;
// The user should define this in .env for specifically building 1:1 Static Images
const STATIC_TEMPLATE_ID = process.env.CREATOMATE_STATIC_TEMPLATE_ID || "STATIC_1_TO_1_TEMPLATE_ID";

if (!CREATOMATE_API_KEY) {
  console.error(JSON.stringify({ status: "FAILED", role: "Static Renderer", error: "Missing CREATOMATE_API_KEY" }, null, 2));
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
       console.log(JSON.stringify({ status: "SKIPPED", role: "Static Renderer", msg: "No items to render." }, null, 2));
       return;
    }

    const results = [];

    // 2. Loop through and dispatch rendering tasks to Creatomate
    for (const item of inputData.data) {
        const staticScript = item.generated_script?.static_post;
        const pexelsVideos = item.visuals?.background_videos || [];

        if (!staticScript) {
            console.error(JSON.stringify({ status: "SKIPPED", msg: "Missing static_post schema, skipping static render." }));
            continue;
        }

        const form = new FormData();
        form.append("template_id", STATIC_TEMPLATE_ID);
        form.append("output_format", "jpg"); // Force static image output even if using video assets

        // Background Visual Modifiers
        if (pexelsVideos[0]) {
            form.append("modifications[Background-Image.source]", pexelsVideos[0]);
        }

        // Mascot Layer Sticker Routing (Nong Pang Good vs Fail)
        const mood = staticScript.mascot_mood === "fail" ? "fail" : "good";
        // Convert to base64 so Creatomate can read the local file
        try {
            const stickerPath = `assets/sticker Pang ${mood}.png`;
            const stickerBuffer = readFileSync(stickerPath);
            const base64Image = stickerBuffer.toString("base64");
            form.append("modifications[Mascot_Layer.source]", `data:image/png;base64,${base64Image}`);
        } catch (e) {
            console.error(JSON.stringify({ status: "WARNING", msg: `Base64 Mascot Failed: ${e}` }));
        }

        // Dynamic Text Modifiers (AI Static Schema Sheapgamer style)
        form.append("modifications[Header_Branding.text]", "เกมปังv2  |  @PangGameV2");

        if (staticScript.headline) {
            form.append("modifications[Main_Headline.text]", staticScript.headline);
        }
        if (staticScript.price_tag) {
            form.append("modifications[Price_Highlight.text]", staticScript.price_tag);
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
            throw new Error(`Creatomate API Static Render Failed: ${renderRes.status} -> ${err}`);
        }

        const renderResponseJson = await renderRes.json();

        // Push Both Render Contexts
        results.push({
            ...item,
            static_render: {
                status: "processing_image",
                render_id: renderResponseJson.id || renderResponseJson[0]?.id
                // Webhook can be added here if needed, or pulled identically to videos.
            }
        });
    }

    console.log(JSON.stringify({
      status: "SUCCESS",
      role: "Static Renderer",
      data: results,
      timestamp: new Date().toISOString()
    }, null, 2));

  } catch (error: any) {
    console.log(JSON.stringify({
      status: "FAILED",
      role: "Static Renderer",
      error: error.message,
      timestamp: new Date().toISOString()
    }, null, 2));
  }
}

run();
