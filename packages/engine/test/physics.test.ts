/**
 * Physics calibration checks, ported from legacy/tests/physics (h.js, n2.js, run.js, sp.js) with
 * the same thresholds as legacy/tests/physics/run-all.js. These guard the feel of the game; the
 * golden test guards exact parity. If you change physics on purpose, update thresholds here.
 *
 * v118 values for reference: 28/28 holed; 523 shots, 16 holed; share >= 1.5: 0.45;
 * spin/shape save 0.113 strokes on average, > 0.1 on 7 of 40 holes.
 */
import { describe, expect, it } from 'vitest';
import {
  analyzeSync,
  CLUBS,
  evChoice,
  geom,
  landFrom,
  makeHole,
  mulberry32,
  NEU,
  outcomeAt,
  YD,
  Z0,
  type Selection,
} from '../src/index.js';

const day = (y: number, m: number, d: number) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

describe('physics calibration', () => {
  it('the best shot holes out on every daily hole (h.js)', () => {
    let holed = 0;
    let n = 0;
    for (let d = 1; d <= 28; d++) {
      const H = makeHole(day(2026, 3, d));
      const r = analyzeSync(H, { club: 2, spin: 1, shape: 2 }, { x: H.pin.x, z: H.pin.z });
      n++;
      if (r.hz.best.holed > 0.5) holed++;
    }
    console.log(`best shot holes out on ${holed} of ${n} holes`);
    expect(holed).toBe(n);
  });

  it('some plain shots drop, none absurd (n2.js)', () => {
    let n = 0;
    let holed = 0;
    const r = mulberry32(3);
    for (let d = 1; d <= 28; d++) {
      const H = makeHole(day(2026, 5, d));
      for (let k = 0; k < 20; k++) {
        const ang = r() * 6.283;
        const rr = r() * 7;
        const aim = { x: H.pin.x + Math.cos(ang) * rr, z: H.pin.z + Math.sin(ang) * rr };
        if (!H.inIsland(aim.x, aim.z)) continue;
        const need = geom(H, { club: 0, spin: 1, shape: NEU }, aim).dist * YD;
        let bi = 0;
        let bd = 1e9;
        CLUBS.forEach((c, i) => {
          const e = Math.abs(need / c.y - 0.95);
          if (e < bd) {
            bd = e;
            bi = i;
          }
        });
        const sel: Selection = { club: bi, spin: 1, shape: NEU, hand: 'R' };
        const o = outcomeAt(H, sel, landFrom(geom(H, sel, aim), aim, 0, 0), null);
        n++;
        if (o.s === 'holed') holed++;
      }
    }
    console.log(`shots ${n} holed ${holed}`);
    expect(holed).toBeGreaterThan(0);
    expect(holed).toBeLessThan(n);
  });

  it('typical-player loss is not extreme (run.js)', () => {
    const costs: number[] = [];
    for (let d = 1; d <= 24; d++) {
      const H = makeHole(day(2026, 2, d));
      const pro = analyzeSync(H, { club: 2, spin: 1, shape: 2 }, { x: H.pin.x, z: H.pin.z }).pro.ev2;
      const rnd = mulberry32(7);
      // aims within 0..9 m of the pin, a club that reaches comfortably, random spin/shape sometimes
      for (let k = 0; k < 14; k++) {
        const rr = Math.pow(rnd(), 1.3) * 9;
        const th = rnd() * 6.28;
        const aim = { x: H.pin.x + Math.cos(th) * rr, z: H.pin.z + Math.sin(th) * rr };
        if (!H.inIsland(aim.x, aim.z) && rnd() < 0.7) continue;
        let ok: Selection | null = null;
        for (let c = 0; c < CLUBS.length; c++) {
          const s: Selection = {
            club: c,
            spin: rnd() < 0.6 ? 1 : Math.floor(rnd() * 3),
            shape: rnd() < 0.5 ? 2 : Math.floor(rnd() * 5),
          };
          const gg = geom(H, s, aim);
          if (gg.swing >= 0.72 && gg.swing <= 1.02) {
            ok = s;
            break;
          }
        }
        if (!ok) continue;
        costs.push(Math.max(0, evChoice(H, ok, aim, Z0) - pro));
      }
    }
    const share = costs.filter((c) => c >= 1.5).length / costs.length;
    console.log(`n ${costs.length} share cost>=1.5: ${share.toFixed(2)}`);
    expect(share).toBeLessThan(0.6);
  });

  it('spin and shape matter on at least a few holes (sp.js)', () => {
    const gains: number[] = [];
    let big = 0;
    for (let d = 0; d < 40; d++) {
      const ds = new Date(Date.UTC(2026, 2, 1) + d * 864e5 * 7).toISOString().slice(0, 10);
      const H = makeHole(ds);
      const sel: Selection = { club: 3, spin: 1, shape: NEU };
      const aim = { x: H.pin.x, z: H.pin.z };
      const all = analyzeSync(H, sel, aim).pro.ev2;
      const plainOnly = analyzeSync(H, sel, aim, { spins: [1], shapes: [NEU] }).pro.ev2;
      const gain = Math.max(0, plainOnly - all);
      gains.push(gain);
      if (gain > 0.1) big++;
    }
    const mean = gains.reduce((s, x) => s + x, 0) / gains.length;
    console.log(`avg strokes saved vs plain-only best ${mean.toFixed(3)}, > 0.1 on ${big} of ${gains.length} holes`);
    expect(big).toBeGreaterThanOrEqual(3);
  });
});
