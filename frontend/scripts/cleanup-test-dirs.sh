#!/bin/bash

# Comprehensive cleanup script for frontend test directories
# This script removes all temporary test directories that may have been left behind
# It targets all test directory patterns used in the frontend codebase

set -e

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Counter for total cleaned directories
TOTAL_CLEANED=0

# Function to clean directories matching a pattern
clean_pattern() {
    local pattern=$1
    local description=$2
    
    echo -e "${YELLOW}Cleaning $description...${NC}"
    
    # Count directories before cleanup
    before_count=$(find ./test-dir -maxdepth 1 -type d -name "$pattern" 2>/dev/null | wc -l | tr -d ' ')
    
    if [ "$before_count" -gt 0 ]; then
        echo "  Found $before_count directories matching pattern: $pattern"
        
        # Remove directories
        find ./test-dir -maxdepth 1 -type d -name "$pattern" -exec rm -rf {} + 2>/dev/null || true
        
        # Count directories after cleanup
        after_count=$(find ./test-dir -maxdepth 1 -type d -name "$pattern" 2>/dev/null | wc -l | tr -d ' ')
        
        cleaned_count=$((before_count - after_count))
        TOTAL_CLEANED=$((TOTAL_CLEANED + cleaned_count))
        
        if [ "$cleaned_count" -gt 0 ]; then
            echo -e "  ${GREEN}✅ Cleaned $cleaned_count directories${NC}"
        else
            echo -e "  ${RED}❌ Failed to clean some directories${NC}"
        fi
    else
        echo "  No directories found matching pattern: $pattern"
    fi
}

# Check if test-dir exists
if [ ! -d "./test-dir" ]; then
    echo "No test-dir directory found - nothing to clean up"
    exit 0
fi

echo -e "${GREEN}🧹 Starting frontend test directory cleanup...${NC}"

# Clean various test directory patterns
clean_pattern "test-cache-*" "test cache directories"
clean_pattern "test-*" "general test directories"

echo ""
echo -e "${GREEN}✅ Cleanup completed!${NC}"
echo "Total directories cleaned: $TOTAL_CLEANED"

# Check if test-dir is now empty (except for .gitkeep if it exists)
remaining_count=$(find ./test-dir -mindepth 1 -type d 2>/dev/null | wc -l | tr -d ' ')
if [ "$remaining_count" -eq 0 ]; then
    echo -e "${GREEN}📁 test-dir is now clean${NC}"
    # Remove the test-dir if it's completely empty
    if [ -z "$(ls -A ./test-dir 2>/dev/null)" ]; then
        rmdir ./test-dir 2>/dev/null || true
        echo -e "${GREEN}🗑️  Removed empty test-dir${NC}"
    fi
else
    echo -e "${YELLOW}📁 $remaining_count directories remain in test-dir${NC}"
fi