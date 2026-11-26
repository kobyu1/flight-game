// The world Kestrel Run flies over: one deterministic valley per seed, with rolling hills,
// a bay of open water, a far island with its own runway, and a canyon variant. Terrain is a
// pure function of world x, so the renderer, the physics and the autopilot all agree on it.

import { FIELD, MISSIONS, PLANE_SCREEN_X, SEA_LEVEL_Y } from './config.js';
import { createNoise1D, createRandom } from './random.js';

/** World length in pixels; every mission's course fits inside it. */
export const WORLD_LENGTH = 16800;
/** The bay's water band (missions 1 and 3). */
export const BAY = { from: 6200, to: 7800 };
/** The start runway and the island runway. */
export const RUNWAYS = [
  { from: 150, to: 980, y: 640, name: 'HOME STRIP' },
  { from: 13600, to: 14450, y: 618, name: 'ISLAND STRIP' },
];
/** Where the canyon dash ends (the far beacon). */
export const CANYON_FINISH_X = 12400;

export const EVENT_RING = 1;
export const EVENT_LANDED = 2;
export const EVENT_CRASHED = 4;
export const EVENT_COMPLETE = 8;
export const EVENT_SCRAPE = 16;
export const EVENT_LOW_FUEL = 32;

/**
 * A ring (or gate) floating over the course. `passed` flips when the plane threads it.
 */
export function createRing(x, y, radius) {
  return { x, y, radius, passed: false };
}

function ringLayout(mission, random, noise) {
  const rings = [];
  if (mission.id === 'rings') {
    for (let i = 0; i < 8; i += 1) {
      const x = 1600 + i * 1350 + random() * 260;
      const y = 250 + random() * 260;
      rings.push(createRing(x, y, 62));
    }
  } else if (mission.id === 'canyon') {
    for (let i = 0; i < 6; i += 1) {
      const x = 1900 + i * 1700 + random() * 200;
      const y = 470 + random() * 70;
      rings.push(createRing(x, y, 58));
    }
  } else {
    // Island landing: three guide rings over the bay, then the strip itself.
    rings.push(createRing(3400, 330, 62));
    rings.push(createRing(6600, 300, 62));
    rings.push(createRing(10800, 330, 62));
  }
  return rings;
}

/**
 * Build one world's terrain, rings, clouds and runway tables for a mission and seed.
 * `state` is the mutable flight state the physics steps.
 */
export function createWorld(seed, missionIndex) {
  const mission = MISSIONS[missionIndex] ?? MISSIONS[0];
  const random = createRandom(seed);
  const noise = createNoise1D(seed);
  const noiseRough = createNoise1D(seed ^ 0x51ab);
  const rings = ringLayout(mission, random, noise);

  // Clouds drift slowly and sit at fixed world x so the sky reads the same every run.
  const clouds = [];
  for (let i = 0; i < 26; i += 1) {
    clouds.push({
      x: random() * WORLD_LENGTH,
      y: 60 + random() * 190,
      scale: 0.7 + random() * 1.1,
      depth: 0.25 + random() * 0.45,
    });
  }

  const state = {
    mission,
    missionIndex,
    seed,
    rings,
    clouds,
    // Flight state (world units, y grows downwards).
    x: 560,
    y: RUNWAYS[0].y - 14,
    vx: 0,
    vy: 0,
    pitch: 0,
    throttle: 0,
    fuel: mission.fuel,
    damage: 0,
    score: 0,
    ringsPassed: 0,
    gearDown: true,
    flaps: false,
    onGround: true,
    landed: false,
    rolledOntoRunway: false,
    crashed: false,
    complete: false,
    crashReason: '',
    time: 0,
    timeLeft: mission.timeLimit,
    lowAltitudeSeconds: 0,
    lowFuelWarned: false,
    lastScrapeTime: -10,
    cameraX: 0,
    distanceFlown: 0,
  };

  /** Height of the ground surface (world y) at world x; runways flatten it. */
  function terrainHeight(x) {
    if (x < 0) x = 0;
    if (x > WORLD_LENGTH) x = WORLD_LENGTH;
    for (const runway of RUNWAYS) {
      if (x >= runway.from - 200 && x <= runway.to + 200) {
        const edge = Math.min(x - (runway.from - 200), runway.to + 200 - x, 200) / 200;
        const raw = baseHeight(x);
        return raw + (runway.y - raw) * Math.max(0, Math.min(1, edge));
      }
    }
    return baseHeight(x);
  }

  function baseHeight(x) {
    // Rolling valley floor with two octaves of seeded noise.
    let h = 596 + noise(x) * 46 + noiseRough(x * 2.7) * 18;
    if (mission.id === 'canyon') {
      // Canyon walls: tall mesas rise out of the valley floor.
      const wall = Math.max(0, noise(x * 0.9 + 700)) ** 2 * 260;
      h -= wall;
      // The channel the dash follows stays low and flyable.
      h = Math.max(h, 470 + noise(x * 1.7) * 26);
    } else {
      // Distant hills climb gently toward the far end of the valley.
      h -= Math.max(0, (x - 9000) / 9000) * 60 * (0.5 + 0.5 * noise(x * 0.4 + 300));
    }
    // The bay is open water: the ground drops below the surface.
    if (mission.id !== 'canyon' && x > BAY.from && x < BAY.to) return 706;
    // The valley floor by the home strip never rises above runway level, so a plane
    // lifting off there meets open sky, not a hillside.
    if (x < 2600) h = Math.max(h, 640);
    // The beach before the island strip stays low, so the glide path clears the ground
    // all the way to the threshold.
    if (mission.id !== 'canyon' && x > 12800 && x < 13600) h = Math.max(h, 640);
    return h;
  }

  /** True when world x is over open water (the bay, or the canyon river). */
  function isWater(x) {
    if (mission.id !== 'canyon' && x > BAY.from && x < BAY.to) return true;
    if (mission.id === 'canyon' && x > 4300 && x < 4900) return true;
    return false;
  }

  /** The runway the plane is over, or null. */
  function runwayAt(x) {
    for (const runway of RUNWAYS) {
      if (x >= runway.from && x <= runway.to) return runway;
    }
    return null;
  }

  /** The next unpassed ring ahead of the plane, or null. */
  function nextRing() {
    for (const ring of rings) {
      if (!ring.passed && ring.x > state.x - 40) return ring;
    }
    return null;
  }

  /** Altitude above the ground in feet (never below zero). */
  function altitudeFeet() {
    return Math.max(0, Math.round((terrainHeight(state.x) - state.y) * 3));
  }

  /** Height above sea level in feet. */
  function altitudeMslFeet() {
    return Math.max(0, Math.round((SEA_LEVEL_Y - state.y) * 3));
  }

  return {
    state,
    mission,
    rings,
    clouds,
    terrainHeight,
    isWater,
    runwayAt,
    nextRing,
    altitudeFeet,
    altitudeMslFeet,
    /** The furthest the course extends. */
    length: WORLD_LENGTH,
    /** Screen x of the plane; the camera keeps it fixed while the world scrolls. */
    planeScreenX: PLANE_SCREEN_X,
    /** World x the camera's left edge sits at, following the plane. */
    cameraX() {
      return Math.max(0, Math.min(WORLD_LENGTH - FIELD.width, state.x - PLANE_SCREEN_X));
    },
  };
}
