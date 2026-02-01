#!/bin/bash
#
# Backfill Historical Data Script
#
# Populates snapshots and analytics from a start date to today.
# Processes dates in chronological order (past → present) to ensure
# time series data is complete when analytics are computed.
#
# Usage:
#   ./scripts/backfill-historical-data.sh [OPTIONS]
#
# Options:
#   --start-date YYYY-MM-DD   Start date (default: 2017-02-06)
#   --end-date YYYY-MM-DD     End date (default: today)
#   --districts LIST          Comma-separated district IDs (default: all)
#   --scrape                  Also scrape data (default: only transform existing CSV)
#   --skip-analytics          Skip analytics computation
#   --force                   Force re-process even if data exists
#   --verbose                 Enable verbose output
#   --dry-run                 Show what would be done without executing
#   --resume-from YYYY-MM-DD  Resume from a specific date (skip earlier dates)
#
# Examples:
#   # Full backfill from 2017-02-06 to today
#   ./scripts/backfill-historical-data.sh
#
#   # Backfill specific date range
#   ./scripts/backfill-historical-data.sh --start-date 2023-01-01 --end-date 2023-12-31
#
#   # Backfill specific districts
#   ./scripts/backfill-historical-data.sh --districts 57,58,59
#
#   # Resume interrupted backfill
#   ./scripts/backfill-historical-data.sh --resume-from 2020-06-15
#

set -e

# Default values
START_DATE="2017-02-06"
END_DATE=$(date +%Y-%m-%d)
DISTRICTS=""
DO_SCRAPE=false
SKIP_ANALYTICS=false
FORCE=false
VERBOSE=false
DRY_RUN=false
RESUME_FROM=""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Log file
LOG_DIR="./backfill-logs"
mkdir -p "$LOG_DIR"
LOG_FILE="$LOG_DIR/backfill-$(date +%Y%m%d-%H%M%S).log"

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --start-date)
            START_DATE="$2"
            shift 2
            ;;
        --end-date)
            END_DATE="$2"
            shift 2
            ;;
        --districts)
            DISTRICTS="$2"
            shift 2
            ;;
        --scrape)
            DO_SCRAPE=true
            shift
            ;;
        --skip-analytics)
            SKIP_ANALYTICS=true
            shift
            ;;
        --force)
            FORCE=true
            shift
            ;;
        --verbose)
            VERBOSE=true
            shift
            ;;
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        --resume-from)
            RESUME_FROM="$2"
            shift 2
            ;;
        --help)
            head -50 "$0" | tail -45
            exit 0
            ;;
        *)
            echo -e "${RED}Unknown option: $1${NC}"
            exit 1
            ;;
    esac
done

# Logging function
log() {
    local level="$1"
    local message="$2"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    
    echo "[$timestamp] [$level] $message" >> "$LOG_FILE"
    
    case $level in
        INFO)
            echo -e "${BLUE}[$timestamp]${NC} $message"
            ;;
        SUCCESS)
            echo -e "${GREEN}[$timestamp]${NC} $message"
            ;;
        WARN)
            echo -e "${YELLOW}[$timestamp]${NC} $message"
            ;;
        ERROR)
            echo -e "${RED}[$timestamp]${NC} $message"
            ;;
    esac
}

# Validate date format
validate_date() {
    local date="$1"
    if ! [[ "$date" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}$ ]]; then
        log ERROR "Invalid date format: $date (expected YYYY-MM-DD)"
        exit 1
    fi
}

# Get next date (cross-platform)
next_date() {
    local current="$1"
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        date -j -v+1d -f "%Y-%m-%d" "$current" "+%Y-%m-%d"
    else
        # Linux
        date -d "$current + 1 day" "+%Y-%m-%d"
    fi
}

# Compare dates (returns 0 if date1 <= date2)
date_lte() {
    local date1="$1"
    local date2="$2"
    [[ "$date1" < "$date2" ]] || [[ "$date1" == "$date2" ]]
}

# Build CLI options
build_cli_options() {
    local opts=""
    
    if [[ -n "$DISTRICTS" ]]; then
        opts="$opts --districts $DISTRICTS"
    fi
    
    if [[ "$FORCE" == "true" ]]; then
        opts="$opts --force"
    fi
    
    if [[ "$VERBOSE" == "true" ]]; then
        opts="$opts --verbose"
    fi
    
    echo "$opts"
}

