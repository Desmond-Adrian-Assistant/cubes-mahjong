#!/usr/bin/env bash
set -u
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
OUT="screenshots/mp-four-player-fullgame/batch-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$OUT"
summary="$OUT/summary.txt"
: > "$summary"

PID=$(lsof -tiTCP:8878 -sTCP:LISTEN || true)
if [ -z "$PID" ]; then
  node server.js > server.log 2>&1 &
  echo "started server $!" | tee -a "$summary"
  sleep 0.5
else
  echo "using server $PID" | tee -a "$summary"
fi

pass=0
fail=0
for i in 1 2 3 4; do
  run="game-$i"
  echo "=== $run ===" | tee -a "$summary"
  if MJ_RUN_ID="$(basename "$OUT")/$run" MJ_FULLGAME_STEPS=380 MJ_FULLGAME_DELAY=15 node scripts/mp-four-player-fullgame.js > "$OUT/$run.json" 2> "$OUT/$run.err"; then
    echo "$run PASS" | tee -a "$summary"
    pass=$((pass+1))
  else
    code=$?
    echo "$run FAIL code=$code" | tee -a "$summary"
    fail=$((fail+1))
  fi
  tail -n 5 "$OUT/$run.err" 2>/dev/null | sed 's/^/ERR: /' | tee -a "$summary" >/dev/null || true
  node -e "const fs=require('fs'); const p='$OUT/$run.json'; if(fs.existsSync(p)&&fs.statSync(p).size){const j=JSON.parse(fs.readFileSync(p)); console.log(JSON.stringify({room:j.room, gameOver:j.gameOver&&j.gameOver.step, blocker:j.gameOver&&j.gameOver.blocker, actionCount:j.actionCount, end:j.endStates&&j.endStates.map(s=>s.modalTitle||s.phase)}, null, 0));}" 2>/dev/null | tee -a "$summary" || true
  sleep 0.3
done

echo "PASS=$pass FAIL=$fail" | tee -a "$summary"
exit $fail
