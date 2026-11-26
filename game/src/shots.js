// The deterministic screenshot scenes behind ?shot=start|play|rings|landing. Each one plays
// the real rules forward from a fresh world for a fixed number of steps, steered by a simple
// autopilot (pitch toward the next ring or the runway, throttle held), so the frame is what a
// short game really looks like and the same seed always gives the same frame.

import { STEP } from './config.js';
import { stepAircraft } from './aircraft.js';
import { createSession, launchMission, selectMission } from './missions.js';
import { SCREEN_PLAY, SCREEN_TITLE } from './render.js';
import { EVENT_COMPLETE, EVENT_CRASHED } from './world.js';

const SAMPLE = STEP;

/** Pitch the nose toward a world point (x, y): positive stick is nose up. A proportional
 *  controller: pick the vertical speed that closes the gap by the time the plane gets
 *  there, then the pitch angle that gives that vertical speed. */
function pitchToward(state, targetX, targetY) {
  const dx = Math.max(200, targetX - state.x);
  const timeToTarget = dx / Math.max(120, state.vx);
  const desiredVy = Math.max(-170, Math.min(170, (targetY - state.y) / Math.max(0.6, timeToTarget)));
  const sinPitch = -desiredVy / (Math.max(120, state.vx) * 0.92);
  const pitchDegrees = (Math.asin(Math.max(-0.53, Math.min(0.53, sinPitch))) * 180) / Math.PI;
  return Math.max(-1, Math.min(1, pitchDegrees / 30));
}

function autopilotRing(world) {
  const s = world.state;
  const ring = world.nextRing();
  const target = ring ?? { x: s.x + 600, y: 340 };
  return { pitch: pitchToward(s, target.x, target.y), throttle: 0.72, brake: false };
}

function autopilotLow(world) {
  const s = world.state;
  const ahead = world.terrainHeight(s.x + 320);
  const targetY = ahead - 130;
  const ring = world.nextRing();
  const target = ring && ring.x - s.x < 900 ? ring : { x: s.x + 400, y: targetY };
  return { pitch: pitchToward(s, target.x, target.y), throttle: 0.68, brake: false };
}

function autopilotLanding(world) {
  const s = world.state;
  const runway = world.runwayAt(14000) ?? { from: 13600, to: 14450, y: 618 };
  const distance = runway.from - s.x;
  // A steady 3-degree glide: aim at a point on the glide path above the threshold, ending
  // at the runway surface itself so the wheels can meet it.
  const glideY = runway.y - 14 - Math.max(0, distance) * 0.055;
  const targetY = distance > 1200 ? Math.min(glideY, 300) : glideY;
  const throttle = distance > 600 ? 0.45 : 0.42;
  return { pitch: pitchToward(s, s.x + 320, targetY), throttle, brake: distance < 150 };
}

/** Run the world forward `seconds` at most, stopping early when `stop(world)` is true. */
function runFor(world, seconds, controlsFor, stop) {
  const steps = Math.round(seconds / SAMPLE);
  for (let i = 0; i < steps; i += 1) {
    const events = stepAircraft(world, controlsFor(world), SAMPLE);
    if (events & EVENT_CRASHED) break; // crashed: stop where it fell
    if (events & EVENT_COMPLETE) break; // complete: stop at the moment of glory
    if (stop && stop(world)) break;
  }
}

/**
 * Stage the named scene (start, play, rings or landing; any other name is start) on a fresh
 * session and return the session plus the screen to draw over it.
 */
export function stageShot(name, seed) {
  const session = createSession(seed);
  if (name === 'play') {
    selectMission(session, 0);
    launchMission(session);
    session.world.state.throttle = 0.72;
    // Fly until the plane is inside a ring, so the cover shows it threading one.
    runFor(session.world, 40, autopilotRing, (world) => {
      const s = world.state;
      for (const ring of world.rings) {
        if (ring.passed) return true;
        const dx = s.x - ring.x;
        const dy = s.y - ring.y;
        if (dx * dx + dy * dy < ring.radius * ring.radius * 0.8) return true;
      }
      return false;
    });
    return { session, screen: SCREEN_PLAY };
  }
  if (name === 'rings') {
    selectMission(session, 0);
    launchMission(session);
    session.world.state.throttle = 0.68;
    // Stay low over the valley until a ring is just ahead.
    runFor(session.world, 30, autopilotLow, (world) => {
      const next = world.nextRing();
      return !!next && next.x - world.state.x > 0 && next.x - world.state.x < 520;
    });
    return { session, screen: SCREEN_PLAY };
  }
  if (name === 'landing') {
    selectMission(session, 2);
    launchMission(session);
    const s = session.world.state;
    s.throttle = 0.42;
    s.gearDown = true;
    s.flaps = true;
    // Start the approach already over the bay, high enough to show the strip ahead.
    s.x = 11800;
    s.y = 300;
    s.vx = 250;
    s.onGround = false;
    runFor(session.world, 40, autopilotLanding, (world) => {
      const st = world.state;
      return st.x > 13100 && st.y < 560 && !st.crashed;
    });
    return { session, screen: SCREEN_PLAY };
  }
  // start: the title screen, plane parked on the home strip, engine idling.
  selectMission(session, 0);
  session.screen = SCREEN_TITLE;
  runFor(session.world, 3, () => ({ pitch: 0, throttle: 0, brake: false }));
  session.screen = SCREEN_TITLE;
  return { session, screen: SCREEN_TITLE };
}
