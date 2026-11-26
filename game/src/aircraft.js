// Kestrel's flight model: throttle sets a target speed, pitch trades speed for height, the
// wing quits below stall speed, and fuel, damage and the ground below all have a say. One
// fixed step (dt seconds) at a time; the caller passes the pilot's (or autopilot's) commands.

import { PLANE, SCORE, SEA_LEVEL_Y, STEP } from './config.js';
import { EVENT_COMPLETE, EVENT_CRASHED, EVENT_LANDED, EVENT_LOW_FUEL, EVENT_RING, EVENT_SCRAPE } from './world.js';

/**
 * Pilot commands for one step. `pitch` is -1 (full nose down) to 1 (full nose up);
 * `throttle` is 0..1, or null to hold the current setting; `brake` holds the airbrake.
 */
export function createControls() {
  return { pitch: 0, throttle: null, brake: false };
}

/** Step the aircraft one fixed step. Returns a bitmask of world events. */
export function stepAircraft(world, controls, dt = STEP) {
  const s = world.state;
  if (s.crashed || s.complete) return 0;
  let events = 0;
  s.time += dt;

  // Throttle chases its command; an empty tank forces idle.
  if (controls.throttle !== null && controls.throttle !== undefined) {
    const rate = 1.4 * dt;
    s.throttle += Math.max(-rate, Math.min(rate, controls.throttle - s.throttle));
  }
  if (s.fuel <= 0) s.throttle = 0;

  // Target speed from throttle, trimmed by gear, flaps and the airbrake.
  let target = PLANE.idleSpeed + s.throttle * (PLANE.maxSpeed - PLANE.idleSpeed);
  if (!s.gearDown) target += PLANE.gearUpBonus;
  if (s.flaps) target -= 30;
  if (controls.brake || s.flaps) target = Math.min(target, PLANE.brakeCap);
  if (s.onGround) target = Math.min(target, 320);
  s.vx += (target - s.vx) * Math.min(1, PLANE.accel * dt);
  if (controls.brake) s.vx = Math.max(0, s.vx - PLANE.brakeDrag * 60 * dt);

  // Pitch chases the stick; the nose only answers while there is airflow. Positive pitch
  // is nose up (climb); negative is nose down (dive).
  const pitchAuthority = Math.min(1, Math.max(0.25, s.vx / 220));
  const pitchLimit = controls.pitch >= 0 ? -PLANE.maxPitchUp : PLANE.maxPitchDown;
  const wantedPitch = controls.pitch * pitchLimit;
  const pitchStep = PLANE.pitchRate * pitchAuthority * dt;
  s.pitch += Math.max(-pitchStep, Math.min(pitchStep, wantedPitch - s.pitch));

  // Lift from pitch and speed, plus a sink when the wing is below stall speed.
  const pitchRad = (s.pitch * Math.PI) / 180;
  let vy = -Math.sin(pitchRad) * s.vx * 0.92;
  if (s.vx < PLANE.stallSpeed) vy += (PLANE.stallSpeed - s.vx) * 0.55;
  s.vy = Math.max(-330, Math.min(330, vy));

  // Fuel burns faster the harder the engine works.
  s.fuel = Math.max(0, s.fuel - (PLANE.fuelIdle + PLANE.fuelPerThrottle * s.throttle) * dt);
  if (s.fuel < 20 && !s.lowFuelWarned) {
    s.lowFuelWarned = true;
    events |= EVENT_LOW_FUEL;
  }

  // Canyon dash: the clock runs out whether the pilot is ready or not.
  if (s.mission.timeLimit > 0) {
    s.timeLeft = Math.max(0, s.mission.timeLimit - s.time);
    if (s.timeLeft <= 0 && !s.complete) {
      return finishCrash(world, 'Time up — the beacon went dark.');
    }
  }

  // Move, then settle against the ground.
  s.x += s.vx * dt;
  s.distanceFlown += s.vx * dt;
  if (s.onGround) {
    s.y = runwayGroundY(world);
    s.vy = 0;
    // Rolling onto a runway counts as a landing: the home strip refuels the sortie,
    // the island strip completes one.
    const rolledOnto = world.runwayAt(s.x);
    if (rolledOnto && !s.rolledOntoRunway) {
      s.rolledOntoRunway = true;
      if (s.mission.id === 'island' && rolledOnto.name === 'ISLAND STRIP') {
        s.landed = true;
        s.score += SCORE.landing + SCORE.missionComplete;
        s.complete = true;
        return EVENT_LANDED | EVENT_COMPLETE;
      }
      s.fuel = 100;
      s.lowFuelWarned = false;
    }
    if (s.vx > 170 && s.pitch > 5) {
      s.onGround = false;
      s.rolledOntoRunway = false;
      // Climb away in this same step, or the ground check below re-lands the plane.
      // (Use the step's computed climb, not s.vy, which this block just zeroed.)
      s.y += vy * dt;
    }
    if (s.vx <= 0.5 && s.throttle < 0.05) s.vx = 0;
  } else {
    s.y += s.vy * dt;
  }
  // The ceiling keeps the aeroplane below the instrument bar, so it is never hidden
  // behind the HUD.
  if (s.y < 120) {
    s.y = 120;
    s.vy = Math.max(0, s.vy);
  }
  if (s.x > world.length - 60) {
    s.x = world.length - 60;
    s.vx = Math.min(s.vx, 0);
  }

  // Low-altitude bonus in the canyon: under 300 ft, fast, and still flying.
  if (s.mission.lowAltitudeBonus && !s.onGround && s.vx > 200) {
    const agl = world.altitudeFeet();
    if (agl > 0 && agl < 300) {
      s.lowAltitudeSeconds += dt;
      s.score += SCORE.lowAltitudePerSecond * dt;
    }
  }

  // Rings: threading one banks its points and a chime.
  for (const ring of world.rings) {
    if (ring.passed) continue;
    const dx = s.x - ring.x;
    const dy = s.y - ring.y;
    if (dx * dx + dy * dy < ring.radius * ring.radius) {
      ring.passed = true;
      s.ringsPassed += 1;
      s.score += SCORE.ring;
      events |= EVENT_RING;
    }
  }

  // Ground and water contact.
  const groundY = world.terrainHeight(s.x);
  const water = world.isWater(s.x);
  if (!s.onGround && s.y + 14 >= groundY) {
    if (water && s.y + 10 >= SEA_LEVEL_Y) {
      return finishCrash(world, 'Ditched in the bay.');
    }
    const runway = world.runwayAt(s.x);
    const gentle = Math.abs(s.vy) < 130 && s.vx < 300 && s.vx > 40;
    if (runway && gentle && s.gearDown) {
      s.y = runway.y - 14;
      s.vy = 0;
      s.onGround = true;
      s.landed = true;
      events |= EVENT_LANDED;
      if (s.mission.id === 'island' && runway.name === 'ISLAND STRIP') {
        s.score += SCORE.landing + SCORE.missionComplete;
        s.complete = true;
        events |= EVENT_COMPLETE;
      } else {
        // A touch-and-go on the home strip refuels the sortie.
        s.fuel = 100;
        s.lowFuelWarned = false;
      }
      return events;
    }
    if (Math.abs(s.vy) > PLANE.hardImpactVy || s.vx > PLANE.hardImpactVx) {
      return finishCrash(world, runway && !s.gearDown ? 'Belly landing — lower the gear (G).' : 'Flew into the ground.');
    }
    if (Math.abs(s.vy) < 130 && s.vx < 90) {
      // A slow, flat arrival rolls to a stop instead of grinding along the ground:
      // a rough-field landing the pilot walks away from, and can take off from again.
      s.onGround = true;
      s.y = groundY - 14;
      s.vy = 0;
      if (s.time - s.lastScrapeTime > 0.8) {
        s.damage = Math.min(100, s.damage + PLANE.scrapeDamage);
        s.lastScrapeTime = s.time;
        events |= EVENT_SCRAPE;
      }
      if (s.damage >= 100) return finishCrash(world, 'Airframe gave out after too many scrapes.');
      return events;
    }
    // A scrape: the airframe takes it, the pilot keeps flying. Damage is only counted
    // once per beat, so one rough patch cannot end the sortie by itself, and the nose
    // is kicked up so the plane climbs away from the ground instead of grinding on it.
    if (s.time - s.lastScrapeTime > 0.8) {
      s.damage = Math.min(100, s.damage + PLANE.scrapeDamage);
      s.lastScrapeTime = s.time;
      events |= EVENT_SCRAPE;
    }
    s.y = groundY - 15;
    s.pitch = Math.max(s.pitch, 18);
    if (s.damage >= 100) return finishCrash(world, 'Airframe gave out after too many scrapes.');
  }

  // A ring left 700 px behind is missed: there is no turning back in this valley.
  const upcoming = world.nextRing();
  if (upcoming && s.x > upcoming.x + 700 && !s.complete) {
    return finishCrash(world, 'Missed a ring — it is behind you now.');
  }

  // Mission goals.
  if (s.mission.id === 'rings' && s.ringsPassed >= s.mission.rings) {
    s.score += SCORE.missionComplete;
    s.complete = true;
    events |= EVENT_COMPLETE;
  } else if (s.mission.id === 'canyon' && s.x >= 12400) {
    s.score += Math.round(s.timeLeft) * SCORE.timePerSecond + SCORE.missionComplete;
    s.complete = true;
    events |= EVENT_COMPLETE;
  }
  return events;
}

function runwayGroundY(world) {
  const runway = world.runwayAt(world.state.x);
  return (runway ? runway.y : world.terrainHeight(world.state.x)) - 14;
}

function finishCrash(world, reason) {
  const s = world.state;
  s.crashed = true;
  s.crashReason = reason;
  s.vx = 0;
  s.vy = 0;
  return EVENT_CRASHED;
}

/** Heading in degrees: the course runs east (090), with drift from pitch and the wind. */
export function headingDegrees(state) {
  const drift = 7 * Math.sin(state.time * 0.35) + state.pitch * 0.25;
  return (90 + drift + 360) % 360;
}

/** Airspeed in knots from pixels per second. */
export function airspeedKnots(state) {
  return Math.max(0, Math.round(state.vx * 0.45));
}
