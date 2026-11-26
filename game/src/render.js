// Everything Kestrel Run paints: one sky, one valley, one aeroplane, all drawn in vector
// canvas code — no images, no fonts to load. The camera follows the plane sideways; the
// plane itself stays fixed on screen while the world scrolls past it.

import { FIELD, FONT, PALETTE, PLANE_SCREEN_X, SEA_LEVEL_Y } from './config.js';
import { BAY, RUNWAYS } from './world.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_BRIEFING = 'briefing';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_COMPLETE = 'complete';
export const SCREEN_OVER = 'over';

/** Create the renderer for a canvas; call `draw(view)` once per frame. */
export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const W = FIELD.width;
  const H = FIELD.height;

  function resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  resize();
  window.addEventListener('resize', resize);

  function drawSky(world, time) {
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, PALETTE.skyTop);
    sky.addColorStop(0.55, PALETTE.skyMid);
    sky.addColorStop(1, PALETTE.skyLow);
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);

    // Sun, high on the right, with a soft halo.
    const sunX = 1050;
    const sunY = 105;
    const glow = ctx.createRadialGradient(sunX, sunY, 10, sunX, sunY, 130);
    glow.addColorStop(0, PALETTE.sunGlow);
    glow.addColorStop(1, 'rgba(255, 214, 107, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(sunX - 140, sunY - 140, 280, 280);
    ctx.fillStyle = PALETTE.sun;
    ctx.beginPath();
    ctx.arc(sunX, sunY, 34, 0, Math.PI * 2);
    ctx.fill();

    // Far and near mountain ridges, parallaxed against the camera.
    drawRidge(world, 0.3, 300, 150, PALETTE.mountainFar);
    drawRidge(world, 0.55, 430, 110, PALETTE.mountainNear);

    // Clouds drift with the wind and parallax with depth.
    for (const cloud of world.clouds) {
      const span = W + 480;
      let sx = (cloud.x - world.cameraX() * cloud.depth) % span;
      if (sx < 0) sx += span;
      sx -= 240;
      drawCloud(sx, cloud.y, cloud.scale);
    }
    void time;
  }

  function drawRidge(world, parallax, baseY, amplitude, colour) {
    const cam = world.cameraX() * parallax;
    ctx.fillStyle = colour;
    ctx.beginPath();
    ctx.moveTo(0, H);
    for (let sx = 0; sx <= W; sx += 16) {
      const wx = cam + sx;
      const y = baseY + Math.sin(wx * 0.004) * amplitude * 0.5 + Math.sin(wx * 0.011 + 2) * amplitude * 0.3 + Math.sin(wx * 0.027 + 5) * amplitude * 0.2;
      ctx.lineTo(sx, y);
    }
    ctx.lineTo(W, H);
    ctx.closePath();
    ctx.fill();
  }

  function drawCloud(x, y, scale) {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.88)';
    ctx.beginPath();
    ctx.ellipse(x, y, 62 * scale, 20 * scale, 0, 0, Math.PI * 2);
    ctx.ellipse(x - 34 * scale, y + 8 * scale, 36 * scale, 15 * scale, 0, 0, Math.PI * 2);
    ctx.ellipse(x + 36 * scale, y + 8 * scale, 40 * scale, 16 * scale, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawTerrain(world) {
    const cam = world.cameraX();
    // Ground: one coloured strip per column, sand by the water, grass on the valley
    // floor, rock where the canyon walls climb.
    for (let sx = 0; sx < W; sx += 8) {
      const wx = cam + sx;
      const gy = world.terrainHeight(wx);
      let colour = PALETTE.hill;
      if (gy < 430) colour = PALETTE.rock;
      else if (gy > 620) colour = PALETTE.hillDark;
      if (world.isWater(wx)) colour = PALETTE.waterDeep;
      else if (gy > 628 && wx > BAY.from - 500 && wx < BAY.to + 500) colour = PALETTE.sand;
      ctx.fillStyle = colour;
      ctx.fillRect(sx, gy, 9, H - gy);
    }
    // Water surface over the bay and the canyon river, with a moving shimmer.
    const t = world.state.time;
    ctx.fillStyle = PALETTE.water;
    for (let sx = 0; sx < W; sx += 8) {
      const wx = cam + sx;
      if (!world.isWater(wx)) continue;
      const wave = Math.sin(wx * 0.05 + t * 2.2) * 2;
      ctx.fillRect(sx, SEA_LEVEL_Y + wave, 9, H - SEA_LEVEL_Y);
    }
    ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
    for (let sx = 0; sx < W; sx += 26) {
      const wx = cam + sx;
      if (!world.isWater(wx)) continue;
      ctx.fillRect(sx, SEA_LEVEL_Y + Math.sin(wx * 0.05 + t * 2.2) * 2, 14, 2);
    }
    // A darker grass line along the top edge of the ground.
    ctx.fillStyle = 'rgba(0, 0, 0, 0.18)';
    for (let sx = 0; sx < W; sx += 8) {
      const wx = cam + sx;
      if (world.isWater(wx)) continue;
      ctx.fillRect(sx, world.terrainHeight(wx), 9, 3);
    }
  }

  function drawRunways(world) {
    const cam = world.cameraX();
    for (const runway of RUNWAYS) {
      const x0 = runway.from - cam;
      const x1 = runway.to - cam;
      if (x1 < -50 || x0 > W + 50) continue;
      ctx.fillStyle = PALETTE.runway;
      ctx.fillRect(x0, runway.y, x1 - x0, 12);
      ctx.fillStyle = PALETTE.runwayLine;
      for (let x = x0 + 14; x < x1 - 10; x += 46) ctx.fillRect(x, runway.y + 5, 26, 2);
      ctx.fillStyle = PALETTE.text;
      ctx.font = `600 13px ${FONT}`;
      ctx.textAlign = 'left';
      ctx.fillText(runway.name, x0 + 8, runway.y - 8);
    }
  }

  function drawRings(world) {
    const cam = world.cameraX();
    for (const ring of world.rings) {
      const sx = ring.x - cam;
      if (sx < -120 || sx > W + 120) continue;
      ctx.save();
      ctx.translate(sx, ring.y);
      if (ring.passed) {
        ctx.strokeStyle = PALETTE.ringDone;
        ctx.globalAlpha = 0.75;
      } else {
        ctx.shadowColor = PALETTE.ringGlow;
        ctx.shadowBlur = 22;
        ctx.strokeStyle = PALETTE.ring;
      }
      ctx.lineWidth = 9;
      ctx.beginPath();
      ctx.arc(0, 0, ring.radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, ring.radius - 8, 0, Math.PI * 2);
      ctx.stroke();
      // Chevrons on the ring point the way through it.
      ctx.fillStyle = ring.passed ? PALETTE.ringDone : PALETTE.ring;
      ctx.beginPath();
      ctx.moveTo(-14, -ring.radius - 16);
      ctx.lineTo(0, -ring.radius - 2);
      ctx.lineTo(14, -ring.radius - 16);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
    // An arrow at the top of the screen points at the next ring when it is off-screen.
    const next = world.nextRing();
    if (next) {
      const sx = next.x - cam;
      if (sx < -40 || sx > W + 40) {
        const ax = Math.max(60, Math.min(W - 60, sx));
        const dir = sx < 0 ? -1 : 1;
        ctx.fillStyle = PALETTE.ring;
        ctx.beginPath();
        ctx.moveTo(ax + dir * 18, 96);
        ctx.lineTo(ax - dir * 10, 84);
        ctx.lineTo(ax - dir * 10, 108);
        ctx.closePath();
        ctx.fill();
        ctx.font = `700 13px ${FONT}`;
        ctx.textAlign = 'center';
        // Keep the label inside the frame even when the arrow sits at the edge.
        const labelX = Math.max(110, Math.min(W - 110, ax));
        ctx.fillText(`NEXT RING ${Math.round(Math.abs(next.x - world.state.x) * 3 / 10) * 10} FT`, labelX, 128);
      }
    }
  }

  /** The Kestrel itself: a cream-and-red high-wing propeller aeroplane, drawn in vectors. */
  function drawPlane(world) {
    const s = world.state;
    const px = PLANE_SCREEN_X;
    const py = s.y;
    ctx.save();
    ctx.translate(px, py);
    if (s.crashed) {
      ctx.rotate(0.42);
    } else {
      // Canvas rotation is clockwise-positive; pitch is climb-positive, so negate it.
      ctx.rotate(-(s.pitch * Math.PI) / 180);
    }
    // Damage smoke trails from the engine when the airframe is hurt.
    if (s.damage > 25 && !s.crashed) {
      for (let i = 0; i < 3; i += 1) {
        const age = (s.time * 2 + i * 0.33) % 1;
        ctx.fillStyle = `rgba(60, 60, 60, ${0.5 * (1 - age)})`;
        ctx.beginPath();
        ctx.arc(-46 - age * 46, -6 - age * 14, 5 + age * 9, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    // Main wing (low wing) and tailplane.
    ctx.fillStyle = PALETTE.planeRed;
    ctx.beginPath();
    ctx.ellipse(-2, 10, 34, 7, -0.12, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = PALETTE.planeDark;
    ctx.beginPath();
    ctx.ellipse(-42, -2, 20, 4, 0.25, 0, Math.PI * 2);
    ctx.fill();
    // Tail fin.
    ctx.fillStyle = PALETTE.planeRed;
    ctx.beginPath();
    ctx.moveTo(-46, -2);
    ctx.lineTo(-58, -24);
    ctx.lineTo(-44, -22);
    ctx.lineTo(-36, -2);
    ctx.closePath();
    ctx.fill();
    // Fuselage: a long rounded body, cream with a red cheatline.
    ctx.fillStyle = PALETTE.planeCream;
    ctx.beginPath();
    ctx.moveTo(-58, -4);
    ctx.quadraticCurveTo(-30, -16, 6, -13);
    ctx.quadraticCurveTo(38, -11, 52, -3);
    ctx.quadraticCurveTo(54, 2, 46, 5);
    ctx.quadraticCurveTo(10, 12, -30, 10);
    ctx.quadraticCurveTo(-54, 8, -58, -4);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = PALETTE.planeRed;
    ctx.fillRect(-52, 1, 96, 4);
    // Canopy.
    ctx.fillStyle = '#9fd4ef';
    ctx.beginPath();
    ctx.ellipse(14, -11, 13, 7, -0.15, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = PALETTE.planeDark;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    // Landing gear.
    if (s.gearDown) {
      ctx.strokeStyle = PALETTE.planeDark;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(-8, 10);
      ctx.lineTo(-12, 24);
      ctx.moveTo(22, 9);
      ctx.lineTo(26, 24);
      ctx.stroke();
      ctx.fillStyle = '#1c1e22';
      ctx.beginPath();
      ctx.arc(-12, 26, 6, 0, Math.PI * 2);
      ctx.arc(26, 26, 6, 0, Math.PI * 2);
      ctx.fill();
    }
    // Propeller: two blades spinning at a rate tied to the throttle, plus the spinner.
    const spin = s.time * (6 + s.throttle * 42);
    ctx.save();
    ctx.translate(52, -3);
    ctx.rotate(spin);
    ctx.fillStyle = 'rgba(44, 47, 54, 0.75)';
    ctx.beginPath();
    ctx.ellipse(0, -16, 3.5, 16, 0, 0, Math.PI * 2);
    ctx.ellipse(0, 16, 3.5, 16, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = PALETTE.planeRed;
    ctx.beginPath();
    ctx.arc(52, -3, 5, 0, Math.PI * 2);
    ctx.fill();
    // Navigation lights: red on the left wingtip, green on the right, blinking.
    const blink = Math.floor(s.time * 1.6) % 2 === 0;
    if (blink) {
      ctx.fillStyle = '#ff4d4d';
      ctx.beginPath();
      ctx.arc(-34, 12, 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#4dff88';
      ctx.beginPath();
      ctx.arc(30, 8, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    // Crash fire glow on the ground.
    if (s.crashed) {
      const glow = ctx.createRadialGradient(px, py + 10, 4, px, py + 10, 70);
      glow.addColorStop(0, 'rgba(255, 120, 40, 0.55)');
      glow.addColorStop(1, 'rgba(255, 120, 40, 0)');
      ctx.fillStyle = glow;
      ctx.fillRect(px - 80, py - 60, 160, 140);
    }
  }

  function panel(x, y, w, h, radius = 10) {
    ctx.fillStyle = PALETTE.panel;
    ctx.strokeStyle = PALETTE.panelEdge;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, radius);
    ctx.fill();
    ctx.stroke();
  }

  function centreText(text, y, size, colour, weight = 700) {
    ctx.fillStyle = colour;
    ctx.font = `${weight} ${size}px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, W / 2, y);
  }

  function drawTitle(view) {
    ctx.fillStyle = 'rgba(8, 16, 26, 0.45)';
    ctx.fillRect(0, 0, W, H);
    centreText('KESTREL RUN', 150, 72, PALETTE.text, 800);
    centreText('A PROPELLER SORTIE IN THREE FLIGHTS', 196, 19, PALETTE.cyan, 600);
    panel(W / 2 - 330, 236, 660, 250);
    ctx.textAlign = 'left';
    ctx.fillStyle = PALETTE.text;
    ctx.font = `700 20px ${FONT}`;
    ctx.fillText('CHOOSE YOUR SORTIE — PRESS 1, 2 OR 3, OR CLICK', W / 2 - 300, 268);
    const missions = view.missions;
    missions.forEach((mission, i) => {
      const y = 306 + i * 52;
      ctx.fillStyle = PALETTE.amber;
      ctx.font = `800 22px ${FONT}`;
      ctx.fillText(`${i + 1}`, W / 2 - 300, y);
      ctx.fillStyle = PALETTE.text;
      ctx.font = `700 20px ${FONT}`;
      ctx.fillText(mission.name, W / 2 - 268, y);
      ctx.fillStyle = PALETTE.textDim;
      ctx.font = `400 15px ${FONT}`;
      ctx.fillText(mission.brief, W / 2 - 268, y + 20);
    });
    centreText('W/S or Up/Down pitch   •   A/D or Left/Right throttle   •   SPACE airbrake   •   G gear   •   P pause   •   M mute', 522, 16, PALETTE.textDim, 600);
    centreText('Mouse: drag the sky to pitch, click the throttle buttons to work the engine', 548, 16, PALETTE.textDim, 600);
    if (view.best > 0) centreText(`BEST SCORE  ${view.best}`, 592, 18, PALETTE.green, 700);
    centreText('Press ENTER or click to fly Sortie 1', 578, 18, PALETTE.amber, 700);
  }

  function drawBriefing(view) {
    const m = view.mission;
    ctx.fillStyle = 'rgba(8, 16, 26, 0.55)';
    ctx.fillRect(0, 0, W, H);
    panel(W / 2 - 360, 150, 720, 380);
    centreText(m.name, 200, 34, PALETTE.text, 800);
    ctx.fillStyle = PALETTE.textDim;
    ctx.font = `400 18px ${FONT}`;
    ctx.textAlign = 'center';
    wrapText(m.brief, W / 2, 248, 620, 26);
    centreText(`OBJECTIVE: ${m.objective}`, 320, 20, PALETTE.amber, 700);
    if (m.timeLimit > 0) centreText(`TIME LIMIT: ${m.timeLimit} SECONDS`, 352, 18, PALETTE.red, 700);
    centreText('Fuel burns with throttle — mind the gauge. The ground is not forgiving.', 392, 16, PALETTE.textDim, 600);
    centreText('Press ENTER or click to take off', 470, 20, PALETTE.green, 700);
    centreText('ESC returns to the mission list', 500, 15, PALETTE.textDim, 600);
  }

  function wrapText(text, cx, y, maxWidth, lineHeight) {
    const words = text.split(' ');
    const lines = [''];
    for (const word of words) {
      const test = lines[lines.length - 1] ? `${lines[lines.length - 1]} ${word}` : word;
      if (ctx.measureText(test).width > maxWidth && lines[lines.length - 1]) lines.push(word);
      else lines[lines.length - 1] = test;
    }
    lines.forEach((line, i) => ctx.fillText(line, cx, y + i * lineHeight));
  }

  function drawPaused() {
    ctx.fillStyle = 'rgba(8, 16, 26, 0.6)';
    ctx.fillRect(0, 0, W, H);
    centreText('PAUSED', 330, 54, PALETTE.text, 800);
    centreText('P or ESC to keep flying   •   R to restart the sortie', 390, 18, PALETTE.textDim, 600);
  }

  function drawComplete(view) {
    const s = view.world.state;
    ctx.fillStyle = 'rgba(8, 20, 12, 0.55)';
    ctx.fillRect(0, 0, W, H);
    panel(W / 2 - 300, 190, 600, 300);
    centreText('MISSION COMPLETE', 240, 40, PALETTE.green, 800);
    centreText(view.world.mission.name, 286, 19, PALETTE.textDim, 600);
    centreText(`SCORE  ${Math.round(s.score)}`, 340, 30, PALETTE.text, 800);
    ctx.fillStyle = PALETTE.textDim;
    ctx.font = `400 17px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText(`Rings threaded: ${s.ringsPassed}    •    Fuel left: ${Math.round(s.fuel)}%    •    Damage: ${Math.round(s.damage)}%`, W / 2, 386);
    if (view.best > 0) centreText(`BEST SCORE  ${view.best}`, 424, 17, PALETTE.green, 700);
    centreText('Press ENTER for the next sortie, or 1 / 2 / 3 to pick one', 458, 17, PALETTE.amber, 700);
  }

  function drawOver(view) {
    const s = view.world.state;
    ctx.fillStyle = 'rgba(26, 8, 8, 0.55)';
    ctx.fillRect(0, 0, W, H);
    panel(W / 2 - 300, 190, 600, 300);
    centreText('SORTIE OVER', 240, 40, PALETTE.red, 800);
    centreText(s.crashReason || 'The sortie ended.', 292, 20, PALETTE.text, 600);
    centreText(`SCORE  ${Math.round(s.score)}`, 344, 30, PALETTE.text, 800);
    ctx.fillStyle = PALETTE.textDim;
    ctx.font = `400 17px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText(`Rings threaded: ${s.ringsPassed}    •    Distance flown: ${Math.round(s.distanceFlown * 3 / 10) * 10} ft`, W / 2, 390);
    if (view.best > 0) centreText(`BEST SCORE  ${view.best}`, 428, 17, PALETTE.green, 700);
    centreText('Press R or ENTER to fly again', 462, 18, PALETTE.amber, 700);
  }

  /** Paint one frame. `view` carries the world, the screen name, the best score and extras. */
  function draw(view) {
    const world = view.world;
    const s = world.state;
    ctx.clearRect(0, 0, W, H);
    drawSky(world, s.time);
    drawTerrain(world);
    drawRunways(world);
    drawRings(world);
    drawPlane(world);
    if (view.screen === SCREEN_TITLE) drawTitle(view);
    else if (view.screen === SCREEN_BRIEFING) drawBriefing(view);
    else if (view.screen === SCREEN_PAUSED) drawPaused();
    else if (view.screen === SCREEN_COMPLETE) drawComplete(view);
    else if (view.screen === SCREEN_OVER) drawOver(view);
    if (view.flash) {
      ctx.fillStyle = PALETTE.amber;
      ctx.font = `800 26px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillText(view.flash, W / 2, 120);
    }
  }

  return { draw, SCREEN_TITLE, SCREEN_BRIEFING, SCREEN_PLAY, SCREEN_PAUSED, SCREEN_COMPLETE, SCREEN_OVER };
}
