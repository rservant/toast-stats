#!/bin/bash
set -euo pipefail

START_DATE="2024-07-20"
END_DATE="2008-07-01"

# Resume support: if .scrape-last exists, resume from the day before it
CHECKPOINT_FILE=".scrape-last"

if [ -f "$CHECKPOINT_FILE" ]; then
  last=$(cat "$CHECKPOINT_FILE")
  current=$(date -j -v-1d -f "%Y-%m-%d" "$last" +"%Y-%m-%d")
  echo "Resuming from $current (last completed: $last)"
else
  current="$START_DATE"
fi

while true; do
  echo "Running collector for $current"
  ~/code/toast-stats/packages/collector-cli/bin/collector-cli.js scrape --date "$current"

  # Write checkpoint only after success
  echo "$current" > "$CHECKPOINT_FILE"

  if [ "$current" = "$END_DATE" ]; then
    echo "Done. Reached $END_DATE"
    break
  fi

  current=$(date -j -v-1d -f "%Y-%m-%d" "$current" +"%Y-%m-%d")
done

