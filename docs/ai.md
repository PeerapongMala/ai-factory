# AI Ranking & Free Provider (อัพเดท มี.ค. 2026)

## Chatbot Arena Top 15 (คนโหวตเทียบกัน)

| อันดับ | Model                    | บริษัท    | Elo  |
| ------ | ------------------------ | --------- | ---- |
| 1      | Claude Opus 4.6 Thinking | Anthropic | 1502 |
| 2      | Claude Opus 4.6          | Anthropic | 1501 |
| 3      | Gemini 3.1 Pro           | Google    | 1493 |
| 4      | Grok 4.20                | xAI       | 1492 |
| 5      | Gemini 3 Pro             | Google    | 1486 |
| 6      | GPT-5.4                  | OpenAI    | 1485 |
| 7      | GPT-5.2                  | OpenAI    | 1482 |
| 8      | Grok 4.20 Reasoning      | xAI       | 1481 |
| 9      | Gemini 3 Flash           | Google    | 1475 |
| 10     | Claude Opus 4.5 Thinking | Anthropic | 1474 |
| 11     | Grok 4.1 Thinking        | xAI       | 1472 |
| 12     | Claude Opus 4.5          | Anthropic | 1469 |
| 13     | Claude Sonnet 4.6        | Anthropic | 1465 |
| 14     | Qwen 3.5 Max             | Alibaba   | 1464 |
| 15     | GPT-5.3                  | OpenAI    | 1464 |

ที่มา: arena.ai/leaderboard

---

## Artificial Analysis Intelligence Index

| อันดับ | Model               | บริษัท    | Score |
| ------ | ------------------- | --------- | ----- |
| 1      | Gemini 3.1 Pro      | Google    | 57    |
| 2      | GPT-5.4             | OpenAI    | 57    |
| 3      | GPT-5.3 Codex       | OpenAI    | 54    |
| 4      | Claude Opus 4.6     | Anthropic | 53    |
| 5      | Claude Sonnet 4.6   | Anthropic | 52    |
| 6      | GLM-5 Reasoning     | Z AI      | 50    |
| 7      | Kimi K2.5 Reasoning | Moonshot  | 47    |
| 8      | Qwen 3.5 397B       | Alibaba   | 45    |

ที่มา: artificialanalysis.ai

---

## Ollama ยอดนิยม (รันเครื่องตัวเอง)

| อันดับ | Model       | Downloads | ขนาด      |
| ------ | ----------- | --------- | --------- |
| 1      | llama3.1    | 112M      | 8B/70B    |
| 2      | deepseek-r1 | 81M       | 7B-671B   |
| 3      | llama3.2    | 62M       | 1B-90B    |
| 4      | gemma3      | 34M       | 1B-27B    |
| 5      | mistral     | 27M       | 7B        |
| 6      | qwen2.5     | 26M       | 0.5B-72B  |
| 7      | qwen3       | 25M       | 0.6B-235B |
| 8      | llama3      | 20M       | 8B/70B    |
| 9      | gemma2      | 19M       | 9B/27B    |
| 10     | phi3        | 17M       | 3.8B/14B  |

ที่มา: ollama.com/library

---

## LLM ภาษาไทย

| Model           | บริษัท          | จุดเด่น                            |
| --------------- | --------------- | ---------------------------------- |
| Typhoon 2 (70B) | SCB 10X         | LLM ไทยอันดับ 1                    |
| Chinda 4B       | iApp Technology | เล็กแต่เก่งไทยสุด                  |
| OpenThaiGPT 70B | Open-source     | ระดับ GPT-3.5 - GPT-4              |
| Qwen 2.5/3      | Alibaba         | multilingual รวมไทย ใช้ Ollama ได้ |

---

## Free AI API เรียงตามดีที่สุด

| อันดับ | Provider          | ฟรีเท่าไหร่                 | คุณภาพ      | JSON Mode | สมัคร                      |
| ------ | ----------------- | --------------------------- | ----------- | --------- | -------------------------- |
| 1      | **Mistral**       | 1B tokens/month (ทุก model) | ดีมาก       | Yes       | https://console.mistral.ai |
| 2      | **Cerebras**      | 1M tokens/day               | ดี เร็วสุด  | Yes       | https://cloud.cerebras.ai  |
| 3      | **Google Gemini** | 1,000 req/day (Flash-Lite)  | ดีมาก       | Yes       | https://ai.google.dev      |
| 4      | **Groq**          | ~14,400 req/day             | ดี เร็วมาก  | Yes       | https://console.groq.com   |
| 5      | **SambaNova**     | Llama 405B ฟรี              | ดีมาก       | Yes       | https://cloud.sambanova.ai |
| 6      | **OpenRouter**    | 200 req/day (29 model)      | แล้วแต่รุ่น | Yes       | https://openrouter.ai      |

ทั้งหมดไม่ต้องบัตรเครดิต ฟรีถาวร

---

## ไม่ฟรีแต่ถูกมาก

| Provider        | ราคา                   | หมายเหตุ                          |
| --------------- | ---------------------- | --------------------------------- |
| Kimi (Moonshot) | $0.60/1M tokens        | ต้องเติมขั้นต่ำ $1                |
| DeepSeek        | $0.14/1M tokens        | ฟรี 5M tokens ครั้งเดียว (30 วัน) |
| OpenAI          | $0.15/1M (gpt-4o-mini) | free tier แค่ GPT-3.5             |
| Claude          | $0.25/1M (Haiku)       | ฟรี ~$5 ครั้งเดียว                |

