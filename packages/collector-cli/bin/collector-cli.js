#!/usr/bin/env node

/**
 * Collector CLI Entry Point
 *
 * This is the executable entry point for the collector-cli tool.
 * It loads the compiled TypeScript code and runs the CLI.
 *
 * Requirements: 1.1 - THE Collector_CLI SHALL be a standalone executable
 */

import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { existsSync } from 'fs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Try to load from dist (compiled) first, then fall back to tsx for development
const distPath = join(__dirname, '..', 'dist', 'index.js')
const srcPath = join(__dirname, '..', 'src', 'index.ts')

async function main() {
  if (existsSync(distPath)) {
    // Production: load compiled JavaScript
    const { run } = await import(distPath)
    await run()
  } else if (existsSync(srcPath)) {
    // Development: use tsx to run TypeScript directly
    console.error('Error: Please build the project first with "npm run build"')
    console.error('Or use "npm run dev" for development mode.')
    process.exit(2)
  } else {
    console.error('Error: Could not find collector-cli source files.')
    process.exit(2)
  }
}

main().catch(error => {
  console.error('Fatal error:', error.message)
  process.exit(2)
})
