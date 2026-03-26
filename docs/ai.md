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
