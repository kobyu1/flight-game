// The instrument panel: altitude, airspeed, a compass strip, throttle, fuel, damage, score
// and the sortie objective, drawn as lit glass panels over the chase view, plus a small
// attitude indicator and clickable throttle, gear and flap buttons for the mouse pilot.

import { FIELD, FONT, PALETTE, PLANE } from './config.js';
import { airspeedKnots, headingDegrees } from './aircraft.js';

const W = FIELD.width;
const H = FIELD.height;

/** The clickable buttons, in logical canvas coords; main.js asks `hitButton(x, y)`. */
export const HUD_BUTTONS = {
  throttleDown: { x: 960, y: 652, w: 70, h: 52, label: 'THR −' },
  throttleUp: { x: 1040, y: 652, w: 70, h: 52, label: 'THR +' },
  gear: { x: 1120, y: 652, w: 70, h: 52, label: 'GEAR' },
  flaps: { x: 1200, y: 652, w: 72, h: 52, label: 'FLAP' },
};

/** Which button, if any, contains the logical point (x, y). */
export function hitHudButton(x, y) {
  for (const [name, b] of Object.entries(HUD_BUTTONS)) {
    if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return name;
  }
  return null;
}

/** Create the HUD; call `draw(ctx, world, view)` after the world is painted. */
export function createHud() {
  function panel(ctx, x, y, w, h) {
    ctx.fillStyle = PALETTE.panel;
    ctx.strokeStyle = PALETTE.panelEdge;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 9);
    ctx.fill();
    ctx.stroke();
  }

  function label(ctx, text, x, y) {
    ctx.fillStyle = PALETTE.textDim;
    ctx.font = `700 11px ${FONT}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(text, x, y);
  }

  function value(ctx, text, x, y, colour = PALETTE.text, size = 26) {
    ctx.fillStyle = colour;
    ctx.font = `800 ${size}px ${FONT}`;
    ctx.textAlign = 'left';
    ctx.fillText(text, x, y);
  }

  function bar(ctx, x, y, w, h, fraction, colour, bg = 'rgba(255,255,255,0.14)') {
    ctx.fillStyle = bg;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 4);
    ctx.fill();
    ctx.fillStyle = colour;
    ctx.beginPath();
    ctx.roundRect(x, y, Math.max(0, Math.min(1, fraction)) * w, h, 4);
    ctx.fill();
  }

  /** The compass strip: a moving tape of headings with the current one centred. */
  function drawCompass(ctx, heading) {
    const x = 330;
    const y = 8;
    const w = 300;
    const h = 56;
    panel(ctx, x, y, w, h);
    label(ctx, 'HDG', x + 10, y + 16);
    ctx.save();
    ctx.beginPath();
    ctx.rect(x + 6, y + 20, w - 12, 30);
    ctx.clip();
    const pxPerDegree = 2.4;
    const centre = x + w / 2;
    for (let d = -75; d <= 75; d += 5) {
      const deg = Math.round((heading + d + 360) % 360);
      const sx = centre + d * pxPerDegree;
      const major = deg % 30 === 0;
      ctx.strokeStyle = major ? PALETTE.text : PALETTE.textDim;
      ctx.lineWidth = major ? 2 : 1;
      ctx.beginPath();
      ctx.moveTo(sx, y + 44);
      ctx.lineTo(sx, y + (major ? 28 : 36));
      ctx.stroke();
      if (major) {
        const name = deg === 0 ? 'N' : deg === 90 ? 'E' : deg === 180 ? 'S' : deg === 270 ? 'W' : String(deg).padStart(3, '0');
        ctx.fillStyle = PALETTE.text;
        ctx.font = `700 12px ${FONT}`;
        ctx.textAlign = 'center';
        ctx.fillText(name, sx, y + 26);
      }
    }
    ctx.restore();
    // Centre caret and the digital heading.
    ctx.fillStyle = PALETTE.amber;
    ctx.beginPath();
    ctx.moveTo(centre, y + 18);
    ctx.lineTo(centre - 6, y + 10);
    ctx.lineTo(centre + 6, y + 10);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = PALETTE.amber;
    ctx.font = `800 15px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText(`${String(Math.round(heading)).padStart(3, '0')}°`, centre, y + 60 - 4);
  }

  /** The attitude indicator: a little ball that rolls and pitches with the aeroplane. */
  function drawAttitude(ctx, state) {
    const cx = 62;
    const cy = 648;
    const r = 46;
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.clip();
    ctx.translate(cx, cy);
    // No roll in this game, so the horizon only slides: climbing (pitch up) pushes the
    // horizon line down in the glass and shows more sky.
    ctx.translate(0, state.pitch * 1.1);
    ctx.fillStyle = '#5fa8dd';
    ctx.fillRect(-r, -r, r * 2, r);
    ctx.fillStyle = '#7a5a34';
    ctx.fillRect(-r, 0, r * 2, r);
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.fillRect(-r, -1, r * 2, 2);
    ctx.restore();
    ctx.strokeStyle = PALETTE.panelEdge;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.stroke();
    // Fixed wings marker.
    ctx.strokeStyle = PALETTE.amber;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(cx - 26, cy);
    ctx.lineTo(cx - 8, cy);
    ctx.moveTo(cx + 8, cy);
    ctx.lineTo(cx + 26, cy);
    ctx.stroke();
    ctx.fillStyle = PALETTE.textDim;
    ctx.font = `700 11px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText('ATTITUDE', cx, cy + r + 14);
  }

  function drawButtons(ctx, state, muted) {
    for (const [name, b] of Object.entries(HUD_BUTTONS)) {
      const active =
        (name === 'gear' && state.gearDown) ||
        (name === 'flaps' && state.flaps);
      ctx.fillStyle = active ? 'rgba(255, 179, 71, 0.35)' : PALETTE.panel;
      ctx.strokeStyle = active ? PALETTE.amber : PALETTE.panelEdge;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(b.x, b.y, b.w, b.h, 9);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = active ? PALETTE.amber : PALETTE.text;
      ctx.font = `800 15px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(b.label, b.x + b.w / 2, b.y + b.h / 2 - 6);
      const sub =
        name === 'gear' ? (state.gearDown ? 'DOWN' : 'UP')
        : name === 'flaps' ? (state.flaps ? 'OUT' : 'IN')
        : name === 'throttleDown' ? '−10%'
        : '+10%';
      ctx.fillStyle = PALETTE.textDim;
      ctx.font = `700 10px ${FONT}`;
      ctx.fillText(sub, b.x + b.w / 2, b.y + b.h - 12);
    }
    ctx.textBaseline = 'alphabetic';
    // Mute state, bottom centre-right, so the pilot can see it at a glance.
    ctx.fillStyle = muted ? PALETTE.red : PALETTE.textDim;
    ctx.font = `700 12px ${FONT}`;
    ctx.textAlign = 'right';
    ctx.fillText(muted ? 'SOUND OFF  (M)' : 'SOUND ON  (M)', 940, 688);
  }

  /** Paint the instruments over the world. `view` carries `muted` and the flash message. */
  function draw(ctx, world, view) {
    const s = world.state;
    const heading = headingDegrees(s);
    const knots = airspeedKnots(s);

    // Top instrument bar.
    panel(ctx, 8, 8, 150, 56);
    label(ctx, 'ALT — FEET AGL', 18, 24);
    value(ctx, `${world.altitudeFeet()}`, 18, 52, s.y > 620 && !s.onGround ? PALETTE.red : PALETTE.text);
    ctx.fillStyle = PALETTE.textDim;
    ctx.font = `700 12px ${FONT}`;
    ctx.fillText('FT', 96, 52);

    panel(ctx, 166, 8, 150, 56);
    label(ctx, 'AIRSPEED', 176, 24);
    const stall = s.vx < PLANE.stallSpeed && !s.onGround;
    value(ctx, `${knots}`, 176, 52, stall ? PALETTE.red : PALETTE.text);
    ctx.fillStyle = PALETTE.textDim;
    ctx.font = `700 12px ${FONT}`;
    ctx.fillText('KT', 244, 52);

    drawCompass(ctx, heading);

    panel(ctx, 638, 8, 120, 56);
    label(ctx, 'THROTTLE', 648, 24);
    value(ctx, `${Math.round(s.throttle * 100)}`, 648, 52, PALETTE.cyan);
    ctx.fillStyle = PALETTE.textDim;
    ctx.font = `700 12px ${FONT}`;
    ctx.fillText('%', 700, 52);
    bar(ctx, 648, 56, 100, 5, s.throttle, PALETTE.cyan);

    panel(ctx, 766, 8, 150, 56);
    label(ctx, 'FUEL', 776, 24);
    const lowFuel = s.fuel < 20;
    value(ctx, `${Math.round(s.fuel)}`, 776, 52, lowFuel ? PALETTE.red : PALETTE.green, 22);
    ctx.fillStyle = PALETTE.textDim;
    ctx.font = `700 12px ${FONT}`;
    ctx.fillText('%', 812, 50);
    bar(ctx, 826, 32, 78, 12, s.fuel / 100, lowFuel ? PALETTE.red : PALETTE.green);

    panel(ctx, 924, 8, 118, 56);
    label(ctx, 'DAMAGE', 934, 24);
    value(ctx, `${Math.round(s.damage)}`, 934, 52, s.damage > 60 ? PALETTE.red : s.damage > 25 ? PALETTE.amber : PALETTE.text, 22);
    ctx.fillStyle = PALETTE.textDim;
    ctx.font = `700 12px ${FONT}`;
    ctx.fillText('%', 972, 50);
    bar(ctx, 982, 32, 48, 12, s.damage / 100, s.damage > 60 ? PALETTE.red : PALETTE.amber);

    panel(ctx, 1050, 8, 222, 56);
    label(ctx, 'SCORE', 1060, 24);
    value(ctx, `${Math.round(s.score)}`, 1060, 52, PALETTE.amber);
    ctx.fillStyle = PALETTE.textDim;
    ctx.font = `700 12px ${FONT}`;
    ctx.textAlign = 'right';
    ctx.fillText(`RINGS ${s.ringsPassed}/${s.mission.rings}`, 1262, 24);
    ctx.textAlign = 'left';

    // Objective strip under the bar.
    ctx.fillStyle = 'rgba(12, 20, 30, 0.6)';
    ctx.beginPath();
    ctx.roundRect(8, 72, 560, 26, 8);
    ctx.fill();
    ctx.fillStyle = PALETTE.amber;
    ctx.font = `700 14px ${FONT}`;
    ctx.textAlign = 'left';
    const next = world.nextRing();
    const ringNote = next ? `  •  next ring ${Math.round(Math.abs(next.x - s.x) * 3 / 10) * 10} ft ahead` : '';
    ctx.fillText(`${s.mission.name}  —  ${s.mission.objective}${ringNote}`, 18, 90);

    // Timer for the canyon dash.
    if (s.mission.timeLimit > 0 && !s.complete) {
      ctx.fillStyle = s.timeLeft < 15 ? PALETTE.red : PALETTE.text;
      ctx.font = `800 22px ${FONT}`;
      ctx.textAlign = 'right';
      ctx.fillText(`TIME ${Math.ceil(s.timeLeft)} s`, 1262, 92);
      ctx.textAlign = 'left';
    }

    // Stall and low-fuel warnings, flashing.
    const blink = Math.floor(s.time * 3) % 2 === 0;
    if (stall && blink) {
      ctx.fillStyle = PALETTE.red;
      ctx.font = `800 26px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillText('STALL — NOSE DOWN, POWER UP', W / 2, 150);
    }
    if (lowFuel && !s.complete && blink) {
      ctx.fillStyle = PALETTE.red;
      ctx.font = `800 20px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillText('LOW FUEL', W / 2, 178);
    }
    ctx.textAlign = 'left';

    drawAttitude(ctx, s);
    drawButtons(ctx, s, view.muted);
  }

  return { draw };
}
