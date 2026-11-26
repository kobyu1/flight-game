// Keyboard and mouse input for Kestrel Run. Keys are held state; one-shot actions (pause,
// restart, gear, mute, confirm, mission pick) are queued and taken once by the main loop.
// The mouse drives the on-screen throttle buttons and can drag the sky to nudge the pitch.

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_RESTART = 4;
export const ACTION_GEAR = 8;
export const ACTION_FLAPS = 16;
export const ACTION_MUTE = 32;
export const ACTION_MISSION_1 = 64;
export const ACTION_MISSION_2 = 128;
export const ACTION_MISSION_3 = 256;

const KEY_ACTIONS = {
  Enter: ACTION_CONFIRM,
  ' ': ACTION_CONFIRM,
  KeyP: ACTION_PAUSE,
  Escape: ACTION_PAUSE,
  KeyR: ACTION_RESTART,
  KeyG: ACTION_GEAR,
  KeyF: ACTION_FLAPS,
  KeyM: ACTION_MUTE,
  Digit1: ACTION_MISSION_1,
  Digit2: ACTION_MISSION_2,
  Digit3: ACTION_MISSION_3,
  Numpad1: ACTION_MISSION_1,
  Numpad2: ACTION_MISSION_2,
  Numpad3: ACTION_MISSION_3,
};

/** Create the input state for a canvas; call `takeActions()` once per frame. */
export function createInput(canvas) {
  const keys = new Set();
  let queued = 0;
  let mouse = { x: 0, y: 0, down: false, dragging: false, dragDy: 0, clicked: false, clickX: 0, clickY: 0 };
  let lastDragY = 0;

  function onKeyDown(event) {
    if (event.repeat) return;
    keys.add(event.code);
    const action = KEY_ACTIONS[event.code];
    if (action) {
      queued |= action;
      event.preventDefault();
    }
    if (event.code === 'ArrowUp' || event.code === 'ArrowDown' || event.code === 'ArrowLeft' || event.code === 'ArrowRight') {
      event.preventDefault();
    }
  }

  function onKeyUp(event) {
    keys.delete(event.code);
  }

  function canvasPoint(event) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * 1280,
      y: ((event.clientY - rect.top) / rect.height) * 720,
    };
  }

  function onMouseDown(event) {
    const p = canvasPoint(event);
    mouse = { ...mouse, x: p.x, y: p.y, down: true, dragging: false, clicked: true, clickX: p.x, clickY: p.y };
    lastDragY = p.y;
  }

  function onMouseMove(event) {
    const p = canvasPoint(event);
    if (mouse.down) {
      mouse.dragging = true;
      mouse.dragDy += lastDragY - p.y;
    }
    mouse.x = p.x;
    mouse.y = p.y;
    lastDragY = p.y;
  }

  function onMouseUp() {
    mouse.down = false;
    mouse.dragging = false;
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  canvas.addEventListener('mousedown', onMouseDown);
  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('mouseup', onMouseUp);
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());

  function held(...codes) {
    return codes.some((code) => keys.has(code));
  }

  return {
    /** Pitch stick: 1 is nose up, -1 nose down, from keys or a mouse drag. */
    pitchStick() {
      let stick = 0;
      if (held('ArrowUp', 'KeyW')) stick += 1;
      if (held('ArrowDown', 'KeyS')) stick -= 1;
      if (mouse.dragging && Math.abs(mouse.dragDy) > 2) {
        stick += Math.max(-1, Math.min(1, mouse.dragDy / 60));
      }
      return Math.max(-1, Math.min(1, stick));
    },
    /** True while the airbrake key is held. */
    brakeHeld() {
      return held('Space');
    },
    /** Throttle keys: 1 to open, -1 to close, 0 when neither is held. */
    throttleKeys() {
      let delta = 0;
      if (held('ArrowRight', 'KeyD')) delta += 1;
      if (held('ArrowLeft', 'KeyA')) delta -= 1;
      return delta;
    },
    /** One-shot actions queued since the last call; the queue is cleared. */
    takeActions() {
      const actions = queued;
      queued = 0;
      return actions;
    },
    /** The latest mouse click (logical canvas coords), or null; consumed on read. */
    takeClick() {
      if (!mouse.clicked) return null;
      mouse.clicked = false;
      return { x: mouse.clickX, y: mouse.clickY };
    },
    /** Current mouse position in logical canvas coords. */
    mousePosition() {
      return { x: mouse.x, y: mouse.y };
    },
    /** True while the mouse button is held down on the canvas. */
    mouseDown() {
      return mouse.down;
    },
    /** Clear any drag accumulated so far (after the game has consumed it). */
    consumeDrag() {
      mouse.dragDy = 0;
    },
  };
}
