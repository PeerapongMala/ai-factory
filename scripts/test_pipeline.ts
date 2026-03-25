import { $ } from "bun";

console.log("=== PANG GAME COMPANY: Static Post Pipeline ===");
console.log("➤ [1/5] THE RESEARCHER: Fetching latest news from RSS...");

const researcherResult = await $`bun run scripts/fetch_news.ts`.text();

console.log("➤ [2/5] THE EXECUTOR: Generating content via Gemini...");

const executorResult = await $`bun run scripts/process_content.ts ${researcherResult}`.text();

console.log("➤ [3/5] THE GRAPHIC: Rendering static image via Creatomate...");

const renderResult = await $`bun run scripts/post_dept/render_static.ts ${executorResult}`.text();

console.log("➤ [4/5] THE GUARDIAN: Sending to Telegram for approval...");

const approvalResult = await $`bun run scripts/request_approval.ts ${renderResult}`.text();

console.log("➤ [5/5] THE DISTRIBUTOR: Posting to Facebook & Instagram...");

const postResult = await $`bun run scripts/post_dept/social_post.ts ${approvalResult}`.text();

console.log("\n====== FINAL PIPELINE OUTPUT ======\n");
console.log(postResult);
console.log("\n===================================\n");
