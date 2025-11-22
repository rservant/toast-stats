# District-Level Data Feature - User Guide

## Overview

The District-Level Data feature provides comprehensive analytics and insights into district, division, area, and club performance over time. This guide will help you understand how to use the feature effectively.

## Table of Contents

1. [Getting Started](#getting-started)
2. [Initiating District Backfill](#initiating-district-backfill)
3. [Understanding Analytics Metrics](#understanding-analytics-metrics)
4. [Using the District Detail Page](#using-the-district-detail-page)
5. [Interpreting Insights](#interpreting-insights)
6. [Exporting Data](#exporting-data)
7. [Troubleshooting](#troubleshooting)

---

## Getting Started

### Prerequisites

- You must be logged in to the Toastmasters District Visualizer
- You need access to view district data
- Your district must have at least some cached data (or you'll need to initiate a backfill)

### First Time Setup

When you first access a district's detail page, you may see a message indicating that no cached data is available. To start analyzing your district's performance, you'll need to initiate a backfill.

---

## Initiating District Backfill

### What is a District Backfill?

A district backfill is the process of fetching historical performance data for your district. The system retrieves three types of reports for each date:
- District-level performance metrics
- Division-level performance metrics
- Club-level performance metrics

### How to Start a Backfill

1. **Navigate to your district's detail page**
   - From the dashboard, select your district from the district selector

2. **Click the "Backfill District Data" button**
   - Located in the top-right corner of the district detail page
   - Has a circular arrow icon

3. **Configure the date range (optional)**
   - **Start Date**: Defaults to the beginning of the current program year (July 1)
   - **End Date**: Defaults to today's date
   - Leave blank to use defaults, or specify a custom range

4. **Click "Start Backfill"**
   - The system will identify which dates are already cached and skip them
   - Only missing dates will be fetched

### Monitoring Backfill Progress

Once started, a progress modal will display:

- **Progress Bar**: Visual representation of completion percentage
- **Statistics**:
  - **Completed**: Number of dates processed
  - **Total**: Total number of dates to process
  - **Skipped**: Dates already cached (not re-fetched)
  - **Unavailable**: Dates during blackout or reconciliation periods
  - **Failed**: Dates that encountered errors
- **Current Date**: The date currently being processed

### Backfill Behavior

- **Background Processing**: The backfill continues even if you navigate away from the page
- **Smart Caching**: Already-cached dates are automatically skipped
- **Error Resilience**: If a date fails, the backfill continues with remaining dates
- **Blackout Periods**: Some dates may be unavailable due to Toastmasters dashboard maintenance

### Cancelling a Backfill

- Click the "Cancel Backfill" button in the progress modal
- Already-fetched data will remain cached
- You can restart the backfill later to fetch remaining dates

---

## Understanding Analytics Metrics

### Club Health Status

Clubs are categorized into three health statuses:

#### 🟢 Healthy
- Membership ≥ 12 members
- At least 1 DCP goal achieved
- No declining membership trends

#### 🟡 At-Risk
- Membership ≥ 12 members BUT:
  - Zero DCP goals achieved, OR
  - Declining membership for 3+ consecutive months

#### 🔴 Critical
- Membership < 12 members
- At risk of losing charter
- Requires immediate attention

### Distinguished Club Levels

Clubs are recognized based on DCP goals achieved:

- **Distinguished**: 5-6 goals achieved
- **Select Distinguished**: 7-8 goals achieved
- **President's Distinguished**: 9-10 goals achieved

### Leadership Effectiveness Score

Divisions are scored on a 0-100 scale based on:
- **40% Club Health**: Average health of clubs in the division
- **30% Membership Growth**: Trend in total membership
- **30% DCP Achievement**: Average DCP goals per club

Scores ≥ 75 with consistent performance qualify as "Best Practice" divisions.

### Membership Metrics

- **Total Membership**: Sum of active members across all clubs
- **Membership Change**: Net change from start to end of date range
- **Program Year Change**: Change since July 1 (program year start)
- **Growth Rate**: Percentage change in membership

### Seasonal Patterns

The system analyzes month-over-month membership changes to identify:
- **Growth Months**: Months with consistent membership increases
- **Decline Months**: Months with consistent membership decreases
- **Stable Months**: Months with minimal change

Common patterns:
- Growth typically occurs in September-October (new program year)
- Decline may occur in June-July (program year end)

---

## Using the District Detail Page

The district detail page is organized into five tabs:

### 1. Overview Tab

**Purpose**: Quick snapshot of district health

**Key Components**:
- **District Overview Card**
  - Total clubs, membership, and distinguished club count
  - Date range of available cached data
  - Date selector for viewing historical snapshots

- **At-Risk Clubs Panel**
  - Prominently displays clubs needing attention
  - Separated into Critical and At-Risk sections
  - Click any club to view detailed trends

- **Distinguished Progress Chart**
  - Visual gauge showing progress toward district goals
  - Breakdown by distinguished level
  - Projection to year-end based on current trends

**How to Use**:
1. Use the date selector to view district status on any cached date
2. Review at-risk clubs and click for details
3. Monitor distinguished club progress toward goals

### 2. Clubs Tab

**Purpose**: Detailed view of all clubs with sorting and filtering

**Key Components**:
- **Search Bar**: Search by club name, division, or area
- **Status Filter**: Filter by health status (all, healthy, at-risk, critical)
- **Sortable Table**: Click column headers to sort
  - Club Name
  - Division
  - Area
  - Members (current count)
  - DCP Goals (out of 10)
  - Distinguished Status
  - Health Status

**How to Use**:
1. Use search to find specific clubs quickly
2. Filter by status to focus on clubs needing attention
3. Sort by membership or DCP goals to identify top/bottom performers
4. Click any row to view detailed club trends
5. Export filtered results to CSV for further analysis

**Color Coding**:
- 🟢 Green rows: Healthy clubs
- 🟡 Yellow rows: At-risk clubs
- 🔴 Red rows: Critical clubs

### 3. Divisions & Areas Tab

**Purpose**: Compare performance across organizational units

**Key Components**:
- **Division Rankings**
  - Ranked list of all divisions
  - Shows total clubs, DCP goals, and health score
  - Highlights "Best Practice" divisions
  - Trend indicators (improving/stable/declining)

- **Area Performance Chart**
  - Visual comparison of area performance
  - Normalized metrics for fair comparison
  - Hover for detailed metrics

**How to Use**:
1. Identify top-performing divisions to learn best practices
2. Compare your division's rank to others
3. Look for divisions with "improving" trends
4. Analyze area performance within divisions

### 4. Trends Tab

**Purpose**: Analyze performance over time

**Key Components**:
- **Membership Trend Chart**
  - Line chart of total district membership
  - Program year milestones overlaid
  - Highlights growth/decline periods
  - Shows seasonal patterns if detected

- **Year-Over-Year Comparison**
  - Side-by-side comparison with previous year
  - Percentage changes for key metrics
  - Green highlights for improvements
  - Red highlights for declines
  - Supports multi-year view if 3+ years of data available

**How to Use**:
1. Identify seasonal membership patterns
2. Compare current year performance to previous years
3. Spot trends early to take corrective action
4. Celebrate improvements with your team

### 5. Analytics Tab

**Purpose**: Deep insights into leadership and performance

**Key Components**:
- **Leadership Insights**
  - Leadership effectiveness scores by division
  - Top-performing divisions and areas
  - Correlations between leadership and club performance

- **Top Growth Clubs**
  - Clubs with highest membership growth
  - Clubs with highest DCP goal achievement
  - Visual badges and indicators

- **DCP Goal Analysis**
  - Most commonly achieved goals across district
  - Goals that are lagging
  - Displayed as bar chart or heatmap

**How to Use**:
1. Recognize high-performing leaders
2. Identify which DCP goals need more focus
3. Learn from top-growth clubs
4. Share insights with district leadership team

---

## Interpreting Insights

### At-Risk Club Detection

When a club appears in the At-Risk panel, review the risk factors:

**"Membership below 12 (critical)"**
- Immediate action required
- Club is at risk of losing charter
- Reach out to club officers immediately
- Consider mentorship or merger options

**"Declining membership for 3+ months"**
- Trend analysis shows consistent decline
- Investigate root causes (meeting quality, leadership, location)
- Implement retention strategies
- Monitor closely

**"Zero DCP goals achieved"**
- Club may be inactive or struggling
- Review club meeting frequency
- Assess officer engagement
- Provide training and support

### Leadership Effectiveness

**High Scores (75-100)**
- Division/area is performing well
- Leadership is effective
- Consider as "Best Practice" example
- Share strategies with other divisions

**Medium Scores (50-74)**
- Room for improvement
- Identify specific weak areas (health, growth, or DCP)
- Provide targeted support

**Low Scores (0-49)**
- Requires attention
- May indicate leadership challenges
- Consider additional training or mentorship
- Review club support strategies

### Seasonal Patterns

Use seasonal insights to plan:

**Growth Months**
- Schedule recruitment campaigns
- Plan open houses and demo meetings
- Maximize new member onboarding

**Decline Months**
- Focus on retention
- Engage existing members
- Plan special events to maintain interest

---

## Exporting Data

### Export Options

**CSV Export**
- Available on Clubs tab and Analytics views
- Click "Export" button in top-right corner
- Includes all filtered/sorted data
- Filename includes district ID and date range

**What's Included**:
- Club name, division, area
- Current membership count
- DCP goals achieved
- Distinguished status
- Health status
- Risk factors (if applicable)

### Using Exported Data

**Excel/Google Sheets**:
- Open CSV file in spreadsheet software
- Create pivot tables for custom analysis
- Generate charts and visualizations
- Share with district leadership

**Presentations**:
- Copy data into PowerPoint/Google Slides
- Highlight key metrics and trends
- Use for district council meetings
- Celebrate successes and address challenges

---

## Troubleshooting

### "No cached data available"

**Solution**: Initiate a district backfill
1. Click "Backfill District Data" button
2. Select date range
3. Start backfill and wait for completion

### Backfill shows many "Unavailable" dates

**Explanation**: This is normal and expected
- Toastmasters dashboard has blackout periods
- Reconciliation periods when data isn't available
- Typically occurs at month-end and during transitions
- These dates will never have data available

### Backfill failed for some dates

**Possible Causes**:
- Network connectivity issues
- Toastmasters dashboard temporarily unavailable
- Rate limiting

**Solution**:
- Wait a few minutes and restart the backfill
- The system will skip already-cached dates
- Only failed dates will be retried

### Charts not displaying

**Possible Causes**:
- Insufficient data (need at least 2 dates for trends)
- Browser compatibility issues

**Solution**:
- Ensure you have cached data for multiple dates
- Try refreshing the page
- Use a modern browser (Chrome, Firefox, Safari, Edge)

### Year-over-year comparison shows "N/A"

**Explanation**: Previous year data not available
- You need cached data from the same date last year
- Initiate a backfill including dates from previous year

**Solution**:
- Backfill data starting from last program year (July 1 of previous year)
- Wait for backfill to complete
- Year-over-year comparisons will then be available

### Performance is slow with large districts

**Optimization Tips**:
- Use filters to reduce displayed data
- Pagination automatically limits table rows
- Export data for offline analysis if needed
- Close other browser tabs to free up memory

---

## Best Practices

### Regular Monitoring

- **Weekly**: Check at-risk clubs panel
- **Monthly**: Review membership trends
- **Quarterly**: Analyze division/area performance
- **Semi-annually**: Compare year-over-year metrics

### Data Freshness

- Backfill new data weekly or bi-weekly
- More frequent backfills during critical periods (end of program year)
- Historical data doesn't change, so old dates don't need re-fetching

### Sharing Insights

- Export data for district council meetings
- Share top-performing club strategies
- Recognize high-performing divisions publicly
- Use at-risk club data to prioritize support

### Taking Action

- Don't just monitor - act on insights
- Reach out to at-risk clubs proactively
- Celebrate and learn from top performers
- Adjust strategies based on seasonal patterns

---

## Support

For technical issues or questions:
- Check this user guide first
- Review the troubleshooting section
- Contact your system administrator
- Report bugs through the appropriate channels

---

## Glossary

**Backfill**: Process of fetching historical data for dates not yet cached

**Cache**: Local storage of fetched data to avoid repeated API calls

**DCP**: Distinguished Club Program - Toastmasters' recognition system

**Program Year**: July 1 - June 30 (Toastmasters fiscal year)

**Blackout Period**: Times when Toastmasters dashboard data is unavailable

**Reconciliation**: Period when Toastmasters updates and verifies data

**At-Risk**: Club with declining trends or zero DCP goals but membership ≥ 12

**Critical**: Club with membership below 12 members (charter risk)

**Distinguished Projection**: Estimated final distinguished club count based on current trends

**Leadership Effectiveness Score**: Composite score (0-100) measuring division performance

**Seasonal Pattern**: Recurring membership trends tied to specific months

---

*Last Updated: November 2025*
*Version: 1.0*
