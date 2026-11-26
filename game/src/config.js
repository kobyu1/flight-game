// Every tuning number and colour for Kestrel Run in one place. The playfield is a fixed
// 1280x720 logical area; the renderer scales it to the window, so no rule below depends on
// the screen size. One pixel is 3 feet of altitude and about 0.45 knots of airspeed.

export const FIELD = { width: 1280, height: 720 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display rate. */
export const STEP = 1 / 60;

/** Feet shown per pixel of height, and knots shown per pixel-per-second of speed. */
export const FEET_PER_PIXEL = 3;
export const KNOTS_PER_PX_PER_SEC = 0.45;

/** The plane's fixed screen position: the world scrolls past it (chase view). */
export const PLANE_SCREEN_X = 430;

/** Sea level in world y (pixels, y grows downwards); the start runway sits just above it. */
export const SEA_LEVEL_Y = 640;

export const PLANE = {
  /** Top speed at full throttle, in pixels per second. */
  maxSpeed: 430,
  /** Speed at idle throttle. */
  idleSpeed: 55,
  /** How fast the speed chases its throttle target. */
  accel: 1.6,
  /** Speed below which the wing stops lifting and the nose sinks. */
  stallSpeed: 150,
  /** Pitch authority, degrees per second of input. */
  pitchRate: 55,
  maxPitchUp: -32,
  maxPitchDown: 30,
  /** Fuel burn: percent per second at idle, plus per unit of throttle. */
  fuelIdle: 0.22,
  fuelPerThrottle: 1.05,
  /** Drag when the airbrake/flaps are out, and the speed they cap the plane at. */
  brakeDrag: 0.9,
  brakeCap: 170,
  /** Gear up costs lift at low speed but adds this many px/s at the top end. */
  gearUpBonus: 26,
  /** Damage taken from a gentle terrain scrape; a hard hit is fatal outright. */
  scrapeDamage: 15,
  /** Vertical speed (px/s) above which touching terrain is a crash, not a scrape. */
  hardImpactVy: 215,
  /** Forward speed (px/s) above which touching terrain is a crash. */
  hardImpactVx: 385,
};

export const MISSIONS = [
  {
    id: 'rings',
    index: 0,
    name: 'SORTIE 1 — RING RUN',
    short: 'Ring Run',
    brief: 'Thread all 8 sky rings over the valley and the bay. Rings are worth 100 points each.',
    objective: 'Fly through 8 rings',
    rings: 8,
    timeLimit: 0,
    fuel: 100,
    lowAltitudeBonus: false,
  },
  {
    id: 'canyon',
    index: 1,
    name: 'SORTIE 2 — CANYON DASH',
    short: 'Canyon Dash',
    brief: 'Race the canyon in 90 seconds. Stay low under 300 ft for a trickle of bonus points — but the walls are not forgiving.',
    objective: 'Reach the far beacon in 90 s',
    rings: 6,
    timeLimit: 90,
    fuel: 100,
    lowAltitudeBonus: true,
  },
  {
    id: 'island',
    index: 2,
    name: 'SORTIE 3 — ISLAND LANDING',
    short: 'Island Landing',
    brief: 'Cross the bay and put Kestrel down on the island strip. Gear down, gentle and slow — a belly landing ends the sortie.',
    objective: 'Land on the island runway',
    rings: 3,
    timeLimit: 0,
    fuel: 100,
    lowAltitudeBonus: false,
  },
];

export const SCORE = {
  ring: 100,
  missionComplete: 250,
  landing: 500,
  /** Points per second flown below 300 ft in the canyon. */
  lowAltitudePerSecond: 3,
  /** Points per second left on the clock in the canyon dash. */
  timePerSecond: 10,
};

/** Where the best score is kept between visits (this browser only). */
export const BEST_KEY = 'kestrel-run.best';

export const PALETTE = {
  skyTop: '#2f6fb4',
  skyMid: '#7db3dd',
  skyLow: '#cfe6f2',
  sun: '#ffd66b',
  sunGlow: 'rgba(255, 214, 107, 0.35)',
  mountainFar: '#7d9bb8',
  mountainNear: '#5d7d5a',
  hill: '#6fa055',
  hillDark: '#4d7a3e',
  rock: '#8a7a63',
  sand: '#d9c48f',
  water: '#2e7fa8',
  waterDeep: '#1d5c80',
  runway: '#3c4148',
  runwayLine: '#f5f0dc',
  ring: '#ffcf3d',
  ringGlow: 'rgba(255, 207, 61, 0.45)',
  ringDone: '#7ddb8a',
  planeCream: '#f2ead8',
  planeRed: '#c0392b',
  planeDark: '#2c2f36',
  panel: 'rgba(12, 20, 30, 0.78)',
  panelEdge: '#4d6f8e',
  text: '#eaf4ff',
  textDim: '#9db8cc',
  amber: '#ffb347',
  green: '#7ddb8a',
  red: '#ff6b5e',
  cyan: '#6fd3ff',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
