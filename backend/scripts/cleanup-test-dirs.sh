#!/bin/bash

# Cleanup script for test directories
# This script removes all temporary test directories that may have been left behind
# It only removes directories that match the patterns in .gitignore

echo "Cleaning up test directories..."

# Count directories before cleanup using a single find command
BEFORE_COUNT=$(find . -type d -name "test-cache*" 2>/dev/null | wc -l | tr -d ' ')

echo "Found $BEFORE_COUNT temporary test directories to clean up"

if [ "$BEFORE_COUNT" -gt 0 ]; then
    # Remove directories using a single find command
    find . -type d -name "test-cache*" -exec rm -rf {} + 2>/dev/null || true
    
    # Count directories after cleanup
    AFTER_COUNT=$(find . -type d -name "test-cache*" 2>/dev/null | wc -l | tr -d ' ')
    
    CLEANED_COUNT=$((BEFORE_COUNT - AFTER_COUNT))
    
    echo "Cleaned up $CLEANED_COUNT temporary test directories"
    
    if [ "$AFTER_COUNT" -gt 0 ]; then
        echo "Warning: $AFTER_COUNT test directories could not be removed"
        echo "Remaining directories:"
        find . -type d -name "test-cache*" 2>/dev/null
    fi
else
    echo "No temporary test directories found to clean up"
fi

echo "Cleanup complete!"
echo ""
echo "Note: This script removes all directories starting with 'test-cache'."
echo "Legitimate test files (like test-cache-helper.ts) are preserved."