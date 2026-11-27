/**
 * Engine constants and the club / spin / shape tables.
 * Values are copied unchanged from the v118 prototype (legacy/src/js/00-engine.js).
 * See docs/SOURCES.md for which numbers are sourced and which are invented.
 */

/** Yards per metre. */
export const YD = 1.09361;
/** Feet per metre. */
export const FT = 3.28084;
/** Gravity, m/s². */
export const G = 9.81;
/** Rolling-sphere factor (5/7) used for slope acceleration. */
export const K = 5 / 7;
/** Slope gain applied to the green's gradient when rolling. */
export const SG = 1.6;
/** Friction multiplier for roll-out. */
export const FRM = 0.5;

/** Collar (dark rough) width in metres. */
export const CW = 1.5;
/** Extra friction in the collar. */
export const COLLAR = 2.5;
/** How much wider the pro assumes its own spread is (unused while DISP = 0). */
export const PRO_RISK = 1.3;
/**
 * Swing dispersion. 0 means no random spread: a shot lands exactly where the physics says.
 * Kept as a named constant because dispersion is a candidate fix for "spin and shape rarely matter".
 */
export const DISP = 0;
/** Whether putting EV adds the "danger around the hole" terms. */
export const DANGER = true;

/** Expected strokes for a ball that ends in the water (penalty and drop). */
export const WATER_EV = 3.6;
/** A tap-in is one putt, so even a perfect shot cannot score below this. */
export const PRO_FLOOR = 1.0;

/** Cup capture radius in metres (20% bigger than a real cup). */
export const CUPR = 0.408;
/** Bevel ring around the cup that funnels slow balls in. */
export const BEV = CUPR * 1.25;

export interface Club {
  /** Short name, e.g. "7i". */
  readonly n: string;
  /** Stock carry in yards. */
  readonly y: number;
  /** Roll-out speed after landing (m/s), hand-tuned. */
  readonly rel: number;
  /** Back-spin check (m/s), hand-tuned. */
  readonly back: number;
  /** Launch angle (deg). */
  readonly la: number;
  /** Landing angle (deg). */
  readonly ld: number;
  /** Peak height (yd). */
  readonly h: number;
  /** Spin (rpm). */
  readonly sp: number;
  /** True when la/ld/h/sp are estimates, not TrackMan averages. */
  readonly est?: boolean;
}

/**
 * Clubs 4i to LW. la/ld/h/sp for 4i to PW are PGA Tour averages from TrackMan;
 * GW, SW and LW continue the trend (est: true). rel/back are hand-tuned roll fits.
 */
export const CLUBS: readonly Club[] = [
  { n: '4i', y: 206, rel: 3.66, back: 0.23, la: 11.0, ld: 48, h: 28, sp: 4836 },
  { n: '5i', y: 195, rel: 3.43, back: 0.38, la: 12.1, ld: 49, h: 31, sp: 5361 },
  { n: '6i', y: 183, rel: 3.22, back: 0.63, la: 14.1, ld: 50, h: 30, sp: 6231 },
  { n: '7i', y: 172, rel: 3.01, back: 1.35, la: 16.3, ld: 50, h: 32, sp: 7097 },
  { n: '8i', y: 158, rel: 2.84, back: 2.1, la: 18.1, ld: 50, h: 31, sp: 7998 },
  { n: '9i', y: 142, rel: 2.65, back: 2.35, la: 20.4, ld: 51, h: 30, sp: 8647 },
  { n: 'PW', y: 128, rel: 2.46, back: 2.52, la: 24.2, ld: 52, h: 29, sp: 9304 },
  { n: 'GW', y: 110, rel: 2.35, back: 2.7, la: 27, ld: 53, h: 29, sp: 9800, est: true },
  { n: 'SW', y: 92, rel: 2.24, back: 2.84, la: 30, ld: 54, h: 29, sp: 10300, est: true },
  { n: 'LW', y: 74, rel: 1.92, back: 2.87, la: 33, ld: 55, h: 29, sp: 10800, est: true },
];

export interface Spin {
  readonly n: string;
  /** Roll multiplier. */
  readonly m: number;
  /** Back-spin bite multiplier. */
  readonly b: number;
  /** Dispersion multiplier. */
  readonly d: number;
  /** Crosswind drift multiplier. */
  readonly w: number;
  /** Head/tailwind multiplier. */
  readonly wh: number;
}

export const SPIN: readonly Spin[] = [
  { n: 'Low', m: 1.3, b: 0, d: 1.12, w: 0.9, wh: 0.75 },
  { n: 'Standard', m: 1, b: 0, d: 1, w: 1, wh: 1 },
  { n: 'High', m: 0.45, b: 1, d: 1.28, w: 1.15, wh: 1.3 },
];

export interface Shape {
  readonly n: string;
  /** How hard it curves; negative = draw side (for a right-hander). */
  readonly s: number;
}

/**
 * Without wind every shape finishes on the aim spot; shape only changes the flight path,
 * how much a crosswind moves it, and how much it releases (draws run out, fades stop).
 */
export const SHAPE: readonly Shape[] = [
  { n: 'Hard draw', s: -2 },
  { n: 'Draw', s: -1 },
  { n: 'Neutral', s: 0 },
  { n: 'Fade', s: 1 },
  { n: 'Hard fade', s: 2 },
];

/** Index of the neutral shape in SHAPE. */
export const NEU = 2;
/** Index of standard spin in SPIN. */
export const STD_SPIN = 1;

/** Expected putts by distance (ft). Approximate tour-style curve, not sourced. */
export const PUTT: readonly (readonly [number, number])[] = [
  [0, 1],
  [1, 1],
  [2, 1.01],
  [3, 1.04],
  [4, 1.13],
  [5, 1.23],
  [6, 1.34],
  [7, 1.42],
  [8, 1.5],
  [9, 1.56],
  [10, 1.61],
  [15, 1.78],
  [20, 1.87],
  [30, 1.98],
  [40, 2.06],
  [50, 2.14],
  [60, 2.21],
  [90, 2.35],
  [200, 2.6],
];
