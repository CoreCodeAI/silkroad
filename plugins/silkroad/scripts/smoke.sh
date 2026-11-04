#!/usr/bin/env bash
# Smoke test: install the packed bundle into an isolated DSH profile of the
# pinned Harness version, boot the Web profile, and exercise the real routes.
# Nothing touches the user's own DSH home.
#
#   scripts/smoke.sh [path/to/dsh-silkroad-x.y.z.tgz]
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DSH_VERSION="$(node -p "require('$ROOT/package.json').peerDependencies['@deepseek-ai/dsh-tools']")"
WORK="${SILKROAD_SMOKE_DIR:-${TMPDIR:-/tmp}/silkroad-smoke}"
PORT="${SILKROAD_SMOKE_PORT:-3997}"
TGZ="${1:-}"

mkdir -p "$WORK"
if [[ -z "$TGZ" ]]; then
  (cd "$ROOT" && pnpm build >/dev/null && pnpm pack --pack-destination "$WORK" >/dev/null)
  TGZ="$(ls -t "$WORK"/dsh-silkroad-*.tgz | head -1)"
fi

export DSH_HOME="$WORK/home"
cd "$WORK"
INSTALLED="$(node -p "require('./node_modules/@deepseek-ai/dsh/package.json').version" 2>/dev/null || true)"
if [[ "$INSTALLED" != "$DSH_VERSION" ]]; then
  [[ -f package.json ]] || npm init -y >/dev/null
  npm install --no-audit --no-fund --save-exact "@deepseek-ai/dsh@$DSH_VERSION" >/dev/null
fi
DSH="$WORK/node_modules/.bin/dsh"

[[ -d "$DSH_HOME/profiles/smoke" ]] || "$DSH" --profile smoke --from-default-profile web --dump-config >/dev/null
"$DSH" plugin --profile smoke remove dsh-silkroad >/dev/null 2>&1 || true
"$DSH" plugin --profile smoke add "$TGZ" >/dev/null

LOG="$WORK/web.log"
# SilkRoad's own folders (knowledge, reports) also stay inside the work dir.
export SILKROAD_HOME="$WORK/silkroad-home"
mkdir -p "$SILKROAD_HOME/reports"
"$DSH" --profile smoke --no-open --port "$PORT" >"$LOG" 2>&1 &
PID=$!
trap 'kill $PID 2>/dev/null || true' EXIT

for _ in $(seq 1 120); do grep -q 'token=' "$LOG" 2>/dev/null && break; sleep 1; done
URL="$(grep -o 'http://127.0.0.1:[0-9]*/?token=[A-Za-z0-9_-]*' "$LOG" | head -1)"
[[ -n "$URL" ]] || { echo "FAIL: web server did not start"; cat "$LOG"; exit 1; }
sleep 3
if grep -q 'did not activate' "$LOG"; then echo "FAIL: an entry did not activate"; cat "$LOG"; exit 1; fi

JAR="$WORK/cookies.txt"; rm -f "$JAR"
curl -s -o /dev/null -c "$JAR" "$URL"
BASE="http://127.0.0.1:$PORT"

check() { # name expected-status curl-args...
  local name="$1" expected="$2"; shift 2
  local status; status="$(curl -s -o "$WORK/out.txt" -w '%{http_code}' "$@")"
  if [[ "$status" == "$expected" ]]; then echo "ok   $name ($status)"; else echo "FAIL $name: expected $expected, got $status"; cat "$WORK/out.txt"; echo; exit 1; fi
}

check 'status requires DSH authentication' 401 "$BASE/api/silkroad/status"
check 'status with the owner session' 200 -b "$JAR" "$BASE/api/silkroad/status"
grep -q '"fastmoss"' "$WORK/out.txt" && grep -q '"serpapi"' "$WORK/out.txt" || { echo 'FAIL: status lacks data sources'; exit 1; }
for _ in $(seq 1 20); do
  curl -s -b "$JAR" -o "$WORK/out.txt" "$BASE/api/silkroad/status"
  grep -q '"pending"' "$WORK/out.txt" || break; sleep 1
