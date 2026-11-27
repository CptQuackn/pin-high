/** Expected strokes after the shot: putting model, penalties, and averaging over dispersion samples. */
import { CW, DANGER, FT, PUTT, WATER_EV } from './constants.js';
import type { Hole } from './hole.js';
import { clamp, gauss, lerp, mulberry32 } from './math.js';
import { geom, landFrom, outcomeAt } from './shot.js';
import type { Outcome, Point, Selection } from './types.js';

/** Dispersion samples: pairs of standard normals along / across the line. */
export interface Samples {
  g1: number[];
  g2: number[];
}

/** One sample with no spread: the deterministic shot. */
export const Z0: Samples = { g1: [0], g2: [0] };

export function makeZ(n: number, seed: number): Samples {
  const r = mulberry32(seed);
  const a: number[] = [];
  const b: number[] = [];
  for (let i = 0; i < n; i++) {
    a.push(gauss(r));
    b.push(gauss(r));
  }
  return { g1: a, g2: b };
}

/** Expected putts from (x, z), dm metres / dft feet from the pin, with slope and danger terms. */
export function puttEV(hole: Hole, x: number, z: number, dm: number, dft: number): number {
  let e = PUTT[PUTT.length - 1]![1];
  for (let i = 1; i < PUTT.length; i++) {
    if (dft <= PUTT[i]![0]) {
      const a = PUTT[i - 1]!;
      const b = PUTT[i]!;
      e = lerp(a[1], b[1], (dft - a[0]) / (b[0] - a[0]));
      break;
    }
  }
  e += 0.03 + 0.0025 * Math.min(dft, 60);
  if (dm > 0.3) {
    const pin = hole.pin;
    const lx = (pin.x - x) / dm;
    const lz = (pin.z - z) / dm;
    const g = hole.grad((x + pin.x) / 2, (z + pin.z) / 2);
    const along = g[0] * lx + g[1] * lz;
    const cross = Math.abs(g[0] * lz - g[1] * lx);
    let adj = (along > 0 ? -1.5 * along : -6 * along) + 4.5 * cross;
    adj = clamp(adj, -0.12, 0.4) * Math.min(1, dft / 8);
    e += adj;
    /* danger around the hole (tuning, no published data): a putt that can run past the pin off the
       green or into the sand, and a pin on a slope where a short putt rolls back. */
    if (!DANGER) return e;
    const dd = Math.min(1, dft / 10);
    const pa = hole.grad(pin.x, pin.z);
    const aPin = pa[0] * lx + pa[1] * lz;
    const reach = (0.9 + 0.03 * dft) * (1 + 10 * Math.max(0, -aPin));
    let dE = 6;
    for (let t = 0.3; t <= 6; t += 0.3) {
      const px = pin.x + lx * t;
      const pz = pin.z + lz * t;
      if (!hole.inIsland(px, pz) || hole.inBunker(px, pz) || hole.edgeR(px, pz) < CW) {
        dE = t;
        break;
      }
    }
    e += dd * clamp(1 - dE / reach, 0, 1) * (0.5 + 14 * Math.max(0, -aPin)) * 0.22;
    const pn = hole.grad(pin.x - lx * 1.2, pin.z - lz * 1.2);
    const aNear = pn[0] * lx + pn[1] * lz;
    e += dd * clamp(10 * (aNear - 0.012), 0, 0.1);
  }
  return e;
}

/** Expected strokes to hole out from an outcome. */
export function evOf(hole: Hole, o: Outcome): number {
  if (o.s === 'holed') return 0;
  if (o.s === 'water') return WATER_EV;
  const dm = Math.hypot(o.x - hole.pin.x, o.z - hole.pin.z);
  const dft = dm * FT;
  if (o.s === 'bunker') return 2.45 + 0.006 * Math.min(dft, 80);
  return puttEV(hole, o.x, o.z, dm, dft);
}

/** Expected strokes after a decision, averaged over the dispersion samples Z. */
export function evChoice(hole: Hole, sel: Selection, aim: Point, Z: Samples, fine = false): number {
  const g = geom(hole, sel, aim);
  let s = 0;
  const n = Z.g1.length;
  for (let i = 0; i < n; i++) s += evOf(hole, outcomeAt(hole, sel, landFrom(g, aim, Z.g1[i]!, Z.g2[i]!), null, fine));
  return s / n;
}

export interface HazardShare {
  sand: number;
  water: number;
  holed: number;
  /** Average distance left (ft) for balls that stayed dry. */
  ft: number;
}

/** Share of samples that finish in sand / water / the cup, and the average leave. */
export function hazOf(hole: Hole, sel: Selection, aim: Point, Z: Samples, fine = false): HazardShare {
  const g = geom(hole, sel, aim);
  const n = Z.g1.length;
  let sand = 0;
  let water = 0;
  let holed = 0;
  let ft = 0;
  let m = 0;
  for (let i = 0; i < n; i++) {
    const o = outcomeAt(hole, sel, landFrom(g, aim, Z.g1[i]!, Z.g2[i]!), null, fine);
    if (o.s === 'water') {
      water++;
      continue;
    }
    if (o.s === 'bunker') sand++;
    if (o.s === 'holed') holed++;
    ft += Math.hypot(o.x - hole.pin.x, o.z - hole.pin.z) * FT;
    m++;
  }
  return { sand: sand / n, water: water / n, holed: holed / n, ft: m ? ft / m : 0 };
}
