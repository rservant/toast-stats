#!/bin/bash

# Comprehensive cleanup script for test directories
# This script removes all temporary test directories that may have been left behind
# It targets all test directory patterns used in the codebase

echo "Cleaning up test directories..."

# Define test directory patterns to clean up
TEST_PATTERNS=(
    "test-cache*"
    "test-reconciliation*" 
    "test-assessment*"
    "test-[a-zA-Z0-9_-]*"
)

TOTAL_BEFORE=0
TOTAL_CLEANED=0

# Function to count and clean directories for a pattern
cleanup_pattern() {
    local pattern="$1"
    local before_count
    local after_count
    local cleaned_count
    
    # Count directories before cleanup
    before_count=$(find ./test-dir -maxdepth 1 -type d -name "$pattern" 2>/dev/null | wc -l | tr -d ' ')
    
    if [ "$before_count" -gt 0 ]; then
        echo "Found $before_count directories matching pattern: $pattern"
        
        # Remove directories
        find ./test-dir -maxdepth 1 -type d -name "$pattern" -exec rm -rf {} + 2>/dev/null || true
        
        # Count directories after cleanup
        after_count=$(find ./test-dir -maxdepth 1 -type d -name "$pattern" 2>/dev/null | wc -l | tr -d ' ')
        
        cleaned_count=$((before_count - after_count))
        echo "Cleaned up $cleaned_count directories for pattern: $pattern"
        
        if [ "$after_count" -gt 0 ]; then
            echo "Warning: $after_count directories matching '$pattern' could not be removed"
        fi
        
        TOTAL_CLEANED=$((TOTAL_CLEANED + cleaned_count))
    fi
    
    TOTAL_BEFORE=$((TOTAL_BEFORE + before_count))
}

# Check if test-dir exists
if [ ! -d "./test-dir" ]; then
    echo "No test-dir directory found - nothing to clean up"
    exit 0
fi

# Clean up each pattern
for pattern in "${TEST_PATTERNS[@]}"; do
    cleanup_pattern "$pattern"
done

echo ""
echo "=== Cleanup Summary ==="
echo "Total directories found: $TOTAL_BEFORE"
echo "Total directories cleaned: $TOTAL_CLEANED"

# Check if test-dir is now empty (except for .gitkeep if it exists)
remaining_count=$(find ./test-dir -mindepth 1 -type d 2>/dev/null | wc -l | tr -d ' ')
if [ "$remaining_count" -eq 0 ]; then
    echo "✅ test-dir is now clean"
else
    echo "⚠️  $remaining_count directories remain in test-dir:"
    find ./test-dir -mindepth 1 -type d 2>/dev/null | head -10
    if [ "$remaining_count" -gt 10 ]; then
        echo "... and $((remaining_count - 10)) more"
    fi
fi

echo ""
echo "Cleanup complete!"
echo ""
echo "Note: This script removes all test directories in ./test-dir/"
echo "Legitimate test files (like test-cache-helper.ts) are preserved."