import { readFileSync } from "fs";
import { stampSticker, uploadImage } from "./stamp_sticker";

const AYRSHARE_API_KEY = process.env.AYRSHARE_API_KEY;
const FB_PAGE_TOKEN = process.env.FB_PAGE_TOKEN;
const FB_PAGE_ID = process.env.FB_PAGE_ID;

if (!AYRSHARE_API_KEY && !FB_PAGE_TOKEN) {
  console.error(JSON.stringify({ status: "FAILED", role: "Output(Distribution)", error: "Missing AYRSHARE_API_KEY and FB_PAGE_TOKEN — ต้องมีอย่างน้อย 1 อย่าง" }, null, 2));
  process.exit(1);
}

// === Facebook Graph API (สำรอง) ===
async function postViaFacebook(caption: string, imageUrl?: string): Promise<any> {
  if (!FB_PAGE_TOKEN || !FB_PAGE_ID) throw new Error("Missing FB_PAGE_TOKEN or FB_PAGE_ID");

  let endpoint: string;
  let body: any;

  if (imageUrl) {
    // โพสต์พร้อมรูป
    endpoint = `https://graph.facebook.com/v19.0/${FB_PAGE_ID}/photos`;
    body = { message: caption, url: imageUrl, access_token: FB_PAGE_TOKEN };
  } else {
    // โพสต์ข้อความอย่างเดียว
    endpoint = `https://graph.facebook.com/v19.0/${FB_PAGE_ID}/feed`;
    body = { message: caption, access_token: FB_PAGE_TOKEN };
  }

  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const data = await res.json();
  if (!res.ok) throw new Error(`Facebook API Error: ${JSON.stringify(data)}`);
  return data;
}

