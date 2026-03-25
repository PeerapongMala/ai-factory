# Pang Game Company

ระบบผลิต content ข่าวเกมอัตโนมัติ โพสต์ลง Facebook + Instagram
ทำงาน 24/7 ผ่าน GitHub Actions ไม่ต้องเปิดคอม

---

## โครงสร้างบริษัท

PM (ผู้จัดการ) สั่งงานพนักงาน 5 คน ทีละขั้น:

```
PM สั่งงาน → นักข่าว → นักเขียน → ตรวจสอบ → กราฟิก → โพสต์
```

| พนักงาน | หน้าที่ | ไฟล์ |
|---------|--------|------|
| PM | สั่งงาน รับรายงาน retry ถ้าพัง | `scripts/pm.ts` |
| นักข่าว | ดึง RSS ข่าวเกม กรอง 24 ชม. กัน hash ซ้ำ | `scripts/fetch_news.ts` |
| นักเขียน | เขียน caption ด้วย AI (Gemini/OpenAI/Claude) | `scripts/process_content.ts` |
| ตรวจสอบ | เช็คข่าวไม่ซ้ำ + ไม่เก่าเกิน 24 ชม. | (อยู่ใน fetch_news) |
| กราฟิก | render ภาพ 1:1 ด้วย Creatomate | `scripts/post_dept/render_static.ts` |
| โพสต์ | โพสต์ FB + IG ผ่าน Ayrshare | `scripts/post_dept/social_post.ts` |

---

## คำสั่ง PM

```bash
# รัน pipeline ทั้งหมด
bun run scripts/pm.ts

# ดูพนักงานทั้งหมด
bun run scripts/pm.ts list

# สอนพนักงาน (เพิ่ม feedback เข้า memory)
bun run scripts/pm.ts train นักเขียน "caption สั้นลง ไม่เกิน 3 บรรทัด"
bun run scripts/pm.ts train กราฟิก "mascot ใหญ่ขึ้น สะดุดตากว่านี้"

# ดู memory ทุกคน
bun run scripts/pm.ts memory

# ดู memory เฉพาะคน
bun run scripts/pm.ts memory นักเขียน
```

**ชื่อพนักงานที่ใช้ได้:** pm, นักข่าว, นักเขียน, ตรวจสอบ, กราฟิก, โพสต์

---

## เปลี่ยน AI Provider

พนักงานแต่ละคนเลือก AI ตัวไหนก็ได้ แก้ใน `config/agents/<ชื่อ>.json`:

### Gemini (ฟรี 1,500 req/day)
```json
{
  "provider": "gemini",
  "model": "gemini-2.0-flash"
}
```
ต้องมี: `GEMINI_API_KEY` ใน .env

### OpenAI
```json
{
  "provider": "openai",
  "model": "gpt-4o-mini"
}
```
ต้องมี: `OPENAI_API_KEY` ใน .env

### Claude
```json
{
  "provider": "claude",
  "model": "claude-haiku-4-5-20251001"
}
```
ต้องมี: `ANTHROPIC_API_KEY` ใน .env

### Groq (ฟรี, เร็วมาก)
```json
{
  "provider": "openai",
  "model": "llama-3.3-70b-versatile",
  "apiKeyEnv": "GROQ_API_KEY",
  "baseUrl": "https://api.groq.com/openai/v1"
}
```
ต้องมี: `GROQ_API_KEY` ใน .env

### Ollama (รันเอง, ฟรี)
```json
{
  "provider": "openai",
  "model": "llama3",
  "apiKeyEnv": "OLLAMA_KEY",
  "baseUrl": "http://localhost:11434/v1"
}
```
ใส่ `OLLAMA_KEY=ollama` ใน .env (ค่าอะไรก็ได้)

---

## ระบบ Memory / Training

พนักงานทุกคนเทรนได้ PM สอนผ่าน feedback → จำไปใช้ใน prompt ครั้งถัดไป

- Memory เก็บใน `config/agents/<ชื่อ>.json` → field `memory[]`
- เก็บสูงสุด 50 feedback ต่อคน
- ตอน generate content จะแปะ memory เข้าไปใน system prompt อัตโนมัติ

```
ตัวอย่าง flow:
แอดมิน → PM train นักเขียน "ใส่ emoji เยอะขึ้น"
→ บันทึกลง writer.json memory
→ ครั้งถัดไป Gemini จะเห็น feedback นี้ใน prompt
→ นักเขียนเขียน caption มี emoji เยอะขึ้น
```

---

## API Keys ที่ต้องมี

ใส่ใน `.env` (local) และ GitHub Secrets (production):

| Key | ใช้ทำอะไร | ฟรี? |
|-----|----------|------|
| `GEMINI_API_KEY` | นักเขียน generate content | ฟรี 1,500 req/day |
| `CREATOMATE_API_KEY` | กราฟิก render ภาพ | ฟรี limited |
| `CREATOMATE_STATIC_TEMPLATE_ID` | template ID ภาพ 1:1 | - |
| `AYRSHARE_API_KEY` | โพสต์ FB + IG | ฟรี limited |
| `TELEGRAM_BOT_TOKEN` | PM รายงานผล | ฟรี |
| `TELEGRAM_CHAT_ID` | chat ที่ PM ส่งรายงาน | ฟรี |

---

## รัน 24/7

ใช้ GitHub Actions cron ทุก 30 นาที:

```
.github/workflows/pang-game-pipeline.yml
```

- ไม่ต้องเปิดคอม
- PM จะรายงานผลทาง Telegram ทุกรอบ
- ถ้า rate limit → retry อัตโนมัติ 3 ครั้ง

---

## โครงสร้างไฟล์

```
ai-content-factory/
├── config/
│   └── agents/           # JSON config พนักงานทุกคน
│       ├── pm.json
│       ├── reporter.json
│       ├── writer.json    # ← มี provider, model, systemPrompt, memory
│       ├── guardian.json
│       ├── graphic.json
│       └── publisher.json
├── scripts/
│   ├── pm.ts              # PM สั่งงาน + train + memory
│   ├── fetch_news.ts      # นักข่าว
│   ├── process_content.ts # นักเขียน (ใช้ AI adapter)
│   ├── ai/
│   │   └── provider.ts    # AI adapter (Gemini/OpenAI/Claude)
│   ├── agents/
│   │   └── memory.ts      # ระบบ memory/training
│   └── post_dept/
│       ├── render_static.ts  # กราฟิก
│       └── social_post.ts    # โพสต์
├── logs/
│   └── processed_hashes.json # กัน hash ข่าวซ้ำ
├── assets/                # sticker น้องปัง
├── index.html             # Dashboard Pixel Office
└── .github/workflows/     # GitHub Actions cron
```

---

## งบประมาณ

เป้าหมาย: ไม่เกิน 1,000 บาท/เดือน

| บริการ | ค่าใช้จ่าย |
|--------|-----------|
| Gemini 2.0 Flash | ฟรี 1,500 req/day |
| GitHub Actions | ฟรี 2,000 min/month |
| Creatomate | ฟรี tier |
| Ayrshare | ฟรี tier |
| Telegram Bot | ฟรี |
| **รวม** | **0 บาท** (ถ้าไม่เกิน free tier) |
