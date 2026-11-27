/**
 * Experiment bench: which mechanic makes spin and shape matter?
 *
 * Runs on the real engine (outcomeAt / evOf) with a pluggable "how a decision becomes a landing spot"
 * model, and reports for each variant how many strokes the best shot saves by using spin/shape
 * compared with the best plain shot (standard spin, neutral shape).
 *
 * Usage (from packages/engine):
 *   node ../../node_modules/.pnpm/node_modules/vite-node/vite-node.mjs experiments/spin-shape.ts -- <variant> [holes]
 * Variants: baseline, disp1, disp05, fixed, fixedCarry, fixed3
 * This is exploration code, not part of the engine or its tests.
 */
import {
  CLUBS,
  CUPR,
  evOf,
  FT,
  geom,
  landFrom,
  makeHole,
  makeZ,
  NEU,
  outcomeAt,
  PRO_FLOOR,
  SHAPE,
  SPIN,
  STD_SPIN,
  YD,
  Z0,
  type Hole,
  type Outcome,
  type Point,
  type Samples,
  type Selection,
} from '../src/index.js';

void CUPR;

/** A decision: club/spin/shape plus a variant-specific aim parameter. */
interface Choice {
  sel: Selection;
  aim: Point;
  swing?: number;
}

interface Variant {
  name: string;
  /** Candidate decisions for the search (spins/shapes restricted for the plain-only run). */
  candidates(H: Hole, spins: number[], shapes: number[]): Choice[];
  /** Expected strokes of a decision. */
  ev(H: Hole, c: Choice, fine: boolean): number;
  /** The typical player's decision. */
  typical(H: Hole): Choice;
}

const ALL_SPINS = [0, 1, 2];
const ALL_SHAPES = [0, 1, 2, 3, 4];

/* ---------- free aim (current game) ---------- */

function freeAimCandidates(H: Hole, spins: number[], shapes: number[]): Choice[] {
  const out: Choice[] = [];
  const S = H.S;
  const nx = Math.floor(2 * S) + 1;
  for (let j = 0; j < nx; j++)
    for (let i = 0; i < nx; i++) {
      const x = -S + i;
      const z = -S + j;
      if (Math.hypot(x, z) > H.outline(Math.atan2(z, x)) - 0.5) continue;
      for (let k = 0; k < CLUBS.length; k++)
        for (const sp of spins)
          for (const sh of shapes) {
            const sel = { club: k, spin: sp, shape: sh };
            const g = geom(H, sel, { x, z });
            if (g.swing < 0.8 || g.swing > 1.0) continue;
            out.push({ sel, aim: { x, z } });
          }
    }
  return out;
}

function freeTypical(H: Hole): Choice {
  const pin = { x: H.pin.x, z: H.pin.z };
  const need = geom(H, { club: 0, spin: 1, shape: NEU }, pin).dist * YD;
  let bi = 0;
  let bd = 1e9;
  CLUBS.forEach((c, i) => {
    const d = Math.abs(need / c.y - 0.95);
    if (d < bd) {
      bd = d;
      bi = i;
    }
  });
  return { sel: { club: bi, spin: STD_SPIN, shape: NEU }, aim: pin };
}

function evSamples(H: Hole, c: Choice, Z: Samples, disp: number, fine: boolean): number {
  const g = geom(H, c.sel, c.aim);
  if (disp > 0) {
    // engine's dispersion formula with DISP = disp (the engine ships DISP = 0)
    const df = 1 + 1.5 * Math.max(0, g.swing - 0.95) + 3.5 * Math.max(0, 0.9 - g.swing);
    g.sa = disp * 0.028 * g.carry * df * SPIN[c.sel.spin]!.d;
    g.sl = disp * 0.024 * g.carry * df * Math.sqrt(SPIN[c.sel.spin]!.d);
  }
  let s = 0;
  for (let i = 0; i < Z.g1.length; i++)
    s += evOf(H, outcomeAt(H, c.sel, landFrom(g, c.aim, Z.g1[i]!, Z.g2[i]!), null, fine));
  return s / Z.g1.length;
}

const baseline: Variant = {
  name: 'baseline: free aim, no dispersion (v118)',
  candidates: freeAimCandidates,
  ev: (H, c, fine) => evSamples(H, c, Z0, 0, fine),
  typical: freeTypical,
};

function dispersion(disp: number, n: number): Variant {
  const Z = makeZ(n, 4242);
  return {
    name: `dispersion DISP=${disp}, ${n} samples, free aim`,
    candidates: freeAimCandidates,
    ev: (H, c, fine) => evSamples(H, c, Z, disp, fine),
    typical: freeTypical,
  };
}

/* ---------- Keven's idea: no spread at a 100% swing, more spread the further the swing is from 100% ----------
   spread scale = base + k * |swing - 1|. Over-swings up to maxSwing are allowed and really fly further. */

