import { readFileSync } from "fs";

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;

if (!TELEGRAM_BOT_TOKEN || !CHAT_ID) {
  console.error(JSON.stringify({ status: "FAILED", role: "Guardian", error: "Missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID" }, null, 2));
  process.exit(1);
}

async function run() {
  try {
    // 1. Read input payload (from render_static.ts output)
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
       console.log(JSON.stringify({ status: "SKIPPED", role: "Guardian", msg: "No posts to send for approval." }, null, 2));
       return;
    }

    const results = [];

    // 2. Loop through finished renders and send photo + caption preview to Telegram
    for (const item of inputData.data) {
        const imageUrl = item.static_render?.url || item.render_job?.url || item.url;
        const title = item.source_article?.title || "New Post";
        const caption = item.generated_script?.caption || "";

        if (!imageUrl) {
           console.error(JSON.stringify({ status: "SKIPPED", msg: "Missing Image URL from Render payload." }));
           continue;
        }

        const telegramApiUrl = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendPhoto`;

        // Inline Keyboard Layout
        const replyMarkup = {
            inline_keyboard: [
                [
                    { text: "✅ APPROVE & POST", callback_data: `APPROVE_${Date.now()}` },
                    { text: "❌ REJECT", callback_data: `REJECT_${Date.now()}` }
                ]
            ]
        };

        // Preview: show image + caption that will be posted
        const previewCaption = caption.length > 600 ? caption.substring(0, 600) + "..." : caption;
        const captionMsg = `⚠️ <b>PANG GAME - APPROVE?</b> ⚠️\n\n<b>Title:</b> ${title}\n\n<b>Caption Preview:</b>\n${previewCaption}`;

        // 3. Fire the sendPhoto request
        const res = await fetch(telegramApiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: CHAT_ID,
                photo: imageUrl,
                caption: captionMsg,
                parse_mode: "HTML",
                reply_markup: replyMarkup
            })
        });

        if (!res.ok) {
            const err = await res.text();
            throw new Error(`Telegram API Error: ${res.status} - ${err}`);
        }

        const telegramResponse = await res.json();

        results.push({
            ...item,
            guardian: {
                status: "AWAITING_HUMAN_APPROVAL",
                telegram_message_id: telegramResponse.result.message_id
            }
        });
    }

    // 4. Output final state for n8n Wait Node
    console.log(JSON.stringify({
      status: "SUCCESS",
      role: "Guardian",
      data: results,
      timestamp: new Date().toISOString()
    }, null, 2));

  } catch (error: any) {
    console.log(JSON.stringify({
      status: "FAILED",
      role: "Guardian",
      error: error.message,
      timestamp: new Date().toISOString()
    }, null, 2));
  }
}

run();
