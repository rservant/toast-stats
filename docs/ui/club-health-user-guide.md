# Club Health Dashboard User Guide

**Version:** 1.0.0  
**Last Updated:** January 2025  
**Audience:** District Leaders, Club Officers, Toastmasters Members

## Overview

The Club Health Dashboard is a comprehensive visualization platform that helps Toastmasters district leaders and club officers understand club performance using a sophisticated 2D classification model. The system evaluates clubs based on Health Status (Thriving/Vulnerable/Intervention Required) and Trajectory (Recovering/Stable/Declining).

## Getting Started

### Accessing the Dashboard

The Club Health Dashboard can be accessed through several routes:

1. **General Dashboard**: `/club-health` - View all clubs across districts
2. **District-Specific**: `/districts/{districtId}/club-health` - View clubs for a specific district
3. **Individual Club**: `/club-health/{club-name}` - Direct link to a specific club's details

### Navigation

- **Back Navigation**: Use the back arrow in the top-left to return to the previous page
- **Breadcrumbs**: The header shows your current location (e.g., "District 42 Club Health")
- **View Toggle**: Switch between "Health Matrix" and "Analytics" views using the toggle buttons

## Health Matrix View

### Understanding the 3x3 Grid

The Health Matrix displays clubs in a 3×3 grid where:

- **Y-Axis (Vertical)**: Health Status
  - **Top Row**: Thriving (Green) - All requirements met
  - **Middle Row**: Vulnerable (Yellow) - Some requirements met
  - **Bottom Row**: Intervention Required (Red) - Critical issues need attention

- **X-Axis (Horizontal)**: Trajectory
  - **Left Column**: Declining (Red) - Performance worsening
  - **Middle Column**: Stable (Gray) - Performance unchanged
  - **Right Column**: Recovering (Green) - Performance improving

### Grid Cell Interactions

#### Viewing Clubs in Each Cell

1. **Club Markers**: Each club appears as a colored dot or badge in the appropriate cell
2. **Cell Counts**: Numbers in each cell show how many clubs fall into that category
3. **Hover Information**: Hover over any club marker to see:
   - Club name
   - Current membership count
   - Health status reasoning
   - Trajectory explanation

#### Selecting Clubs

- **Click any club marker** to open the detailed Club Health Modal
- **Click cell headers** to filter and view all clubs in that category
- **Use keyboard navigation** (Tab/Enter) for accessibility

### Color Coding System

The dashboard uses Toastmasters brand colors for consistency:

#### Health Status Colors

- **Thriving**: Green (`#28a745`) - Strong performance
- **Vulnerable**: Yellow (`#ffc107`) - Needs attention
- **Intervention Required**: Red (`#dc3545`) - Critical status

#### Trajectory Colors

- **Recovering**: Green (`#28a745`) - Positive trend
- **Stable**: Gray (`#6c757d`) - No significant change
- **Declining**: Red (`#dc3545`) - Negative trend

### Filtering Options

Use the filter panel to narrow down the view:

1. **Health Status Filter**: Show only clubs with specific health statuses
2. **Trajectory Filter**: Show only clubs with specific trajectories
3. **District Filter**: Filter by specific districts (when viewing multiple districts)
4. **Division Filter**: Filter by divisions within a district

## Analytics View

### Overview Dashboard

The Analytics view provides comprehensive district-wide statistics:

#### Health Status Distribution

- **Pie Chart**: Visual breakdown of clubs by health status
- **Percentages**: Exact percentages for each category
- **Total Count**: Total number of clubs in the district

#### Trajectory Distribution

- **Bar Chart**: Shows count of clubs in each trajectory category
- **Trend Indicators**: Month-over-month changes in trajectory distribution

#### Key Metrics Cards

- **Total Clubs**: Overall club count in the district
- **Clubs Needing Attention**: Count of clubs requiring intervention
- **Average Membership**: District-wide membership statistics
- **DCP Progress**: Overall Distinguished Club Program progress

### Trend Analysis

#### Historical Trends

- **Line Charts**: Show health status changes over time
- **Month-over-Month**: Compare current month to previous months
- **Seasonal Patterns**: Identify recurring patterns in club performance

#### Pattern Identification

The system automatically identifies clubs that need attention:

1. **Consistent Intervention**: Clubs in "Intervention Required" for multiple months
2. **Consistent Vulnerable**: Clubs stuck in "Vulnerable" status
3. **Declining Trends**: Clubs showing consistent downward trajectory

