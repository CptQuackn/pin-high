/**
 * Parity with prototype v118. test/golden/v118.json was captured from the legacy engine by
 * scripts/capture-golden.cjs; every number here must match exactly (same RNG calls, same float ops).
 * If a physics change is intentional, bump ENGINE_VERSION and add a new golden file rather than
 * overwriting this one.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
  CLUBS,
  evChoice,
  gauss,
  geom,
  hashStr,
  hazOf,
  landFrom,
  makeHole,
  makeZ,
  mulberry32,
  nextTier,
  outcomeAt,
  scoreShot,
  tierOf,
  totalScore,
  Z0,
  type Hand,
  type Point,
  type Selection,
} from '../src/index.js';

/* eslint-disable @typescript-eslint/no-explicit-any */
const golden: any = JSON.parse(readFileSync(fileURLToPath(new URL('./golden/v118.json', import.meta.url)), 'utf8'));
const plain = <T>(o: T): T => JSON.parse(JSON.stringify(o));

describe('v118 parity: RNG', () => {
  it('hashStr, mulberry32, gauss and makeZ match', () => {
    for (const [s, h] of golden.rngs.hash) expect(hashStr(s)).toBe(h);
    const r = mulberry32(12345);
    expect(golden.rngs.mulberry.map(() => r())).toEqual(golden.rngs.mulberry);
    const g = mulberry32(5);
    expect(golden.rngs.gauss.map(() => gauss(g))).toEqual(golden.rngs.gauss);
    expect(plain(makeZ(5, 99))).toEqual(golden.rngs.makeZ);
  });
});

describe('v118 parity: holes', () => {
  for (const gh of golden.holes) {
    it(`hole ${gh.key}`, () => {
      const H = makeHole(gh.key);
      expect({
        type: H.type,
        waterAround: H.waterAround,
        R: H.R,
        area: H.area,
        Rmax: H.Rmax,
        Rview: H.Rview,
        vcx: H.vcx,
        vcz: H.vcz,
        S: H.S,
        pin: plain(H.pin),
        P: plain(H.P),
        pinYd: H.pinYd,
        stimp: H.stimp,
        wind: plain(H.wind),
        af: H.af,
        hazards: H.hazards.length,
      }).toEqual(gh.scalars);
      expect(gh.outline.map(([th]: [number]) => [th, H.outline(th)])).toEqual(gh.outline);
      expect(gh.vOutline.map(([th]: [number]) => [th, H.vOutline(th)])).toEqual(gh.vOutline);
      const field = gh.field.map(({ x, z }: Point) => {
        const g = H.grad(x, z);
        return {
          x,
          z,
          h: H.h(x, z),
          hv: H.hv(x, z),
          gx: g[0],
          gz: g[1],
          inIsland: H.inIsland(x, z),
          edgeR: H.edgeR(x, z),
        };
      });
      expect(field).toEqual(gh.field);

      for (const s of gh.shots) {
        const sel: Selection = s.sel;
        const aim: Point = s.aim;
        const g = geom(H, sel, aim);
        expect(plain(g)).toEqual(s.geom);
        const L = landFrom(g, aim, 0, 0);
        expect(plain(L)).toEqual(s.landing);
        expect(plain(outcomeAt(H, sel, L, null))).toEqual(s.coarse);
        const rec: number[] = [];
        expect(plain(outcomeAt(H, sel, L, rec))).toEqual(s.fine);
        expect({ n: rec.length, sum: rec.reduce((a, b) => a + b, 0), last: rec.slice(-2) }).toEqual(s.rec);
        expect(evChoice(H, sel, aim, Z0)).toBe(s.evCoarse);
        expect(evChoice(H, sel, aim, Z0, true)).toBe(s.evFine);
        expect(plain(hazOf(H, sel, aim, Z0))).toEqual(s.hzCoarse);
      }
    });
  }
});

describe('v118 parity: best-shot search and scoring', () => {
  for (const ga of golden.analyses) {
    it(`analysis ${ga.key}${ga.plainOnly ? ' (plain only)' : ''}${ga.sel.hand === 'L' ? ' (left-handed)' : ''}`, () => {
      const H = makeHole(ga.key);
      const sel: Selection = { ...ga.sel, hand: ga.sel.hand as Hand };
      const opts = ga.plainOnly ? { spins: [1], shapes: [2] } : undefined;
      const sc = scoreShot(H, sel, ga.aim, opts);
      const res = sc.analysis;
      // v118 candidate selections carry no `hand`; the port copies the player's hand onto them
      const { hand: _h, ...bestSel } = res.best.sel;
      void _h;
      expect({ ev: res.best.ev, ev2: res.best.ev2, sel: bestSel, aim: plain(res.best.aim) }).toEqual(ga.best);
      expect(res.mine).toBe(ga.mine);
      expect(plain(res.hz)).toEqual(ga.hz);
      expect({
        nx: res.heat.nx,
        step: res.heat.step,
        S: res.heat.S,
        min: res.heat.min,
        vals: Array.from(res.heat.vals, (v) => (v === v ? v : null)),
      }).toEqual(ga.heat);
      expect({
        cost: sc.cost,
        avgCost: sc.avgCost,
        total: sc.total,
        tier: sc.tier.n,
        typical: { sel: sc.typical.sel, aim: plain(sc.typical.aim), hz: plain(sc.typical.hz) },
      }).toEqual(ga.score);
    });
  }
});

describe('v118 parity: score curve and tiers', () => {
  it('totalScore matches for every cost / typical-player pair', () => {
    for (const s of golden.scoring) expect(totalScore(s.cost, s.avg)).toBe(s.total);
  });
  it('tierOf and nextTier match', () => {
    for (const t of golden.tiers) {
      expect(tierOf(t.s).n).toBe(t.tier);
      expect(nextTier(t.s)?.min ?? null).toBe(t.next);
    }
  });
  it('has ten clubs', () => expect(CLUBS).toHaveLength(10));
});
