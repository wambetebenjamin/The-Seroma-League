# 🏆 The Seroma League

A mobile-first **POV ("from your own eyes") sports game** set on the campus of
**Seroma Christian High School, Mukono, Uganda** — inspired by
[POV Soccer on CrazyGames](https://www.crazygames.com/game/pov-soccer-pij).

Play as any Seroma League player, wear your club's colours, and take the field,
the court or the pool in first person.

## Sports

| Sport | Venue | Idea |
| --- | --- | --- |
| ⚽ **Football** | Jubilee Pitch | 5-a-side POV football. Look at a team-mate to pass, look at the goal and hold to blast it. Call for the ball, slide in to tackle, pull step-overs and rainbow flicks. |
| 🏀 **Basketball** | Seroma Court | 3x3 shootout. Drive, aim at the rim, hold and release in the green power band. Behind the arc is worth 3; a green release adds a bonus point. |
| 🏊 **Swimming** | Seroma Aquatics | 50m freestyle final. Tap *STROKE* in rhythm with the cycle marker for surges, and burn stamina on an underwater kick. |

Each sport has a **Match** mode (clock, crowd, pressing opponents) and a relaxed
**Practice** mode for learning the controls.

## The league

All 12 clubs, their coaches and the full squads come from
**THE SEROMA LEAGUE VOTING POLL**:

Licans · Celestials · Galacticals · Levites · Legendaries · FC Gaucho ·
Raptors · Rostocks · Titans · Theos · Elites · Spartans

The home screen also carries the live award races from the poll (Best Coach,
Best Female Player, Best Goalkeeper, Best Defender, Best Midfielder,
Best Forward) with a link to the official Google Form.

## The campus

Wisdom Hall, the terracotta classroom blocks with their green roofs, the new
stone terraces, the perimeter wall, eucalyptus and palm trees, floodlights and a
painted grandstand are all recreated in 3D and shared between venues. The school
facts (founded 2002 by Lt. Col. Robert and Mrs Margaret Sekidde, "Heads But Not
Tails", the six values, the four-star ranking) come from
[seroma.ac.ug](https://www.seroma.ac.ug/).

## Controls

Phone: left thumb = move, right thumb drag = look, **SHOOT** button = hold/release,
plus action pills (CALL / TACKLE / skills).

Desktop (matching the reference game's control set): **WASD** move · mouse look ·
**hold left click or F** to power up and kick where you look · **Shift** sprint ·
**Space** call for the ball · **C** slide tackle · **1/2/3** (also **Q/E/R**)
step-overs, rainbow flick and roulette · **right click** look over your shoulder ·
**P/Esc** pause.

Shots use the reference's aiming logic: look at the top corner of the goal and
hold for a rising, corner-bound strike; look at a team-mate and the same button
passes. Skill moves briefly beat your marker — mistime one and they nick it back.

## Tech

Vanilla JS + [three.js](https://threejs.org/) + Vite. No downloaded models or
audio: everything is built from primitives, canvas-painted textures and WebAudio
blips, so the whole game is a couple of megabytes and loads instantly.

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # static build in dist/
```

`smoke.mjs` runs the three game engines headlessly with a stubbed renderer:

```bash
node smoke.mjs
```

## Credits

Fan-made game for The Seroma League. School photos belong to their respective
owners (Seroma Christian High School, USSSA, NBS Sport, Kawowo Sports, New
Vision) and are used here to celebrate the school community.