### Drill-Down Capabilities

#### From Charts to Details

1. **Click any chart segment** to see the clubs in that category
2. **Filter by clicking legend items** to focus on specific metrics
3. **Use the drill-down panel** to explore detailed club lists

#### Export Options

- **CSV Export**: Download club data for spreadsheet analysis
- **PDF Reports**: Generate formatted reports for meetings
- **JSON Data**: Export raw data for custom analysis

## Club Detail Modal

### Opening Club Details

The Club Detail Modal opens when you:

- Click on any club marker in the Health Matrix
- Select a club from the Analytics drill-down lists
- Navigate directly to a club URL

### Information Displayed

#### Current Status Section

- **Health Status Badge**: Large, colored badge showing current classification
- **Trajectory Indicator**: Arrow showing trend direction
- **Composite Label**: Combined status (e.g., "Thriving • Recovering")

#### Detailed Metrics

- **Current Membership**: Number of active members
- **Member Growth**: Net change since July (program year start)
- **DCP Progress**: Distinguished Club Program goals achieved
- **CSP Status**: Club Success Plan submission status

#### Month-over-Month Changes

- **Membership Delta**: Change from previous month
- **DCP Delta**: Change in goals achieved
- **Health Status Change**: Previous vs. current status

#### Reasoning Explanations

- **Health Status Reasons**: Detailed explanation of why the club received its health status
- **Trajectory Reasons**: Explanation of trajectory determination
- **Requirements Analysis**: Breakdown of which requirements are met/unmet

### Historical Trends

#### Time-Series Charts

- **Health Status History**: Line chart showing status changes over time
- **Membership Trends**: Track membership growth/decline
- **DCP Progress**: Cumulative goal achievement over the program year

#### Performance Indicators

- **Consistency Metrics**: How stable the club's performance has been
- **Improvement Trends**: Whether the club is generally improving
- **Risk Indicators**: Early warning signs of potential issues

### Recommendations

#### Actionable Suggestions

Based on the club's current status, the system provides:

1. **Membership Recommendations**: Strategies for member recruitment/retention
2. **DCP Guidance**: Specific goals to focus on next
3. **CSP Reminders**: Deadlines and submission requirements
4. **Officer Training**: Training completion recommendations

#### Resource Links

- **Toastmasters Resources**: Links to official materials
- **District Support**: Contact information for district leaders
- **Training Materials**: Relevant educational content

### Export and Sharing

#### Individual Club Reports

- **PDF Export**: Generate a comprehensive club health report
- **Print View**: Printer-friendly version of club details
- **Share Link**: Direct URL to the club's detail view

## Accessibility Features

### Keyboard Navigation

The dashboard is fully accessible via keyboard:

1. **Tab Navigation**: Move through interactive elements
2. **Enter/Space**: Activate buttons and select items
3. **Arrow Keys**: Navigate within charts and grids
4. **Escape**: Close modals and return to previous view

### Screen Reader Support

- **ARIA Labels**: All interactive elements have descriptive labels
- **Live Regions**: Dynamic content changes are announced
- **Semantic HTML**: Proper heading structure and landmarks
- **Alt Text**: All visual elements have text alternatives

### Visual Accessibility

- **High Contrast**: WCAG AA compliant color contrasts (4.5:1 minimum)
- **Large Touch Targets**: All interactive elements are at least 44px
- **Clear Typography**: Readable fonts with appropriate sizing
- **Color Independence**: Information is not conveyed by color alone

### Mobile Accessibility

- **Responsive Design**: Adapts to all screen sizes
- **Touch-Friendly**: Large, easy-to-tap interface elements
- **Gesture Support**: Swipe and pinch gestures where appropriate
- **Orientation Support**: Works in both portrait and landscape modes

## Troubleshooting Guide

### Common Issues and Solutions

#### Dashboard Not Loading

**Problem**: The dashboard shows a loading spinner indefinitely

**Solutions**:

1. **Check Internet Connection**: Ensure you have a stable internet connection
2. **Refresh the Page**: Press F5 or Ctrl+R to reload
3. **Clear Browser Cache**: Clear your browser's cache and cookies
4. **Try Different Browser**: Test with Chrome, Firefox, or Safari
5. **Check District ID**: Ensure the district ID in the URL is valid

#### No Clubs Displayed

**Problem**: The Health Matrix or Analytics view shows no clubs

**Solutions**:

