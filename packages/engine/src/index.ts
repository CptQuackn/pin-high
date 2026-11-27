/**
 * @pin-high/engine: pure game logic with no DOM, no clock and no global state.
 * Hole generation, shot physics, best-shot search and scoring.
 */
export * from './constants.js';
export * from './math.js';
export * from './types.js';
export * from './hole.js';
export * from './shot.js';
export * from './ev.js';
export * from './analyze.js';
export * from './score.js';

/**
 * Bump when any change alters hole generation, shot outcomes or scores, and store it with every
 * round and shot so a physics change never rescores past days. "118" = parity with prototype v118.
 */
export const ENGINE_VERSION = '1.0.0+v118';
