รายการรออัปเกรด (Game Pang v2 Expansion)
อัพเดทล่าสุด: 2026-03-27

=== DONE ===

[x] Static Post Pipeline (1:1)
    - flow: fetch_news -> process_content -> social_post
    - platforms: Facebook + Instagram (ตัด TikTok ออก)
    - ใช้ Ayrshare API โพสต์ทั้ง 2 แพลตฟอร์มพร้อมกัน

[x] PM AI Brain (Mistral)
    - เปลี่ยน PM จาก logic เดิม เป็น Mistral Large AI ตัดสินใจเอง
    - PM ตรวจ content, เทรนพนักงานอัตโนมัติ, สั่ง proceed/retry/skip/train/alert
    - คุยกับ PM ได้ผ่าน Dashboard

[x] AI Provider Adapter
    - รองรับ Gemini / OpenAI / Claude / Mistral / Groq ผ่าน provider.ts
    - ตอนนี้ใช้ Mistral (PM + นักเขียน)

[x] Dashboard (Web UI)
    - React + Tailwind + Babel 7 (in-browser JSX)
    - ปุ่ม: RUN PIPELINE, AUTO ทุก 30 นาที, ถามก่อน/โพสต์เลย
    - ปุ่ม: พนักงาน, Memory, คุย PM, Analytics
    - AI TOKENS live (ดึงสถานะจริงจาก API)
    - Pending posts = Facebook post preview จำลอง

[x] Sticker Stamp (sharp)
    - แปะสติกเกอร์น้องปัง มุมซ้ายล่าง
    - Headline text + gradient overlay ลงรูปข่าว
    - mood: good (ข่าวดี) / fail (ข่าวแย่)
    - upload ผ่าน 0x0.st

[x] RSS Image Extraction
    - ดึงรูปจาก media:content, enclosure, media:thumbnail, img tag
    - Fallback: og:image จากเว็บต้นทาง -> Pexels gameplay

[x] Facebook API (สำรอง)
    - เมื่อ Ayrshare quota หมด (429) สลับไปโพสต์ผ่าน FB Graph API อัตโนมัติ
    - Page Token ถาวร (ไม่หมดอายุ)

[x] Approve Mode
    - โหมด "ถามก่อน": PM ทำงานแต่ส่งให้ตรวจก่อนโพสต์
    - โหมด "โพสต์เลย": โพสต์อัตโนมัติ
    - Preview เป็น Facebook post จำลองใน Dashboard

[x] Analytics Dashboard
    - ดึงยอด like/comment/share/reach/engaged จาก Facebook API
    - แสดงใน Dashboard กดปุ่ม Analytics

[x] Scheduler
    - รันอัตโนมัติทุก 30 นาที
    - เปิด/ปิดได้จาก Dashboard

[x] Deploy Railway
    - URL: ai-factory-production-fc75.up.railway.app
    - รัน 24/7 บน cloud ไม่ต้องเปิดเครื่อง
    - Free tier 500 ชม./เดือน

[x] Retry Logic (Guardian)
    - auto-retry 3 ครั้ง เมื่อโดน 429 rate limit
    - รอ 30 วินาทีต่อรอบ

[x] Mascot Sticker Logic
    - น้อง Pang มี 2 ท่า: Good / Fail
    - AI ประเมิน mood อัตโนมัติ
    - ลบ background แล้ว (transparent PNG)

[x] GitHub Repo + Security
    - repo: github.com/PeerapongMala/ai-factory (private)
    - .gitignore กัน .env / node_modules / .jpg / audio
    - API keys อยู่ใน Railway Variables

[x] Pipeline Bug Fix
    - แยก stderr ออกจาก stdout
    - fire-and-forget pipeline (ไม่ timeout)
    - poll status ทุก 3 วินาที


=== TODO ===

[ ] เชื่อม Instagram กับ Ayrshare
    - ทำใน ayrshare.com dashboard
    - จะโพสต์ IG ได้ด้วย

[ ] ซื้อ Domain
    - แนะนำ Cloudflare .com ~฿340/ปี
    - หรือใช้ .up.railway.app ฟรี


=== BACKLOG ===

[ ] Facebook Reels (แผนกวิดีโอ)
    - มีโค้ดพร้อม: text_to_speech.ts / fetch_assets.ts / render_video.ts
    - ต้องต่อ ElevenLabs + Pexels + Creatomate video template
    - รอต่อเข้า PM pipeline

[ ] ระบบรับออร์เดอร์ LINE
    - โปรเจกต์ช่วยงานขายอาหารของคุณยาย
    - ยังไม่ได้เริ่ม รอออกแบบ flow

[ ] บริษัททำเว็บ
    - โปรเจกต์ถัดไป ยังไม่ได้เริ่ม
    - จะใช้ structure เดียวกับ Pang Game เป็นต้นแบบ
