# How it works

## Loop
Rotate the green -> read slope grid, green speed, wind -> choose club (4i to LW), spin (low/standard/high) and shape
(hard draw to hard fade) -> tap aim -> Shoot -> watch -> result card (score, tier, comparison with the typical player,
the best shot shown as a gold ring) -> share text (10 squares).

## Hole generator (`makeHole`)
Seeded by date. Builds an island outline from an archetype, a slope field (`DRAMA=.6`, slopes scaled .85), green speed
(stimp, roughly 9.5 to 12), wind, pin position (slope at the pin <= .032, edge distance >= 3.6) and pin distance:
`cu=r()*CLUBS.length; pinYd=round(CLUBS[ck].y*(.82+.13*frac))`, about 61 to 195 yd, median ~133. Wind is
`round(5+15*r^1.5)` mph: 5 to 20, mean about 11.

## Shot model (deterministic, `DISP=0`)
- `geom(sel, aim)`: distance, carry (capped by the club), landing offset from wind, curve from shape.
  Headwind adds 1% distance per mph, tailwind removes 0.5% per mph, crosswind drifts 0.35% of distance per mph
  (that last number is a placeholder).
- Flight (`flightParams`/`flightAt`): launch angle `la`, landing angle `ld` and peak height `h` per club, a two-piece
  Hermite height profile peaking at 62% of range. Spin changes height (.8/1/1.25); a draw flies lower, a fade higher
  (8% per step); softer swings fly lower. Shape bows the path sideways up to 14 m (0.75 x curve) and changes the landing
  angle 6% per step.
- Landing and roll (`outcomeAt`/`roll`): roll speed = `rel*spinMult*(1-.12*shape) - back*spinBite*(1+.12*shape)`,
  then a slope-dependent friction integration. High spin can roll back. Cup: radius .408 m with a bevel funnel; a ball
  drops if it is inside the cup radius and slower than ~4 mph at the centre, otherwise it lips over.
- Hazards are off; missing the island is "Off the island" (penalty).

## Scoring
`cost` = expected strokes of your shot minus the best shot's (`analyze` searches all clubs/spins/shapes/aims).
The score is relative to the typical player's cost on the same hole (default club nearest .95 swing, standard spin,
neutral shape, aimed at the pin): `1000*(1-.5*(cost/max(avg,.25))^.8)` clamped to 60..1000, 1000 if you match the best.
About 500 is the typical player. Tiers: 985 Pro line, 900 Dialed in, 780 Sharp read, 620 Solid, 450 Decent,
250 Costly, below that Wrong read.

## Juice
Count-up with ticks, tier pop, confetti at >= 900 or holed, haptics, WebAudio sounds with mute, comet trail, landing
sparks, cup sparks, streak and best score.

## Known weaknesses
- Spin and shape rarely beat a plain shot: with free aim and a deterministic model there is almost always a plain line.
  Measured (`tests/physics/sp.js`): the best spin/shape shot saves 0.11 strokes per hole on average and more than 0.1 on
  about 7 of 40 holes. Steeper slopes did not help (0.051). Ideas not built: swing dispersion, landing zones,
  obstacles, limited aim.
- The curve of a draw/fade is cosmetic: it changes flight and roll but not where the ball lands.