done
if grep -q '"broken"' "$WORK/out.txt" || grep -q '"pending"' "$WORK/out.txt"; then echo 'FAIL: role presets are not ready'; cat "$WORK/out.txt"; echo; exit 1; fi
[[ "$(grep -o '"state":"ready"' "$WORK/out.txt" | wc -l)" -ge 4 ]] && echo 'ok   four role presets are ready' || { echo 'FAIL: role presets missing'; exit 1; }
check 'save a vendor key' 200 -b "$JAR" -H 'content-type: application/json' -d '{"id":"serpapi","value":"smoke-key"}' "$BASE/api/silkroad/vendors/key"
check 'status shows the key as configured' 200 -b "$JAR" "$BASE/api/silkroad/status"
grep -q '"configured"' "$WORK/out.txt" && ! grep -q 'smoke-key' "$WORK/out.txt" || { echo 'FAIL: key state wrong or value leaked'; exit 1; }
check 'clear the vendor key' 200 -b "$JAR" -H 'content-type: application/json' -d '{"id":"serpapi"}' "$BASE/api/silkroad/vendors/clear"
check 'status lists the shop and knowledge base' 200 -b "$JAR" "$BASE/api/silkroad/status"
grep -q '"knowledge"' "$WORK/out.txt" && grep -q '"tiktok-shop"' "$WORK/out.txt" || { echo 'FAIL: status lacks the shop or knowledge base'; exit 1; }
check 'save TikTok Shop app settings' 200 -b "$JAR" -H 'content-type: application/json' -d '{"values":{"appKey":"smoke-app","serviceId":"1234","region":"us"}}' "$BASE/api/silkroad/shop/settings"
check 'save the TikTok Shop app secret' 200 -b "$JAR" -H 'content-type: application/json' -d '{"value":"smoke-secret"}' "$BASE/api/silkroad/shop/secret"
check 'status shows the shop ready to authorize' 200 -b "$JAR" "$BASE/api/silkroad/status"
grep -q '"state":"disconnected"' "$WORK/out.txt" && grep -q '"secretConfigured":true' "$WORK/out.txt" && ! grep -q 'smoke-secret' "$WORK/out.txt" || { echo 'FAIL: shop state wrong or secret leaked'; cat "$WORK/out.txt"; exit 1; }
check 'shop completion without a pending authorization is refused' 400 -b "$JAR" -H 'content-type: application/json' -d '{"pasted":"https://x.test/cb?code=a&state=b"}' "$BASE/api/silkroad/shop/complete"
check 'shop callback rejects a forged state' 400 "$BASE/silkroad/oauth/callback/tiktok-shop?code=x&state=y"
check 'clear the TikTok Shop app secret' 200 -b "$JAR" -H 'content-type: application/json' -d '{}' "$BASE/api/silkroad/shop/secret/clear"
check 'OAuth callback is public but rejects an unknown login' 400 "$BASE/silkroad/oauth/callback/fastmoss?code=x&state=y"
check 'index lists the client bundle' 200 -b "$JAR" "$BASE/"
grep -q 'dsh-silkroad/client.js' "$WORK/out.txt" || { echo 'FAIL: index does not load the SilkRoad client'; exit 1; }
BUNDLE="$(grep -oE 'plugins/\?\?[^"]*dsh-silkroad/client\.js[^"]*' "$WORK/out.txt" | head -1 | sed 's/&amp;/\&/g')"
check 'client bundle is served' 200 -b "$JAR" "$BASE/$BUNDLE"
grep -q 'id: "dsh-silkroad"' "$WORK/out.txt" || { echo 'FAIL: served bundle is not SilkRoad'; exit 1; }

check 'reports list is served' 200 -b "$JAR" "$BASE/api/silkroad/reports"
grep -q '"files":\[' "$WORK/out.txt" || { echo 'FAIL: reports list malformed'; cat "$WORK/out.txt"; exit 1; }
check 'reading a report outside the folder is refused' 400 -b "$JAR" -H 'content-type: application/json' -d '{"path":"../secret.md"}' "$BASE/api/silkroad/reports/read"

echo "smoke passed against DSH $DSH_VERSION"
if [[ -n "${SILKROAD_SMOKE_KEEP:-}" ]]; then
  echo "keeping the server up: $URL"
  wait $PID
fi
