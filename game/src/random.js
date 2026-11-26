// A small deterministic random source: mulberry32 plus a smooth 1-D value-noise field built
// from it, so the same seed always grows the same valley, bay and canyon. Nothing in the
// simulation ever calls Math.random, which keeps the screenshot scenes reproducible.

/** A mulberry32 generator: returns a function that yields numbers in [0, 1). */
export function createRandom(seed) {
  let state = seed >>> 0;
  return function random() {
    state |= 0;
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A smooth 1-D noise field over world x, in [-1, 1], built from a seeded lattice. */
export function createNoise1D(seed) {
  const random = createRandom(seed ^ 0x9e3779b9);
  const lattice = new Float32Array(512);
  for (let i = 0; i < lattice.length; i += 1) lattice[i] = random() * 2 - 1;
  const fade = (t) => t * t * (3 - 2 * t);
  return function noise1D(x) {
    const scaled = x / 420;
    const i = Math.floor(scaled);
    const f = scaled - i;
    const a = lattice[((i % 512) + 512) % 512];
    const b = lattice[(((i + 1) % 512) + 512) % 512];
    return a + (b - a) * fade(f);
  };
}

/** A deterministic pick from an array, using a seeded random function. */
export function pick(random, array) {
  return array[Math.floor(random() * array.length) % array.length];
}
