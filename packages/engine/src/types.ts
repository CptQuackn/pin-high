export type Hand = 'R' | 'L';

/** A player's decision: indexes into CLUBS, SPIN and SHAPE, plus handedness (default right). */
export interface Selection {
  club: number;
  spin: number;
  shape: number;
  hand?: Hand;
}

export interface Point {
  x: number;
  z: number;
}

/** Where a shot finished. `near` is the closest pass of the cup that did not drop. */
export type Outcome =
  | { s: 'holed'; x: number; z: number }
  | { s: 'water'; x: number; z: number }
  | { s: 'bunker'; x: number; z: number }
  | { s: 'green'; x: number; z: number; near: { d: number; v: number } | null };

export type OutcomeKind = Outcome['s'];
