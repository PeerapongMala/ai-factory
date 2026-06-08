#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────
# Pang News — Railway deploy helper
#
# รันใน terminal จริงของคุณ (ไม่ใช่ใน Claude session) ตามลำดับ:
#   1) railway login          # เปิด browser ยืนยันตัวตน
#   2) railway link           # เลือก project เดิม  (ถ้าไม่มี: railway init)
#   3) bash railway-deploy.sh # ← สคริปต์นี้: ตั้ง env + deploy + ขอ domain
#
# secret อ่านจาก .env ตอนรัน ไม่ถูกเขียนลงที่ไหน
# ──────────────────────────────────────────────────────────────
set -euo pipefail

if [ ! -f .env ]; then
  echo "✗ ไม่เจอไฟล์ .env ในโฟลเดอร์นี้ — cd เข้าโปรเจกต์ก่อน"
  exit 1
fi

if ! railway whoami >/dev/null 2>&1; then
  echo "✗ ยังไม่ได้ login — รัน 'railway login' แล้ว 'railway link' ก่อน"
  exit 1
fi

echo "→ ส่ง environment variables เข้า Railway (ข้ามการ redeploy ระหว่างตั้งค่า)..."
while IFS='=' read -r key val; do
  [ -z "${key}" ] && continue
  case "${key}" in \#*) continue ;; esac
  railway variables --set "${key}=${val}" --skip-deploys >/dev/null && echo "  ✓ ${key}"
done < <(grep -E '^[A-Za-z_][A-Za-z0-9_]*=' .env)

echo "→ deploy จากไฟล์ในเครื่อง (railway up)..."
railway up --ci

echo "→ ขอ/แสดง public domain..."
railway domain

echo ""
echo "✓ เสร็จแล้ว — เปิด domain ด้านบนเพื่อดู Dashboard (ฉาก Kairosoft + rail ใหม่)"
