const {
  scorePoi,
  computeTargetPriceLevel,
  buildDayStops,
} = require('../src/services/recommendationEngine');

describe('computeTargetPriceLevel', () => {
  test('low budget maps to price level 0', () => {
    expect(computeTargetPriceLevel(100, 4)).toBe(0); // 25/day
  });
  test('high budget maps to price level 4', () => {
    expect(computeTargetPriceLevel(2000, 4)).toBe(4); // 500/day
  });
  test('defaults to mid-range when no budget given', () => {
    expect(computeTargetPriceLevel(null, 4)).toBe(2);
  });
});

describe('scorePoi', () => {
  const baseCtx = {
    preferenceWeights: { museums: 10, food: 5 },
    targetPriceLevel: 2,
    categoryCounts: {},
  };

  test('rewards a matching interest tag at max weight', () => {
    const { score, interestMatch } = scorePoi(
      { category: 'museums', rating: 5, price_level: 2 },
      baseCtx
    );
    expect(interestMatch).toBe(1);
    expect(score).toBeGreaterThan(0.7);
  });

  test('gives zero interest_match for an unselected category', () => {
    const { interestMatch } = scorePoi(
      { category: 'nightlife', rating: 5, price_level: 2 },
      baseCtx
    );
    expect(interestMatch).toBe(0);
  });

  test('redundancy penalty reduces score for repeated categories', () => {
    const fresh = scorePoi(
      { category: 'museums', rating: 4, price_level: 2 },
      { ...baseCtx, categoryCounts: {} }
    );
    const repeated = scorePoi(
      { category: 'museums', rating: 4, price_level: 2 },
      { ...baseCtx, categoryCounts: { museums: 3 } }
    );
    expect(repeated.score).toBeLessThan(fresh.score);
  });

  test('budget_fit is highest when price_level matches target exactly', () => {
    const exact = scorePoi({ category: 'food', rating: 3, price_level: 2 }, baseCtx);
    const off = scorePoi({ category: 'food', rating: 3, price_level: 4 }, baseCtx);
    expect(exact.budgetFit).toBeGreaterThan(off.budgetFit);
  });
});

describe('buildDayStops (distance-aware ordering + 9h budget cap)', () => {
  const anchor = { lat: 48.8566, lng: 2.3522 };

  test('orders stops nearest-neighbour style from the anchor', () => {
    const stops = [
      { external_place_id: 'a', lat: 48.9, lng: 2.4, avg_visit_minutes: 60, score: 0.5 },
      { external_place_id: 'b', lat: 48.86, lng: 2.355, avg_visit_minutes: 60, score: 0.6 },
      { external_place_id: 'c', lat: 49.5, lng: 3.0, avg_visit_minutes: 60, score: 0.4 },
    ];
    const ordered = buildDayStops(anchor, stops, 9 * 60);
    expect(ordered[0].external_place_id).toBe('b'); // closest to anchor first
  });

  test('drops lowest-scoring stop when the daily time budget is exceeded', () => {
    const stops = [
      { external_place_id: 'a', lat: 48.86, lng: 2.355, avg_visit_minutes: 200, score: 0.9 },
      { external_place_id: 'b', lat: 48.87, lng: 2.36, avg_visit_minutes: 200, score: 0.2 },
      { external_place_id: 'c', lat: 48.88, lng: 2.37, avg_visit_minutes: 200, score: 0.8 },
    ];
    // Tight budget forces at least one stop to be dropped.
    const ordered = buildDayStops(anchor, stops, 300);
    expect(ordered.length).toBeLessThan(stops.length);
    expect(ordered.find((s) => s.external_place_id === 'b')).toBeUndefined();
  });
});
