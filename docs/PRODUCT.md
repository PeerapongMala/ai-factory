# Product

## Register

product

## Users

แอดมิน/เจ้าของเพจเกม (Pang Game Company) คนเดียวที่ดูแลระบบผลิต content ข่าวเกมอัตโนมัติ
เปิด dashboard เพื่อ "คุมทีมพนักงาน AI" แบบเกมบริหารบริษัท — สั่งรัน pipeline, เทรนพนักงาน,
ดู log, สลับโหมดโพสต์ งานจริงรันเองผ่าน GitHub Actions 24/7 dashboard คือหน้าต่างมอนิเตอร์ + สั่งงาน

## Product Purpose

หน้า control panel เดียวสำหรับโรงงาน content อัตโนมัติ: PM สั่งพนักงาน 5 คน
(นักข่าว → นักเขียน → ตรวจสอบ → กราฟิก → โพสต์) ผลิตข่าวเกมลง FB + IG
ความสำเร็จ = แอดมินเห็นสถานะระบบได้ชัดในแวบเดียว สั่งงาน/เทรนได้ไม่ต้องแตะ terminal
และรู้สึกสนุกเหมือนเล่นเกม tycoon ไม่ใช่จ้องหน้าจอดำๆ

## Brand Personality

สนุก, มีชีวิตชีวา, เป็นกันเอง (playful tycoon) — 3 คำ: **น่ารัก / มีชีวิต / คุมง่าย**
อารมณ์เป้าหมาย: เปลี่ยนงาน DevOps น่าเบื่อให้เป็นเกม Kairosoft ที่อยากเปิดดู
ภาษาไทยเป็นหลัก โทนเป็นเพื่อนร่วมทีม ไม่ทางการ

## Anti-references

- SaaS dashboard ทั่วไป (การ์ดสีเทา + กราฟ + ตัวเลขใหญ่ hero-metric) — น่าเบื่อ ไม่มีชีวิต
- Terminal ดำๆ ตัวหนังสือวิ่ง — สิ่งที่ระบบนี้ตั้งใจหนีจาก
- Isometric โทนเทาอุตสาหกรรม (sci-fi/industrial) — ผิดอารมณ์ ต้องการ top-down สดใสแบบ Kairosoft

## Design Principles

1. **เกมก่อน dashboard** — ทุกสถานะเล่าผ่านฉากออฟฟิศที่มีชีวิต (ตัวละครเดิน, ทำงาน, speech bubble) ก่อนจะเป็นตัวเลข
2. **แวบเดียวเข้าใจ** — top bar บอกสุขภาพระบบ (tokens/staff/mode/engine) อ่านจบใน 1 วินาที
3. **ทุก state มีหน้าตา** — loading, empty, error, success ต้องสื่อสารและสอนวิธีใช้ ไม่ปล่อยว่าง
4. **Pixel art คุมมือ** — palette แน่น, สีสื่อความหมายคงที่ (พนักงาน 1 คน = 1 สีตลอดทั้งระบบ)
5. **Motion มีเหตุผล** — animation บอกสถานะ (pipeline รัน, เทรนสำเร็จ) ไม่ใช่ตกแต่ง และเคารพ reduced-motion เสมอ

## Accessibility & Inclusion

- ตัวอักษร body ต้องผ่าน contrast ≥ 4.5:1 (เลี่ยง muted เทาจางบนพื้นไม้เข้ม)
- ปุ่ม/อินพุตทุกตัวมี focus-visible ring (กดผ่านคีย์บอร์ดได้)
- ปิด panel ด้วย Esc + คลิกพื้นหลัง
- `prefers-reduced-motion`: ตัด animation ตัวละคร/shimmer/notif ให้เป็น crossfade/instant
- Touch target ≥ 44px บนจอเล็ก
