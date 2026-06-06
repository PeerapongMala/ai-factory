# Plan: พนักงาน 6 คน = AI agent จริง ประสานงานเหมือนคนจริง

เป้าหมาย: แต่ละพนักงาน (PM/นักข่าว/นักเขียน/ตรวจสอบ/กราฟิก/โพสต์) เป็น **AI agent อิสระ คนละ model**
ประสานงานกันจริง (ส่งต่องาน + ให้ feedback) แล้ว dashboard โชว์บทสนทนา **จริง** (ไม่ใช่ scripted)

---

## ✅ เช็กแล้ว: OpenClaw รองรับ multi-agent

จาก docs.openclaw.ai + install ที่ `~/.openclaw/`:
- **multi-agent routing** — แต่ละ agent มี workspace แยก (`SOUL.md`/`AGENTS.md`), session แยก, **model แยกต่อ agent**
- **`sessions_spawn`** — agent แม่สร้าง agent ลูกได้ (hierarchical → PM แจกงานลูกน้องได้)
- routing ผ่าน **Discord** (มี `~/.openclaw/discord/` อยู่แล้ว)
- ปัจจุบันมี agent เดียว: `~/.openclaw/agents/main`

→ **เป็นไปได้จริง** แต่เป็นงาน infra หลายขั้น

---

## สถาปัตยกรรมที่เสนอ (3 เฟส)

### 🟢 เฟส 1 — multi-agent ใน repo นี้ (เร็ว, ทำได้เลย)
ใช้ระบบ agent ที่โปรเจกต์มีอยู่แล้ว (`config/agents/*.json` + `scripts/ai/provider.ts`)
- **model คนละตัว**: แก้ `provider`/`model` ของแต่ละ JSON (รองรับอยู่แล้ว)
  - ข้อจำกัด: ตอนนี้มี key แค่ Gemini + Mistral → ได้ 2 แบบ
  - ถ้าอยากได้ Opus/GLM-5/Claude ต่อคน → ต้องเพิ่ม key **หรือ** route ผ่าน OpenClaw (เฟส 2)
- **เลิกคุยมั่ว**: ให้ทุก step ของ pipeline emit "บทพูดจากงานจริง" (หัวข้อข่าวจริง/caption จริง) → เขียนลง `tmp/team_chat.json` → dashboard อ่านมาโชว์แทน scripted
- **feedback loop จริง**: ตรวจสอบไม่ผ่าน → ส่งกลับให้นักเขียนแก้ (วน) ; PM รีวิวด้วย AI จริง
ผล: "ประสานงานเหมือนคนจริง" ~80% โดยไม่ต้องแตะ OpenClaw

### 🟡 เฟส 2 — ย้าย "สมอง" ไป OpenClaw (per-agent model จริง)
- สร้าง 6 agent workspace ใน OpenClaw: `~/.openclaw/agents/{pm,reporter,writer,guardian,graphic,publisher}/`
  - แต่ละตัวมี `SOUL.md`/`AGENTS.md` = persona + กฎ (ดึงจาก `config/agents/*.json` systemPrompt + memory)
  - ตั้ง **model แยกต่อ agent** (Opus/GLM-5/Gemini/... ตามใจ — ผ่านโควต้า OpenClaw)
- pipeline เรียก agent ผ่าน OpenClaw แทน provider.ts (ต้องมี bridge: CLI/gateway call)
- dashboard อ่าน output จาก `~/.openclaw/agents/<x>/sessions/` (ไฟล์ session local) → บทพูดจริง

### 🔴 เฟส 3 — autonomous เต็ม (agent คุยกันเองผ่าน Discord)
- PM agent ใช้ `sessions_spawn` แจกงานลูกน้อง 5 คน
- agent ประสานงานผ่าน Discord channel/thread (เห็นใน Discord จริง)
- dashboard mirror Discord/session → real-time
- ต้อง: orchestration logic + host gateway 24/7 (เครื่อง/Oracle Free) + คุมค่า model

---

## ⚠️ ข้อจำกัด/ความเสี่ยงที่ต้องรู้
1. **read-back**: dashboard ต้องอ่าน output agent กลับมา → ใช้ session files local ของ OpenClaw (เครื่องเดียวกัน) ได้ ; ถ้า host แยกต้องมี API
2. **24/7**: agent ต้องรันตลอด → เครื่องเปิด หรือ host (pipeline หลักยังรันบน GitHub Actions ได้เหมือนเดิม)
3. **cost**: 6 agent × model ดีๆ = เรียก AI เยอะขึ้น
4. **ความซับซ้อน**: เฟส 3 = ระบบ multi-agent จริง ดีบักยาก ควรทำทีละเฟส

---

