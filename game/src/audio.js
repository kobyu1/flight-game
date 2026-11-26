// Every sound Kestrel Run makes is synthesised with WebAudio — no audio files. The engine
// is a sawtooth hum whose pitch and loudness follow the throttle, and the events (ring,
// scrape, crash, landing) are short tones and noise bursts. Nothing starts until the pilot
// has interacted, and M toggles the mute.

/** Create the sound engine; call `ensure()` from a user gesture before playing. */
export function createAudio() {
  let context = null;
  let engineOsc = null;
  let engineOsc2 = null;
  let engineGain = null;
  let engineFilter = null;
  let muted = false;
  let started = false;

  function ensure() {
    if (context) {
      if (context.state === 'suspended') context.resume();
      return true;
    }
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return false;
      context = new AudioContext();
    } catch {
      return false;
    }
    // Engine hum: two detuned saws through a low-pass filter, gain tied to throttle.
    engineOsc = context.createOscillator();
    engineOsc.type = 'sawtooth';
    engineOsc.frequency.value = 52;
    engineOsc2 = context.createOscillator();
    engineOsc2.type = 'sawtooth';
    engineOsc2.frequency.value = 55;
    engineFilter = context.createBiquadFilter();
    engineFilter.type = 'lowpass';
    engineFilter.frequency.value = 320;
    engineGain = context.createGain();
    engineGain.gain.value = 0;
    engineOsc.connect(engineFilter);
    engineOsc2.connect(engineFilter);
    engineFilter.connect(engineGain);
    engineGain.connect(context.destination);
    engineOsc.start();
    engineOsc2.start();
    started = true;
    return true;
  }

  /** Follow the throttle (0..1) and whether the engine is running. */
  function setEngine(throttle, running) {
    if (!started || muted) return;
    const now = context.currentTime;
    const target = running ? 0.02 + throttle * 0.075 : 0;
    engineGain.gain.setTargetAtTime(target, now, 0.08);
    engineOsc.frequency.setTargetAtTime(46 + throttle * 62, now, 0.1);
    engineOsc2.frequency.setTargetAtTime(49 + throttle * 66, now, 0.1);
    engineFilter.frequency.setTargetAtTime(240 + throttle * 620, now, 0.1);
  }

  function tone(frequency, duration, type, volume, when = 0, slideTo = null) {
    if (!context || muted) return;
    const now = context.currentTime + when;
    const osc = context.createOscillator();
    const gain = context.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(frequency, now);
    if (slideTo !== null) osc.frequency.exponentialRampToValueAtTime(slideTo, now + duration);
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(volume, now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.connect(gain);
    gain.connect(context.destination);
    osc.start(now);
    osc.stop(now + duration + 0.05);
  }

  function noiseBurst(duration, volume, lowpass) {
    if (!context || muted) return;
    const now = context.currentTime;
    const length = Math.floor(context.sampleRate * duration);
    const buffer = context.createBuffer(1, length, context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / length);
    const source = context.createBufferSource();
    source.buffer = buffer;
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = lowpass;
    const gain = context.createGain();
    gain.gain.value = volume;
    source.connect(filter);
    filter.connect(gain);
    gain.connect(context.destination);
    source.start(now);
  }

  return {
    ensure,
    setEngine,
    /** A bright two-note chime when a ring is threaded. */
    ringChime() {
      tone(880, 0.18, 'sine', 0.22);
      tone(1318, 0.3, 'sine', 0.2, 0.09);
    },
    /** A dull thud when the airframe scrapes the ground. */
    scrapeThud() {
      tone(90, 0.22, 'sine', 0.4, 0, 45);
      noiseBurst(0.15, 0.25, 500);
    },
    /** A low crash: falling tone plus a noise burst. */
    crashThud() {
      tone(70, 0.7, 'sine', 0.5, 0, 30);
      noiseBurst(0.5, 0.5, 900);
    },
    /** A short landing jingle: three rising notes. */
    landingJingle() {
      tone(523, 0.16, 'triangle', 0.25);
      tone(659, 0.16, 'triangle', 0.25, 0.13);
      tone(784, 0.34, 'triangle', 0.28, 0.26);
    },
    /** A soft click for a button or a menu move. */
    click() {
      tone(1200, 0.05, 'square', 0.08);
    },
    /** Toggle the mute; returns the new muted state. */
    toggleMute() {
      muted = !muted;
      if (engineGain && context) engineGain.gain.setTargetAtTime(0, context.currentTime, 0.02);
      return muted;
    },
    isMuted() {
      return muted;
    },
  };
}
