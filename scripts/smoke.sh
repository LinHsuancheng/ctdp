#!/usr/bin/env bash
# Launches the built app headless under Xvfb and runs the in-app smoke check
# (src/main/smoke.ts). Exits non-zero if the check fails.
set -euo pipefail
cd "$(dirname "$0")/.."
exec xvfb-run -a npx electron . --no-sandbox --smoke
