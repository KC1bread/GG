/**
 * EngineAudio — procedural spacecraft engine sound via Web Audio API.
 *
 * Creates a rich, layered engine rumble whose pitch and volume track
 * the ship's current speed.  No external audio files required.
 *
 * Usage:
 *   const engine = new EngineAudio();
 *   engine.init();               // must be called from a user-gesture handler
 *   engine.update(speedRatio);   // 0 = idle, 1 = full throttle
 */

export class EngineAudio {
  constructor() {
    this.ctx = null;           // AudioContext — created on first init()
    this.initialised = false;

    // Oscillator & gain nodes
    this.osc1 = null;          // main rumble (sawtooth)
    this.osc2 = null;          // sub-bass (triangle)
    this.gain1 = null;
    this.gain2 = null;
    this.masterGain = null;   // master volume control
    this.filter = null;        // low-pass filter for warmth

    this._targetFreq = 55;    // Hz at idle
    this._currentFreq = 55;
    this._targetGain = 0;
    this._currentGain = 0;
  }

  /**
   * Create the AudioContext and node graph.  MUST be called inside a
   * user-gesture event (click / keydown) to satisfy browser autoplay policy.
   */
  init() {
    if (this.initialised) return;

    try {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    } catch (_) {
      console.warn('EngineAudio: Web Audio API not available');
      return;
    }

    // ---- Node graph -----------------------------------------------------------
    // osc1 ──→ gain1 ──┐
    // osc2 ──→ gain2 ──┤──→ filter ──→ masterGain ──→ destination
    //                   └──→ gain1.connect(filter) manually

    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 0;
    this.masterGain.connect(this.ctx.destination);

    this.filter = this.ctx.createBiquadFilter();
    this.filter.type = 'lowpass';
    this.filter.frequency.value = 600;
    this.filter.Q.value = 1.8;
    this.filter.connect(this.masterGain);

    // Main rumble — sawtooth gives a gritty engine timbre
    this.osc1 = this.ctx.createOscillator();
    this.osc1.type = 'sawtooth';
    this.osc1.frequency.value = 55;

    this.gain1 = this.ctx.createGain();
    this.gain1.gain.value = 0.12;
    this.osc1.connect(this.gain1);
    this.gain1.connect(this.filter);

    // Sub-bass layer — triangle wave adds weight at low end
    this.osc2 = this.ctx.createOscillator();
    this.osc2.type = 'triangle';
    this.osc2.frequency.value = 27.5;  // half of main

    this.gain2 = this.ctx.createGain();
    this.gain2.gain.value = 0.15;
    this.osc2.connect(this.gain2);
    this.gain2.connect(this.filter);

    // Start oscillators — they run continuously, we control volume
    this.osc1.start();
    this.osc2.start();

    this.initialised = true;
  }

  /**
   * Update engine sound to match the current speed.
   *
   * @param {number} speedRatio — 0 (stopped) … 1 (full β = 0.99)
   * @param {boolean} thrusting — whether the player is actively holding forward
   */
  update(speedRatio, thrusting) {
    if (!this.initialised) return;

    // Map speed ratio to frequency: idle 55 Hz → max 320 Hz
    this._targetFreq = 55 + speedRatio * 265;
    // Also raise the filter cutoff so high frequencies come through at speed
    const filterFreq = 400 + speedRatio * 1200;

    // Master volume — quiet at idle, loud at full throttle
    // Scale: 0 at 0, 0.08 at idle thrust, 0.18 at full speed
    this._targetGain = speedRatio * 0.15 + (thrusting ? 0.04 : 0);

    // Smooth transitions to avoid clicks
    const lerp = 0.12;
    this._currentFreq += (this._targetFreq - this._currentFreq) * lerp;
    this._currentGain += (this._targetGain - this._currentGain) * lerp;

    this.osc1.frequency.value = this._currentFreq;
    this.osc2.frequency.value = this._currentFreq * 0.5;
    this.filter.frequency.value = filterFreq;
    this.masterGain.gain.value = Math.max(0, this._currentGain);
  }

  /** Mute immediately — call on pause */
  mute() {
    if (this.masterGain) this.masterGain.gain.value = 0;
    this._currentGain = 0;
    this._targetGain = 0;
  }

  /** Full teardown */
  dispose() {
    if (this.osc1) { try { this.osc1.stop(); } catch (_) { /* already stopped */ } }
    if (this.osc2) { try { this.osc2.stop(); } catch (_) { /* already stopped */ } }
    if (this.ctx)  { this.ctx.close(); }
    this.initialised = false;
  }
}
