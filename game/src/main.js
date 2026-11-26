// Boot and the one loop: input is read every frame, the world advances in fixed 1/60 s
// steps (several in a slow frame, none in a fast one), and the renderer paints what is
// there. The game moves between six screens: title, briefing, play, paused, complete and
// over. ?seed=N fixes the valley. ?shot=start|play|rings|landing (with &seed=N) stages
// that scene instead of running the loop, paints it twice and sets window.__shotReady
// for a screenshot.

import { BEST_KEY, MISSIONS, STEP } from './config.js';
import { stepAircraft } from './aircraft.js';
import { createAudio } from './audio.js';
import { createHud, hitHudButton } from './hud.js';
import {
  ACTION_CONFIRM,
  ACTION_FLAPS,
  ACTION_GEAR,
  ACTION_MISSION_1,
  ACTION_MISSION_2,
  ACTION_MISSION_3,
  ACTION_MUTE,
  ACTION_PAUSE,
  ACTION_RESTART,
  createInput,
} from './input.js';
import {
  createSession,
  currentFlash,
  handleWorldEvents,
  launchMission,
  nextMissionIndex,
  restartMission,
  selectMission,
  showTitle,
  togglePause,
} from './missions.js';
import { createRenderer, SCREEN_BRIEFING, SCREEN_COMPLETE, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE } from './render.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : shot ? 7 : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
const status = document.getElementById('status');
const renderer = createRenderer(canvas);
const hud = createHud();

function announce(message) {
  status.textContent = message;
}

