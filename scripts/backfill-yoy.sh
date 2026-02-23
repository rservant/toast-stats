#!/usr/bin/env bash
# backfill-yoy.sh — Recompute YoY analytics with previous year snapshots
#
# This script fixes the "No Historical Data" issue in the Year-over-Year
# comparison by:
# 1. Downloading previous year snapshots from GCS
# 2. Downloading current snapshots from GCS (if not already local)
# 3. Recomputing analytics with --force
# 4. Uploading the recomputed analytics back to GCS
#
# Usage: ./scripts/backfill-yoy.sh [SNAPSHOT_DATE]
#   SNAPSHOT_DATE: defaults to the latest snapshot date in GCS

set -euo pipefail

GCS_BUCKET="toast-stats-data"
CACHE_DIR="./cache"
DISTRICTS=(109 117 20 42 61 86)

# Determine the snapshot date to recompute
if [ -n "${1:-}" ]; then
  SNAPSHOT_DATE="$1"
else
  echo "Discovering latest snapshot date from GCS..."
  SNAPSHOT_DATE=$(gcloud storage ls "gs://${GCS_BUCKET}/snapshots/" \
    | grep -oP '\d{4}-\d{2}-\d{2}' \
    | sort -r \
    | head -1)
fi

echo "=== YoY Backfill ==="
echo "Snapshot date: ${SNAPSHOT_DATE}"

# Calculate previous year date (macOS compatible)
PREV_YEAR=$(date -v-1y -j -f "%Y-%m-%d" "${SNAPSHOT_DATE}" +%Y-%m-%d 2>/dev/null || \
            date -d "${SNAPSHOT_DATE} - 1 year" +%Y-%m-%d)
echo "Previous year date: ${PREV_YEAR}"
echo ""

# Step 1: Download previous year snapshots
echo "📥 Step 1: Downloading previous year snapshots..."
mkdir -p "${CACHE_DIR}/snapshots/${PREV_YEAR}"
SYNCED=0
for D in "${DISTRICTS[@]}"; do
  SRC="gs://${GCS_BUCKET}/snapshots/${PREV_YEAR}/district_${D}.json"
  DEST="${CACHE_DIR}/snapshots/${PREV_YEAR}/district_${D}.json"
  if gcloud storage cp "$SRC" "$DEST" 2>/dev/null; then
    SIZE=$(wc -c < "$DEST" | tr -d ' ')
    echo "  ✓ district_${D}.json (${SIZE} bytes)"
    SYNCED=$((SYNCED + 1))
  else
    echo "  ✗ district_${D}.json (not found)"
  fi
done
echo "  Synced: ${SYNCED}/${#DISTRICTS[@]} snapshots"
echo ""

# Step 2: Ensure current snapshots exist locally
echo "📥 Step 2: Ensuring current snapshots exist locally..."
mkdir -p "${CACHE_DIR}/snapshots/${SNAPSHOT_DATE}"
for D in "${DISTRICTS[@]}"; do
  DEST="${CACHE_DIR}/snapshots/${SNAPSHOT_DATE}/district_${D}.json"
  if [ ! -f "$DEST" ]; then
    SRC="gs://${GCS_BUCKET}/snapshots/${SNAPSHOT_DATE}/district_${D}.json"
    if gcloud storage cp "$SRC" "$DEST" 2>/dev/null; then
      echo "  ✓ district_${D}.json (downloaded)"
    else
      echo "  ✗ district_${D}.json (not found)"
    fi
  else
    echo "  ✓ district_${D}.json (already local)"
  fi
done

# Also download all-districts-rankings if not present
RANKINGS_DEST="${CACHE_DIR}/snapshots/${SNAPSHOT_DATE}/all-districts-rankings.json"
if [ ! -f "$RANKINGS_DEST" ]; then
  gcloud storage cp \
    "gs://${GCS_BUCKET}/snapshots/${SNAPSHOT_DATE}/all-districts-rankings.json" \
    "$RANKINGS_DEST" 2>/dev/null || echo "  ⚠ all-districts-rankings.json not found"
fi
echo ""

# Step 3: Recompute analytics
echo "🔄 Step 3: Recomputing analytics with --force..."
DISTRICT_LIST=$(IFS=,; echo "${DISTRICTS[*]}")
npx collector-cli compute-analytics \
  --date "${SNAPSHOT_DATE}" \
  --districts "${DISTRICT_LIST}" \
  --force-analytics \
  --verbose

echo ""

# Step 4: Upload recomputed analytics to GCS
echo "📤 Step 4: Uploading recomputed analytics to GCS..."
ANALYTICS_DIR="${CACHE_DIR}/snapshots/${SNAPSHOT_DATE}/analytics"
if [ -d "$ANALYTICS_DIR" ]; then
  gcloud storage rsync -r \
    "$ANALYTICS_DIR" \
    "gs://${GCS_BUCKET}/snapshots/${SNAPSHOT_DATE}/analytics/"
  echo "  ✓ Analytics synced to GCS"
else
  echo "  ✗ No analytics directory found at ${ANALYTICS_DIR}"
  exit 1
fi

echo ""

# Step 5: Verify YoY data
echo "🔍 Step 5: Verifying YoY data..."
for D in "${DISTRICTS[@]}"; do
  YOY_FILE="${ANALYTICS_DIR}/district_${D}_year-over-year.json"
  if [ -f "$YOY_FILE" ]; then
    AVAILABLE=$(python3 -c "import json; f=open('${YOY_FILE}'); d=json.load(f); print(d.get('data',{}).get('dataAvailable', 'N/A'))")
    echo "  District ${D}: dataAvailable=${AVAILABLE}"
  else
    echo "  District ${D}: ✗ year-over-year.json not found"
  fi
done

echo ""
echo "✅ Backfill complete!"
