const { results, PLATFORMS, SCENARIOS } = require('../../scripts/simulate_vr_memory');

describe('Ticket 5: VR Texture Streaming & Performance Memory Simulation', () => {
  test('Simulation outputs valid scenarios across all 3 target platforms', () => {
    expect(results.length).toBe(SCENARIOS.length * Object.keys(PLATFORMS).length);
  });

  test('Meta Quest 3: Scenario A (Single NPC) operates safely within memory budgets', () => {
    const q3ScenarioA = results.find(
      (r) => r.scenario === 'SCENARIO_A' && r.platform === 'QUEST_3'
    );
    expect(q3ScenarioA).toBeDefined();
    expect(q3ScenarioA.poolDeficitMB).toBe(0);
    expect(q3ScenarioA.oomRiskLevel).toBe('LOW');
    expect(q3ScenarioA.totalResidentMB).toBeLessThan(q3ScenarioA.maxWorkingSetMB);
  });

  test('Meta Quest 3: Scenario B (Quad NPC Hub) flags texture pool over-subscription', () => {
    const q3ScenarioB = results.find(
      (r) => r.scenario === 'SCENARIO_B' && r.platform === 'QUEST_3'
    );
    expect(q3ScenarioB).toBeDefined();
    expect(q3ScenarioB.poolDeficitMB).toBeGreaterThan(0);
    expect(q3ScenarioB.textureDemandMB).toBeGreaterThan(q3ScenarioB.poolBudgetMB);
  });

  test('Meta Quest 3: Scenario C (Worst-Case 8 NPCs) triggers CRITICAL OOM risk', () => {
    const q3ScenarioC = results.find(
      (r) => r.scenario === 'SCENARIO_C' && r.platform === 'QUEST_3'
    );
    expect(q3ScenarioC).toBeDefined();
    expect(q3ScenarioC.oomRiskLevel).toMatch(/CRITICAL/);
    expect(q3ScenarioC.totalResidentMB).toBeGreaterThan(q3ScenarioC.maxWorkingSetMB);
  });

  test('Android Mobile: Scenario C (Worst-Case 8 NPCs) exceeds pool budget by >= 1000 MB', () => {
    const mobileScenarioC = results.find(
      (r) => r.scenario === 'SCENARIO_C' && r.platform === 'ANDROID_MOBILE'
    );
    expect(mobileScenarioC).toBeDefined();
    expect(mobileScenarioC.poolDeficitMB).toBeGreaterThanOrEqual(1000);
    expect(mobileScenarioC.oomRiskLevel).toMatch(/CRITICAL/);
  });

  test('PC Desktop: Accommodates all scenarios within high VRAM and RAM budgets', () => {
    const pcResults = results.filter((r) => r.platform === 'PC_DESKTOP');
    for (const res of pcResults) {
      expect(res.poolDeficitMB).toBe(0);
      expect(res.oomRiskLevel).toBe('LOW');
      expect(res.totalResidentMB).toBeLessThan(res.maxWorkingSetMB);
    }
  });
});