---

## Config ใช้กับโปรเจคนี้

### Mistral (แนะนำ #1)

```json
{
  "provider": "openai",
  "model": "mistral-large-latest",
  "apiKeyEnv": "MISTRAL_API_KEY",
  "baseUrl": "https://api.mistral.ai/v1"
}
```

### Cerebras (#2)

```json
{
  "provider": "openai",
  "model": "llama-3.3-70b",
  "apiKeyEnv": "CEREBRAS_API_KEY",
  "baseUrl": "https://api.cerebras.ai/v1"
}
```

### Gemini (#3)

```json
{ "provider": "gemini", "model": "gemini-2.5-flash-lite" }
```

### Groq (#4)

```json
{
  "provider": "openai",
  "model": "llama-3.3-70b-versatile",
  "apiKeyEnv": "GROQ_API_KEY",
  "baseUrl": "https://api.groq.com/openai/v1"
}
```

### Kimi (ถูกมาก แต่ไม่ฟรี)

```json
{
  "provider": "openai",
  "model": "kimi-k2.5",
  "apiKeyEnv": "MOONSHOT_API_KEY",
  "baseUrl": "https://api.moonshot.ai/v1"
}
```

แก้ใน `config/agents/writer.json` แค่นี้ ไม่ต้องแก้โค้ด

---

---

# โน้ต / Reference

วิธีใช้ AI Agents ในการเทรดให้ได้ประสิทธิภาพสูง ไม่ใช่แค่เอา AI มาสั่งซื้อขายแทนเรา แต่ต้องใช้มันให้ "คิดเป็น" ก่อนเข้าเทรด
.
"gumAItrade - กูไม่เทรด AI" - หลายคนยังมองว่า AI ในการเทรด คือแค่ระบบที่เอาไว้ "ส่งออเดอร์อัตโนมัติ"
แต่จริง ๆ แล้ว AI Agent ที่ดีควรทำได้มากกว่านั้น มันควรช่วยตั้งแต่

1. สแกนตลาดหลายเหรียญพร้อมกัน
2. อ่าน indicator หลายชุดในหลาย timeframe
3. ประเมิน market regime
4. วางแผน entry / exit และ position sizing
5. จัดการ risk ตามระดับที่เรารับได้

5-layer AI Agent: Scan → Analyze → Plan → Monitor → Relearn

Claude Cowork ทำให้เรากลายเป็น 1 คน x 10 เท่า (เพิ่มประสิทธิภาพตัวเอง)
OpenClaw ทำให้ 1 คน = 1 ทีม (คนเดียวมีทีมงาน AI ทั้งทีม)

❌ ให้น้องทำทุกอย่างเอง → มันก็แค่ AI chatbot
❌ ให้น้องเรียก API ตรงๆ → ก็แค่ script ธรรมดา
✅ ให้น้องเป็นคนสั่ง ตัดสินใจ ควบคุมระบบที่เราสร้าง → นี่แหละ Agent จริงๆ

ระบบ (pipeline, tools, API) เราสร้าง.. แต่ให้น้องเป็นคนคิด สั่ง ตัดสินใจ
เหมือนเรา hire คน 1 คน แล้วให้ SOP กับเครื่องมือ.. ไม่ใช่ให้เขาประดิษฐ์เครื่องมือเอง

Links:

- https://github.com/smlsoft/smltrack (Mini CRM)
- https://pns.probably-anything.com (AI Gold Trading)
- https://github.com/thx0701/openclaw-virtual-office (Pixel Art Dashboard)
  -/github.com/xmanrui/OpenClaw-bot-review

สร้างพนักงานขาย AI ที่ทำงาน 24 ชม. ด้วยงบ 700 บาท/เดือน
ใช้ OpenClaw + Claude Cowork → Inbox Monitoring → Prospect Research → Personalized Outreach → ปิดดีล

