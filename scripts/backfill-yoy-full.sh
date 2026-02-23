#!/usr/bin/env bash
# backfill-yoy-full.sh — Recompute YoY analytics across the entire GCS cache
#
# This script:
# 1. Lists all snapshot dates in GCS
# 2. Finds dates that have a matching previous-year date (for YoY comparison)
# 3. Skips the first program year (2016-2017) — no prior year data exists
# 4. For each matchable date: downloads both snapshots, recomputes analytics,
#    and uploads the results
#
# Usage:
#   ./scripts/backfill-yoy-full.sh                     # all matchable dates
#   ./scripts/backfill-yoy-full.sh --dry-run            # show plan without executing
#   ./scripts/backfill-yoy-full.sh --start 2024-07-01   # start from a specific date
#   ./scripts/backfill-yoy-full.sh --limit 10           # process only N dates
#
# Run in background:
#   nohup ./scripts/backfill-yoy-full.sh > /tmp/backfill-yoy.log 2>&1 &
#   tail -f /tmp/backfill-yoy.log

set -euo pipefail

GCS_BUCKET="toast-stats-data"
CACHE_DIR="./cache"
LOG_FILE="/tmp/backfill-yoy-full.log"

# Parse arguments
DRY_RUN=false
START_DATE=""
LIMIT=0
while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run)  DRY_RUN=true; shift ;;
    --start)    START_DATE="$2"; shift 2 ;;
    --limit)    LIMIT="$2"; shift 2 ;;
    *)          echo "Unknown option: $1"; exit 1 ;;
  esac
done

echo "============================================"
echo "  YoY Full Backfill — $(date '+%Y-%m-%d %H:%M:%S')"
echo "============================================"
echo ""

# ── Step 1: List all snapshot dates ──────────────────────────
echo "📋 Step 1: Listing all snapshot dates in GCS..."
ALL_DATES_FILE=$(mktemp)
gcloud storage ls "gs://${GCS_BUCKET}/snapshots/" \
  | grep -oE '[0-9]{4}-[0-9]{2}-[0-9]{2}' \
  | sort \
  > "$ALL_DATES_FILE"

TOTAL_DATES=$(wc -l < "$ALL_DATES_FILE" | tr -d ' ')
FIRST_DATE=$(head -1 "$ALL_DATES_FILE")
LAST_DATE=$(tail -1 "$ALL_DATES_FILE")
echo "  Total snapshot dates: ${TOTAL_DATES}"
echo "  Range: ${FIRST_DATE} → ${LAST_DATE}"
echo ""

# ── Step 2: Find matchable dates ─────────────────────────────
echo "📋 Step 2: Finding dates with matching previous-year snapshots..."

# Build a set of all dates for fast lookup, then find matches
MATCHABLE_FILE=$(mktemp)
python3 - "$ALL_DATES_FILE" "$MATCHABLE_FILE" "$START_DATE" << 'PYEOF'
import sys

all_dates_file = sys.argv[1]
out_file = sys.argv[2]
start_date = sys.argv[3] if len(sys.argv) > 3 else ""

dates = set()
with open(all_dates_file) as f:
    for line in f:
        d = line.strip()
        if d:
            dates.add(d)

matchable = []
for d in sorted(dates):
    y = int(d[:4])
    prev = f'{y-1}{d[4:]}'
    if prev in dates:
        if not start_date or d >= start_date:
            matchable.append(d)

with open(out_file, 'w') as f:
    for d in matchable:
        f.write(d + '\n')

# Print summary by program year
py_counts = {}
for d in matchable:
    y, m = int(d[:4]), int(d[5:7])
    py = f'{y}-{y+1}' if m >= 7 else f'{y-1}-{y}'
    py_counts[py] = py_counts.get(py, 0) + 1

print(f'  Matchable dates: {len(matchable)}')
if matchable:
    print(f'  First: {matchable[0]}')
    print(f'  Last:  {matchable[-1]}')
    print()
    print('  Per program year:')
    for py in sorted(py_counts.keys()):
        print(f'    {py}: {py_counts[py]} dates')
