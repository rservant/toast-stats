#!/usr/bin/env node

/**
 * Script to fix malformed JSON files in club health data directory
 * This addresses the issue where JSON files have extra closing brackets/braces
 */

import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const DATA_DIR = path.join(__dirname, '..', 'backend', 'data', 'club_health')

/**
 * Fix common malformed JSON issues
 */
function fixMalformedJson(content) {
  // Remove any trailing whitespace and newlines
  let fixed = content.trim()

  // Remove extra closing brackets/braces at the end
  // This handles patterns like: ]}] or }] or ]] or }}
  fixed = fixed.replace(/\s*[\]}]\s*[\]}]\s*$/, '')

  // Remove trailing commas before closing brackets/braces
  fixed = fixed.replace(/,(\s*[\]}])/g, '$1')

  // Ensure proper array closing if it starts with [
  if (fixed.startsWith('[') && !fixed.endsWith(']')) {
    fixed = fixed + ']'
  }

  // Ensure proper object closing if it starts with {
  if (fixed.startsWith('{') && !fixed.endsWith('}')) {
    fixed = fixed + '}'
  }

  return fixed
}

async function fixAllJsonFiles() {
  try {
    console.log('🔧 Starting JSON file repair...')

    const files = await fs.readdir(DATA_DIR)
    const historyFiles = files.filter(f => f.endsWith('_history.json'))

    console.log(`📁 Found ${historyFiles.length} history files to check`)

    let fixedCount = 0
    let errorCount = 0
    let alreadyValidCount = 0

    for (const file of historyFiles) {
      const filePath = path.join(DATA_DIR, file)

      try {
        const content = await fs.readFile(filePath, 'utf-8')

        // Try to parse original content
        try {
          JSON.parse(content)
          // If it parses successfully, skip
          alreadyValidCount++
          continue
        } catch (parseError) {
          // Content is malformed, try to fix it
          console.log(`🔨 Fixing malformed JSON: ${file}`)
          console.log(`   Error: ${parseError.message}`)

          const fixedContent = fixMalformedJson(content)

          // Verify the fixed content is valid JSON
          let parsed
          try {
            parsed = JSON.parse(fixedContent)
          } catch (fixError) {
            console.error(`❌ Could not fix ${file}: ${fixError.message}`)
            console.log(`   Original length: ${content.length}`)
            console.log(`   Fixed length: ${fixedContent.length}`)
            console.log(
              `   Last 100 chars of original: ${JSON.stringify(content.slice(-100))}`
            )
            console.log(
              `   Last 100 chars of fixed: ${JSON.stringify(fixedContent.slice(-100))}`
            )
            errorCount++
            continue
          }

          // Write the fixed content back to file
          await fs.writeFile(filePath, JSON.stringify(parsed, null, 2), 'utf-8')

          fixedCount++
          console.log(`✅ Fixed: ${file}`)
        }
      } catch (error) {
        console.error(`❌ Error processing ${file}:`, error.message)
        errorCount++
      }
    }

    console.log('\n📊 Summary:')
    console.log(`✅ Files fixed: ${fixedCount}`)
    console.log(`✨ Files already valid: ${alreadyValidCount}`)
    console.log(`❌ Files with errors: ${errorCount}`)
    console.log(`📁 Total files processed: ${historyFiles.length}`)

    if (fixedCount > 0) {
      console.log(
        '\n🎉 JSON repair completed! The server should now load more clubs.'
      )
      console.log('💡 Restart the server to reload the fixed data.')
    } else if (alreadyValidCount === historyFiles.length) {
      console.log('\n✨ All JSON files are already valid!')
      console.log(
        '💡 The issue might be in the server-side JSON parsing logic.'
      )
    } else {
      console.log(
        '\n⚠️  Some files could not be fixed. Manual intervention may be required.'
      )
    }
  } catch (error) {
    console.error('💥 Failed to fix JSON files:', error)
    process.exit(1)
  }
}

// Run the script
fixAllJsonFiles()