async function run() {
  try {
    // 1. Read input payload
    let inputStr = "";
    if (process.argv.length > 2) {
      inputStr = readFileSync(process.argv[2], "utf8");
    } else {
      inputStr = await Bun.stdin.text();
    }

    if (!inputStr.trim()) {
      throw new Error("No payload received from Static Renderer.");
    }

    const inputData = JSON.parse(inputStr);

    if (inputData.status === "FAILED" || !inputData.data || inputData.data.length === 0) {
       console.log(JSON.stringify({ status: "SKIPPED", role: "Output(Distribution)", msg: "No items to post." }, null, 2));
       return;
    }

    const results = [];

    // 2. Loop through approved items
    for (const item of inputData.data) {
        const scriptJson = item.generated_script || {};

        // สร้าง caption จาก AI output (รองรับหลาย format)
        let caption = "";
        if (typeof scriptJson.caption === "string") {
          caption = scriptJson.caption;
        } else if (scriptJson.caption?.hook) {
          const parts = [
            scriptJson.caption.header || "",
            scriptJson.caption.hook || "",
            ...(Array.isArray(scriptJson.caption.content) ? scriptJson.caption.content : []),
            scriptJson.caption.mascot_role || "",
            scriptJson.caption.cta || ""
          ].filter(Boolean);
          caption = parts.join("\n\n");
        } else if (scriptJson.rawText) {
          const hookMatch = scriptJson.rawText.match(/"hook":\s*"([^"]+)"/);
          caption = hookMatch ? hookMatch[1] : (item.source_article?.title || "");
          caption += "\n\n#เกมปังv2 #panggame";
        } else {
          caption = `${item.source_article?.title || ""}\n\n#เกมปังv2 #panggame`;
        }

        // === ดึงรูปข่าว ===
        // 1. RSS thumbnail > 2. og:image จากเว็บต้นทาง > 3. Google search gameplay
        let rawImageUrl = item.source_article?.image || item.static_render?.url || item.render_job?.url;

        // Fallback: ดึง og:image จาก URL ข่าวต้นทาง
        if (!rawImageUrl && item.source_article?.link) {
            try {
                const pageRes = await fetch(item.source_article.link, {
                    headers: { "User-Agent": "Mozilla/5.0 (compatible; PangBot/1.0)" },
                    redirect: "follow",
                });
                const html = await pageRes.text();
                const ogMatch = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)
                    || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
                if (ogMatch) {
                    rawImageUrl = ogMatch[1];
                    console.error(`[Image] og:image จากข่าว: ${rawImageUrl}`);
                }
            } catch (e: any) {
                console.error(`[Image] ดึง og:image ไม่ได้: ${e.message}`);
            }
        }

        // Fallback: ค้นหารูป gameplay จาก Google (ผ่าน Pexels API)
        if (!rawImageUrl) {
            const pexelsKey = process.env.PEXELS_API_KEY;
            if (pexelsKey) {
                try {
                    const title = item.source_article?.title || scriptJson.headline || "gaming";
                    const query = encodeURIComponent(title + " gameplay screenshot");
                    const pxRes = await fetch(`https://api.pexels.com/v1/search?query=${query}&per_page=1&orientation=square`, {
                        headers: { "Authorization": pexelsKey }
                    });
                    const pxData = await pxRes.json();
                    if (pxData.photos && pxData.photos.length > 0) {
                        rawImageUrl = pxData.photos[0].src.large;
                        console.error(`[Image] Pexels: ${rawImageUrl}`);
                    }
                } catch (e: any) {
                    console.error(`[Image] Pexels ไม่ได้: ${e.message}`);
                }
            }
        }

        // === แปะสติกเกอร์น้องปัง + headline ===
        let finalImageUrl = rawImageUrl;
        if (rawImageUrl) {
            try {
                const mood = scriptJson.mood === "fail" ? "fail" : "good";
                const headline = scriptJson.headline || item.source_article?.title || "";
                const idx = results.length;
                const localPath = await stampSticker(rawImageUrl, mood, headline, `post_${idx}.jpg`);
                finalImageUrl = await uploadImage(localPath);
                console.error(`[Sticker] ${mood} + headline → ${finalImageUrl}`);
            } catch (e: any) {
                console.error(`[Sticker] แปะไม่ได้ ใช้รูปเดิม: ${e.message}`);
            }
        }

        const payload: any = {
            post: caption,
            platforms: finalImageUrl ? ["facebook", "instagram"] : ["facebook"],
            autoHashtag: true,
        };
        if (finalImageUrl) {
            payload.mediaUrls = [finalImageUrl];
        }

        // 3. โพสต์: Ayrshare (หลัก) → Facebook API (สำรอง)
        let postResult: any = null;
        let usedProvider = "ayrshare";

        if (AYRSHARE_API_KEY) {
            const postRes = await fetch("https://app.ayrshare.com/api/post", {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${AYRSHARE_API_KEY}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(payload)
            });

            const postResponseJson = await postRes.json();

            // 429 = quota หมด → fallback ไป Facebook API
            if (postRes.status === 429 && FB_PAGE_TOKEN) {
                console.error("[Ayrshare] quota หมด → สลับไป Facebook API");
                usedProvider = "facebook";
            } else if (!postRes.ok && !postResponseJson.postIds?.some((p: any) => p.status === "success")) {
                throw new Error(`Ayrshare API Error: ${postRes.status} - ${JSON.stringify(postResponseJson)}`);
            } else {
                postResult = {
                    status: "PUBLISHED",
                    provider: "ayrshare",
                    ayrshare_id: postResponseJson.id || postResponseJson.refId,
                    platforms: postResponseJson.postIds,
                    imageUrl: finalImageUrl
                };
            }
        } else {
            usedProvider = "facebook";
        }

        // Fallback: Facebook Graph API
        if (usedProvider === "facebook") {
            if (!FB_PAGE_TOKEN || !FB_PAGE_ID) {
                throw new Error("Ayrshare quota หมด และไม่มี FB_PAGE_TOKEN/FB_PAGE_ID สำรอง");
            }
            const fbRes = await postViaFacebook(caption, finalImageUrl);
            console.error(`[Facebook API] โพสต์สำเร็จ id=${fbRes.id || fbRes.post_id}`);
            postResult = {
                status: "PUBLISHED",
                provider: "facebook",
                fb_post_id: fbRes.id || fbRes.post_id,
                platforms: ["facebook"],
                imageUrl: finalImageUrl
            };
        }

        results.push({
            ...item,
            distribution: postResult
        });
    }

    // 4. Output Final System Log State
    console.log(JSON.stringify({
      status: "SUCCESS",
      role: "Output(Distribution)",
      data: results,
      timestamp: new Date().toISOString()
    }, null, 2));

  } catch (error: any) {
    console.log(JSON.stringify({
      status: "FAILED",
      role: "Output(Distribution)",
      error: error.message,
      timestamp: new Date().toISOString()
    }, null, 2));
  }
}

run();
