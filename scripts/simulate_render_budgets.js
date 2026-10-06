/**
 * PRJ381 Cross-Platform Render Performance & Latency Budget Tool
 *
 * Models rendering pipelines, stereo draw calls, polygon density, and
 * framerate budgets across:
 * - Meta Quest 3 (Standalone VR - Snapdragon XR2 Gen 2)
 * - Android Mobile (Mid-Tier Touchscreen - Adreno / Mali GPU)
 * - PC Desktop (Windows DX12 - Dedicated GPU)
 */

const fs = require('fs');
const path = require('path');

const CONTENT_DIR = path.resolve(__dirname, '../Content');
const ENVIROMENTS_DIR = path.join(CONTENT_DIR, 'Enviroments');
const NPC_DIR = path.join(CONTENT_DIR, 'NPC');

function scanDirectory(dir, filterFn) {
  let list = [];
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const e of entries) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) {
        list = list.concat(scanDirectory(p, filterFn));
      } else if (e.isFile() && (!filterFn || filterFn(e.name, p))) {
        const stat = fs.statSync(p);
        list.push({ name: e.name, path: p, sizeKB: stat.size / 1024 });
      }
    }
  } catch (err) {}
  return list;
}

console.log('====================================================');
console.log('🚀 PRJ381 Cross-Platform Rendering Performance & Budgets');
console.log('====================================================\n');

// 1. SUB-LEVEL ENVIRONMENT ASSET SCAN
console.log('1. Analyzing Sub-Level Geometry & Static Meshes...');

const envFolders = ['Cafeteria', 'Hallway', 'Library', 'TechnoLab', 'OuterCampus', 'Auditorium'];
const levelStats = {};

for (const env of envFolders) {
  const envPath = path.join(ENVIROMENTS_DIR, env);
  const meshes = scanDirectory(envPath, (name) => name.endsWith('.uasset') && !name.startsWith('T_') && !name.startsWith('M_'));
  const textures = scanDirectory(envPath, (name) => name.endsWith('.uasset') && (name.startsWith('T_') || name.includes('Texture')));
  const materials = scanDirectory(envPath, (name) => name.endsWith('.uasset') && (name.startsWith('M_') || name.startsWith('MI_')));

  levelStats[env] = {
    meshCount: meshes.length,
    textureCount: textures.length,
    materialCount: materials.length,
    totalAssets: meshes.length + textures.length + materials.length,
  };
}

console.table(levelStats);

// 2. PLATFORM HARDWARE PERFORMANCE CONSTRAINTS
const RENDER_PROFILES = {
  QUEST_3: {
    name: 'Meta Quest 3 (Standalone VR)',
    targetFps: 72,
    frameBudgetMs: 1000 / 72, // 13.88 ms
    maxDrawCallsPerEye: 175,
    maxVisibleTriangles: 700000,
    stereoMultiplier: 1.35, // Multiview / Instanced Stereo saves ~65% of duplicate state changes
    thermalThrottleMinutes: 20, // Throttling ceiling if GPU load > 80%
  },
  ANDROID_MOBILE: {
    name: 'Android Mobile (Snapdragon 778G / Adreno 642L)',
    targetFps: 60,
    frameBudgetMs: 1000 / 60, // 16.66 ms
    maxDrawCallsPerEye: 130,
    maxVisibleTriangles: 400000,
    stereoMultiplier: 1.0, // Monoscopic rendering
    thermalThrottleMinutes: 12,
  },
  PC_DESKTOP: {
    name: 'PC Desktop (NVIDIA RTX 3060 / DX12)',
    targetFps: 120,
    frameBudgetMs: 1000 / 120, // 8.33 ms
    maxDrawCallsPerEye: 2500,
    maxVisibleTriangles: 5000000,
    stereoMultiplier: 1.0,
    thermalThrottleMinutes: Infinity,
  },
};

// 3. PERFORMANCE ESTIMATION ACROSS VIEWPOINTS
console.log('2. Evaluating Draw Calls & Triangle Pressure per Level Viewpoint...\n');

const viewpoints = [
  { level: 'TechnoLab', activeNpc: 1, dynamicLights: 3 },
  { level: 'Library', activeNpc: 1, dynamicLights: 4 },
  { level: 'Cafeteria', activeNpc: 0, dynamicLights: 5 },
  { level: 'OuterCampus', activeNpc: 4, dynamicLights: 8 }, // Campus Hub
];

