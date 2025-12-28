#!/usr/bin/env node

import fs from 'fs';
import path from 'path';

function fixTsImports(dir) {
  const files = fs.readdirSync(dir, { withFileTypes: true });
  
  for (const file of files) {
    const fullPath = path.join(dir, file.name);
    
    if (file.isDirectory()) {
      fixTsImports(fullPath);
    } else if (file.name.endsWith('.ts')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      let modified = false;
      
      // Fix .ts extensions in imports
      const tsImportRegex = /from\s+['"]([^'"]+)\.ts['"]/g;
      const newContent = content.replace(tsImportRegex, (match, importPath) => {
        modified = true;
        return `from '${importPath}'`;
      });
      
      if (modified) {
        fs.writeFileSync(fullPath, newContent);
        console.log(`Fixed imports in: ${fullPath}`);
      }
    }
  }
}

console.log('Fixing .ts import extensions...');
fixTsImports('./src');
console.log('Done!');