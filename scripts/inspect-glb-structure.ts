/**
 * Script to inspect GLB model structure and list all objects
 * Run with: npx tsx scripts/inspect-glb-structure.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Parse GLB binary to extract JSON chunk
function parseGLB(buffer: Buffer): { scenes: unknown[]; nodes: unknown[]; meshes: unknown[] } | null {
  // GLB header: magic (4) + version (4) + length (4)
  const magic = buffer.readUInt32LE(0);
  if (magic !== 0x46546C67) { // 'glTF' in little endian
    console.log('Not a valid GLB file');
    return null;
  }

  // First chunk (JSON)
  const chunkLength = buffer.readUInt32LE(12);
  const chunkType = buffer.readUInt32LE(16);

  if (chunkType !== 0x4E4F534A) { // 'JSON'
    console.log('First chunk is not JSON');
    return null;
  }

  const jsonChunk = buffer.slice(20, 20 + chunkLength).toString('utf8');
  return JSON.parse(jsonChunk);
}

function inspectGLB(filePath: string): void {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Inspecting: ${path.basename(filePath)}`);
  console.log('='.repeat(60));

  const buffer = fs.readFileSync(filePath);
  const gltf = parseGLB(buffer);

  if (!gltf) return;

  const nodes = gltf.nodes as Array<{ name?: string; mesh?: number; children?: number[] }>;
  const meshes = gltf.meshes as Array<{ name?: string }>;

  console.log(`\nTotal nodes: ${nodes.length}`);
  console.log(`Total meshes: ${meshes.length}`);

  console.log('\n--- Top-level objects (likely individual models) ---');

  // Find root nodes (nodes that are not children of other nodes)
  const childNodes = new Set<number>();
  nodes.forEach(node => {
    node.children?.forEach(c => childNodes.add(c));
  });

  // Print root nodes
  nodes.forEach((node, i) => {
    if (!childNodes.has(i)) {
      const name = node.name || `node_${i}`;
      const childCount = node.children?.length || 0;
      const hasMesh = node.mesh !== undefined;
      console.log(`  [${i}] "${name}" - ${hasMesh ? 'has mesh' : 'group'} (${childCount} children)`);
    }
  });

  console.log('\n--- All named objects ---');
  nodes.forEach((node, i) => {
    if (node.name) {
      const childCount = node.children?.length || 0;
      const hasMesh = node.mesh !== undefined;
      console.log(`  [${i}] "${node.name}" - ${hasMesh ? 'MESH' : 'GROUP'} (${childCount} children)`);
    }
  });
}

// Also log building sizes from the addBuildingModel extraction
console.log('\n\n=== Building Size Analysis ===');
console.log('Run the game and check console for actual building dimensions from AssetLoader');
console.log('The models in city_pack.glb should show their extracted width/depth/height');

// Inspect all GLB files in buildings folder
const buildingsDir = path.join(__dirname, '../public/assets/models/buildings');

if (fs.existsSync(buildingsDir)) {
  const files = fs.readdirSync(buildingsDir).filter(f => f.endsWith('.glb'));

  for (const file of files) {
    inspectGLB(path.join(buildingsDir, file));
  }
} else {
  console.log('Buildings directory not found');
}
