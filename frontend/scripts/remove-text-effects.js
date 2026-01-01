#!/usr/bin/env node

/**
 * Text Effects Removal Script
 *
 * Scans the codebase for prohibited text effects and removes them
 * according to Toastmasters brand guidelines (Requirements 2.3, 2.4)
 */

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Prohibited text effects patterns (actual violations, not prevention rules)
const PROHIBITED_PATTERNS = [
  /text-shadow\s*:\s*(?!none)[^;]+/gi,
  /filter\s*:\s*drop-shadow\([^)]+\)/gi,
  /filter\s*:\s*blur\([^)]+\)/gi,
  /-webkit-text-stroke\s*:\s*(?!none)[^;]+/gi,
  /text-stroke\s*:\s*(?!none)[^;]+/gi,
  /text-outline\s*:\s*(?!none)[^;]+/gi,
  /-webkit-text-outline\s*:\s*(?!none)[^;]+/gi,
]

// File extensions to scan
const SCAN_EXTENSIONS = ['.css', '.scss', '.tsx', '.jsx', '.ts', '.js']

// Directories to scan
const SCAN_DIRECTORIES = [
  path.join(__dirname, '../src'),
  path.join(__dirname, '../public'),
]

// Directories to exclude
const EXCLUDE_DIRECTORIES = [
  'node_modules',
  'dist',
  'build',
  '.git',
  'coverage',
  '__tests__',
]

/**
 * Check if a file should be scanned
 */
function shouldScanFile(filePath) {
  const ext = path.extname(filePath)
  return SCAN_EXTENSIONS.includes(ext)
}

/**
 * Check if a directory should be excluded
 */
function shouldExcludeDirectory(dirPath) {
  const dirName = path.basename(dirPath)
  return EXCLUDE_DIRECTORIES.includes(dirName)
}

/**
 * Recursively get all files to scan
 */
function getAllFiles(dirPath, fileList = []) {
  if (!fs.existsSync(dirPath)) {
    return fileList
  }

  const files = fs.readdirSync(dirPath)

  files.forEach(file => {
    const filePath = path.join(dirPath, file)
    const stat = fs.statSync(filePath)

    if (stat.isDirectory()) {
      if (!shouldExcludeDirectory(filePath)) {
        getAllFiles(filePath, fileList)
      }
    } else if (shouldScanFile(filePath)) {
      fileList.push(filePath)
    }
  })

  return fileList
}

/**
 * Scan a file for prohibited text effects
 */
function scanFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8')
  const violations = []

  PROHIBITED_PATTERNS.forEach(pattern => {
    let match
    while ((match = pattern.exec(content)) !== null) {
      // Skip if this is a prevention rule (setting to 'none')
      const matchText = match[0].toLowerCase()
      if (matchText.includes(': none') || matchText.includes(':none')) {
        continue
      }

      violations.push({
        file: filePath,
        line: content.substring(0, match.index).split('\n').length,
        match: match[0],
        pattern: pattern.source,
      })
    }
  })

  return violations
}

/**
 * Remove prohibited text effects from a file
 */
function removeTextEffectsFromFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8')
  let modified = false

  PROHIBITED_PATTERNS.forEach(pattern => {
    const originalContent = content
    content = content.replace(pattern, match => {
      // Replace with 'none' for text effects
      if (match.includes('text-shadow')) {
        return 'text-shadow: none'
      } else if (match.includes('filter')) {
        return 'filter: none'
      } else if (match.includes('text-stroke')) {
        return match.includes('-webkit-')
          ? '-webkit-text-stroke: none'
          : 'text-stroke: none'
      } else if (match.includes('text-outline')) {
        return match.includes('-webkit-')
          ? '-webkit-text-outline: none'
          : 'text-outline: none'
      }
      return 'none'
    })

    if (content !== originalContent) {
      modified = true
    }
  })

  if (modified) {
    fs.writeFileSync(filePath, content, 'utf8')
    return true
  }

  return false
}

/**
 * Main execution function
 */
async function main() {
  console.log('🔍 Scanning for prohibited text effects...\n')

  // Get all files to scan
  const allFiles = []
  SCAN_DIRECTORIES.forEach(dir => {
    getAllFiles(dir, allFiles)
  })

  console.log(`📁 Scanning ${allFiles.length} files...\n`)

  // Scan all files
  const allViolations = []
  allFiles.forEach(file => {
    const violations = scanFile(file)
    allViolations.push(...violations)
  })

  if (allViolations.length === 0) {
    console.log('✅ No prohibited text effects found!')
    console.log('All files comply with Toastmasters brand guidelines.\n')
    return
  }

  console.log(`❌ Found ${allViolations.length} prohibited text effects:\n`)

  // Group violations by file
  const violationsByFile = {}
  allViolations.forEach(violation => {
    if (!violationsByFile[violation.file]) {
      violationsByFile[violation.file] = []
    }
    violationsByFile[violation.file].push(violation)
  })

  // Display violations
  Object.keys(violationsByFile).forEach(file => {
    const relativePath = path.relative(process.cwd(), file)
    console.log(`📄 ${relativePath}:`)

    violationsByFile[file].forEach(violation => {
      console.log(`   Line ${violation.line}: ${violation.match}`)
    })
    console.log('')
  })

  // Ask for confirmation to remove
  const { createInterface } = await import('readline')
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  })

  rl.question(
    'Do you want to remove these prohibited text effects? (y/N): ',
    answer => {
      if (answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes') {
        console.log('\n🔧 Removing prohibited text effects...\n')

        let filesModified = 0
        Object.keys(violationsByFile).forEach(file => {
          const modified = removeTextEffectsFromFile(file)
          if (modified) {
            filesModified++
            const relativePath = path.relative(process.cwd(), file)
            console.log(`✅ Fixed: ${relativePath}`)
          }
        })

        console.log(
          `\n🎉 Successfully removed prohibited text effects from ${filesModified} files!`
        )
        console.log(
          'All files now comply with Toastmasters brand guidelines.\n'
        )
      } else {
        console.log(
          '\n❌ No changes made. Prohibited text effects remain in the codebase.\n'
        )
      }

      rl.close()
    }
  )
}

// Run the script
main().catch(console.error)
