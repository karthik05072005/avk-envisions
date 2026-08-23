import { describe, expect, it } from 'vitest';

import { resolvePricing } from './pricing-service';

/**
 * The published ladder for the paid test series: 199 for the first 50 seats,
 * 299 up to 100, 399 thereafter.
 */
const LADDER = {
  priceInPaise: 39900,
  tier1PriceInPaise: 19900,
  tier1Limit: 50,
  tier2PriceInPaise: 29900,
  tier2Limit: 100,
};

describe('resolvePricing', () => {
  it('sells at tier 1 while the first band has room', () => {
    const p = resolvePricing(LADDER, 0);
    expect(p.priceInPaise).toBe(19900);
    expect(p.activeTier).toBe(1);
    expect(p.seatsLeftInTier).toBe(50);
    expect(p.nextPriceInPaise).toBe(29900);
  });

  it('counts down the seats remaining in the live tier', () => {
    expect(resolvePricing(LADDER, 37).seatsLeftInTier).toBe(13);
    expect(resolvePricing(LADDER, 49).seatsLeftInTier).toBe(1);
  });

  it('steps up the moment a tier fills, not one sale later', () => {
    // The 50th buyer takes the last tier-1 seat; the 51st pays tier 2.
    expect(resolvePricing(LADDER, 49).priceInPaise).toBe(19900);
    expect(resolvePricing(LADDER, 50).priceInPaise).toBe(29900);
    expect(resolvePricing(LADDER, 50).activeTier).toBe(2);
    expect(resolvePricing(LADDER, 50).seatsLeftInTier).toBe(50);
  });

  it('falls back to the regular price once every tier is exhausted', () => {
    const p = resolvePricing(LADDER, 100);
    expect(p.priceInPaise).toBe(39900);
    expect(p.activeTier).toBeNull();
    expect(p.seatsLeftInTier).toBeNull();
    expect(p.nextPriceInPaise).toBeNull();
  });

  it('never drops back down if enrolment somehow exceeds the last limit', () => {
    expect(resolvePricing(LADDER, 5_000).priceInPaise).toBe(39900);
  });

  it('leaves a free series free, ladder or not', () => {
    const free = { ...LADDER, priceInPaise: 0 };
    const p = resolvePricing(free, 0);
    expect(p.priceInPaise).toBe(0);
    expect(p.activeTier).toBeNull();
  });

  it('ignores a half-configured ladder rather than guessing', () => {
    // A tier price with no limit cannot say when it expires, so it is not applied.
    const partial = { ...LADDER, tier1Limit: null };
    expect(resolvePricing(partial, 0).priceInPaise).toBe(29900);

    const noTiers = {
      priceInPaise: 39900,
      tier1PriceInPaise: null,
      tier1Limit: null,
      tier2PriceInPaise: null,
      tier2Limit: null,
    };
    expect(resolvePricing(noTiers, 0).priceInPaise).toBe(39900);
    expect(resolvePricing(noTiers, 0).activeTier).toBeNull();
  });

  it('names every rung, so a page can print the whole ladder', () => {
    // The published table shows 199 / 299 / 399 at once. Exposing only the live
    // tier meant an exhausted rung rendered as zero.
    const p = resolvePricing(LADDER, 60);
    expect(p.ladder.map((r) => r.priceInPaise)).toEqual([19900, 29900, 39900]);
    expect(p.ladder.map((r) => r.active)).toEqual([false, true, false]);
    expect(p.ladder[0]?.label).toBe('For the first 50 members');
    expect(p.ladder[2]?.label).toBe('Final price');
  });

  it('gives a free series no ladder at all', () => {
    expect(resolvePricing({ ...LADDER, priceInPaise: 0 }, 0).ladder).toEqual([]);
  });

  it('applies the PYQ ladder: 50, then 100, then 199', () => {
    const pyq = {
      priceInPaise: 19900,
      tier1PriceInPaise: 5000,
      tier1Limit: 50,
      tier2PriceInPaise: 10000,
      tier2Limit: 100,
    };
    expect(resolvePricing(pyq, 0).priceInPaise).toBe(5000);
    expect(resolvePricing(pyq, 50).priceInPaise).toBe(10000);
    expect(resolvePricing(pyq, 100).priceInPaise).toBe(19900);
  });
});
