# Flow สายพานผลิต Content - Pang Game Company

## ภาพรวม

```
ทุก 30 นาที (GitHub Actions)
         │
         ▼
┌─────────────────┐
│       PM        │  ← ศูนย์กลางสั่งงาน
│  scripts/pm.ts  │     รับรายงาน แก้ปัญหา
└────────┬────────┘
         │
         ▼
   สั่งงานทีละขั้น
   ขั้นไหนพัง → หยุด → แจ้ง Telegram
```

---

## Flow ทีละขั้น

```
ขั้น 1: นักข่าว                    ขั้น 2: นักเขียน
┌──────────────────────┐          ┌──────────────────────┐
│  fetch_news.ts       │          │  process_content.ts  │
│                      │          │                      │
│  RSS feeds ข่าวเกม   │   JSON   │  AI สร้าง caption    │
│  → กรองข่าวเก่า >24h │ ───────► │  (Gemini/OpenAI/     │
│  → กัน hash ซ้ำ      │          │   Claude/Groq)       │
│  → ส่งข่าวใหม่       │          │  → ใช้ memory จาก    │
└──────────────────────┘          │    training ด้วย     │
                                  └──────────┬───────────┘
                                             │
                                             ▼
ขั้น 4: โพสต์                      ขั้น 3: กราฟิก
┌──────────────────────┐          ┌──────────────────────┐
│  social_post.ts      │          │  render_static.ts    │
│                      │   JSON   │                      │
│  Ayrshare API        │ ◄─────── │  Creatomate API      │
│  → โพสต์ Facebook    │          │  → render ภาพ 1:1    │
│  → โพสต์ Instagram   │          │  → แปะ mascot ปัง    │
│  → PM รายงาน Telegram│          │  → ใส่ branding      │
└──────────────────────┘          └──────────────────────┘
```

---

## Flow ละเอียด

### ขั้น 1: นักข่าว (fetch_news.ts)

```
RSS Feeds (Thairath, Sanook, ...)
         │
         ▼
    ดึง XML → parse หัวข้อ + summary
         │
         ▼
    ┌─── กรอง ───┐
    │             │
    │  เก่า >24h? → ข้าม
    │  hash ซ้ำ?  → ข้าม
    │             │
    └─────────────┘
         │
         ▼
    Output: { status: "SUCCESS", data: [{ title, source, summary }] }
```

### ขั้น 2: นักเขียน (process_content.ts)

```
รับ JSON จากนักข่าว
         │
         ▼
    โหลด writer.json config
    → provider: gemini/openai/claude
    → systemPrompt: สไตล์ Sheapgamer
    → memory: feedback ที่เคยได้รับ
         │
         ▼
    วน loop ข่าวแต่ละตัว
    → ส่ง prompt ให้ AI
    → retry 3 ครั้ง ถ้า rate limit
         │
         ▼
    Output: { status: "SUCCESS", data: [{ source_article, generated_script }] }
```

### ขั้น 3: กราฟิก (render_static.ts)

```
รับ JSON จากนักเขียน
         │
         ▼
    เรียก Creatomate API
    → ภาพ 1:1 (1080x1080)
    → แปะหัวข้อข่าว
    → แปะ mascot น้องปัง (good/fail ตาม mood)
    → ใส่ branding "เกมปังv2 | @PangGameV2"
         │
         ▼
    Output: { status: "SUCCESS", data: [{ image_url, caption }] }
```

### ขั้น 4: โพสต์ (social_post.ts)

```
รับ JSON จากกราฟิก
         │
         ▼
    เรียก Ayrshare API
    → โพสต์ Facebook (รูป + caption)
    → โพสต์ Instagram (รูป + caption)
         │
         ▼
    Output: { status: "SUCCESS", platforms: ["facebook", "instagram"] }
```

---

## PM ตัดสินใจอะไรบ้าง

```
ขั้นไหนพัง?
    │
    ├── นักข่าว FAILED     → "ไม่มีข่าวใหม่" → หยุด รอรอบถัดไป
    │
    ├── นักเขียน FAILED    → เช็ค rate limit?
    │   ├── ใช่ → retry 3 ครั้ง (รอ 30 วินาที)
    │   └── ไม่ → หยุด แจ้ง Telegram
    │
    ├── กราฟิก FAILED      → หยุด แจ้ง Telegram
    │
    ├── โพสต์ FAILED       → หยุด แจ้ง Telegram
    │
    └── ทุกขั้นสำเร็จ      → สรุปรายงาน Telegram
                             "โพสต์แล้ว X ข่าว บน FB + IG"
```

---

## ระบบ Training

```
แอดมิน
  │
  │  bun run scripts/pm.ts train นักเขียน "caption สั้นลง"
  │
  ▼
PM บันทึก feedback → writer.json memory[]
  │
  │  รอบถัดไปที่ pipeline รัน...
  │
  ▼
process_content.ts โหลด memory
  │
  ▼
ส่งเป็น system prompt ให้ AI:
  "คุณคือ Mascot ปัง..."
  + "[ความจำจาก feedback]"
  + "- [แอดมิน] caption สั้นลง"
  │
  ▼
AI เขียน caption สั้นลงตาม feedback
```

---

## Timeline 1 รอบ

```
00:00  GitHub Actions trigger
00:01  PM เริ่มประชุม
00:02  นักข่าว ดึง RSS → ได้ 3 ข่าว
00:05  นักเขียน AI สร้าง caption × 3
00:10  กราฟิก render ภาพ × 3
00:15  โพสต์ ลง FB + IG × 3
00:16  PM รายงาน Telegram "สำเร็จ 3 ข่าว"
00:16  จบ รอรอบถัดไป (30 นาที)
```

---

## Error Handling

| สถานการณ์ | PM ทำอะไร |
|-----------|----------|
| RSS ล่ม | สลับไป feed สำรอง |
| ไม่มีข่าวใหม่ | หยุดเลย ไม่เสีย API |
| Gemini 429 rate limit | retry 3 ครั้ง รอ 30 วิ |
| Gemini error อื่น | หยุด ไม่ retry (เสีย quota เปล่า) |
| Creatomate พัง | หยุด แจ้ง Telegram |
| Ayrshare พัง | หยุด แจ้ง Telegram |
| ข่าวซ้ำ | กรองออกตั้งแต่ขั้นนักข่าว (MD5 hash) |
| ข่าวเก่า >24 ชม. | กรองออกตั้งแต่ขั้นนักข่าว (pubDate) |