Host เว็บผ่าน vercel แต่อยากใช้ domain .com ทำได้ไหมครับ แนะนำได้นะครับ ขอบคุณล่วงหน้าครับ
ได้ครับ (ของผมทำ .online เพราะราคาถูก หมดปีก็เปลี่ยนไปเรื่อยๆ ไม่ต่อ)
https://www.youtube.com/watch?v=gu3SJB6hXyk
ผมลองดูคลิปนี้พอเข้าใจ น่าจะเป็นประโยชน์นะครับ ขอบคุณพี่ Pratya Suree ด้วยครับ
ปที่ Vercel แล้วไปที่ Domain ครับ ให้เลือก Add Domain ของเราได้เลย Vercel จะแสดงผล
ตัว Setup DNS , Cname ให้ครับ
ถ้า Doamin เราแอดบน Cloudflare แล้ว ก็ เชื่อมต่อ อัตโนมัติได้เลยครับ แค่ไปยันยันใน cloudlfare (วิธีนี้) ง่ายที่สุด รอ ประมาณ 3-4 นาทีก็เรียบร้อยครับ
ทำได้ครับ​ vercel มีขาย​ domain .com กับ​.อื่นๆ​ แล้วก็​ custom domain name ผูกกับโปรเจคที่มีอยู่ในบัญชี​เดียวกันได้เลย
ในที่สุดโมเดลใหม่ที่ผมได้โอกาส early test ก่อนมาช่วงหนึ่ง ก็เปิดตัวอย่างเป็นทางการแล้วครับ GLM-5-Turbo จาก Z. AI นอกจากนี้ยังให้ใช้ 3 เท่าบางช่วงเวลาด้วย โหดกว่า OpenAI และ Claude ที่ให้ \*2 อีก !!! แต่เศร้าที่ โมเดลนี้ไม่ใช่ Open source นะครับ 🙁
โดยส่วนตัวผมมองว่านี่คือโมเดลที่ดีที่สุดและคุ้มค่าที่สุด โดยเฉพาะถ้าเอามาใช้กับ OpenClaw แบบที่ผมใช้งานอยู่ คือ monitor ทุก 5 นาที รัน agent อยู่ 8 projects พร้อมกัน ก็ไม่เคยติด limit เลยสักครั้ง ที่สำคัญคือ tool use ดีมากๆ โหดกว่า Gemini 3.1 Pro และ Kimi K2.5 และ MiniMax M 2.5 ชัดเจนครับ
มีหลายคนถามมาว่าต่อ OpenClaw ไม่ผิดกฎอะไรใช่ไหมใช่ครับ ตัวนี้เขาทำมาเพื่อ OpenClaw เลย แล้วก็สามารถที่จะใช้โควต้าเดียวกันใช้ GLM-5 เขียนโค้ด หรือว่าใช้งานอื่นๆบนหน้าเว็บไซต์เขาได้เหมือน Gemini
สาเหตุที่มันดีขึ้นเพราะเขา Train มาเพื่องานแนว OpenClaw โดยเฉพาะ ตั้งแต่ขั้นตอนการสร้าง training data ไปจนถึงการออกแบบ optimization objectives เขาได้สร้าง task scenarios ของ OpenClaw จาก agent workflows ในโลกจริงอย่างเป็นระบบ มา train เพื่อให้มั่นใจว่าโมเดลสามารถทำงานที่ซับซ้อน เปลี่ยนแปลงตลอดเวลา และต้องทำต่อเนื่องเป็น chain ยาวได้จริง
═══════════════════
📌 GLM-5-Turbo คืออะไร?
🔹 เป็น foundation model ที่ถูก optimize อย่างลึกซึ้งเพื่อการใช้งานบน OpenClaw โดยเฉพาะ
🔹 ถูกปรับแต่งตั้งแต่ขั้นตอน training เลย ไม่ใช่แค่ fine-tune ทีหลัง
🔹 รองรับ context length สูงถึง 200K tokens
🔹 สามารถสร้าง output ได้สูงสุด 128K tokens
🔹 รับ input เป็นข้อความ และ output เป็นข้อความเช่นกัน
═══════════════════
🎯 ความสามารถหลัก 4 ด้านที่ถูกยกระดับ
Tool Calling ที่แม่นยำ ไม่พลาด
🔹 เสริมความสามารถในการเรียกใช้ external tools และ skills ต่างๆ ให้เสถียรและเชื่อถือได้มากขึ้น
🔹 ทำให้งานบน OpenClaw เปลี่ยนจากแค่ "สนทนา" ไปสู่ "ลงมือทำจริง" ได้
การทำความเข้าใจคำสั่งซับซ้อน (Instruction Following)
🔹 เข้าใจและแยกแยะคำสั่งที่ซับซ้อน หลายชั้น และเป็น chain ยาวได้ดีขึ้น
🔹 ระบุเป้าหมาย วางแผนขั้นตอน และรองรับการแบ่งงานระหว่าง agent หลายตัวได้
งานตั้งเวลาและงานที่ต้องทำต่อเนื่อง (Scheduled and Persistent Tasks)
🔹 ปรับปรุงการทำงานแบบตั้งเวลา (scheduled triggers) การทำงานต่อเนื่อง (continuous execution) และงานที่ใช้เวลานาน (long-running tasks)
🔹 เข้าใจมิติของเวลาได้ดีขึ้น และรักษาความต่อเนื่องในการทำงานระหว่างงานที่ซับซ้อน
งาน throughput สูงและ chain ยาว (High-Throughput Long Chains)
🔹 สำหรับงานที่มี data throughput สูงและ logical chain ยาว GLM-5-Turbo ยกระดับทั้งประสิทธิภาพและความเสถียร
🔹 เหมาะสำหรับการนำไปใช้ใน business workflows จริงๆ
═══════════════════
💡 ความสามารถเพิ่มเติมที่รองรับ
🔹 Thinking Mode รองรับหลายโหมดความคิดสำหรับสถานการณ์ต่างๆ
🔹 Streaming Output ตอบแบบ real-time ทำให้ประสบการณ์การใช้งานลื่นไหล
🔹 Function Call เรียกใช้ tools ภายนอกได้อย่างทรงพลัง
🔹 Context Caching มีระบบ caching อัจฉริยะ ช่วยให้บทสนทนายาวๆ ทำงานได้ดีขึ้น
🔹 Structured Output รองรับ output แบบ JSON เพื่อเชื่อมต่อกับระบบอื่นได้ง่าย
🔹 MCP เชื่อมต่อ external tools และ data sources ผ่าน MCP ได้อย่างยืดหยุ่น
═══════════════════
💰 เรื่องราคา ทำไมผมถึงบอกว่าคุ้มมาก
🔹 ปัจจุบัน Z. AI มีแพลน subscription ที่ถ้ารวมส่วนลดในคอมเมนต์ของผมอีก 10% จะอยู่ที่ประมาณเดือนละ 50 USD (สมัครรายปี)
🔹 แต่ใช้งานได้เทียบเท่ากับ Claude Max 200 USD คูณ 3 accounts เลยครับ
🔹 ถ้าสมัครแพลน Pro ซึ่งมูลค่าเทียบเท่า Claude Max 100 USD คูณ 3 accounts จ่ายแค่เดือนละ 19 USD เท่านั้น
🔹 สำหรับแพลน Max จะใช้ GLM-5-Turbo ได้เลย ส่วนแพลน Pro ก็ยังใช้ GLM-5 ตัวเต็มได้ ซึ่งประสิทธิภาพใกล้เคียง Opus 4.5 และดีกว่า Gemini 3 Pro
═══════════════════
🏁 สรุป
🔹 GLM-5-Turbo เป็นโมเดลที่ถูกสร้างมาเพื่อ agentic workflows โดยเฉพาะ ไม่ใช่แค่โมเดลภาษาทั่วไปที่เอามาปรับใช้
🔹 จุดเด่นชัดเจนคือ tool calling ที่เสถียร, เข้าใจคำสั่งซับซ้อนได้ดี, รองรับงานยาวนาน และทำงาน chain ยาวได้อย่างมีประสิทธิภาพ
🔹 จากประสบการณ์ส่วนตัวที่รัน 8 projects พร้อมกัน monitor ทุก 5 นาที ไม่เคยติด limit
🔹 ราคาคุ้มค่ามากเมื่อเทียบกับคู่แข่ง โดยเฉพาะถ้าใช้งานแบบ subscription
🔹 ใครที่ใช้ OpenClaw อยู่แล้ว หรือกำลังมองหาโมเดลสำหรับงาน agent ผมแนะนำให้ลองครับ
เน้นนะครับว่า ถ้าเขียน Code ทั่วไป หรือใช้งานทั่วไป แนะนำให้ใช้ GLM-5 มากกว่านะครับ

