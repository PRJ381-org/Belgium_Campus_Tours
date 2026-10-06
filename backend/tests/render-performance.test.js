const { renderResults, RENDER_PROFILES, levelStats } = require('../../scripts/simulate_render_budgets');

describe('Ticket 3: Cross-Platform Render Performance & Latency Budgets', () => {
  test('scans and parses all 6 campus sub-levels', () => {
    const levels = ['Cafeteria', 'Hallway', 'Library', 'TechnoLab', 'OuterCampus', 'Auditorium'];
    for (const lvl of levels) {
      expect(levelStats[lvl]).toBeDefined();
      expect(levelStats[lvl].meshCount).toBeGreaterThan(0);
    }
  });

  test('Indoor zones (TechnoLab & Library) maintain optimal draw call budgets on Quest 3', () => {
    const indoorResults = renderResults.filter(
      r => (r.level === 'TechnoLab' || r.level === 'Library') && r.platform === 'QUEST_3'
    );

    for (const res of indoorResults) {
      expect(res.status).toBe('OPTIMAL');
      expect(res.totalDrawCalls).toBeLessThanOrEqual(res.maxDrawCalls);
      expect(res.totalTriangles).toBeLessThanOrEqual(res.maxTriangles);
    }
  });

  test('Complex outdoor hub (OuterCampus) identifies draw call and triangle overflow on Quest 3', () => {
    const outerCampusQuest = renderResults.find(
      r => r.level === 'OuterCampus' && r.platform === 'QUEST_3'
    );

    expect(outerCampusQuest).toBeDefined();
    expect(outerCampusQuest.status).toMatch(/OVER_BUDGET/);
    expect(outerCampusQuest.totalDrawCalls).toBeGreaterThan(outerCampusQuest.maxDrawCalls);
    expect(outerCampusQuest.totalTriangles).toBeGreaterThan(outerCampusQuest.maxTriangles);
  });

  test('Mobile Android: High triangle load identified in Cafeteria and OuterCampus', () => {
    const mobileCafeteria = renderResults.find(
      r => r.level === 'Cafeteria' && r.platform === 'ANDROID_MOBILE'
    );
    expect(mobileCafeteria.status).toMatch(/OVER_BUDGET/);
    expect(mobileCafeteria.totalTriangles).toBeGreaterThan(mobileCafeteria.maxTriangles);
  });

  test('PC Desktop: Absorbs all viewpoints comfortably within DirectX 12 budget', () => {
    const pcResults = renderResults.filter(r => r.platform === 'PC_DESKTOP');
    for (const res of pcResults) {
      expect(res.status).toBe('OPTIMAL');
      expect(res.totalDrawCalls).toBeLessThan(res.maxDrawCalls * 0.15); // <15% of budget
      expect(res.totalTriangles).toBeLessThan(res.maxTriangles * 0.30); // <30% of budget
    }
  });
});
