รายการรออัปเกรด (Game Pang v2 Expansion)
อัพเดทล่าสุด: 2026-03-25

=== DONE ===

[x] Static Post Pipeline (1:1)
    - flow: fetch_news -> process_content -> render_static -> request_approval -> social_post
    - platforms: Facebook + Instagram (ตัด TikTok ออก)
    - ใช้ Ayrshare API โพสต์ทั้ง 2 แพลตฟอร์มพร้อมกัน

[x] Gemini Model Update
    - เปลี่ยนจาก gemini-1.5-pro-latest -> gemini-2.0-flash
    - แก้ทั้ง process_content.ts + fetch_assets.ts
    - เหตุผล: model เก่าถูกถอดออกจาก API แล้ว

[x] Retry Logic (Guardian)
    - auto-retry 3 ครั้ง เมื่อโดน 429 rate limit
    - รอ 30 วินาทีต่อรอบ
    - อยู่ใน process_content.ts + fetch_assets.ts

[x] Mascot Sticker Logic
    - น้อง Pang (ผมชมพู) มี 2 ท่า: Good (ข่าวดี) / Fail (ข่าวร้าย)
    - AI ประเมิน mascot_mood อัตโนมัติจากเนื้อหาข่าว
    - render_static.ts แปะ sticker เป็น base64 ส่ง Creatomate

[x] Telegram Approval
    - request_approval.ts ส่งรูป (sendPhoto) + caption preview
    - มีปุ่ม APPROVE / REJECT (inline keyboard)
    - รับ input จาก render_static.ts output

[x] OpenClaw Dashboard + Pixel Office
    - index.html (React + Tailwind + Babel)
    - Pixel Office: พนักงาน 4 คน (Scout, Gemini, Anti, Post) นั่งโต๊ะ
    - ตอน active: emoji bubble (📡🧠🎨📤) + particle ลอยจากจอ + ตัวขยับพิมพ์งาน
    - ตอน idle: นั่งเฉยๆ ขยับช้า
    - Output Pipeline icons: Facebook / Instagram / Telegram
    - Guardian Log แสดง gemini-2.0-flash

[x] GitHub Actions (CI/CD)
    - .github/workflows/pang-game-pipeline.yml
    - cron ทุก 30 นาที 24/7 (ไม่ต้องเปิดคอม)
    - ถ้าไม่มีข่าวใหม่ -> skip ทั้ง pipeline ประหยัด quota
    - ถ้า Gemini fail -> หยุด pipeline ไม่วิ่ง step ถัดไป
    - auto push processed_hashes.json กลับ repo กันข่าวซ้ำ
    - Secrets เก็บใน GitHub (ไม่มี API key ใน code)

[x] Scheduler (standalone)
    - scripts/scheduler.ts สำหรับรันบนเครื่องตัวเอง
    - วิ่งทุก 15 นาที แสดง timestamp เวลาไทย
    - error ไม่ crash แค่ log แล้วรอรอบถัดไป

[x] GitHub Repo + Security
    - repo: github.com/PeerapongMala/ai-factory (private)
    - .gitignore กัน .env / node_modules / .jpg / audio
    - API keys ทั้งหมดอยู่ใน GitHub Secrets

[x] Pipeline Bug Fix
    - แยก stderr (retry log) ออกจาก stdout (JSON) ด้วย 2>/dev/null
    - เพิ่ม executor skip check ใน workflow
    - ป้องกัน JSON parse error เมื่อ step ก่อนหน้า fail


=== TODO (Pang Game - บริษัทต้นแบบ) ===

[ ] รอ Gemini Quota Reset
    - free tier daily quota หมดวันนี้ (2026-03-25)
    - พรุ่งนี้ pipeline จะวิ่งได้จริงอัตโนมัติผ่าน GitHub Actions
    - ทางเลือก: สร้าง API key ใหม่จาก aistudio.google.com ไม่ต้องรอ

[ ] Token Summary บน Dashboard
    - เพิ่มระบบนับ Gemini token ใช้จริงต่อวัน/เดือน
    - แสดงบน Dashboard ช่อง API BUDGET (ตอนนี้เป็นตัวเลขจำลอง)
    - คำนวณค่าใช้จ่ายจริง เทียบกับงบ 1,000 บาท/เดือน

[ ] Telegram Approve (optional)
    - ตัดออกจาก pipeline แล้ว ตอนนี้โพสต์อัตโนมัติเลย
    - ถ้าอยากเพิ่มกลับมาทีหลัง: ใช้ Cloudflare Worker ฟรี รับ callback


=== BACKLOG (รอบริษัทต้นแบบเสร็จ) ===

[ ] Facebook Reels (แผนกวิดีโอ)
    - พับไว้ก่อน รอ Static Post ลงตัว
    - มีโค้ดพร้อมแล้ว: text_to_speech.ts / fetch_assets.ts / render_video.ts
    - ต้องต่อ ElevenLabs + Pexels + Creatomate video template

[ ] ระบบรับออร์เดอร์ LINE
    - โปรเจกต์ช่วยงานขายอาหารของคุณยาย
    - ยังไม่ได้เริ่ม รอออกแบบ flow

[ ] บริษัททำเว็บ
    - โปรเจกต์ถัดไป ยังไม่ได้เริ่ม
    - จะใช้ structure เดียวกับ Pang Game เป็นต้นแบบ
