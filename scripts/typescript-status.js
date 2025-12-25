#!/usr/bin/env node

/**
 * TypeScript Error Tracking Script
 * 
 * This script provides detailed TypeScript error analysis and tracking
 * for the zero-error policy enforcement.
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function runTypeScriptCheck(directory) {
  try {
    const result = execSync(`cd ${directory} && npx tsc --noEmit --skipLibCheck`, { 
      encoding: 'utf8',
      stdio: 'pipe'
    });
    return { errors: [], count: 0 };
  } catch (error) {
    const output = error.stdout || error.stderr || '';
    const errorLines = output.split('\n').filter(line => 
      line.includes('error TS') && !line.includes('Found ')
    );
    
    return {
      errors: errorLines,
      count: errorLines.length
    };
  }
}

function categorizeErrors(errors) {
  const categories = {
    'Type Errors': [],
    'Missing Properties': [],
    'Unused Variables': [],
    'Import/Export Issues': [],
    'Other': []
  };

  errors.forEach(error => {
    if (error.includes('TS2339') || error.includes('TS2345') || error.includes('TS2322')) {
      categories['Type Errors'].push(error);
    } else if (error.includes('TS2741') || error.includes('TS2740')) {
      categories['Missing Properties'].push(error);
    } else if (error.includes('TS6133') || error.includes('TS6196')) {
      categories['Unused Variables'].push(error);
    } else if (error.includes('TS2307') || error.includes('TS2305')) {
      categories['Import/Export Issues'].push(error);
    } else {
      categories['Other'].push(error);
    }
  });

  return categories;
}

function generateReport() {
  console.log('🔍 TypeScript Error Analysis Report');
  console.log('=====================================\n');

  // Check backend
  console.log('📊 Backend Analysis:');
  const backendResult = runTypeScriptCheck('backend');
  console.log(`   Errors: ${backendResult.count}`);
  
  if (backendResult.count > 0) {
    const backendCategories = categorizeErrors(backendResult.errors);
    Object.entries(backendCategories).forEach(([category, errors]) => {
      if (errors.length > 0) {
        console.log(`   ${category}: ${errors.length}`);
      }
    });
  }

  // Check frontend
  console.log('\n📊 Frontend Analysis:');
  const frontendResult = runTypeScriptCheck('frontend');
  console.log(`   Errors: ${frontendResult.count}`);
  
  if (frontendResult.count > 0) {
    const frontendCategories = categorizeErrors(frontendResult.errors);
    Object.entries(frontendCategories).forEach(([category, errors]) => {
      if (errors.length > 0) {
        console.log(`   ${category}: ${errors.length}`);
      }
    });
  }

  // Summary
  const totalErrors = backendResult.count + frontendResult.count;
  console.log('\n📈 Summary:');
  console.log(`   Total Errors: ${totalErrors}`);
  console.log(`   Backend: ${backendResult.count}`);
  console.log(`   Frontend: ${frontendResult.count}`);

  // Policy compliance
  console.log('\n🎯 Policy Compliance:');
  if (totalErrors === 0) {
    console.log('   ✅ COMPLIANT - Zero TypeScript errors detected');
    console.log('   🎉 Ready for production deployment!');
  } else {
    console.log('   ❌ NON-COMPLIANT - TypeScript errors detected');
    console.log('   🚫 Deployment blocked until errors are resolved');
    console.log(`   📋 See .kiro/steering/typescript-policy.md for guidance`);
  }

  // Save report to file
  const reportData = {
    timestamp: new Date().toISOString(),
    backend: {
      count: backendResult.count,
      errors: backendResult.errors
    },
    frontend: {
      count: frontendResult.count,
      errors: frontendResult.errors
    },
    total: totalErrors,
    compliant: totalErrors === 0
  };

  fs.writeFileSync('typescript-report.json', JSON.stringify(reportData, null, 2));
  console.log('\n📄 Detailed report saved to typescript-report.json');

  // Exit with error code if there are TypeScript errors
  if (totalErrors > 0) {
    process.exit(1);
  }
}

// Show detailed errors if requested
if (process.argv.includes('--detailed')) {
  console.log('\n🔍 Detailed Error Analysis:');
  
  const backendResult = runTypeScriptCheck('backend');
  if (backendResult.count > 0) {
    console.log('\n❌ Backend Errors:');
    backendResult.errors.slice(0, 10).forEach((error, index) => {
      console.log(`   ${index + 1}. ${error.trim()}`);
    });
    if (backendResult.errors.length > 10) {
      console.log(`   ... and ${backendResult.errors.length - 10} more errors`);
    }
  }

  const frontendResult = runTypeScriptCheck('frontend');
  if (frontendResult.count > 0) {
    console.log('\n❌ Frontend Errors:');
    frontendResult.errors.slice(0, 10).forEach((error, index) => {
      console.log(`   ${index + 1}. ${error.trim()}`);
    });
    if (frontendResult.errors.length > 10) {
      console.log(`   ... and ${frontendResult.errors.length - 10} more errors`);
    }
  }
}

generateReport();