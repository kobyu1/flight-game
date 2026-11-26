// The sortie session: which mission is loaded, which screen the pilot sees, and what the
// world just did (a ring threaded, a scrape, a landing, a crash). One session owns one world
// at a time; picking another sortie rebuilds the world from its seed.

import { BEST_KEY, MISSIONS } from './config.js';
import { createWorld, EVENT_COMPLETE, EVENT_CRASHED, EVENT_LANDED, EVENT_LOW_FUEL, EVENT_RING, EVENT_SCRAPE } from './world.js';
import { SCREEN_BRIEFING, SCREEN_COMPLETE, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE } from './render.js';

/** Read the stored best score (this browser only); 0 when there is none. */
export function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best score then lasts this visit only.
  }
}

/** Create a session: the title screen over sortie 1's world, awaiting a mission pick. */
export function createSession(seed) {
  return {
    seed,
    missionIndex: 0,
    world: createWorld(seed, 0),
    screen: SCREEN_TITLE,
    best: readBest(),
    flash: '',
    flashUntil: 0,
    muted: false,
    sortiesFlown: 0,
  };
}

/** The mission definitions, in menu order. */
export function missionList() {
  return MISSIONS;
}

/** Load a mission's briefing screen (world reset, plane on the home strip). */
export function selectMission(session, missionIndex) {
  session.missionIndex = missionIndex;
  session.world = createWorld(session.seed, missionIndex);
  session.screen = SCREEN_BRIEFING;
  session.flash = '';
  return session.world;
}

/** Leave the briefing and start flying. */
export function launchMission(session) {
  session.screen = SCREEN_PLAY;
  session.sortiesFlown += 1;
}

/** Back to the mission list. */
export function showTitle(session) {
  session.world = createWorld(session.seed, session.missionIndex);
  session.screen = SCREEN_TITLE;
  session.flash = '';
}

/** Restart the current sortie from its briefing. */
export function restartMission(session) {
  return selectMission(session, session.missionIndex);
}

/** Pause or resume the flight. */
export function togglePause(session) {
  if (session.screen === SCREEN_PLAY) session.screen = SCREEN_PAUSED;
  else if (session.screen === SCREEN_PAUSED) session.screen = SCREEN_PLAY;
}

/** The next sortie after a completed one (wraps back to sortie 1). */
export function nextMissionIndex(session) {
  return (session.missionIndex + 1) % MISSIONS.length;
}

/**
 * Turn the world's event bitmask into flash messages, screen changes and sound cues.
 * Returns the sound names the main loop should play, in order.
 */
export function handleWorldEvents(session, events) {
  const sounds = [];
  const s = session.world.state;
  if (events & EVENT_RING) {
    session.flash = `RING!  +100   (${s.ringsPassed}/${s.mission.rings})`;
    session.flashUntil = s.time + 1.6;
    sounds.push('ring');
  }
  if (events & EVENT_SCRAPE) {
    session.flash = `SCRAPE!  Damage ${Math.round(s.damage)}%`;
    session.flashUntil = s.time + 1.6;
    sounds.push('scrape');
  }
  if (events & EVENT_LOW_FUEL) {
    session.flash = 'LOW FUEL — find the strip';
    session.flashUntil = s.time + 2.2;
  }
  if (events & EVENT_LANDED) {
    if (!s.complete) {
      session.flash = 'TOUCHDOWN — refuelled';
      session.flashUntil = s.time + 2;
      sounds.push('landing');
    }
  }
  if (events & EVENT_COMPLETE) {
    session.screen = SCREEN_COMPLETE;
    session.flash = '';
    if (Math.round(s.score) > session.best) {
      session.best = Math.round(s.score);
      saveBest(session.best);
    }
    sounds.push('landing');
  }
  if (events & EVENT_CRASHED) {
    session.screen = SCREEN_OVER;
    session.flash = '';
    if (Math.round(s.score) > session.best) {
      session.best = Math.round(s.score);
      saveBest(session.best);
    }
    sounds.push('crash');
  }
  return sounds;
}

/** The flash message to show now, or '' once it has expired. */
export function currentFlash(session) {
  if (!session.flash) return '';
  return session.world.state.time <= session.flashUntil ? session.flash : '';
}