1. **Check Filters**: Clear all active filters to see all clubs
2. **Verify District**: Ensure you're viewing the correct district
3. **Data Availability**: Some districts may not have current health data
4. **Contact Support**: Reach out to your district leadership for data issues

#### Club Detail Modal Won't Open

**Problem**: Clicking on clubs doesn't open the detail modal

**Solutions**:

1. **JavaScript Enabled**: Ensure JavaScript is enabled in your browser
2. **Pop-up Blockers**: Disable pop-up blockers for the site
3. **Browser Compatibility**: Use a modern browser (Chrome 90+, Firefox 88+, Safari 14+)
4. **Try Different Club**: Test with multiple clubs to isolate the issue

#### Charts Not Displaying

**Problem**: Analytics charts appear blank or broken

**Solutions**:

1. **Browser Support**: Ensure your browser supports SVG graphics
2. **Ad Blockers**: Temporarily disable ad blockers
3. **Screen Size**: Try a larger screen or different orientation
4. **Data Issues**: Charts may be empty if no data is available

#### Performance Issues

**Problem**: Dashboard is slow or unresponsive

**Solutions**:

1. **Close Other Tabs**: Free up browser memory
2. **Reduce Data Range**: Use filters to show fewer clubs
3. **Check Device**: Ensure your device meets minimum requirements
4. **Network Speed**: Test with a faster internet connection

### Error Messages

#### "District not found or no health data available"

**Meaning**: The specified district doesn't exist or has no current health data

**Action**:

- Verify the district ID is correct
- Contact district leadership about data availability
- Try a different district to test functionality

#### "Failed to retrieve club health history"

**Meaning**: Historical data for the club is not available

**Action**:

- Try refreshing the page
- Check if the club name is spelled correctly
- Historical data may not exist for new clubs

#### "Request timeout"

**Meaning**: The server took too long to respond

**Action**:

- Check your internet connection
- Try again in a few minutes
- Contact technical support if the issue persists

### Browser Requirements

#### Minimum Requirements

- **Chrome**: Version 90 or later
- **Firefox**: Version 88 or later
- **Safari**: Version 14 or later
- **Edge**: Version 90 or later

#### Recommended Settings

- **JavaScript**: Must be enabled
- **Cookies**: Must be enabled for session management
- **Local Storage**: Used for user preferences
- **Screen Resolution**: 1024×768 minimum, 1920×1080 recommended

### Mobile Device Support

#### Supported Devices

- **iOS**: iPhone 8 or later, iPad (6th generation) or later
- **Android**: Android 8.0 or later with Chrome 90+
- **Screen Size**: 320px width minimum

#### Mobile-Specific Features

- **Touch Navigation**: Tap and swipe gestures
- **Responsive Layout**: Optimized for small screens
- **Offline Viewing**: Limited offline capability for cached data

## Best Practices

### For District Leaders

#### Regular Monitoring

1. **Weekly Reviews**: Check the dashboard weekly for status changes
2. **Monthly Reports**: Generate monthly analytics reports for district meetings
3. **Proactive Outreach**: Contact clubs showing declining trends early
4. **Resource Allocation**: Use data to prioritize district support efforts

#### Data Interpretation

1. **Context Matters**: Consider seasonal patterns and local factors
2. **Trend Focus**: Pay more attention to trajectory than single-month status
3. **Multiple Metrics**: Don't rely solely on health status; consider membership and DCP progress
4. **Historical Perspective**: Compare current performance to previous years

### For Club Officers

#### Using Club Details

1. **Monthly Check-ins**: Review your club's status monthly
2. **Action Planning**: Use recommendations to create improvement plans
3. **Member Communication**: Share positive trends with members
4. **Goal Setting**: Use DCP progress to set monthly goals

#### Improvement Strategies

1. **Membership Focus**: Prioritize member recruitment and retention
2. **DCP Planning**: Create a timeline for achieving remaining goals
3. **CSP Compliance**: Ensure timely submission of required plans
4. **Officer Training**: Complete all required training promptly

### For Technical Users

#### Performance Optimization

1. **Filter Usage**: Use filters to reduce data load for large districts
2. **Browser Cache**: Allow the browser to cache static resources
3. **Regular Updates**: Keep your browser updated for best performance
4. **Network Considerations**: Use wired connections for large data exports

#### Data Export Tips

1. **CSV for Analysis**: Use CSV exports for spreadsheet analysis
2. **PDF for Sharing**: Use PDF exports for meeting presentations
3. **JSON for Integration**: Use JSON exports for custom applications
4. **Regular Backups**: Export data regularly for historical records