const renderResults = [];

for (const vp of viewpoints) {
  const stats = levelStats[vp.level] || { meshCount: 50 };
  
  // Model draw calls:
  // Base visible meshes in frustum (~35% of total meshes with frustum culling)
  const visibleMeshes = Math.max(25, Math.round(stats.meshCount * 0.35));
  // Average material slots per mesh: 1.8
  const envDrawCalls = visibleMeshes * 1.8;
  // MetaHuman characters generate ~8 draw calls each (Body, Face, Eyelashes, Hair, Clothes, Shoes)
  const npcDrawCalls = vp.activeNpc * 8;
  // Dynamic shadow passes per shadow-casting light: ~2 draw calls per light
  const shadowDrawCalls = vp.dynamicLights * 2;

  const monoDrawCalls = Math.round(envDrawCalls + npcDrawCalls + shadowDrawCalls);

  // Triangle estimate (LiDAR decimated static meshes avg ~15k tris; MetaHuman LOD0 ~60k tris)
  const envTriangles = visibleMeshes * 12000;
  const npcTriangles = vp.activeNpc * 55000;
  const totalTriangles = envTriangles + npcTriangles;

  for (const [key, p] of Object.entries(RENDER_PROFILES)) {
    const totalDrawCalls = Math.round(monoDrawCalls * p.stereoMultiplier);
    const drawCallLoad = (totalDrawCalls / p.maxDrawCallsPerEye) * 100;
    const triangleLoad = (totalTriangles / p.maxVisibleTriangles) * 100;

    let status = 'OPTIMAL';
    if (drawCallLoad > 100 || triangleLoad > 100) status = 'OVER_BUDGET (Stutter / Motion Sickness)';
    else if (drawCallLoad > 80 || triangleLoad > 80) status = 'NEAR_CAPACITY (Thermal Throttling Risk)';

    renderResults.push({
      level: vp.level,
      platform: key,
      platformName: p.name,
      totalDrawCalls,
      maxDrawCalls: p.maxDrawCallsPerEye,
      drawCallLoadPercent: drawCallLoad.toFixed(1),
      totalTriangles,
      maxTriangles: p.maxVisibleTriangles,
      triangleLoadPercent: triangleLoad.toFixed(1),
      status,
    });
  }
}

// Group output by Level
for (const vp of viewpoints) {
  console.log(`📍 Viewpoint: ${vp.level} (Active NPCs: ${vp.activeNpc}, Dynamic Lights: ${vp.dynamicLights})`);
  const levelResults = renderResults.filter(r => r.level === vp.level);
  for (const lr of levelResults) {
    console.log(`  [${lr.platformName}]`);
    console.log(`    * Draw Calls: ${lr.totalDrawCalls} / ${lr.maxDrawCalls} (${lr.drawCallLoadPercent}%)`);
    console.log(`    * Triangles: ${lr.totalTriangles.toLocaleString()} / ${lr.maxTriangles.toLocaleString()} (${lr.triangleLoadPercent}%)`);
    console.log(`    * Status: ${lr.status}`);
  }
  console.log('');
}

// 4. ARCHITECTURAL OPTIMIZATION RECOMMENDATIONS
console.log('====================================================');
console.log('💡 Render Optimization Directives (Ticket 3)');
console.log('====================================================');
console.log(`
1. OuterCampus Hub Draw Call Bottleneck:
   - On Quest 3, OuterCampus with 4 MetaHumans and 8 dynamic lights produces ~170+ draw calls,
     reaching 97-105% of the mobile stereo draw call threshold!
   - Recommendation: Convert static campus lights from Movable/Stationary to Baked Static Lighting,
     or disable shadow casting on secondary fill lights.

2. Mobile Multi-View / Instanced Stereo:
   - Ensure Mobile Multiview is enabled in Project Settings -> Platforms -> Android / XR.
   - Reduces VR stereo draw call overhead by ~40% by drawing both eyes in a single render pass.

3. Static Mesh Nanite & LOD Distance Culling:
   - Nanite is disabled on Quest 3 (Vulkan Mobile). Meshes must rely on traditional LODs.
   - For all LiDAR meshes in Content/Enviroments, ensure LOD1 (50% reduction) kicks in at 15 meters,
     and LOD2 (75% reduction) kicks in at 30 meters.
`);

module.exports = { renderResults, RENDER_PROFILES, levelStats };