## 💡 แนะนำลำดับ
1. **เฟส 1 ก่อน** (ทำในนี้ได้เลย เห็นผลเร็ว แก้ "มั่ว" + คนละ model) ←
2. ถ้าโอเค → **เฟส 2** (ยกสมองไป OpenClaw, model ดีต่อคน)
3. อยาก autonomous เต็มค่อย **เฟส 3**

> เฟส 1 = งานในโปรเจกต์นี้ (ผมทำได้) · เฟส 2-3 = แตะ `~/.openclaw/` + orchestration (งานใหญ่ หลาย session)

---

## ✅ เฟส 2 — สถานะ (อัปเดต 2026-06-06): Cloud ฐาน + OpenClaw opt-in

ทิศทางที่เลือก: **ทำทั้งคู่** — cloud เป็นฐานทำงาน 24/7 บน GitHub Actions, OpenClaw เป็น **อัปเกรด local แบบ opt-in** (Claude ต่อ agent) พร้อม fallback อัตโนมัติ

### ทำเสร็จแล้ว
- **`buildProviderConfig(agent, defaults)`** (`scripts/ai/provider.ts`) — รวมศูนย์การสร้าง config ที่ pm.ts / process_content.ts / server.ts
  - ไม่มี `USE_OPENCLAW` → คืน cloud config ปกติ (writer=gemini-2.0-flash, pm=mistral-large) → **production/GitHub Actions ไม่เปลี่ยนพฤติกรรม**
  - `USE_OPENCLAW=1` + agent มี block `openclaw` → route ไป OpenClaw (Claude ต่อ agent) โดยตั้ง cloud เป็น `fallback` อัตโนมัติ
- **provider `openclaw`** — เรียกผ่าน `Bun.spawn(["openclaw","agent",...,"--json"])`, parse envelope แบบ defensive, ถ้า exit≠0 → throw
- **fallback chain** ใน `generateContent` — primary พัง (throw) หรือไม่มี handler → ใช้ `config.fallback`
- **OpenClaw agents** (isolated, ไม่ผูก Discord, ไม่แตะ agent `main`):
  - `pang-pm` → `anthropic/claude-opus-4-8` · workspace `~/.openclaw/workspace-pang/pm` · มี `SOUL.md` (persona PM)
  - `pang-writer` → `anthropic/claude-opus-4-7` · workspace `~/.openclaw/workspace-pang/writer` · มี `SOUL.md` (persona "Pang")
  - backup config เดิมไว้ที่ `~/.openclaw/openclaw.json.pre-pang.bak` · ลบกลับได้ด้วย `openclaw agents delete`
- **config**: `config/agents/pm.json` + `config/agents/writer.json` เพิ่ม block `"openclaw": { "agent", "model" }` (provider/model เดิม = cloud fallback)

### ✅ verify แล้ว (2026-06-06)
- 9/9 PASS: cloud path ไม่รั่ว openclaw, opt-in path ติด fallback ถูกตัว, fallback ยิงเมื่อ primary throw และเมื่อไม่มี handler
- ทดสอบ openclaw จริง: `openclaw agent --agent pang-writer ...` → exit **1** + `spawn claude ENOENT` → `callOpenClaw` throw → fallback ไป cloud **ทำงานถูกต้อง** (ระบบไม่พังแม้ openclaw ใช้ไม่ได้)

### ⚠️ ตัวบล็อก OpenClaw (รู้สาเหตุแล้ว — ไม่กระทบ 24/7)
- gateway spawn `claude` แบบ bare → Windows ต้องการ `claude.cmd`/`claude.exe` (CreateProcess หา `claude` เปล่าไม่เจอ) → **`spawn claude ENOENT`**
- `claude` ติดตั้งแล้วที่ `…\npm\claude.cmd` (v2.1.165) แต่ OpenClaw schema ไม่มี field ให้ override path ของ runtime
- **ผลกระทบ = ศูนย์ต่อ production**: `USE_OPENCLAW` ไม่ได้ตั้งบน GitHub Actions → ใช้ cloud ตลอด; ถ้าเปิด local แล้ว openclaw พัง → fallback cloud อัตโนมัติ
- จะใช้งานได้เมื่อ: ติดตั้ง Claude Code native binary (มี `claude.exe` บน PATH) หรือ OpenClaw แก้ให้ resolve `.cmd`/`.exe` บน Windows

### วิธีใช้
```bash
# production / ปกติ — ใช้ cloud (ไม่ต้องทำอะไร)
bun run scripts/pm.ts

# local อัปเกรด: ลอง Claude ต่อ agent (ต้องมี gateway openclaw + claude.exe บน PATH)
USE_OPENCLAW=1 bun run scripts/pm.ts          # PM=opus-4-8, writer=opus-4-7, พังเมื่อไหร่ fallback cloud
USE_OPENCLAW=1 OPENCLAW_TIMEOUT_S=180 bun run scripts/process_content.ts
```
