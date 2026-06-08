# QA Plan — Pang News Dashboard

> รันทีหลังเมื่อ "ระบบเสร็จ" แล้ว — ต้องรัน **server ตัวจริง** ก่อน (`bun run scripts/server.ts` → `http://localhost:3000`)
> ⚠️ การ์ดความปลอดภัย: ก่อนเทสต์ "Run Pipeline" ให้สลับเป็นโหมด **approve** ก่อน เพื่อกันโพสต์จริงลง FB/IG

## 0. Setup
- [ ] `bun run scripts/server.ts` ขึ้น `http://localhost:3000` ไม่มี error
- [ ] เปิดในเบราว์เซอร์ → console ไม่มี JS error (มีแต่ network ที่ตั้งใจ catch ได้)
- [ ] โหลดข้อมูลจริง: TOKENS/STAFF ไม่ใช่ "—", rail แสดง agent 6 คน

## 1. Top bar
| TC | คาดหวัง |
|----|---------|
| TIME เดินจริง | อัปเดตทุกวินาที |
| TOKENS x/y | ตรงกับ `/api/tokens` |
| STAFF | = 6 |
| MODE badge | สะท้อนโหมดจริง (auto/approve) สลับตามปุ่ม |
| ENGINE | "GitHub Actions 24/7" |

## 2. Right rail (desktop ≥900px)
| TC | คาดหวัง |
|----|---------|
| Agent status สด | 6 แถว ลำดับนิ่ง, badge ทำงาน/เดิน/ว่าง เปลี่ยนตามตัวละครจริง |
| count "x/6 ทำงาน" | ตรงกับจำนวน working |
| คลิกแถว agent | ตัวละครในฉากเด้ง 👋 + วงแหวนทอง |
| provider/model | โชว์จาก `/api/agents` (ไม่ใช่ "AI agent" ตอนมี server) |
| Activity log | log ไหลเข้าตอน Run, auto-scroll |

## 3. Pipeline stepper
| TC | คาดหวัง |
|----|---------|
| Idle | 5 step (นักข่าว→โพสต์) สีกลาง |
| ตอน Run | step ปัจจุบันไฮไลต์ทอง, ก่อนหน้าเป็น ✓ เขียว |
| เสร็จ | ทุก step ✓ แล้วรีเซ็ตหลัง ~3 วิ |

## 4. Bottom-bar buttons (ทุกปุ่ม)
| ปุ่ม | TC | คาดหวัง |
|------|----|---------|
| ▶ Run Pipeline | กด (โหมด approve) | disabled ระหว่างรัน, log+notif ขึ้น, จบแล้วกดได้อีก, **ไม่โพสต์จริง** |
| 👥 Staff | เปิด panel | list 6 คน + provider/model + memory + ดาว |
| 💬 Chat PM | ส่งข้อความ | PM ตอบกลับ (`/api/chat`), loading state, auto-scroll |
| 🎓 Train | เลือกคน + พิมพ์ + Train | `/api/train` สำเร็จ, memory +1, ตัวละครเด้ง 📚, **ลบ memory ทดสอบออกหลังเทสต์** |
| 📋 Log | เปิด panel | log ปัจจุบัน / empty state |
| ⚡ Auto Post | toggle | สลับ auto⇄approve, badge+notif อัปเดต |

## 5. Approve/Pending panel *(ฟีเจอร์ใหม่ที่ต้องสร้างก่อน)*
| TC | คาดหวัง |
|----|---------|
| โหมด approve → Run | ได้ pending ไม่โพสต์ |
| เปิด panel Pending | เห็นรายการ + รูป preview (ติดสติกเกอร์) + headline + caption |
| Approve รายตัว | โพสต์เฉพาะตัวนั้น, หายจาก list |
| Reject รายตัว | หายจาก list ไม่โพสต์ |
| Clear all | ล้าง pending |
| empty | empty state เมื่อไม่มี pending |

## 6. Analytics panel *(ถ้าสร้าง)*
| TC | คาดหวัง |
|----|---------|
| เปิด Analytics | ดึง `/api/analytics` (like/comment/share/reach) แสดงผล |
| ไม่มี FB token | empty/error state สวยงาม |

## 7. Modal a11y (ทุก panel)
- [ ] เปิด → focus เข้า panel, `role=dialog`, `aria-modal`
- [ ] Esc ปิด + focus คืนปุ่มเดิม
- [ ] Tab วน (focus trap) ไม่หลุดออกนอก
- [ ] คลิกพื้นหลังปิด
- [ ] ปุ่ม ✕ มี aria-label

## 8. Responsive
- [ ] 1440 / 1024 / 768 / 390 — ไม่มี overflow แนวนอน
- [ ] <900px: rail ซ่อน, ปุ่ม touch ≥44px, bar/ stepper wrap
- [ ] ตรวจว่า mobile ยังเข้าถึง Staff/Log ได้ (ผ่านปุ่ม)

## 9. Motion / reduced-motion
- [ ] เปิด OS reduced-motion → ตัวละครหยุดเดิน/หายใจ, ไม่มี shimmer/notif slide
- [ ] panel/notif/stepper transition ลื่น ไม่กระตุก

## 10. Console / network
- [ ] ไม่มี uncaught JS error
- [ ] ทุก fetch มี catch (ไม่พังหน้าเมื่อ API ล่ม)