function swingDisp(k: number, base: number, maxSwing: number, n: number): Variant {
  const Z = makeZ(n, 4242);
  const ev = (H: Hole, c: Choice, fine: boolean) => {
    const g = geom(H, c.sel, c.aim);
    const club = CLUBS[c.sel.club]!;
    const need = g.dist * YD * g.wf;
    g.carry = Math.min(need, club.y * maxSwing) / YD;
    g.land = g.carry / g.wf;
    const scale = base + k * Math.abs(g.swing - 1);
    const d = SPIN[c.sel.spin]!.d;
    g.sa = scale * 0.028 * g.carry * d;
    g.sl = scale * 0.024 * g.carry * Math.sqrt(d);
    const Zs = scale > 0 ? Z : Z0;
    let s = 0;
    for (let i = 0; i < Zs.g1.length; i++)
      s += evOf(H, outcomeAt(H, c.sel, landFrom(g, c.aim, Zs.g1[i]!, Zs.g2[i]!), null, fine));
    return s / Zs.g1.length;
  };
  return {
    name: `swing-based spread: ${base} + ${k} x |swing - 1|, swings 70% to ${maxSwing * 100}%`,
    candidates(H, spins, shapes) {
      const out: Choice[] = [];
      const S = H.S;
      const nx = Math.floor(2 * S) + 1;
      for (let j = 0; j < nx; j++)
        for (let i = 0; i < nx; i++) {
          const x = -S + i;
          const z = -S + j;
          if (Math.hypot(x, z) > H.outline(Math.atan2(z, x)) - 0.5) continue;
          for (let kk = 0; kk < CLUBS.length; kk++)
            for (const sp of spins)
              for (const sh of shapes) {
                const sel = { club: kk, spin: sp, shape: sh };
                const g = geom(H, sel, { x, z });
                if (g.swing < 0.7 || g.swing > maxSwing) continue;
                out.push({ sel, aim: { x, z } });
              }
        }
      return out;
    },
    ev,
    typical: freeTypical,
  };
}

/* ---------- fixed club distances: aim picks a direction, the club and swing set the carry ---------- */

interface FixedOpts {
  swings: number[];
  /** Carry change per shape step (+ = draw flies longer) and per spin (low/std/high). */
  shapeCarry: number;
  spinCarry: [number, number, number];
}

function fixedAim(H: Hole, c: Choice, opts: FixedOpts, angle: number): Point {
  // direction from the tee, measured from the line to the pin
  const base = Math.atan2(H.pin.x - H.P.x, H.pin.z - H.P.z);
  const a = base + angle;
  const ux = Math.sin(a);
  const uz = Math.cos(a);
  const sw = SPIN[c.sel.spin]!.wh;
  const W = H.wind;
  const head = -(W.x * ux + W.z * uz) * W.mph;
  const wf = 1 + (head >= 0 ? 0.01 : 0.005) * head * sw;
  const shapeK = 1 - opts.shapeCarry * SHAPE[c.sel.shape]!.s; // draw (s<0) longer
  const carryYd = CLUBS[c.sel.club]!.y * (c.swing ?? 1) * shapeK * (1 + opts.spinCarry[c.sel.spin]!);
  const D = carryYd / YD / wf;
  return { x: H.P.x + ux * D, z: H.P.z + uz * D };
}

function fixedVariant(name: string, opts: FixedOpts): Variant {
  return {
    name,
    candidates(H, spins, shapes) {
      const out: Choice[] = [];
      const dPin = Math.hypot(H.pin.x - H.P.x, H.pin.z - H.P.z);
      const span = (H.S + 4) / dPin;
      const step = 0.4 / dPin; // about 0.4 m sideways at the green
      for (let k = 0; k < CLUBS.length; k++)
        for (const swing of opts.swings)
          for (const sp of spins)
            for (const sh of shapes) {
              const sel = { club: k, spin: sp, shape: sh };
              // skip clubs that cannot land anywhere near the green
              const probe = fixedAim(H, { sel, aim: H.pin, swing }, opts, 0);
              if (Math.hypot(probe.x, probe.z) > H.S + 6) continue;
              for (let a = -span; a <= span; a += step) {
                const aim = fixedAim(H, { sel, aim: H.pin, swing }, opts, a);
                if (Math.hypot(aim.x, aim.z) > H.S + 2) continue;
                out.push({ sel, aim, swing });
              }
            }
      return out;
    },
    ev: (H, c, fine) => evSamples(H, c, Z0, 0, fine),
    typical(H) {
      // full swing with the club whose wind-adjusted carry is nearest the pin, aimed straight at it
      const dPin = Math.hypot(H.pin.x - H.P.x, H.pin.z - H.P.z);
      let best: Choice | null = null;
      let bd = 1e9;
      for (let k = 0; k < CLUBS.length; k++) {
        const c: Choice = { sel: { club: k, spin: STD_SPIN, shape: NEU }, aim: H.pin, swing: 1 };
        const aim = fixedAim(H, c, opts, 0);
        const d = Math.abs(Math.hypot(aim.x - H.P.x, aim.z - H.P.z) - dPin);
        if (d < bd) {
          bd = d;
          best = { ...c, aim };
        }
      }
      return best!;
    },
  };
}