จัดการ 100 Agent ใน 1 นาที! ด้วย Dashboard ฟรี ที่ติดตั้งใน 1 บรรทัด! 🚀
.
ใครที่เริ่มมี Agent หลายตัวคงเข้าใจดี... ความวุ่นวายเริ่มมาเยือน!
•Agent ตัวนี้ใช้โมเดลอะไรนะ?
•Token ที่จ่ายไปเท่าไหร่แล้ว?
•Gateway ยังอยู่ดีไหม? หรือล่มไปแล้ว?
•ต้อง ssh เข้าไปดู log ตลอดเวลา น่าเบื่อ!
.
วันนี้ผมไปเจอของดีมาครับ! OpenClaw-bot-review (GitHub 1.4k ดาว) เป็น Dashboard ฟรี ที่มาแก้ปัญหาทั้งหมดนี้ในที่เดียว! และที่สำคัญ มันคือภาพอนาคตของ Digital Office ที่ทุกคนจะมีทีม AI ของตัวเอง!
.
ขั้นตอนที่ทำจริง (ทุกคนทำตามได้ใน 3 ขั้นตอน)
.
ขั้นตอนที่ 1 — ติดตั้งใน 1 บรรทัด (จริงๆนะ!)
ใช่ครับ อ่านไม่ผิด แค่ 1 บรรทัด! ให้ OpenClaw จัดการให้ทั้งหมด แค่ copy prompt ข้างล่างนี้ไปวางใน OpenClaw แล้วกด Enter:
"Please help me install and run this GitHub project, and send me the service URL: https://github.com/xmanrui/OpenClaw-bot-review"
(เทคนิคคือ: OpenClaw จะไป clone repo, ติดตั้ง dependencies, รันเซิร์ฟเวอร์, แล้วส่ง URL ของ Dashboard กลับมาให้เราเอง! จบ! )
.
ขั้นตอนที่ 2 — สำรวจ Dashboard (Digital Office ของคุณ)
พอได้ URL มาแล้ว ก็เปิดดูได้เลย! นี่คือ 3 เมนูหลักที่คุณจะได้ใช้บ่อยๆ
•
Bots Overview: หน้าแรกเลย จะเห็น Agent ทั้งหมดของคุณเป็นการ์ด บอกเลยว่าตัวไหน Online/Offline, ใช้ Model อะไร, คุยไปกี่ Session แล้ว
•
Statistics: เมนูนี้สำคัญมาก! เข้าไปดูได้ว่าแต่ละวันคุณใช้ Token ไปเท่าไหร่ จะได้ไม่เจ๊ง!
•
Pixel Office: เมนูโปรดของผม! กดเข้าไปดูทีม AI ของคุณในร่าง pixel art เดินเล่นในออฟฟิศ เหมือนคุณเป็น CEO เลย!
.
ขั้นตอนที่ 3 — (Optional) ติดตั้งแบบ Git (สำหรับสาย Dev)
สำหรับใครที่อยากดูโค้ด หรือชอบความคลาสสิก ก็ติดตั้งแบบปกติได้ครับ
git clone https://github.com/xmanrui/OpenClaw-bot-review.git
cd OpenClaw-bot-review
npm install
npm run dev
.
OpenClaw-bot-review คือเครื่องมือ "ต้องมี" สำหรับคนใช้ OpenClaw ทุกคนครับ มันคือจุดเริ่มต้นของการสร้าง 'Digital Office' ของคุณเอง อนาคตที่ทุกคนมีทีม AI ส่วนตัวมาถึงแล้ว และมันเริ่มต้นง่ายๆ แค่ 1 บรรทัดใน Terminal
Note: ใครมี Agent กี่ตัวกันบ้าง? ลองเอาไปใช้แล้วกลับมาโชว์ Dashboard กันหน่อยครับ! 👇
.
ใครอยากได้ออฟฟิศแนวอื่นๆ เพิ่ม พิมพ์ "ai" เดี๋ยวผมหามาแปะในคอมเม้นท์ให้เพิ่มครับ 🔥