# Run scraper-cli command
run_cli() {
    local command="$1"
    local date="$2"
    local extra_opts="$3"
    
    local cli_opts=$(build_cli_options)
    local full_cmd="npx scraper-cli $command --date $date $cli_opts $extra_opts"
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log INFO "[DRY-RUN] Would execute: $full_cmd"
        return 0
    fi
    
    log INFO "Executing: $full_cmd"
    
    # Run command and capture output
    local output_file="$LOG_DIR/output-$date-$command.json"
    
    if eval "$full_cmd" > "$output_file" 2>> "$LOG_FILE"; then
        local status=$(jq -r '.status' "$output_file" 2>/dev/null || echo "unknown")
        if [[ "$status" == "success" ]]; then
            log SUCCESS "$command for $date completed successfully"
            return 0
        elif [[ "$status" == "partial" ]]; then
            log WARN "$command for $date completed with partial success"
            return 0
        else
            log ERROR "$command for $date failed (status: $status)"
            return 1
        fi
    else
        log ERROR "$command for $date failed with exit code $?"
        return 1
    fi
}

# Process a single date
process_date() {
    local date="$1"
    
    log INFO "========== Processing date: $date =========="
    
    # Step 1: Scrape (only if --scrape flag is set)
    if [[ "$DO_SCRAPE" == "true" ]]; then
        if ! run_cli "scrape" "$date" "--transform"; then
            log WARN "Scrape failed for $date, continuing to next date..."
            return 1
        fi
    else
        # Just transform existing raw CSV files
        if ! run_cli "transform" "$date" ""; then
            log WARN "Transform failed for $date, continuing to next date..."
            return 1
        fi
    fi
    
    # Step 2: Compute analytics (if not skipped)
    if [[ "$SKIP_ANALYTICS" != "true" ]]; then
        if ! run_cli "compute-analytics" "$date" ""; then
            log WARN "Analytics computation failed for $date, continuing..."
            return 1
        fi
    fi
    
    log SUCCESS "Completed processing for $date"
    return 0
}

# Main execution
main() {
    validate_date "$START_DATE"
    validate_date "$END_DATE"
    
    if [[ -n "$RESUME_FROM" ]]; then
        validate_date "$RESUME_FROM"
        START_DATE="$RESUME_FROM"
        log INFO "Resuming from $RESUME_FROM"
    fi
    
    log INFO "=============================================="
    log INFO "Historical Data Backfill"
    log INFO "=============================================="
    log INFO "Start date: $START_DATE"
    log INFO "End date: $END_DATE"
    log INFO "Districts: ${DISTRICTS:-all}"
    log INFO "Scrape: $DO_SCRAPE"
    log INFO "Skip analytics: $SKIP_ANALYTICS"
    log INFO "Force: $FORCE"
    log INFO "Dry run: $DRY_RUN"
    log INFO "Log file: $LOG_FILE"
    log INFO "=============================================="
    
    # Calculate total days
    local current_date="$START_DATE"
    local total_days=0
    while date_lte "$current_date" "$END_DATE"; do
        ((total_days++))
        current_date=$(next_date "$current_date")
    done
    
    log INFO "Total dates to process: $total_days"
    
    # Process each date
    current_date="$START_DATE"
    local processed=0
    local succeeded=0
    local failed=0
    
    while date_lte "$current_date" "$END_DATE"; do
        ((processed++))
        
        log INFO "Progress: $processed / $total_days dates"
        
        if process_date "$current_date"; then
            ((succeeded++))
        else
            ((failed++))
        fi
        
        current_date=$(next_date "$current_date")
        
        # Brief pause between dates to avoid overwhelming the system
        if [[ "$DRY_RUN" != "true" ]]; then
            sleep 1
        fi
    done
    
    # Summary
    log INFO "=============================================="
    log INFO "Backfill Complete"
    log INFO "=============================================="
    log INFO "Total processed: $processed"
    log SUCCESS "Succeeded: $succeeded"
    if [[ $failed -gt 0 ]]; then
        log ERROR "Failed: $failed"
    fi
    log INFO "Log file: $LOG_FILE"
    log INFO "=============================================="
    
    if [[ $failed -gt 0 ]]; then
        exit 1
    fi
    
    exit 0
}

# Run main
main