/** Paint a staged screenshot scene: world, then the instruments over it. */
function runShot(name) {
  const { session, screen } = stageShot(name, seed);
  const view = {
    world: session.world,
    screen,
    best: session.best,
    missions: MISSIONS,
    mission: session.world.mission,
    flash: currentFlash(session),
  };
  let painted = 0;
  function paint() {
    renderer.draw(view);
    hud.draw(ctx, session.world, { muted: true, flash: view.flash });
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  const audio = createAudio();
  const session = createSession(seed);
  let screen = SCREEN_TITLE;
  let throttleTarget = 0;
  let accumulator = 0;
  let last = performance.now();

  function playSounds(names) {
    for (const name of names) {
      if (name === 'ring') audio.ringChime();
      else if (name === 'scrape') audio.scrapeThud();
      else if (name === 'crash') audio.crashThud();
      else if (name === 'landing') audio.landingJingle();
    }
  }

  function startBriefing(missionIndex) {
    selectMission(session, missionIndex);
    screen = SCREEN_BRIEFING;
    throttleTarget = 0;
    audio.ensure();
    audio.click();
    announce(`${session.world.mission.name}. ${session.world.mission.brief}`);
  }

  function launch() {
    launchMission(session);
    screen = SCREEN_PLAY;
    throttleTarget = 0.55;
    audio.ensure();
    announce(`Flying ${session.world.mission.name}.`);
  }

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_MUTE) {
      session.muted = audio.toggleMute();
      announce(session.muted ? 'Sound off.' : 'Sound on.');
    }
    if (actions & ACTION_GEAR && screen === SCREEN_PLAY) {
      session.world.state.gearDown = !session.world.state.gearDown;
      announce(session.world.state.gearDown ? 'Gear down.' : 'Gear up.');
      audio.click();
    }
    if (actions & ACTION_FLAPS && screen === SCREEN_PLAY) {
      session.world.state.flaps = !session.world.state.flaps;
      announce(session.world.state.flaps ? 'Flaps out.' : 'Flaps in.');
      audio.click();
    }
    if (actions & ACTION_RESTART && (screen === SCREEN_PLAY || screen === SCREEN_PAUSED || screen === SCREEN_OVER)) {
      startBriefing(session.missionIndex);
      return;
    }
    if (actions & ACTION_PAUSE) {
      if (screen === SCREEN_PLAY || screen === SCREEN_PAUSED) {
        togglePause(session);
        screen = session.screen;
        announce(screen === SCREEN_PAUSED ? 'Paused.' : 'Flying.');
      } else if (screen === SCREEN_BRIEFING) {
        showTitle(session);
        screen = SCREEN_TITLE;
      }
      return;
    }
    if (actions & ACTION_MISSION_1 && screen !== SCREEN_PLAY && screen !== SCREEN_PAUSED) startBriefing(0);
    else if (actions & ACTION_MISSION_2 && screen !== SCREEN_PLAY && screen !== SCREEN_PAUSED) startBriefing(1);
    else if (actions & ACTION_MISSION_3 && screen !== SCREEN_PLAY && screen !== SCREEN_PAUSED) startBriefing(2);
    else if (actions & ACTION_CONFIRM) {
      if (screen === SCREEN_TITLE) startBriefing(session.missionIndex);
      else if (screen === SCREEN_BRIEFING) launch();
      else if (screen === SCREEN_COMPLETE) startBriefing(nextMissionIndex(session));
      else if (screen === SCREEN_OVER) startBriefing(session.missionIndex);
      else if (screen === SCREEN_PAUSED) {
        togglePause(session);
        screen = session.screen;
      }
    }
  }

  function handleClick() {
    const click = input.takeClick();
    if (!click) return;
    audio.ensure();
    const button = hitHudButton(click.x, click.y);
    if (button) {
      const s = session.world.state;
      if (button === 'throttleUp') throttleTarget = Math.min(1, throttleTarget + 0.1);
      else if (button === 'throttleDown') throttleTarget = Math.max(0, throttleTarget - 0.1);
      else if (button === 'gear' && screen === SCREEN_PLAY) s.gearDown = !s.gearDown;
      else if (button === 'flaps' && screen === SCREEN_PLAY) s.flaps = !s.flaps;
      audio.click();
      return;
    }
    if (screen === SCREEN_TITLE) {
      // The three mission rows on the title screen are clickable.
      for (let i = 0; i < 3; i += 1) {
        if (click.y >= 280 + i * 52 && click.y <= 332 + i * 52 && click.x >= 310 && click.x <= 970) {
          startBriefing(i);
          return;
        }
      }
      startBriefing(session.missionIndex);
    } else if (screen === SCREEN_BRIEFING) launch();
    else if (screen === SCREEN_COMPLETE) startBriefing(nextMissionIndex(session));
    else if (screen === SCREEN_OVER) startBriefing(session.missionIndex);
  }

  function step() {
    const s = session.world.state;
    // Throttle keys trim the target; the airbrake is held, not toggled.
    throttleTarget = Math.max(0, Math.min(1, throttleTarget + input.throttleKeys() * STEP * 0.7));
    const controls = {
      pitch: input.pitchStick(),
      throttle: throttleTarget,
      brake: input.brakeHeld(),
    };
    input.consumeDrag();
    const events = stepAircraft(session.world, controls, STEP);
    playSounds(handleWorldEvents(session, events));
    screen = session.screen;
    audio.setEngine(s.throttle, screen === SCREEN_PLAY && !s.crashed);
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    handleClick();
    if (screen === SCREEN_PLAY) {
      while (accumulator >= STEP && screen === SCREEN_PLAY) {
        step();
        accumulator -= STEP;
      }
    } else if (screen === SCREEN_TITLE || screen === SCREEN_BRIEFING) {
      // The title and briefing keep the valley alive behind the panel.
      while (accumulator >= STEP) {
        session.world.state.time += STEP;
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    const view = {
      world: session.world,
      screen,
      best: session.best,
      missions: MISSIONS,
      mission: session.world.mission,
      flash: currentFlash(session),
    };
    renderer.draw(view);
    hud.draw(ctx, session.world, { muted: session.muted, flash: view.flash });
  }

  announce('Kestrel Run. Choose a sortie: 1, 2 or 3.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
void BEST_KEY;
