/**
 * Best-shot search. Every aim spot (1 m grid), club, spin and shape is evaluated once with a perfect
 * swing; the best is the lowest expected strokes among shots a pro would swing at 80% to 100% of
 * stock distance. Ported from v118; it is a generator so a browser can spread it over frames.
 */
import { CLUBS, PRO_FLOOR, SHAPE, SPIN } from './constants.js';
import { evChoice, hazOf, Z0, type HazardShare } from './ev.js';
import type { Hole } from './hole.js';
import { geom } from './shot.js';
import type { Point, Selection } from './types.js';

export interface Candidate {
  ev: number;
  sel: Selection;
  aim: Point;
}

export interface BestShot extends Candidate {
  /** ev floored at PRO_FLOOR (a perfect shot still needs a tap-in). */
  ev2: number;
}

export interface Analysis {
  best: BestShot;
  /** Same object as best (v118 name). */
  pro: BestShot;
  /** Expected strokes of the player's own shot. */
  mine: number;
  /** Best EV per aim cell (NaN where nothing reaches), for the heat map. */
  heat: { vals: Float32Array; nx: number; step: number; S: number; min: number };
  hz: { you: HazardShare; best: HazardShare };
}

export interface AnalyzeOptions {
  /** Spin indexes to search (default all). */
  spins?: readonly number[];
  /** Shape indexes to search (default all). */
  shapes?: readonly number[];
}

const ALL_SPINS = SPIN.map((_, i) => i);
const ALL_SHAPES = SHAPE.map((_, i) => i);

/**
 * Yields progress (cells done) every 6 cells; the return value is the Analysis.
 * `sel` and `aim` are the player's shot, priced against the best.
 */
export function* analyze(
  hole: Hole,
  sel: Selection,
  aim: Point,
  opts: AnalyzeOptions = {},
): Generator<number, Analysis, void> {
  const spins = opts.spins ?? ALL_SPINS;
  const shapes = opts.shapes ?? ALL_SHAPES;
  const step = 1.0;
  const S = hole.S;
  const nx = Math.floor((2 * S) / step) + 1;
  const vals = new Float32Array(nx * nx).fill(NaN);
  let best: Candidate | null = null;
  let done = 0;
  const cand: Candidate[] = [];
  for (let j = 0; j < nx; j++)
    for (let i = 0; i < nx; i++) {
      const x = -S + i * step;
      const z = -S + j * step;
      const ro = hole.outline(Math.atan2(z, x));
      if (Math.hypot(x, z) > ro - 0.5) continue;
      const A = { x, z };
      let bp = 9;
      for (let k = 0; k < CLUBS.length; k++)
        for (const sp of spins)
          for (const sh of shapes) {
            const s0: Selection = { club: k, spin: sp, shape: sh, hand: sel.hand };
            const g = geom(hole, s0, A);
            if (g.swing < 0.8 || g.swing > 1.0) continue;
            const ev = evChoice(hole, s0, A, Z0);
            if (ev < bp) bp = ev;
            cand.push({ ev, sel: s0, aim: A });
            if (cand.length > 150) {
              cand.sort((a, b) => a.ev - b.ev);
              cand.length = 40;
            }
          }
      if (bp < 9) vals[j * nx + i] = bp;
      if (++done % 6 === 0) yield done;
    }
  cand.sort((a, b) => a.ev - b.ev);
  cand.length = Math.min(cand.length, 40);
  // re-check the shortlist at the animation's fine roll step so the result matches what is shown
  for (const c of cand) {
    c.ev = evChoice(hole, c.sel, c.aim, Z0, true);
    if (!best || c.ev < best.ev) best = c;
  }
  if (!best) best = { ev: evChoice(hole, sel, aim, Z0, true), sel, aim };
  const b: BestShot = Object.assign(best, { ev2: Math.max(PRO_FLOOR, best.ev) });
  const mine = evChoice(hole, sel, aim, Z0, true);
  const hz = { you: hazOf(hole, sel, aim, Z0, true), best: hazOf(hole, b.sel, b.aim, Z0, true) };
  let mn = 1e9;
  for (const v of vals) if (v === v && v < mn) mn = v;
  return { best: b, pro: b, mine, heat: { vals, nx, step, S, min: mn }, hz };
}

/** Runs analyze to completion synchronously. */
export function analyzeSync(hole: Hole, sel: Selection, aim: Point, opts?: AnalyzeOptions): Analysis {
  const it = analyze(hole, sel, aim, opts);
  let r = it.next();
  while (!r.done) r = it.next();
  return r.value;
}