const variants: Record<string, Variant> = {
  baseline,
  disp1: dispersion(1, 8),
  disp05: dispersion(0.5, 8),
  swing5: swingDisp(5, 0, 1.1, 8),
  swing3: swingDisp(3, 0, 1.1, 8),
  swing5base: swingDisp(5, 0.25, 1.1, 8),
  fixed: fixedVariant('fixed carry: full swing only, spin/shape change roll only', {
    swings: [1],
    shapeCarry: 0,
    spinCarry: [0, 0, 0],
  }),
  fixedCarry: fixedVariant('fixed carry: full swing, shape ±3%/step and spin ±2% carry', {
    swings: [1],
    shapeCarry: 0.03,
    spinCarry: [0.02, 0, -0.02],
  }),
  fixed3: fixedVariant('fixed carry: full / 90% / 80% swing, spin/shape change roll only', {
    swings: [1, 0.9, 0.8],
    shapeCarry: 0,
    spinCarry: [0, 0, 0],
  }),
};

/* ---------- search ---------- */

function best(H: Hole, v: Variant, spins: number[], shapes: number[]) {
  const cands = v.candidates(H, spins, shapes).map((c) => ({ c, ev: v.ev(H, c, false) }));
  cands.sort((a, b) => a.ev - b.ev);
  let b: { c: Choice; ev: number } | null = null;
  for (const x of cands.slice(0, 40)) {
    const ev = v.ev(H, x.c, true);
    if (!b || ev < b.ev) b = { c: x.c, ev };
  }
  return b ? { ...b, ev2: Math.max(PRO_FLOOR, b.ev) } : null;
}

function describe(H: Hole, c: Choice, o: Outcome): string {
  const ft = o.s === 'holed' ? 0 : Math.hypot(o.x - H.pin.x, o.z - H.pin.z) * FT;
  return `${CLUBS[c.sel.club]!.n}${c.swing && c.swing < 1 ? ' ' + c.swing * 100 + '%' : ''} ${SPIN[c.sel.spin]!.n} ${SHAPE[c.sel.shape]!.n} -> ${o.s} ${ft.toFixed(0)}ft`;
}

const args = process.argv.slice(2).filter((a) => a !== '--');
const key = args[0] ?? 'baseline';
const nHoles = +(args[1] ?? 40);
const v = variants[key];
if (!v) throw new Error('unknown variant ' + key + '; one of ' + Object.keys(variants).join(', '));

const rows: { gain: number; nonstd: boolean; typCost: number; bestHoled: boolean }[] = [];
const t0 = Date.now();
for (let d = 0; d < nHoles; d++) {
  const ds = new Date(Date.UTC(2026, 2, 1) + d * 864e5 * 7).toISOString().slice(0, 10);
  const H = makeHole(ds);
  const full = best(H, v, ALL_SPINS, ALL_SHAPES);
  const plain = best(H, v, [STD_SPIN], [NEU]);
  if (!full || !plain) {
    console.log(ds, 'no candidates');
    continue;
  }
  const ty = v.typical(H);
  const typCost = Math.max(0, v.ev(H, ty, true) - full.ev2);
  const gain = Math.max(0, plain.ev2 - full.ev2);
  const nonstd = full.c.sel.spin !== STD_SPIN || full.c.sel.shape !== NEU;
  const bo = outcomeAt(H, full.c.sel, landFrom(geom(H, full.c.sel, full.c.aim), full.c.aim, 0, 0), null, true);
  rows.push({ gain, nonstd, typCost, bestHoled: bo.s === 'holed' });
  if (process.env.VERBOSE)
    console.log(
      ds,
      H.type,
      H.pinYd + 'yd',
      'gain',
      gain.toFixed(2),
      'typ',
      typCost.toFixed(2),
      '| best',
      describe(H, full.c, bo),
    );
}
const n = rows.length;
const mean = (f: (r: (typeof rows)[number]) => number) => rows.reduce((s, r) => s + f(r), 0) / n;
const gains = rows.map((r) => r.gain).sort((a, b) => a - b);
console.log(
  JSON.stringify({
    variant: key,
    name: v.name,
    holes: n,
    meanGain: +mean((r) => r.gain).toFixed(3),
    medianGain: +gains[Math.floor(n / 2)]!.toFixed(3),
    holesGainOver01: rows.filter((r) => r.gain > 0.1).length,
    holesGainOver025: rows.filter((r) => r.gain > 0.25).length,
    bestUsesSpinOrShape: rows.filter((r) => r.nonstd).length,
    typicalMeanCost: +mean((r) => r.typCost).toFixed(2),
    typicalShareOver15: +(rows.filter((r) => r.typCost >= 1.5).length / n).toFixed(2),
    bestHolesOut: rows.filter((r) => r.bestHoled).length,
    seconds: Math.round((Date.now() - t0) / 1000),
  }),
);