PYEOF

MATCHABLE_COUNT=$(wc -l < "$MATCHABLE_FILE" | tr -d ' ')
echo ""

if [ "$LIMIT" -gt 0 ] && [ "$MATCHABLE_COUNT" -gt "$LIMIT" ]; then
  echo "  Limiting to first ${LIMIT} dates (of ${MATCHABLE_COUNT})"
  MATCHABLE_LIMITED=$(mktemp)
  head -"${LIMIT}" "$MATCHABLE_FILE" > "$MATCHABLE_LIMITED"
  MATCHABLE_FILE="$MATCHABLE_LIMITED"
  MATCHABLE_COUNT=$LIMIT
fi

if [ "$DRY_RUN" = true ]; then
  echo ""
  echo "🔍 DRY RUN — would process these ${MATCHABLE_COUNT} dates:"
  cat "$MATCHABLE_FILE"
  echo ""
  echo "Run without --dry-run to execute."
  rm -f "$ALL_DATES_FILE" "$MATCHABLE_FILE"
  exit 0
fi

# ── Step 3: Process each date ────────────────────────────────
echo ""
echo "🔄 Step 3: Processing ${MATCHABLE_COUNT} dates..."
echo ""

PROCESSED=0
SUCCEEDED=0
FAILED=0
SKIPPED=0
FAILED_DATES=""
START_TIME=$(date +%s)