## Frequently Asked Questions

### General Questions

**Q: How often is the club health data updated?**
A: Club health data is typically updated monthly, with some metrics updated more frequently based on data availability from Toastmasters International systems.

**Q: Can I view historical data for clubs that no longer exist?**
A: Historical data for disbanded clubs may be available for a limited time, but active clubs are prioritized in the system.

**Q: Why do some clubs show "No Data Available"?**
A: This can occur for new clubs, clubs with incomplete data submissions, or during system maintenance periods.

### Technical Questions

**Q: Does the dashboard work offline?**
A: Limited offline functionality is available for recently viewed data, but full functionality requires an internet connection.

**Q: Can I integrate this data with other systems?**
A: Yes, the dashboard provides JSON export functionality and API access for integration with other systems.

**Q: Is my club data secure?**
A: Yes, all data is encrypted in transit and at rest, and access is controlled based on Toastmasters roles and permissions.

### Interpretation Questions

**Q: What does "Intervention Required" really mean?**
A: It indicates a club has membership below 12 members AND growth below 3 members since July, requiring immediate district support.

**Q: Can a "Thriving" club have a "Declining" trajectory?**
A: Yes, this indicates a club that meets all current requirements but is showing concerning trends that need attention.

**Q: How are DCP requirements calculated?**
A: DCP requirements increase throughout the program year: 1+ goals (Aug-Sep), 2+ (Oct-Nov), 3+ (Dec-Jan), 4+ (Feb-Mar), 5+ (Apr-Jun).

## Support and Resources

### Getting Help

#### Technical Support

- **Documentation**: This user guide and API documentation
- **Browser Issues**: Try different browsers or clear cache
- **Performance Problems**: Check system requirements and network connection

#### District Support

- **Data Questions**: Contact your District Governor or Program Quality Director
- **Club Issues**: Work with your Area/Division Director
- **Training Needs**: Reach out to your District Training team

#### Toastmasters Resources

- **Official Website**: [toastmasters.org](https://toastmasters.org)
- **DCP Information**: Distinguished Club Program guidelines
- **CSP Templates**: Club Success Plan templates and deadlines
- **Officer Training**: Required training modules and schedules

### Additional Resources

#### Educational Materials

- **Club Health Webinars**: Recorded sessions on interpreting health data
- **Best Practices Guide**: Strategies for improving club health
- **Case Studies**: Examples of successful club turnarounds
- **Monthly Tips**: Regular updates on club health improvement

#### Community Support

- **District Forums**: Connect with other district leaders
- **User Groups**: Join discussions about dashboard usage
- **Feedback Channels**: Provide suggestions for improvements
- **Success Stories**: Share your club improvement successes

## Changelog

### Version 1.0.0 (Current)

#### New Features

- Complete Health Matrix visualization with 3×3 grid
- Comprehensive Analytics dashboard with charts and trends
- Detailed Club Health Modal with historical data
- Full accessibility compliance (WCAG AA)
- Mobile-responsive design
- Export functionality (CSV, PDF, JSON)
- Real-time filtering and drill-down capabilities

#### Accessibility Improvements

- Keyboard navigation support
- Screen reader compatibility
- High contrast color schemes
- Large touch targets (44px minimum)
- Alternative text for all visual elements

#### Performance Enhancements

- Optimized chart rendering
- Efficient data filtering
- Responsive image loading
- Browser caching strategies

### Planned Features

#### Version 1.1 (Upcoming)

- **Real-time Updates**: Live data refresh without page reload
- **Custom Alerts**: Set up notifications for club status changes
- **Advanced Filtering**: More granular filter options
- **Bulk Actions**: Perform actions on multiple clubs simultaneously

#### Version 1.2 (Future)

- **Predictive Analytics**: Forecast future club health trends
- **Comparison Tools**: Compare clubs side-by-side
- **Integration APIs**: Enhanced API access for third-party tools
- **Mobile App**: Dedicated mobile application

## Conclusion

The Club Health Dashboard is a powerful tool for understanding and improving Toastmasters club performance. By regularly monitoring health status and trajectory trends, district leaders and club officers can proactively address issues and support club growth.

For additional support or questions not covered in this guide, please contact your district leadership or refer to the technical documentation provided with the system.

---

**Document Information**

- **Version**: 1.0.0
- **Last Updated**: January 2025
- **Next Review**: April 2025
- **Feedback**: Submit suggestions through your district leadership