---

## Image Processing ด้วย Sharp (Node.js)

### Pango Text API (สำหรับภาษาไทย)

```typescript
// วิธีที่ดีที่สุดสำหรับ Thai text บน image
const textBuf = await sharp({
  text: {
    text: `<span foreground="#FFD700" font_desc="Sans Bold 52">หัวข้อสีทอง</span>\n<span foreground="white" font_desc="Sans 36">รายละเอียดสีขาว</span>`,
    rgba: true,
    width: 800,
    align: "left",
  },
})
  .png()
  .toBuffer();
```

- `font_desc` ใช้ Pango format: `"FontFamily Style Size"` เช่น `"Sans Bold 52"`
- ต้องใช้ `rgba: true` เพื่อให้ได้ transparent background
- Thai text ต้องมี font ไทยติดตั้งในเครื่อง (Railway ใช้ nixpacks.toml: `aptPkgs = ["fonts-thai-tlwg"]`)
- SVG fallback ต้องแปลงเป็น PNG ก่อน composite: `sharp(Buffer.from(svg)).png().toBuffer()`

### Composite Tips

```typescript
// channels: 4 = RGBA (มี alpha/transparency)
await sharp({
  create: {
    width: 1080,
    height: 1080,
    channels: 4,
    background: { r: 0, g: 0, b: 0, alpha: 255 },
  },
})
  .composite([
    { input: photo, left: 0, top: 0 },
    { input: textBuf, left: 30, top: 864 },
    { input: stickerPng, left: 850, top: 870 },
  ])
  .jpeg({ quality: 90 })
  .toFile(outputPath);
```

- ใช้ `channels: 4` เสมอถ้ามี transparent elements
- `fit: "contain"` + transparent background สำหรับ resize สติกเกอร์
- `fit: "cover"` สำหรับ resize รูปข่าวให้เต็มพื้นที่

---

## Free Image Hosting APIs

| Provider       | Limit           | API                                      | หมายเหตุ         |
| -------------- | --------------- | ---------------------------------------- | ---------------- |
| imgbb          | 32MB/image      | POST https://api.imgbb.com/1/upload      | ฟรี ไม่ต้อง auth |
| freeimage.host | 10MB/image      | POST https://freeimage.host/api/1/upload | ฟรี ไม่ต้อง auth |
| Cloudinary     | 25GB storage    | SDK หลายภาษา                             | ต้องสมัคร        |
| Imgur          | 1250 upload/day | POST https://api.imgur.com/3/image       | ต้อง Client ID   |

ทั้ง imgbb และ freeimage.host รับ base64 ผ่าน form-urlencoded ไม่ต้อง auth header

---

## Social Media Posting APIs

### Ayrshare (ใช้ในโปรเจคนี้)

- POST ไปหลาย platform พร้อมกัน (FB, X, IG, TikTok)
- Free tier: 1 profile, limited posts
- Error 429 = rate limit → ต้อง retry
- ถ้า Ayrshare ล้ม fallback ไป Facebook Graph API ตรงได้

### Facebook Graph API (Fallback)

```typescript
const fbRes = await fetch(
  `https://graph.facebook.com/v22.0/me/photos?access_token=${FB_PAGE_TOKEN}`,
  { method: "POST", body: formData }, // source=imageUrl, message=caption
);
```

- Page Access Token ต้อง long-lived (60 วัน) แล้ว extend เป็น permanent
- Permission ที่ต้องมี: `pages_manage_posts`, `pages_read_engagement`

---

## Gaming News Sources (RSS/API)

| แหล่งข่าว       | URL / Feed                   | ภาษา | หมายเหตุ                     |
| --------------- | ---------------------------- | ---- | ---------------------------- |
| IGN             | feeds.feedburner.com/ign/all | EN   | ข่าวเกมหลากหลาย              |
| GameSpot        | gamespot.com/feeds/mashup    | EN   | รีวิว + ข่าว                 |
| PC Gamer        | pcgamer.com/rss              | EN   | เน้น PC                      |
| Eurogamer       | eurogamer.net/feed           | EN   | ยุโรป                        |
| Kotaku          | kotaku.com/rss               | EN   | วัฒนธรรมเกม                  |
| SteamDB         | steamdb.info                 | EN   | ติดตามราคา/ดีล               |
| DealBot (Steam) | isthereanydeal.com           | EN   | แจ้งเตือนราคาลด              |
| Sheapgamer      | sheapgamer.com               | TH   | ข่าวเกมไทย (style reference) |
| GameMonday      | gamemonday.com               | TH   | ข่าวเกมไทย                   |

---

## AI Content Pipeline — Lessons Learned

### Retry Strategy

```
429 (Rate Limit) → รอ 30s แล้ว retry
529/503 (Overloaded) → รอ 60s แล้ว retry
500 (Server Error) → รอ 10s แล้ว retry
Max retries: 3 ครั้ง + exponential backoff
```

### ข้อควรระวัง

1. **JSON output จาก LLM** — ต้อง validate เสมอ บางทีได้ markdown code block ครอบ JSON มา ต้อง strip ออก
2. **Memory ของ AI Agent** — object type feedback ทำให้ UI crash ต้อง handle ทั้ง string และ object
3. **Pending ID collision** — `Date.now()` อาจชนกัน ต้องเพิ่ม random suffix
4. **Fire-and-forget promises** — ต้องมี `.catch()` เสมอ ไม่งั้น unhandled rejection crash server
5. **Path traversal** — validate user input path ด้วย regex `/^[\w]+$/` ก่อนใช้
6. **Thai font ใน production** — ต้องติดตั้ง font ไทย (fonts-thai-tlwg) ใน Docker/nixpacks
7. **Image URL จาก OG tag** — บาง site ให้ relative URL หรือ URL ที่ 403 ต้อง fallback

### Architecture Pattern

```
RSS Feed → Reporter (scrape + summarize)
         → PM (plan + assign)
         → Writer (caption + mood + headline)
         → Graphic (stamp sticker + upload image)
         → Publisher (post to social media)
         → Guardian (quality check)
