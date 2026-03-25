# n8n Architectural Strategy: AI Content Factory

## The Router (CEO) & Trigger Node
1. **Trigger Node**: Schedule Trigger (e.g., Every day at 08:00 AM).
2. **Execute Command Node (The Researcher)**: 
   - Command: `bun run d:/peerapong/P/Code For P/ai-content-factory/scripts/fetch_news.ts`
   - Output (JSON) goes to the next node.

## The Executor (Prompt Prep)
3. **Execute Command Node (The Executor)**: 
   - Command: `bun run d:/peerapong/P/Code For P/ai-content-factory/scripts/process_content.ts '{{ $json.stdout }}'`
   - This parses the Researcher's JSON, applies Guardian rules, and prepares the exact API prompt payload.

## Gemini API Invocation
4. **HTTP Request Node**:
   - URL: `https://generativelanguage.googleapis.com/...`
   - Payload: Bind exactly from The Executor's output (`{{$json.stdout.payload}}`).
   - This isolates heavy text processing to Bun, and uses n8n simply as an orchestration router.

## The Guardian & Approval
5. **If Node (Guardrail Check)**:
   - Condition: Check if `status == FAILED` in previous nodes. Provide an alert (e.g., Line Notify) if failed and halt.
6. **Wait Node (Approval)**:
   - Wait for Webhook / Manual Resume before sending script to TikTok/Reels APIs.
   - Prevents AI hallucinations from going live instantly.

## The Summarizer
7. **Google Sheets / Notion Node**:
   - Log the generated Script, the Timestamp, and Estimated Token Costs for budget tracking over the 1,000 THB/month limit.
