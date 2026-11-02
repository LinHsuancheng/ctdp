#!/usr/bin/env bash
# Starts the built sync server on a scratch database, then launches the built
# app headless under Xvfb and runs the in-app smoke check (src/main/smoke.ts),
# which connects to that server. Exits non-zero if the check fails.
set -euo pipefail
cd "$(dirname "$0")/.."

data=$(mktemp -d)
export CTDP_SMOKE_SYNC_URL="http://127.0.0.1:18787"
export CTDP_SMOKE_SYNC_TOKEN="smoke-token-$(date +%s%N)"
CTDP_TOKEN="$CTDP_SMOKE_SYNC_TOKEN" PORT=18787 CTDP_DATA_DIR="$data" node --disable-warning=ExperimentalWarning server/dist/server.js &
server=$!
trap 'kill $server 2>/dev/null; rm -rf "$data"' EXIT
for _ in $(seq 50); do
  node -e 'fetch(process.argv[1]).then((r) => process.exit(r.ok ? 0 : 1), () => process.exit(1))' "$CTDP_SMOKE_SYNC_URL/api/health" && break
  sleep 0.1
done

xvfb-run -a npx electron . --no-sandbox --smoke
