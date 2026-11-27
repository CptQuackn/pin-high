/**
 * Scoring: strokes lost against the best shot, scaled by what a simulated typical player loses.
 * Moved out of the v118 UI (src/js/60-result-scoring.js) so a server can score with the same code.
 */
import { analyze, type Analysis, type AnalyzeOptions } from './analyze.js';
import { CLUBS, NEU, STD_SPIN, YD } from './constants.js';
import { evChoice, hazOf, Z0, type HazardShare } from './ev.js';
import type { Hole } from './hole.js';
import { clamp, lerp } from './math.js';
import { geom } from './shot.js';
import type { Hand, Point, Selection } from './types.js';

/** Fixed curve for saves made before the typical-player figure existed: [cost, points]. */
export const SCORE_PTS: readonly (readonly [number, number])[] = [
  [0, 1000],
  [0.03, 975],
  [0.15, 880],
  [0.4, 740],
  [0.8, 590],
  [1.3, 430],
  [2, 250],
  [2.6, 100],
  [3.5, 50],
];

/**
 * Hole score, 60 to 1000. 1000 is the best shot, about 500 is what the typical player gets.
 * `avg` (the typical player's cost) is floored at 0.25 strokes so an easy hole doesn't turn small
 * misses into zeros. Without `avg` the legacy fixed curve is used.
 */
export function totalScore(cost: number, avg?: number | null): number {
  if (avg != null) {
    if (cost <= 0) return 1000;
    const A = Math.max(avg, 0.25);
    return Math.round(clamp(1000 * (1 - 0.5 * Math.pow(cost / A, 0.8)), 60, 1000));
  }
  if (cost <= 0) return 1000;
  for (let i = 1; i < SCORE_PTS.length; i++) {
    const a = SCORE_PTS[i - 1]!;
    const b = SCORE_PTS[i]!;
    if (cost <= b[0]) return Math.round(lerp(a[1], b[1], (cost - a[0]) / (b[0] - a[0])));
  }
  return 50;
}

export interface Tier {
  min: number;
  /** Display name. */
  n: string;
  /** Colour class 1 (bad) to 3 (good). */
  c: 1 | 2 | 3;
}

export const TIERS: readonly Tier[] = [
  { min: 985, n: 'Pro line', c: 3 },
  { min: 900, n: 'Dialed in', c: 3 },
  { min: 780, n: 'Sharp read', c: 3 },
  { min: 620, n: 'Solid', c: 2 },
  { min: 450, n: 'Decent', c: 2 },
  { min: 250, n: 'Costly', c: 1 },
  { min: 0, n: 'Wrong read', c: 1 },
];

export function tierOf(score: number): Tier {
  for (const t of TIERS) if (score >= t.min) return t;
  return TIERS[TIERS.length - 1]!;
}

/** The next tier above a score, or null at the top. */
export function nextTier(score: number): Tier | null {
  let nx: Tier | null = null;
  for (const t of TIERS) if (t.min > score) nx = t;
  return nx;
}

/** The typical player: the club that needs a ~95% swing, standard spin, no shape, aimed at the pin. */
export function typicalShot(hole: Hole, hand: Hand = 'R'): { sel: Selection; aim: Point } {
  const pin = { x: hole.pin.x, z: hole.pin.z };
  const need = geom(hole, { club: 0, spin: STD_SPIN, shape: NEU }, pin).dist * YD;
  let bi = 0;
  let bd = 1e9;
  CLUBS.forEach((c, i) => {
    const d = Math.abs(need / c.y - 0.95);
    if (d < bd) {
      bd = d;
      bi = i;
    }
  });
  return { sel: { club: bi, spin: STD_SPIN, shape: NEU, hand }, aim: pin };
}

export interface ShotScore {
  analysis: Analysis;
  /** Strokes lost against the best shot (>= 0). */
  cost: number;
  /** Strokes the typical player loses (>= 0). */
  avgCost: number;
  /** Hole score, 60 to 1000. */
  total: number;
  tier: Tier;
  typical: { sel: Selection; aim: Point; hz: HazardShare };
}

/** Scores a finished analysis exactly as the v118 result card did (costs rounded to 0.01 first). */
export function scoreFromAnalysis(hole: Hole, sel: Selection, res: Analysis): Omit<ShotScore, 'analysis'> {
  const ty = typicalShot(hole, sel.hand ?? 'R');
  const avgCost = Math.max(0, evChoice(hole, ty.sel, ty.aim, Z0) - res.pro.ev2);
  const tyHz = hazOf(hole, ty.sel, ty.aim, Z0);
  const cost = Math.max(0, res.mine - res.pro.ev2);
  const total = totalScore(+cost.toFixed(2), +avgCost.toFixed(2));
  return { cost, avgCost, total, tier: tierOf(total), typical: { ...ty, hz: tyHz } };
}

/** Analyzes and scores one shot synchronously (slow: about half a second per hole in Node). */
export function scoreShot(hole: Hole, sel: Selection, aim: Point, opts?: AnalyzeOptions): ShotScore {
  const it = analyze(hole, sel, aim, opts);
  let r = it.next();
  while (!r.done) r = it.next();
  return { analysis: r.value, ...scoreFromAnalysis(hole, sel, r.value) };
}
