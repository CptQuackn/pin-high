# Data sources and what is invented

Honest ledger, as of v118. "Sourced" means a number was taken from a public source; the sources are secondary or
averaged, not lab data for this game.

## Sourced (roughly)
- Club launch angle, landing angle, peak height (4i to PW): TrackMan PGA Tour averages (TrackMan support attachment, undated).
- Carries: Golf Monthly 2024 (TrackMan carries), ProYardages (wedge carries 110/92/74, secondary), MyGolfSpy and Shot Scope (carry by handicap).
- Tour roll after landing (standard spin): ProYardages carry vs total gives about 27 ft for 7i, 18 ft for PW, 15 ft for SW (surface unknown). LW ~3-4 yd per the same page.
- Wind: NOAA city averages 6.0 to 12.3 mph, median 9.0 (currentresults.com from NOAA NCDC Comparative Climatic Data).
  Masters 1980-2019 study (PMC10589173): round-mean wind 5.3 to 14.8 mph, +0.089 strokes per mph (rounds 1-2), +0.071 (rounds 3-4).
- Headwind +1% / tailwind -0.5% per mph: a Golf Monthly rule of thumb.
- Draw vs fade direction (draw flatter, more roll): TrackMan driver sample (fade 42.9 deg / 3,768 rpm, draw 28.8 deg / 2,643 rpm, draw ~20 yd more roll) and MyGolfSpy at 100 mph club speed (draw carry 224 / total 258, fade 222 / 249). Driver only.

## Estimated or invented (no source found)
- GW, SW, LW launch/landing/height values (marked `est:true` in `CLUBS`).
- 4i to 6i, 8i, 9i and GW standard-spin roll (interpolated or extrapolated from the sourced points).
- All high-spin rollback amounts and the low-spin multiplier.
- Crosswind drift (0.35% of distance per mph).
- Draw/fade size: curve (4.5% of distance per step), bow (0.75 of the curve, max 14 m), roll +/-12% per step, apex +/-8%, landing angle +/-6% per step.
- Cup capture rule (about 4 mph at the centre) and the friction/slope integration constants.
- Wind distribution `5+15*r^1.5`.
- Score curve shape and tier thresholds.
- `rel`/`back` per club are hand-tuned fits to the roll targets above.

## Not found
- Published roll-out by landing angle and spin, spin-rate-to-rollback relationships, iron draw/fade curve amounts, any tour-wide per-shot average wind.
