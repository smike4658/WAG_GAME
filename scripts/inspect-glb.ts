/**
 * Script to inspect GLB model structure
 * Run with: npx tsx scripts/inspect-glb.ts
 */

import * as fs from 'fs';
import * as path from 'path';

const modelsDir = path.join(__dirname, '../public/assets/models');

function listModels(dir: string, indent = 0): void {
  const items = fs.readdirSync(dir);

  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      console.log('  '.repeat(indent) + `📁 ${item}/`);
      listModels(fullPath, indent + 1);
    } else if (item.endsWith('.glb') || item.endsWith('.gltf')) {
      const size = (stat.size / 1024 / 1024).toFixed(2);
      console.log('  '.repeat(indent) + `🎮 ${item} (${size} MB)`);
    }
  }
}

console.log('\n=== GLB Models in project ===\n');
listModels(modelsDir);
console.log('\n');
