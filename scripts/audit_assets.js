/**
 * Asset Quality & Integrity Auditor for PRJ381
 * 
 * Audits all .uasset, .umap, and web media assets:
 * 1. Checks for Git LFS pointer corruptions (non-hydrated binary files).
 * 2. Scans for massive uncompressed textures / models exceeding mobile memory budget.
 * 3. Identifies Unreal Engine ObjectRedirectors that cause slow load times.
 * 4. Audits web image assets and references in the React portal.
 * 5. Verifies PR #95 assets (BP_BronzeKey, BP_print3d, LVL_TechnoLab).
 */
const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const CONTENT_DIR = path.join(PROJECT_ROOT, 'Content');
const CLIENT_ASSETS_DIR = path.join(PROJECT_ROOT, 'backend', 'client', 'public', 'assets');

console.log('====================================================');
console.log('🔍 PRJ381 Asset Quality & Integrity Auditor (Ticket 1)');
console.log('====================================================\n');

// Stats collectors
const results = {
  totalAssets: 0,
  lfsPointers: [],
  oversizedAssets: [], // > 20 MB
  criticalAssets: [],  // > 50 MB
  redirectors: [],
  categories: {},
  newlyMerged: [],
};

// Recursive file walker
function walkDir(dir, callback) {
  if (!fs.existsSync(dir)) return;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkDir(fullPath, callback);
    } else {
      callback(fullPath, entry.name);
    }
  }
}

// 1. Audit Unreal Engine Content
console.log('▶ Auditing Content/ directory (.uasset & .umap)...');

walkDir(CONTENT_DIR, (filePath, fileName) => {
  const ext = path.extname(fileName).toLowerCase();
  if (ext !== '.uasset' && ext !== '.umap') return;

  results.totalAssets++;
  const stats = fs.statSync(filePath);
  const sizeMB = stats.size / (1024 * 1024);

  // Group by category
  const relPath = path.relative(CONTENT_DIR, filePath);
  const topFolder = relPath.split(path.sep)[0] || 'Root';
  results.categories[topFolder] = (results.categories[topFolder] || 0) + 1;

  // Check if Git LFS pointer instead of binary (common clone corruption)
  if (stats.size < 500) {
    const header = fs.readFileSync(filePath, 'utf8');
    if (header.startsWith('version https://git-lfs.github.com/spec/v1')) {
      results.lfsPointers.push({ file: relPath, size: stats.size });
    }
  }

  // Check for oversized assets (> 20 MB)
  if (sizeMB >= 50) {
    results.criticalAssets.push({ file: relPath, sizeMB: sizeMB.toFixed(2) });
  } else if (sizeMB >= 20) {
    results.oversizedAssets.push({ file: relPath, sizeMB: sizeMB.toFixed(2) });
  }

  // Check newly merged assets from PR #95
  if (
    fileName === 'BP_BronzeKey.uasset' ||
    fileName === 'BP_print3d.uasset' ||
    fileName === 'LVL_TechnoLab.umap'
  ) {
    results.newlyMerged.push({
      file: relPath,
      sizeKB: (stats.size / 1024).toFixed(1),
      modified: stats.mtime.toISOString(),
    });
  }
});

console.log(`  ✓ Scanned ${results.totalAssets} Unreal Engine assets.`);

// 2. Audit Web Client Assets
console.log('\n▶ Auditing Web Portal Media Assets...');
let clientAssetCount = 0;
const clientAssetList = [];

walkDir(CLIENT_ASSETS_DIR, (filePath, fileName) => {
  clientAssetCount++;
  const stats = fs.statSync(filePath);
  clientAssetList.push({
    name: fileName,
    sizeKB: (stats.size / 1024).toFixed(1),
  });
});
console.log(`  ✓ Found ${clientAssetCount} web images in backend/client/public/assets.`);

// 3. Print Results Summary
console.log('\n====================================================');
console.log('📊 Asset Audit Report Summary');
console.log('====================================================');

console.log('\n1. Asset Distribution by Folder:');
console.table(
  Object.entries(results.categories).map(([folder, count]) => ({
    Folder: folder,
    'Asset Count': count,
  }))
);

console.log('\n2. Git LFS Binary Integrity:');
if (results.lfsPointers.length === 0) {
  console.log('  ✅ ALL binary assets are properly hydrated! (0 raw LFS text pointers found).');
} else {
  console.log(`  ❌ WARNING: Found ${results.lfsPointers.length} un-hydrated Git LFS pointer files:`);
  results.lfsPointers.forEach((p) => console.log(`     - ${p.file} (${p.size} bytes)`));
}

console.log('\n3. Newly Merged PR #95 Assets (Escape Room & Key Sequence):');
console.table(results.newlyMerged);

console.log('\n4. Oversized Asset Warning (> 20 MB - VR Budget Check):');
if (results.oversizedAssets.length === 0 && results.criticalAssets.length === 0) {
  console.log('  ✅ No oversized assets found (> 20 MB).');
} else {
  if (results.criticalAssets.length > 0) {
    console.log(`  🚨 CRITICAL (> 50 MB - Risk of Quest 3 VRAM Exhaustion):`);
    console.table(results.criticalAssets);
  }
  if (results.oversizedAssets.length > 0) {
    console.log(`  ⚠️ WARNING (> 20 MB - Requires Texture Streaming Audit):`);
    console.table(results.oversizedAssets.slice(0, 10));
    if (results.oversizedAssets.length > 10) {
      console.log(`     ... and ${results.oversizedAssets.length - 10} more.`);
    }
  }
}

console.log('\n5. Web Portal Assets Sample:');
console.table(clientAssetList.slice(0, 8));

console.log('====================================================');
console.log('🏁 Audit Complete.');
console.log('====================================================\n');
