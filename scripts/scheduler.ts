import { $ } from "bun";

const INTERVAL_MINUTES = 15;
const INTERVAL_MS = INTERVAL_MINUTES * 60 * 1000;

function timestamp(): string {
  return new Date().toLocaleString("th-TH", { timeZone: "Asia/Bangkok" });
}

async function runPipeline() {
  console.log(`\n${"=".repeat(50)}`);
  console.log(`[${timestamp()}] PANG GAME COMPANY: Pipeline Starting...`);
  console.log(`${"=".repeat(50)}\n`);

  try {
    // Step 1: Fetch News
    console.log("➤ [1/5] THE RESEARCHER: Fetching latest news...");
    const researcherResult = await $`bun run scripts/fetch_news.ts`.text();
    const researcherJson = JSON.parse(researcherResult);

    if (researcherJson.status === "FAILED" || !researcherJson.data?.length) {
      console.log(`[${timestamp()}] No new news found. Sleeping ${INTERVAL_MINUTES} min...\n`);
      return;
    }

    console.log(`  Found ${researcherJson.data.length} new article(s)`);

    // Step 2: Generate Content
    console.log("➤ [2/5] THE EXECUTOR: Generating content via Gemini...");
    const executorResult = await $`bun run scripts/process_content.ts ${researcherResult}`.text();
    const executorJson = JSON.parse(executorResult);

    if (executorJson.status !== "SUCCESS") {
      console.log(`[${timestamp()}] Executor failed: ${executorJson.error || executorJson.msg}`);
      return;
    }

    // Step 3: Render Static Image
    console.log("➤ [3/5] THE GRAPHIC: Rendering static image...");
    const renderResult = await $`bun run scripts/post_dept/render_static.ts ${executorResult}`.text();

    // Step 4: Telegram Approval
    console.log("➤ [4/5] THE GUARDIAN: Sending to Telegram for approval...");
    const approvalResult = await $`bun run scripts/request_approval.ts ${renderResult}`.text();

    // Step 5: Post to Social
    console.log("➤ [5/5] THE DISTRIBUTOR: Posting to Facebook & Instagram...");
    const postResult = await $`bun run scripts/post_dept/social_post.ts ${approvalResult}`.text();

    console.log(`\n[${timestamp()}] Pipeline completed.`);
    console.log(postResult);

  } catch (error: any) {
    console.error(`[${timestamp()}] Pipeline error: ${error.message}`);
  }
}

// Run immediately on start
console.log(`PANG GAME COMPANY - Auto Scheduler`);
console.log(`Interval: every ${INTERVAL_MINUTES} minutes`);
console.log(`Started at: ${timestamp()}\n`);

await runPipeline();

// Then loop every 15 minutes
setInterval(runPipeline, INTERVAL_MS);