while IFS= read -r SNAPSHOT_DATE; do
  PROCESSED=$((PROCESSED + 1))
  ELAPSED=$(( $(date +%s) - START_TIME ))
  if [ "$PROCESSED" -gt 1 ]; then
    AVG_SECS=$(( ELAPSED / (PROCESSED - 1) ))
    REMAINING=$(( AVG_SECS * (MATCHABLE_COUNT - PROCESSED + 1) ))
    ETA_MIN=$(( REMAINING / 60 ))
    ETA_STR="${ETA_MIN}m remaining"
  else
    ETA_STR="estimating..."
  fi

  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "  [${PROCESSED}/${MATCHABLE_COUNT}] ${SNAPSHOT_DATE}  (${ETA_STR})"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

  # Calculate previous year date (macOS compatible)
  PREV_YEAR=$(date -v-1y -j -f "%Y-%m-%d" "${SNAPSHOT_DATE}" +%Y-%m-%d 2>/dev/null || \
              date -d "${SNAPSHOT_DATE} - 1 year" +%Y-%m-%d)

  # Discover districts for this snapshot date
  DISTRICTS=$(gcloud storage ls "gs://${GCS_BUCKET}/snapshots/${SNAPSHOT_DATE}/district_*.json" 2>/dev/null \
    | grep -oE 'district_[^.]+' \
    | sed 's/district_//' \
    | tr '\n' ',' \
    | sed 's/,$//')

  if [ -z "$DISTRICTS" ]; then
    echo "  ⚠ No district files found, skipping"
    SKIPPED=$((SKIPPED + 1))
    continue
  fi

  echo "  Districts: ${DISTRICTS}"
  echo "  Previous year: ${PREV_YEAR}"

  # Download previous year snapshots
  mkdir -p "${CACHE_DIR}/snapshots/${PREV_YEAR}"
  PREV_SYNCED=0
  for D in ${DISTRICTS//,/ }; do
    SRC="gs://${GCS_BUCKET}/snapshots/${PREV_YEAR}/district_${D}.json"
    DEST="${CACHE_DIR}/snapshots/${PREV_YEAR}/district_${D}.json"
    if [ ! -f "$DEST" ]; then
      if gcloud storage cp "$SRC" "$DEST" 2>/dev/null; then
        PREV_SYNCED=$((PREV_SYNCED + 1))
      fi
    else
      PREV_SYNCED=$((PREV_SYNCED + 1))
    fi
  done

  if [ "$PREV_SYNCED" -eq 0 ]; then
    echo "  ⚠ No previous year snapshots found, skipping"
    SKIPPED=$((SKIPPED + 1))
    continue
  fi

  echo "  Previous year snapshots: ${PREV_SYNCED}"

  # Download current snapshots
  mkdir -p "${CACHE_DIR}/snapshots/${SNAPSHOT_DATE}"
  for D in ${DISTRICTS//,/ }; do
    DEST="${CACHE_DIR}/snapshots/${SNAPSHOT_DATE}/district_${D}.json"
    if [ ! -f "$DEST" ]; then
      gcloud storage cp \
        "gs://${GCS_BUCKET}/snapshots/${SNAPSHOT_DATE}/district_${D}.json" \
        "$DEST" 2>/dev/null || true
    fi
  done

  # Download all-districts-rankings if available
  RANKINGS_DEST="${CACHE_DIR}/snapshots/${SNAPSHOT_DATE}/all-districts-rankings.json"
  if [ ! -f "$RANKINGS_DEST" ]; then
    gcloud storage cp \
      "gs://${GCS_BUCKET}/snapshots/${SNAPSHOT_DATE}/all-districts-rankings.json" \
      "$RANKINGS_DEST" 2>/dev/null || true
  fi

  # Compute analytics
  if npx collector-cli compute-analytics \
    --date "${SNAPSHOT_DATE}" \
    --districts "${DISTRICTS}" \
    --force-analytics 2>&1 | tail -3; then

    # Upload recomputed analytics
    ANALYTICS_DIR="${CACHE_DIR}/snapshots/${SNAPSHOT_DATE}/analytics"
    if [ -d "$ANALYTICS_DIR" ]; then
      gcloud storage rsync -r \
        "$ANALYTICS_DIR" \
        "gs://${GCS_BUCKET}/snapshots/${SNAPSHOT_DATE}/analytics/" \
        --quiet 2>/dev/null

      # Quick verify: check YoY files
      YOY_OK=0
      for D in ${DISTRICTS//,/ }; do
        YOY_FILE="${ANALYTICS_DIR}/district_${D}_year-over-year.json"
        if [ -f "$YOY_FILE" ]; then
          AVAILABLE=$(python3 -c "
import json
with open('${YOY_FILE}') as f:
    d = json.load(f)
    print(d.get('data',{}).get('dataAvailable', False))
")
          if [ "$AVAILABLE" = "True" ]; then
            YOY_OK=$((YOY_OK + 1))
          fi
        fi
      done
      echo "  ✓ Done — ${YOY_OK} districts with YoY data"
      SUCCEEDED=$((SUCCEEDED + 1))
    fi
  else
    echo "  ✗ Compute failed"
    FAILED=$((FAILED + 1))
    FAILED_DATES="${FAILED_DATES} ${SNAPSHOT_DATE}"
  fi

  # Clean up current date cache to save disk space
  # Keep previous year cache since adjacent dates share the same prev year
  rm -rf "${CACHE_DIR}/snapshots/${SNAPSHOT_DATE}"
  echo ""

done < "$MATCHABLE_FILE"

# ── Summary ──────────────────────────────────────────────────
TOTAL_TIME=$(( $(date +%s) - START_TIME ))
TOTAL_MIN=$(( TOTAL_TIME / 60 ))

echo ""
echo "============================================"
echo "  Backfill Complete — $(date '+%Y-%m-%d %H:%M:%S')"
echo "============================================"
echo "  Total dates:     ${MATCHABLE_COUNT}"
echo "  Succeeded:       ${SUCCEEDED}"
echo "  Failed:          ${FAILED}"
echo "  Skipped:         ${SKIPPED}"
echo "  Duration:        ${TOTAL_MIN} minutes (${TOTAL_TIME}s)"
if [ -n "$FAILED_DATES" ]; then
  echo "  Failed dates:   ${FAILED_DATES}"
fi
echo ""

# Cleanup temp files
rm -f "$ALL_DATES_FILE" "$MATCHABLE_FILE"
