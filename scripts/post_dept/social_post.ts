import { readFileSync } from "fs";
import { stampSticker, uploadImage } from "./stamp_sticker";

const AYRSHARE_API_KEY = process.env.AYRSHARE_API_KEY;
const FB_PAGE_TOKEN = process.env.FB_PAGE_TOKEN;
const FB_PAGE_ID = process.env.FB_PAGE_ID;
const IG_USER_ID = process.env.IG_USER_ID; // Instagram Business account id (ผูกกับเพจ) — มีแล้วจะโพสต์ IG ตรงด้วย

if (!AYRSHARE_API_KEY && !FB_PAGE_TOKEN) {
  console.error(JSON.stringify({ status: "FAILED", role: "Output(Distribution)", error: "Missing AYRSHARE_API_KEY and FB_PAGE_TOKEN — ต้องมีอย่างน้อย 1 อย่าง" }, null, 2));
  process.exit(1);
}

// === Instagram Graph API (ตรง ไม่ผ่าน Ayrshare = ไม่มีลายน้ำ) ===
// ขั้นตอนมาตรฐาน 2 จังหวะ: สร้าง media container → publish
async function postViaInstagram(caption: string, imageUrl: string): Promise<any> {
  if (!FB_PAGE_TOKEN || !IG_USER_ID) throw new Error("Missing FB_PAGE_TOKEN or IG_USER_ID");
  const mediaRes = await fetch(`https://graph.facebook.com/v19.0/${IG_USER_ID}/media`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ image_url: imageUrl, caption, access_token: FB_PAGE_TOKEN }),
  });
  const media = await mediaRes.json();
  if (!mediaRes.ok) throw new Error(`IG media Error: ${JSON.stringify(media)}`);
  const pubRes = await fetch(`https://graph.facebook.com/v19.0/${IG_USER_ID}/media_publish`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ creation_id: media.id, access_token: FB_PAGE_TOKEN }),
  });
  const pub = await pubRes.json();
  if (!pubRes.ok) throw new Error(`IG publish Error: ${JSON.stringify(pub)}`);
  return pub;
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

        // 🧹 sanitize: ล้างสัญลักษณ์ที่ทำให้อ่านขัด — markdown '**', bullet '*', '#' กลางประโยค
        // หมายเหตุ: แท็กหมวด [News]/[Deal]/[Update] = ตั้งใจให้โชว์บนโพสต์ ไม่ลบ
        caption = caption
          .replace(/\*\*/g, "")
          .replace(/^\s*\*\s+/gm, "- ")
          .replace(/#/g, "")
          .replace(/[ \t]{2,}/g, " ")
          .trim();

        // ⛔ guard ชั้นสุดท้าย: วัด "เนื้อข่าวจริง" หลังตัด CTA + แท็กหมวดออก → กันโพสต์เหลือแต่ CTA ลอยๆ
        // (CTA ยาว ~48 ตัว เคยทำให้ guard เดิมที่วัด length เฉยๆ ผ่านทั้งที่ไม่มีข่าว)
        const realBody = caption
          .replace(/ติดตามเพจ[^\n]*/g, "")
          .replace(/เกมปังv2/gi, "")
          .replace(/\[(News|Deal|Update)\]/gi, "")
          .replace(/["'\s]/g, "");
        if (realBody.length < 20) {
          console.error(`[Post] ข้าม item — ไม่มีเนื้อข่าวจริงหลังตัด CTA (${realBody.length} chars): "${caption.slice(0, 50)}"`);
          results.push({ ...item, distribution: { status: "SKIPPED", reason: "empty caption (CTA-only)" } });
          continue;
        }

        // === เพิ่มข้อความทิ้งท้ายเพจถ้าไม่มี ===
        const CTA_TEXT = "ติดตามเพจใหม่เพื่อรับข่าวสารเพิ่มเติมได้ที่นี่ เกมปังv2";
        if (!caption.includes("ติดตามเพจ") && !caption.includes("เกมปังv2")) {
          caption = caption.trimEnd() + "\n\n" + CTA_TEXT;
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
                    || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i)
                    || html.match(/<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i);
                if (ogMatch?.[1]) {
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

        // === กรอง URL ที่ไม่ใช่รูปภาพออก (YouTube, video embeds) ===
        if (rawImageUrl && (rawImageUrl.includes('youtube.com') || rawImageUrl.includes('youtu.be') || rawImageUrl.includes('/embed/'))) {
            console.error(`[Image] ข้าม URL วิดีโอ: ${rawImageUrl}`);
            rawImageUrl = undefined;
        }

        // === กฎแอดมิน: หารูปข่าวไม่เจอ → ไม่โพสต์เลย (guardian บล็อก) ===
        if (!rawImageUrl) {
            console.error(`[Guardian] บล็อกโพสต์: หารูปข่าวไม่เจอ → ไม่ลง "${(item.source_article?.title || "").slice(0, 60)}"`);
            results.push({ ...item, distribution: { status: "BLOCKED", reason: "ไม่มีรูปข่าว — guardian บล็อก (กฎแอดมิน)" } });
            continue;
        }

        // === แปะการ์ดน้องปัง + headline ลงบนรูปข่าวจริง ===
        let finalImageUrl = rawImageUrl;
        try {
            const mood = scriptJson.mood === "fail" ? "fail" : "good";
            const headline = scriptJson.headline || item.source_article?.title || "";
            // สร้าง summary จาก caption
            const capStr = typeof caption === "string" ? caption : "";
            const summaryLines = capStr.split("\n").filter((l: string) => l.trim() && !l.includes("ติดตามเพจ") && !l.includes("เกมปังv2")).slice(0, 3);
            const summary = summaryLines.join("\n").slice(0, 200);
            const idx = results.length;
            const localPath = await stampSticker(rawImageUrl, mood, headline, `post_${idx}.jpg`, summary);
            finalImageUrl = await uploadImage(localPath);
            console.error(`[Sticker] ${mood} + headline → ${finalImageUrl}`);
        } catch (e: any) {
            console.error(`[Sticker] แปะไม่ได้ ใช้รูปเดิม: ${e.message}`);
        }

        // autoHashtag ปิดถาวร — Ayrshare เคยยัด # กลางประโยค (แม้แต่ใน CTA) ทำให้อ่านขัดมาก
        const payload: any = {
            post: caption,
            platforms: finalImageUrl ? ["facebook", "instagram"] : ["facebook"],
        };
        if (finalImageUrl) {
            payload.mediaUrls = [finalImageUrl];
        }

        // 3. โพสต์: FB/IG Graph API ตรง (หลัก — ไม่มีลายน้ำ "[Sent with Free Plan]") → Ayrshare (สำรอง)
        let postResult: any = null;
        let usedProvider = FB_PAGE_TOKEN && FB_PAGE_ID ? "facebook-direct" : "ayrshare";
        // กันโพสต์เบิ้ล: ถ้าเคยยิง FB ไปแล้ว (แม้ throw — FB อาจสร้างโพสต์สำเร็จแต่ network ขาด)
        // ห้ามวนกลับมายิง FB ซ้ำผ่าน fallback เด็ดขาด
        let fbAttempted = false;

        if (usedProvider === "facebook-direct") {
            fbAttempted = true;
            try {
                const fbRes = await postViaFacebook(caption, finalImageUrl);
                console.error(`[FB direct] โพสต์สำเร็จ id=${fbRes.id || fbRes.post_id}`);
                const platforms: any[] = [{ platform: "facebook", id: fbRes.id || fbRes.post_id, status: "success" }];
                if (IG_USER_ID && finalImageUrl) {
                    try {
                        const igRes = await postViaInstagram(caption, finalImageUrl);
                        console.error(`[IG direct] โพสต์สำเร็จ id=${igRes.id}`);
                        platforms.push({ platform: "instagram", id: igRes.id, status: "success" });
                    } catch (e: any) {
                        console.error(`[IG direct] ไม่สำเร็จ (FB โพสต์ไปแล้ว): ${e.message}`);
                        platforms.push({ platform: "instagram", status: "failed", error: e.message });
                    }
                }
                postResult = { status: "PUBLISHED", provider: "facebook-direct", platforms, imageUrl: finalImageUrl };
            } catch (e: any) {
                // FB ตรงล่ม → ค่อยถอยไป Ayrshare (ยอมมีลายน้ำดีกว่าไม่ได้โพสต์)
                console.error(`[FB direct] Error → fallback Ayrshare: ${e.message}`);
                usedProvider = "ayrshare";
            }
        }

        if (!postResult && usedProvider === "ayrshare" && AYRSHARE_API_KEY) {
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
            } else if (!postRes.ok) {
                const hasSuccess = Array.isArray(postResponseJson.postIds) && postResponseJson.postIds.some((p: any) => p.status === "success");
                if (!hasSuccess) {
                    // ลอง fallback ไป Facebook ก่อน throw
                    if (FB_PAGE_TOKEN) {
                        console.error(`[Ayrshare] Error ${postRes.status} → fallback Facebook API`);
                        usedProvider = "facebook";
                    } else {
                        throw new Error(`Ayrshare API Error: ${postRes.status} - ${JSON.stringify(postResponseJson)}`);
                    }
                }
            } else {
                postResult = {
                    status: "PUBLISHED",
                    provider: "ayrshare",
                    ayrshare_id: postResponseJson.id || postResponseJson.refId,
                    platforms: postResponseJson.postIds,
                    imageUrl: finalImageUrl
                };
            }
        } else if (!postResult && usedProvider === "ayrshare") {
            // ไม่มี AYRSHARE_API_KEY → ลอง Facebook ตรงเป็นทางสุดท้าย
            usedProvider = "facebook";
        }

        // Fallback: Facebook Graph API (เฉพาะตอนยังไม่มีผลโพสต์เท่านั้น — กันโพสต์เบิ้ล)
        if (!postResult && usedProvider === "facebook") {
            if (!FB_PAGE_TOKEN || !FB_PAGE_ID) {
                throw new Error("Ayrshare quota หมด และไม่มี FB_PAGE_TOKEN/FB_PAGE_ID สำรอง");
            }
            // ⛔ ถ้า FB-direct ยิงไปแล้ว (อาจสำเร็จเงียบๆ ทั้งที่ throw) ห้ามยิงซ้ำ — กันโพสต์เบิ้ล
            if (fbAttempted) {
                console.error("[Post] FB-direct ยิงไปแล้ว + Ayrshare ใช้ไม่ได้ → ไม่ยิง FB ซ้ำ (กันโพสต์เบิ้ล)");
                results.push({ ...item, distribution: { status: "FAILED", reason: "FB-direct error + Ayrshare unavailable — ไม่ re-post กันเบิ้ล" } });
                continue;
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
