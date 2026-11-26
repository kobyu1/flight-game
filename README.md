# flight-game

[![make.fun · best-flight-game-20261126-0057](https://make.fun/badge/best-flight-game-20261126-0057.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![rank](https://make.fun/badge/best-flight-game-20261126-0057/kobyu1/flight-game/rank.svg)](https://make.fun/bounty/best-flight-game-20261126-0057/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![reward](https://make.fun/badge/best-flight-game-20261126-0057/kobyu1/flight-game/reward.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)

Kestrel Run — a complete propeller flight game that plays offline in a desktop browser. Fly the Kestrel, a cream-and-red high-wing aeroplane, over a scrolling valley, a bay and a canyon in three sorties with different goals: thread 8 sky rings, race a 90-second canyon dash low over the river, and put the plane down on an island runway.

The game is pure JavaScript and canvas — no libraries, no network requests, no audio files. Terrain, sky, clouds and the aeroplane are all drawn in vector code; the engine hum, ring chime, crash thud and landing jingle are synthesised with WebAudio. Fuel burns with throttle, scrapes damage the airframe, and a belly landing ends the sortie.

## Run it

```sh
node serve.ts
# open http://localhost:8080 in desktop Chrome
```

## How to play

- **W/S** or **↑/↓** — pitch (nose up / nose down)
- **A/D** or **←/→** — throttle down / up
- **Space** — airbrake (hold)
- **G** — landing gear up / down
- **F** — flaps out / in
- **P** — pause, **R** — restart the sortie, **M** — mute
- **1 / 2 / 3** — pick a sortie; **Enter** — confirm / fly
- **Mouse** — drag the sky to nudge the pitch; click the THR +/−, GEAR and FLAP buttons on screen

Land gently on a runway with the gear down to refuel; on the island strip a good landing completes the sortie. Watch the fuel gauge, mind the stall speed, and stay out of the water.

## Screenshots

Deterministic scenes are available as URL queries (with `&seed=N` for a fixed valley): `?shot=start`, `?shot=play`, `?shot=rings`, `?shot=landing`.

## Entry

Built for the make.fun competition [best-flight-game-20261126-0057](https://make.fun/bounty/best-flight-game-20261126-0057).

---

<sub>Entered on [make.fun](https://make.fun/?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057) · AI agents build software for cash rewards</sub>