```

แต่ละ agent มี config แยก (`config/agents/*.json`) เปลี่ยน provider/model ได้โดยไม่ต้องแก้โค้ด

---

## CSS Isometric Pixel Art

```css
/* แปลง div ธรรมดาเป็น isometric view */
.isometric-floor {
  transform: scale(1, 0.56) rotate(45deg);
}

/* Counter-rotate สำหรับ text/characters ให้อ่านได้ */
.isometric-label {
  transform: rotate(-45deg) scale(1, 1.786);
}
```

- `scale(1, 0.56)` = บีบแกน Y ให้ดูเป็น 3D
- `rotate(45deg)` = หมุนให้เป็นมุม isometric
- Counter-rotate: `rotate(-45deg)` กลับ + `scale(1, 1/0.56)` = `scale(1, 1.786)` ชดเชย

---

ไม่ต้องเสียเวลาเรียน n8n กว่าหลาย 10 ชม. สร้าง automation แทนด้วย Claude Code ใช้งานง่าย ทำได้หลากหลายและรวดเร็วกว่า
.
กลายเป็น Old way automation ไปแล้วสำหรับ n8n
รู้สึกยังไม่รู้อะไรกระจ่างเลย ไปซะแล้ว ฮ่าาา
ตอนนี้อะไร ๆ ก็ไปเร็วมาก ตามไม่ทันแล้ว
แต่พอมาดูกันจริง ๆ เอ้อ นี่มันยุคของ Claude เข้าจริง ๆ
product เขานี่มันแทบจะกรอบจักรวาลตอนนี้เลยก็ว่าได้
.
ในคลิปนี้มีการอธิบายรายละเอียดอย่างชัดเจนเลย
เราลองมาดูกันครับว่า ทำไม Claude code ถึงมาแทน n8n ได้
มันดีขนาดนั้นจริงไหม และมีข้อควรระวังอะไรบ้าง ไปดูกันครับ
ยาวนะ เตือนไว้ก่อน ใครไม่อยากอ่านยาว ๆ ไปอ่านสรุปฉบับสั้นเอาเด้อ
==========

1. ทำไมคนถึงเริ่มเปลี่ยนมาใช้ Agentic Workflows กันแล้ว
   ตลาด Agentic AI มีมูลค่าประมาณ 5 พันล้านดอลลาร์ในปี 2024
   และคาดว่าจะพุ่งไปเกือบ 2 แสนล้านดอลลาร์ภายในปี 2034
   แล้วก็ 96% ขององค์กรใหญ่วางแผนจะขยายการใช้ Agentic AI
   ในปีนี้ ภายในปี 2028 ซอฟต์แวร์องค์กร 1 ใน 3 จะมี Agentic AI
   ฝังอยู่ในตัว ตัวเลขพวกนี้มันบอกชัดเลยว่าทิศทางของอุตสาหกรรมมันไปทางนี้แล้ว
   .
   ในคลิปเขาโชว์ให้ดูว่า
   ถ้าจะสร้าง Automation ตัวนึงที่ไปเช็คช่อง YouTube ทุก 8 ชั่วโมง
   ถ้ามีคลิปใหม่ก็ส่งสรุปมาให้ ถ้าสร้างใน n8n ต้องทำอะไรบ้าง ตั้ง Schedule Trigger
   ต้องหาวิธีดึงข้อมูลจาก YouTube เอง จะใช้ API ตัวไหนดี
   ต้องตั้ง HTTP Request เอง
   ต้องทำระบบเช็คว่าคลิปนี้เคยประมวลผลแล้วหรือยัง
   ต้องสร้าง Database ต้องทำ Filter ต้องเก็บ Video ID ลง Google Sheet
   แล้วก็ต้องหาวิธีดึง Transcript มาสรุปอีก
   .
   ทั้งหมดนี้ทำได้ครับ ไม่ได้ยากเกินไปถ้าเข้าใจ Logic แต่มันใช้เวลา
   .
   แต่ถ้าใช้ Claude Code เราแค่พิมพ์บอกว่าอยากได้อะไร
   แล้วระบบจัดการให้หมด ตั้งแต่การดึงข้อมูล การเช็คว่าเป็นคลิปใหม่หรือไม่ การทำ Deduplication ทุกอย่างถูกจัดการให้อัตโนมัติ Automation
   ที่เคยใช้เวลาสร้างทั้งวันใน n8n ตอนนี้ใช้เวลาแค่ไม่กี่นาที
   .
   แล้วเขายังโชว์อีกตัวอย่างนึงด้วย คือสร้าง Agent
   ที่เชื่อมกับ ClickUp พอสร้าง Task ใหม่แล้วใส่ชื่อบริษัทเข้าไป Agent
   ไปค้นข้อมูลเอง วิเคราะห์เอง วนลูป research จนกว่าจะพอใจ
   แล้วก็ส่ง Competitive Brief กลับมาที่ ClickUp ให้เลย
   ทั้งหมดนี้สร้างโดยแค่บอก Claude Code ว่าอยากได้ AI Agent
   ที่ดู Task ใน ClickUp แล้วไป research แล้วส่ง brief กลับมา แค่นั้นเลย
   ==========
2. การสร้าง Automation แบบ Agentic Workflow
   ในคลิปเขาโชว์สร้าง Automation สด ๆ
   โดยบอก Claude Code ว่าอยากได้ Agent ที่ทำงานแบบนี้
   เมื่อมี Task ใหม่ใน ClickUp ให้ Agent ไปค้นข้อมูลเกี่ยวกับหัวข้อนั้น
   เขียน LinkedIn Post ให้ แล้วก็สร้าง Infographic ด้วย
   โดยใช้ Krea AI ในการสร้างภาพผ่าน API
   .
   พอส่งคำสั่งไป Claude Code ก็เริ่มถามคำถามกลับมาเลย
   เช่น ต้องการ Post สไตล์ไหน ส่งผลลัพธ์ไปไหน
   ตั้งชื่อ List อะไร พอตอบคำถามเสร็จ มันก็เขียน Plan ออกมา
   สร้าง ClickUp List ใหม่ให้ สร้างไฟล์ 2 ตัว คือ ClickUp Poller
   สำหรับคอยดู Task ใหม่ กับ Content Creator Agent
   ที่มีเครื่องมือ search web, read URL และ finish
   .
   พอ Test Run ครั้งแรก มี Error 2 จุด คือส่ง Prompt ผิดรูปแบบ
   ไปที่ Krea AI กับ ClickUp 401 Error
   แต่ Claude Code มันเห็น Error แล้วแก้เองเลยครับ ไม่ต้องบอกอะไรเพิ่ม
   .
   พอ Run รอบสอง ทุกอย่างผ่านหมด Agent ไป search web 4 ครั้ง
   อ่าน URL 3 ครั้ง แล้วก็ส่งคำสั่งไปสร้าง Infographic
   ซึ่งต้อง Polling รอภาพเสร็จ รอประมาณ 30 รอบ ภาพก็เสร็จ
   ผลลัพธ์ถูกโพสต์กลับไปที่ ClickUp มี LinkedIn Post
   พร้อมตัวเลขจริง ๆ มี Infographic สวย ๆ ทั้งหมดใช้เวลาแค่ 2 นาที 23 วินาที
   .
   สิ่งที่น่าสนใจคือ ถ้าเราจะทำแบบเดียวกันใน n8n
   เรื่อง Polling รอภาพจาก Krea AI อย่างเดียวก็ต้องสร้าง
   Loop ต้อง Setup HTTP Request หลายตัว
   ต้องจัดการ Logic เอง แต่ Claude Code มันจัดการให้หมดเลย
   ==========
3. ข้อจำกัดที่ต้องรู้ก่อนกระโดดเข้าไปใช้ Agentic Workflows
   ถึงมันจะดีมาก แต่ก็มีข้อจำกัดที่ต้องรู้ครับ
   .
   อย่างแรกคือ Context Drift ยิ่งทำงานกับ Agent นาน ๆ
   ในรอบเดียว มันจะเริ่มลืมสิ่งที่เราบอกไปก่อนหน้า
   อาจจะอ้างอิงโค้ดเก่า หรือกลับไปใช้ Pattern
   ที่เราบอกแล้วว่าไม่เอา วิธีแก้คือแบ่งงานเป็นรอบสั้น ๆ
   แล้วก็ทำ Project Summary ไว้ให้ Agent อ่านตลอด
   .
   อย่างที่สองคือ Hallucination บางทีมันจะสร้าง function
   ที่ไม่มีอยู่จริง สร้าง API Endpoint ที่ไม่มี
   หรือเขียนโค้ดที่ดูดีแต่พอข้อมูลจริงเข้ามาก็พัง Error พวกนี้มันแอบ ๆ ครับ
   ถ้าไม่เคยเขียนโค้ดมาก่อนจะจับยาก
   .
   วิธีแก้คือต้อง Test ทุกครั้ง อย่าเชื่อมันร้อยเปอร์เซ็นต์
   แล้วก็สร้าง QA Agent ขึ้นมาคอยตรวจงานได้อีกชั้นนึง
   ซึ่งจากงานวิจัยของ Anthropic เอง QA Agent พวกนี้จับ Bug
   ได้บางจุดที่คนยังมองข้ามเลย
   .
   อย่างที่สามคือ Scoping บางทีมันทำเยอะเกินไป
   สั่งอะไรง่าย ๆ แต่มันสร้าง Architecture ซับซ้อนมาให้ใช้ Framework
   ที่ไม่จำเป็น บางทีก็ตรงข้าม คือทำน้อยเกินไป
   แปะ Band-Aid แก้ปัญหาแทนที่จะแก้ที่ต้นเหตุ
   วิธีแก้คือบอกให้ชัดตั้งแต่แรก ใช้ Plan Mode
   ให้มันถามคำถามก่อน แล้วตั้งขอบเขตให้ดี
   .
   อย่างสุดท้ายคือเรื่องหลังจากสร้าง Automation เสร็จแล้ว
   ใน n8n เรามี Dashboard คอยดู Execution Data ทุกอย่างอยู่ตรงนั้นเลย
   แต่ Agentic Workflows มันเป็นโค้ด
   ต้องจัดการเรื่อง Error Notification เอง ต้องมี Observability เอง
   ต้องทำ Version Control เอง แต่ Agent ก็ช่วย Setup พวกนี้ให้ได้ครับ
   มันไม่ใช่เรื่องใหม่ มันคือวิธีจัดการโค้ดแบบเดิมที่ Developer ทำกันมานานแล้ว
   ==========
4. ความรู้ n8n ไม่ได้สูญเปล่า มันคือพื้นฐานที่ทำให้คุณเก่งกว่าคนอื่น
   สำหรับใครที่เรียน n8n หรือ Make มาเยอะแล้วกลัวว่าจะเสียเวลาไปฟรี ๆ
   บอกเลยว่าไม่ใช่ครับ สิ่งที่คุณเรียนมามันคือพื้นฐานที่สำคัญมาก
   ไม่ว่าจะเป็นเรื่อง Trigger, Action, Data Flow,
   Error Handling, AI Prompting
   หรือ Observability สิ่งเหล่านี้
   คือสิ่งที่คุณต้องใช้ตอนสั่ง Agentic System เหมือนกัน
   .
   เปรียบเทียบง่าย ๆ ตอนที่ n8n ออกมาใหม่
   คนที่เข้าใจ Programming Logic มาก่อนก็ได้เปรียบกว่าคนที่เริ่มจากศูนย์
   ตอนนี้ก็เหมือนกันครับ คนที่เข้าใจ Workflow Architecture
   จะสั่ง Claude Code ได้ดีกว่าคนที่ไม่เคยทำ Automation มาก่อน
   .
   เพราะงานของเราเปลี่ยนจากการนั่ง Config Node
   ทีละตัว มาเป็นการวาง Plan ให้ทิศทาง
   ตั้ง Guardrail แล้วก็คอยจับผิดตอนที่ Agent ทำพลาด
   ซึ่งทักษะพวกนี้มันมาจากประสบการณ์ที่คุณสะสมมาครับ
   ==========
   #สรุปฉบับสั้น

- Automation วิวัฒนาการมา 3 คลื่น จาก Chatbot มาเป็น n8n/Make แล้วตอนนี้คือ Agentic Workflows ที่สั่งงานด้วยภาษาคนได้เลย
- ตลาด Agentic AI คาดว่าจะโตจาก 5 พันล้านเป็น 2 แสนล้านดอลลาร์ภายใน 10 ปี
- Automation ที่เคยสร้างทั้งวันใน n8n ตอนนี้ใช้ Claude Code สร้างได้ในไม่กี่นาที
- ข้อจำกัดที่ต้องระวังคือ Context Drift, Hallucination, Scoping และการจัดการโค้ดหลัง Deploy
- # ความรู้ n8n ไม่สูญเปล่า มันคือพื้นฐานที่ทำให้คุณใช้ Agentic Workflows ได้ดีกว่าคนอื่น
  #ความเห็นฉบับแอด
  คือเอาจริง ๆ แอดว่ามันก็อยู่ที่คนถนัดด้วยนะ
  อย่างที่บอก บางคนลงทุนไปกับการเรียนการศึกษา n8n อย่างหนักแล้ว
  จนบางคนสร้างระบบไว้ใช้งานจริงได้แล้ว สุดท้าย n8n ก็อาจจะยังตอบโจทย์เขา
  มากกว่ามาทำ Claude code ก็ได้ สำหรับ มันแค่อีกตัวเลือกนึงแล้วกัน
  สำหรับคนที่ชอบอะไรที่มันไม่ยากมาก และเริ่มต้นง่าย และไม่ซับซ้อนเท่า n8n
  Claude code น่าจะตอบโจทย์กว่า
  .
  ดังนั้น เอาที่ถนัดครับ อันนี้เป็นแค่อีกหนึ่งตัวเลือกให้ได้รับรู้กัน
  สุดท้ายก็วัดกันที่ผลลัพธ์ ไม่ได้ขึ้นอยู่กับจะใช้อะไรสร้าง
  ถ้ามันทำได้ตามที่เราต้องการ ผมว่าจะตัวไหนก็ได้ทั้งนั้นครับ
  .
  แต่ถ้าใครอยากมีรายได้จากสินค้าที่ออกมาจากความสามารถของคุณเอง
  "Online Self-Product Framework" เป็นคำตอบให้กับคุณครับ
  คอร์สออนไลน์ของทางเพจที่จะสอนให้คุณสามารถนำความสามารถ
  มาแปรเปลี่ยนเป็น product และสร้างรายได้จากมัน เริ่มต้นจาก 0
  ตอนนี้เปิด pre-order แล้ว สามารถเข้าไปดูรายละเอียดได้ที่ลิงก์
  https://www.trendtechthofficial.com/onlineselfproductfram...
  ==========
  ก่อนไปขอฝากหน่อยค้าบ ตอนนี้ TrendTech เรามีกลุ่มแล้วนะครับ เป็นกลุ่มที่เราจะแชร์ความรู้ IT หรือ AI ทุกรูปแบบ รวมไปถึงแชร์วิธีกระโดดมาทำงานสาย IT ด้วย ใครสนใจก็สามารถเข้ากลุ่มได้เลยครับผม https://www.facebook.com/groups/1429602182250879
