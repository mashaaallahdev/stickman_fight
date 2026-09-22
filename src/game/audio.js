// Loud, Attractive Arcade Sound Engine Themed like 'Double Dragon'
// Features high-energy FM synth battle music, loud crunching hits, and retro speech synthesizer.

export class SoundEngine {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.sfxGain = null;
    this.bgmGain = null;
    this.compressor = null;
    this.streamDest = null;
    this.bgmInterval = null;
    this.bgmStep = 0;
    this.isSlowMotion = false;
    this.tempo = 124;
    this.currentTrack = 'HALAL_DUFF';
    this.duffInterval = null;
    this.duffStep = 0;
    this.ambientWindSource = null;
    this.ambientWindGain = null;
    this.crowdMurmurSource = null;
    this.crowdMurmurGain = null;
    this.tensionLevel = 0;
    this.lastHeartbeatTime = 0;
  }

  init() {
    if (this.ctx) return;
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    this.ctx = new AudioContext();

    // Master Dynamics Compressor for loud, punchy arcade cabinet sound without distortion
    this.compressor = this.ctx.createDynamicsCompressor();
    this.compressor.threshold.setValueAtTime(-12, this.ctx.currentTime);
    this.compressor.knee.setValueAtTime(8, this.ctx.currentTime);
    this.compressor.ratio.setValueAtTime(6, this.ctx.currentTime);
    this.compressor.attack.setValueAtTime(0.003, this.ctx.currentTime);
    this.compressor.release.setValueAtTime(0.15, this.ctx.currentTime);

    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.setValueAtTime(1.2, this.ctx.currentTime);

    this.sfxGain = this.ctx.createGain();
    this.sfxGain.gain.setValueAtTime(2.6, this.ctx.currentTime);
    this.sfxGain.connect(this.compressor);

    this.bgmGain = this.ctx.createGain();
    this.bgmGain.gain.setValueAtTime(0.85, this.ctx.currentTime); // Halal acoustic background sound
    this.bgmGain.connect(this.compressor);

    this.compressor.connect(this.masterGain);

    // Audio stream destination for video capture
    this.streamDest = this.ctx.createMediaStreamDestination();
    this.masterGain.connect(this.streamDest);
    this.masterGain.connect(this.ctx.destination);

    // Silent primer: force AudioContext to actually start outputting frames.
    // Without this, Chrome headless may create the context in a 'running'
    // state but not produce real audio frames for the MediaRecorder.
    const primer = this.ctx.createOscillator();
    const primerGain = this.ctx.createGain();
    primerGain.gain.setValueAtTime(0.0001, this.ctx.currentTime); // inaudible
    primer.connect(primerGain);
    primerGain.connect(this.ctx.destination);
    primer.start(this.ctx.currentTime);
    primer.stop(this.ctx.currentTime + 0.1);
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') {
      return this.ctx.resume().catch(() => {});
    }
    return Promise.resolve();
  }

  getMediaStreamTrack() {
    if (!this.ctx) this.init();
    return this.streamDest.stream.getAudioTracks()[0];
  }

  _ensureAudio() {
    if (!this.ctx) this.init();
    // Aggressively force audio context to resume every time we play a sound
    if (this.ctx && this.ctx.state !== 'running') {
      this.ctx.resume().catch(() => {});
    }
  }

  // --- Double Dragon Loud Arcade SFX ---

  playWhoosh(speed = 1.0) {
    this._ensureAudio();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const dur = 0.16 / speed;

    const osc = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(780, now);
    osc.frequency.exponentialRampToValueAtTime(120, now + dur);

    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1400, now);
    filter.Q.setValueAtTime(3.5, now);

    gain.gain.setValueAtTime(0.7, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + dur);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);

    osc.start(now);
    osc.stop(now + dur);
  }

  // Loud Punch Sound (Crisp snap + deep bone impact)
  playPunch(type = 'light') {
    this._ensureAudio();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const isHeavy = type === 'heavy' || type === 'super';
    const dur = isHeavy ? 0.32 : 0.15;

    // 1. High transient crack / knuckle pop
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(isHeavy ? 420 : 540, now);
    osc.frequency.exponentialRampToValueAtTime(isHeavy ? 45 : 75, now + dur);

    gain.gain.setValueAtTime(isHeavy ? 1.0 : 0.85, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + dur);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + dur);

    // 2. Heavy blunt chest/rib thud
    const sub = this.ctx.createOscillator();
    const subGain = this.ctx.createGain();
    sub.type = 'sawtooth';
    sub.frequency.setValueAtTime(isHeavy ? 160 : 120, now);
    sub.frequency.exponentialRampToValueAtTime(25, now + (isHeavy ? 0.28 : 0.12));
    subGain.gain.setValueAtTime(isHeavy ? 0.95 : 0.65, now);
    subGain.gain.exponentialRampToValueAtTime(0.001, now + (isHeavy ? 0.28 : 0.12));
    sub.connect(subGain);
    subGain.connect(this.sfxGain);
    sub.start(now);
    sub.stop(now + (isHeavy ? 0.28 : 0.12));

    // 3. Meaty impact noise crunch
    this._playNoise(isHeavy ? 0.18 : 0.08, isHeavy ? 1200 : 2200, isHeavy ? 0.85 : 0.6);
  }

  // Loud Kick Sound (Cutting whoosh + heavy blunt impact smack)
  playKick(type = 'light') {
    this._ensureAudio();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const isHeavy = type === 'heavy' || type === 'super';
    const dur = isHeavy ? 0.38 : 0.2;

    // 1. Heavy thumping sine/triangle sweep
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(isHeavy ? 280 : 340, now);
    osc.frequency.exponentialRampToValueAtTime(32, now + dur);

    gain.gain.setValueAtTime(1.0, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + dur);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + dur);

    // 2. Deep sub drop kick impact
    const sub = this.ctx.createOscillator();
    const subGain = this.ctx.createGain();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(isHeavy ? 130 : 95, now);
    sub.frequency.exponentialRampToValueAtTime(22, now + dur * 1.2);
    subGain.gain.setValueAtTime(isHeavy ? 1.0 : 0.7, now);
    subGain.gain.exponentialRampToValueAtTime(0.001, now + dur * 1.2);
    sub.connect(subGain);
    subGain.connect(this.sfxGain);
    sub.start(now);
    sub.stop(now + dur * 1.2);

    // 3. Shin impact whip noise
    this._playNoise(isHeavy ? 0.22 : 0.12, isHeavy ? 950 : 1600, isHeavy ? 0.9 : 0.65);
  }

  playLightHit() {
    this.playPunch('light');
  }

  playHeavyHit() {
    this.playPunch('heavy');
  }

  // Loud Fire Throwing Sound (Roaring flame blast + ignition surge)
  playFireThrow() {
    this._ensureAudio();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const dur = 0.55;

    // 1. Rushing flame resonance filter
    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(350, now);
    filter.frequency.exponentialRampToValueAtTime(1800, now + 0.18);
    filter.frequency.exponentialRampToValueAtTime(450, now + dur);
    filter.Q.setValueAtTime(4.0, now);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.9, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + dur);

    filter.connect(gain);
    gain.connect(this.sfxGain);

    // Sizzling flame noise
    const bufferSize = Math.floor(this.ctx.sampleRate * dur);
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      data[i] = (last + (0.05 * white)) / 1.05; // Brown noise flame rumble
      last = data[i];
    }
    const noiseSource = this.ctx.createBufferSource();
    noiseSource.buffer = buffer;
    noiseSource.connect(filter);
    noiseSource.start(now);
    noiseSource.stop(now + dur);

    // 2. High energy plasma zap
    const osc = this.ctx.createOscillator();
    const oscGain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(1200, now);
    osc.frequency.exponentialRampToValueAtTime(220, now + 0.25);
    oscGain.gain.setValueAtTime(0.65, now);
    oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
    osc.connect(oscGain);
    oscGain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + 0.25);
  }

  // Loud Fireball Explosion Sound (Thunderous detonation + crackling flames)
  playFireExplosion() {
    this._ensureAudio();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const dur = 0.8;

    // Deep explosive sub boom
    const sub = this.ctx.createOscillator();
    const subGain = this.ctx.createGain();
    sub.type = 'triangle';
    sub.frequency.setValueAtTime(190, now);
    sub.frequency.exponentialRampToValueAtTime(20, now + dur);
    subGain.gain.setValueAtTime(1.0, now);
    subGain.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    sub.connect(subGain);
    subGain.connect(this.sfxGain);
    sub.start(now);
    sub.stop(now + dur);

    // Fiery crackle explosion noise
    this._playNoise(dur * 0.7, 750, 0.95);
  }

  // Loud Thunder / Lightning Plasma Throw Sound
  playThunderThrow() {
    this._ensureAudio();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const dur = 0.45;

    // High energy electric arc zap
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(1600, now);
    osc.frequency.exponentialRampToValueAtTime(320, now + dur);
    gain.gain.setValueAtTime(0.85, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + dur);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + dur);

    this._playNoise(0.2, 4500, 0.75);
  }

  // Loud Thunder / Lightning Bolt Detonation Impact
  playThunderExplosion() {
    this._ensureAudio();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const dur = 0.75;

    // Thunderous crack
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(580, now);
    osc.frequency.exponentialRampToValueAtTime(35, now + dur);
    gain.gain.setValueAtTime(1.0, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + dur);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + dur);

    this._playNoise(0.6, 2800, 0.95);
  }

  // Loud Ice Shard Throw Sound
  playIceThrow() {
    this._ensureAudio();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const dur = 0.38;

    // High crystalline whistle
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(2200, now);
    osc.frequency.exponentialRampToValueAtTime(800, now + dur);
    gain.gain.setValueAtTime(0.75, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + dur);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + dur);

    this._playNoise(0.25, 5200, 0.55);
  }

  // Loud Frost Shatter Crystal Impact
  playIceExplosion() {
    this._ensureAudio();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const dur = 0.65;

    // Glass / crystal shatter transient
    [1800, 2400, 3100].forEach((freq, idx) => {
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = 'triangle';
      o.frequency.setValueAtTime(freq, now + idx * 0.02);
      g.gain.setValueAtTime(0.65, now + idx * 0.02);
      g.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.02 + 0.3);
      o.connect(g);
      g.connect(this.sfxGain);
      o.start(now + idx * 0.02);
      o.stop(now + idx * 0.02 + 0.3);
    });

    this._playNoise(dur * 0.8, 4200, 0.85);
  }

  // Loud Mud / Sludge Ball Throw Sound
  playMudThrow() {
    this._ensureAudio();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const dur = 0.42;

    // Heavy bubbling heave
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(280, now);
    osc.frequency.exponentialRampToValueAtTime(90, now + dur);
    gain.gain.setValueAtTime(0.85, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + dur);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + dur);

    this._playNoise(0.22, 900, 0.65);
  }

  // Loud Mud Splat Impact
  playMudExplosion() {
    this._ensureAudio();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const dur = 0.6;

    // Heavy viscous splat
    const sub = this.ctx.createOscillator();
    const subGain = this.ctx.createGain();
    sub.type = 'sawtooth';
    sub.frequency.setValueAtTime(140, now);
    sub.frequency.exponentialRampToValueAtTime(25, now + 0.35);
    subGain.gain.setValueAtTime(0.9, now);
    subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
    sub.connect(subGain);
    subGain.connect(this.sfxGain);
    sub.start(now);
    sub.stop(now + 0.35);

    this._playNoise(0.4, 700, 0.9);
  }

  // Loud Rock / Boulder Throw Sound
  playRockThrow() {
    this._ensureAudio();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const dur = 0.5;

    // Low guttural heave
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.exponentialRampToValueAtTime(65, now + dur);
    gain.gain.setValueAtTime(0.9, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + dur);
    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(now);
    osc.stop(now + dur);

    this._playNoise(0.3, 500, 0.7);
  }

  // Loud Crushing Boulder Earth Smash
  playRockExplosion() {
    this._ensureAudio();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const dur = 0.85;

    // Earth trembling sub rumble
    const sub = this.ctx.createOscillator();
    const subGain = this.ctx.createGain();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(160, now);
    sub.frequency.exponentialRampToValueAtTime(18, now + dur);
    subGain.gain.setValueAtTime(1.0, now);
    subGain.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    sub.connect(subGain);
    subGain.connect(this.sfxGain);
    sub.start(now);
    sub.stop(now + dur);

    this._playNoise(0.5, 450, 0.95);
  }

  // Generic Element Audio Dispatchers
  playElementThrow(element = 'FIRE') {
    switch (element) {
      case 'THUNDER': this.playThunderThrow(); break;
      case 'ICE': this.playIceThrow(); break;
      case 'MUD': this.playMudThrow(); break;
      case 'ROCK': this.playRockThrow(); break;
      case 'FIRE':
      default:
        this.playFireThrow();
        break;
    }
  }

  playElementExplosion(element = 'FIRE') {
    switch (element) {
      case 'THUNDER': this.playThunderExplosion(); break;
      case 'ICE': this.playIceExplosion(); break;
      case 'MUD': this.playMudExplosion(); break;
      case 'ROCK': this.playRockExplosion(); break;
      case 'FIRE':
      default:
        this.playFireExplosion();
        break;
    }
  }

  playBlock() {
    this._ensureAudio();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const dur = 0.18;

    // Metallic guard clang + bone thud
    [920, 1480, 2100].forEach((freq, i) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + i * 0.01);
      osc.frequency.exponentialRampToValueAtTime(freq * 0.75, now + i * 0.01 + dur);

      gain.gain.setValueAtTime(0.75, now + i * 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.01 + dur);

      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(now + i * 0.01);
      osc.stop(now + i * 0.01 + dur);
    });
    // Solid thud underneath
    this._playNoise(0.12, 600, 0.5);
  }

  playSuperImpact() {
    this._ensureAudio();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const dur = 1.2;

    // Dramatic K.O. explosion: low BOOM + mid crack + high sizzle
    const sub = this.ctx.createOscillator();
    const subGain = this.ctx.createGain();
    sub.type = 'triangle';
    sub.frequency.setValueAtTime(280, now);
    sub.frequency.exponentialRampToValueAtTime(16, now + dur);

    subGain.gain.setValueAtTime(1.0, now);
    subGain.gain.exponentialRampToValueAtTime(0.0001, now + dur);

    sub.connect(subGain);
    subGain.connect(this.sfxGain);
    sub.start(now);
    sub.stop(now + dur);

    // Mid crack layer
    const mid = this.ctx.createOscillator();
    const midGain = this.ctx.createGain();
    mid.type = 'square';
    mid.frequency.setValueAtTime(520, now);
    mid.frequency.exponentialRampToValueAtTime(60, now + 0.5);
    midGain.gain.setValueAtTime(0.9, now);
    midGain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
    mid.connect(midGain);
    midGain.connect(this.sfxGain);
    mid.start(now);
    mid.stop(now + 0.5);

    this._playNoise(dur * 0.9, 800, 1.0);
  }

  // Loud Arcade Speech Synthesizer & Speech API for "ROUND 1 FIGHT!"
  playAnnouncer(text) {
    if (!this.ctx) this.init();
    this.resume();
    const now = this.ctx.currentTime;

    // 1. Try Browser Speech Synthesis for crisp human vocal announcement
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      try {
        window.speechSynthesis.cancel(); // cancel previous if any
        const utter = new SpeechSynthesisUtterance(text);
        utter.rate = 0.95; // Authoritative, deliberate tournament voice
        utter.pitch = 0.85; // Deep dramatic fighting game voice
        utter.volume = 1.0;
        window.speechSynthesis.speak(utter);
      } catch (e) {
        // Fallback to Web Audio formant synth
      }
    }

    // 2. Synthesize Loud Booming Web Audio Voice Formants (Recorded into MediaStream)
    const upper = text.toUpperCase();
    if (upper.includes('ROUND 1') || upper.includes('ROUND ONE')) {
      // Synthesize "ROUND ONE": Deep dramatic resonance chords
      const chords = [
        { f: 185, dur: 0.28, t: 0.0 },   // "ROUND" (low chest formant)
        { f: 260, dur: 0.35, t: 0.32 }   // "ONE" (rising punch)
      ];
      chords.forEach(c => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(c.f, now + c.t);
        osc.frequency.exponentialRampToValueAtTime(c.f * 1.15, now + c.t + c.dur);
        gain.gain.setValueAtTime(0.9, now + c.t);
        gain.gain.exponentialRampToValueAtTime(0.001, now + c.t + c.dur);
        osc.connect(gain);
        gain.connect(this.sfxGain);
        osc.start(now + c.t);
        osc.stop(now + c.t + c.dur);
      });
    } else if (upper.includes('ROUND 2') || upper.includes('ROUND TWO')) {
      // Synthesize "ROUND TWO"
      const chords = [
        { f: 185, dur: 0.28, t: 0.0 },   // "ROUND"
        { f: 220, dur: 0.38, t: 0.32 }   // "TWO"
      ];
      chords.forEach(c => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(c.f, now + c.t);
        osc.frequency.exponentialRampToValueAtTime(c.f * 1.12, now + c.t + c.dur);
        gain.gain.setValueAtTime(0.9, now + c.t);
        gain.gain.exponentialRampToValueAtTime(0.001, now + c.t + c.dur);
        osc.connect(gain);
        gain.connect(this.sfxGain);
        osc.start(now + c.t);
        osc.stop(now + c.t + c.dur);
      });
    } else if (upper.includes('ROUND 3') || upper.includes('ROUND THREE')) {
      // Synthesize "ROUND THREE"
      const chords = [
        { f: 185, dur: 0.28, t: 0.0 },   // "ROUND"
        { f: 310, dur: 0.38, t: 0.32 }   // "THREE"
      ];
      chords.forEach(c => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(c.f, now + c.t);
        osc.frequency.exponentialRampToValueAtTime(c.f * 1.12, now + c.t + c.dur);
        gain.gain.setValueAtTime(0.9, now + c.t);
        gain.gain.exponentialRampToValueAtTime(0.001, now + c.t + c.dur);
        osc.connect(gain);
        gain.connect(this.sfxGain);
        osc.start(now + c.t);
        osc.stop(now + c.t + c.dur);
      });
    } else if (upper.includes('FIGHT')) {
      // Synthesize "FIGHT!": Explosive gong impact + high energetic vocal punch
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.exponentialRampToValueAtTime(140, now + 0.45);
      gain.gain.setValueAtTime(1.0, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(now);
      osc.stop(now + 0.45);

      // Explosive metallic strike gong
      [580, 880, 1160].forEach(f => {
        const o = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        o.type = 'triangle';
        o.frequency.setValueAtTime(f, now);
        g.gain.setValueAtTime(0.75, now);
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
        o.connect(g);
        g.connect(this.sfxGain);
        o.start(now);
        o.stop(now + 0.6);
      });
    } else if (upper.includes('WINS')) {
      // Synthesize Winner Announcement Fanfare & Vocal Chords!
      const fanfare = [
        { f: 293.66, t: 0.0, dur: 0.15 }, // D4
        { f: 369.99, t: 0.15, dur: 0.15 }, // F#4
        { f: 440.00, t: 0.30, dur: 0.18 }, // A4
        { f: 587.33, t: 0.48, dur: 0.65 }  // D5!
      ];
      fanfare.forEach(note => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(note.f, now + note.t);
        gain.gain.setValueAtTime(0.85, now + note.t);
        gain.gain.exponentialRampToValueAtTime(0.001, now + note.t + note.dur);
        osc.connect(gain);
        gain.connect(this.sfxGain);
        osc.start(now + note.t);
        osc.stop(now + note.t + note.dur);
      });
      this.playCrowdCheer();
    } else {
      // General retro arcade speech chirp sequence
      const sequence = [360, 480, 620];
      sequence.forEach((f, idx) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        const t = now + idx * 0.08;
        osc.type = 'square';
        osc.frequency.setValueAtTime(f, t);
        gain.gain.setValueAtTime(0.7, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
        osc.connect(gain);
        gain.connect(this.sfxGain);
        osc.start(t);
        osc.stop(t + 0.14);
      });
    }
  }

  _playNoise(duration, cutoff = 1000, volume = 0.3) {
    if (!this.ctx) return;
    const bufferSize = Math.floor(this.ctx.sampleRate * duration);
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(cutoff, this.ctx.currentTime);

    const gain = this.ctx.createGain();
    const now = this.ctx.currentTime;
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);

    noise.start(now);
  }

  // --- Islamically Permissible Background Sound Engine ---
  // Strictly NO musical instruments (no synths, strings, wind, or melodic instruments).
  // Purely atmospheric environmental street ambiance + traditional acoustic Duff (frame drum) martial rhythm,
  // human rhythmic clapping, dynamic crowd reactions, and physical movement foley.

  _playDuffDum(time, isHeavy = false) {
    if (!this.ctx) return;
    const dest = this.bgmGain;

    // 1. Primary drum head membrane fundamental pitch-drop (leather drum skin)
    const osc = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    const startFreq = isHeavy ? 92 : 80;
    const endFreq = isHeavy ? 38 : 44;
    const decayDur = isHeavy ? 0.36 : 0.28;

    osc.frequency.setValueAtTime(startFreq, time);
    osc.frequency.exponentialRampToValueAtTime(endFreq, time + decayDur);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(isHeavy ? 280 : 220, time);

    gain.gain.setValueAtTime(isHeavy ? 0.95 : 0.75, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + decayDur);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(dest);

    osc.start(time);
    osc.stop(time + decayDur);

    // 2. Leather skin wooden attack click (transient palm impact)
    const click = this.ctx.createOscillator();
    const clickGain = this.ctx.createGain();
    click.type = 'triangle';
    click.frequency.setValueAtTime(240, time);
    click.frequency.exponentialRampToValueAtTime(40, time + 0.035);
    clickGain.gain.setValueAtTime(0.4, time);
    clickGain.gain.exponentialRampToValueAtTime(0.001, time + 0.035);
    click.connect(clickGain);
    clickGain.connect(dest);
    click.start(time);
    click.stop(time + 0.035);
  }

  _playDuffTak(time, isAccent = false) {
    if (!this.ctx) return;
    const dest = this.bgmGain;

    // Crisp acoustic rim / edge hand tap on wood frame
    const bufferSize = Math.floor(this.ctx.sampleRate * 0.08);
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (this.ctx.sampleRate * 0.015));
    }
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(isAccent ? 1750 : 1350, time);
    filter.Q.setValueAtTime(2.8, time);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(isAccent ? 0.55 : 0.38, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.075);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(dest);

    noise.start(time);

    // Wooden edge click resonance
    const woodOsc = this.ctx.createOscillator();
    const woodGain = this.ctx.createGain();
    woodOsc.type = 'sine';
    woodOsc.frequency.setValueAtTime(isAccent ? 560 : 440, time);
    woodGain.gain.setValueAtTime(isAccent ? 0.35 : 0.2, time);
    woodGain.gain.exponentialRampToValueAtTime(0.001, time + 0.04);
    woodOsc.connect(woodGain);
    woodGain.connect(dest);
    woodOsc.start(time);
    woodOsc.stop(time + 0.04);
  }

  _playDuffSlap(time) {
    if (!this.ctx) return;
    const dest = this.bgmGain;

    // Open hand palm slap across the drum skin
    const bufferSize = Math.floor(this.ctx.sampleRate * 0.12);
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (this.ctx.sampleRate * 0.022));
    }
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(950, time);
    filter.Q.setValueAtTime(1.8, time);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.5, time);
    gain.gain.exponentialRampToValueAtTime(0.001, time + 0.11);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(dest);
    noise.start(time);
  }

  _playCrowdClap(time, intensity = 1.0) {
    if (!this.ctx) return;
    const dest = this.bgmGain;
    // Rhythmic stadium crowd clapping: Staggered natural acoustic hand claps
    const clapCount = 3 + Math.floor(Math.random() * 3);
    for (let c = 0; c < clapCount; c++) {
      const offset = (Math.random() * 0.025);
      const clapTime = time + offset;
      const bufferSize = Math.floor(this.ctx.sampleRate * 0.05);
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (this.ctx.sampleRate * 0.009));
      }
      const noise = this.ctx.createBufferSource();
      noise.buffer = buffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(1100 + Math.random() * 300, clapTime);
      filter.Q.setValueAtTime(2.2, clapTime);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.22 * intensity, clapTime);
      gain.gain.exponentialRampToValueAtTime(0.001, clapTime + 0.045);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(dest);
      noise.start(clapTime);
    }
  }

  _startAtmosphericAmbiance(stageKey = 'ALLEY') {
    if (!this.ctx) return;
    this._stopAtmosphericAmbiance();

    // 1. Stage Environmental Bed (4-second smooth looping pink/brown noise)
    const bufferSize = this.ctx.sampleRate * 4;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      data[i] = (b0 + b1 + b2) * 0.18;
    }

    this.ambientWindSource = this.ctx.createBufferSource();
    this.ambientWindSource.buffer = buffer;
    this.ambientWindSource.loop = true;

    const filter = this.ctx.createBiquadFilter();
    let cutoff = 420;
    if (stageKey === 'SUBWAY') cutoff = 220; // Heavy subterranean low rumble
    else if (stageKey === 'FOUNDRY') cutoff = 340; // Factory warm roar
    else if (stageKey === 'ROOFTOP') cutoff = 650; // Open-sky gusting wind
    else if (stageKey === 'CAGE') cutoff = 480;

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(cutoff, this.ctx.currentTime);

    this.ambientWindGain = this.ctx.createGain();
    this.ambientWindGain.gain.setValueAtTime(0.24, this.ctx.currentTime);

    this.ambientWindSource.connect(filter);
    filter.connect(this.ambientWindGain);
    this.ambientWindGain.connect(this.bgmGain);

    this.ambientWindSource.start();

    // 2. Spectator Crowd Presence & Arena Murmur (Low vocal formant background)
    const crowdBuffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const cData = crowdBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      cData[i] = (Math.random() * 2 - 1) * 0.12;
    }
    this.crowdMurmurSource = this.ctx.createBufferSource();
    this.crowdMurmurSource.buffer = crowdBuffer;
    this.crowdMurmurSource.loop = true;

    const crowdFilter = this.ctx.createBiquadFilter();
    crowdFilter.type = 'bandpass';
    crowdFilter.frequency.setValueAtTime(680, this.ctx.currentTime);
    crowdFilter.Q.setValueAtTime(1.4, this.ctx.currentTime);

    this.crowdMurmurGain = this.ctx.createGain();
    this.crowdMurmurGain.gain.setValueAtTime(0.16, this.ctx.currentTime);

    this.crowdMurmurSource.connect(crowdFilter);
    crowdFilter.connect(this.crowdMurmurGain);
    this.crowdMurmurGain.connect(this.bgmGain);

    this.crowdMurmurSource.start();
  }

  _stopAtmosphericAmbiance() {
    if (this.ambientWindSource) {
      try {
        this.ambientWindSource.stop();
        this.ambientWindSource.disconnect();
      } catch (e) {}
      this.ambientWindSource = null;
    }
    if (this.crowdMurmurSource) {
      try {
        this.crowdMurmurSource.stop();
        this.crowdMurmurSource.disconnect();
      } catch (e) {}
      this.crowdMurmurSource = null;
    }
  }

  startHalalBackgroundSound(stageKey = 'ALLEY') {
    this._ensureAudio();
    if (!this.ctx) return;

    this.stopHalalBackgroundSound();
    this._startAtmosphericAmbiance(stageKey);

    this.duffStep = 0;
    this.tensionLevel = 0;
    this._scheduleDuffTick();
  }

  _scheduleDuffTick() {
    if (!this.ctx) return;
    const baseStepMs = 125; // 16-step grid at 120 BPM = 125ms per 16th note
    const tensionFactor = 1.0 - (this.tensionLevel * 0.18); // accelerates up to ~146 BPM in high tension
    const stepDurationMs = Math.max(95, baseStepMs * tensionFactor);

    this.duffInterval = setTimeout(() => {
      if (!this.ctx || this.ctx.state !== 'running') {
        this._scheduleDuffTick();
        return;
      }

      const now = this.ctx.currentTime;
      const s = this.duffStep % 16;
      const isDanger = this.tensionLevel > 0.45;

      // 16-Step Traditional Martial Duff & Stadium Crowd Clap Pattern:
      // Step 0:  Heavy DUM (Downbeat)
      // Step 2:  Soft TAK
      // Step 4:  CROWD CLAP + TAK
      // Step 6:  DUM
      // Step 8:  Deep DUM
      // Step 10: SLAP (Open hand)
      // Step 12: CROWD CLAP + TAK (Backbeat)
      // Step 14: TAK (Accent)
      // Danger Mode adds syncopated double-dum kicks on 1, 7, 13 & finger rolls!

      if (s === 0) {
        this._playDuffDum(now, true);
      } else if (s === 1 && isDanger) {
        this._playDuffDum(now, false);
      } else if (s === 2) {
        this._playDuffTak(now, false);
      } else if (s === 4) {
        this._playDuffTak(now, true);
        this._playCrowdClap(now, isDanger ? 1.4 : 0.9);
      } else if (s === 6) {
        this._playDuffDum(now, false);
      } else if (s === 7 && isDanger) {
        this._playDuffDum(now, false);
      } else if (s === 8) {
        this._playDuffDum(now, true);
      } else if (s === 10) {
        this._playDuffSlap(now);
      } else if (s === 12) {
        this._playDuffTak(now, true);
        this._playCrowdClap(now, isDanger ? 1.5 : 1.0);
      } else if (s === 14) {
        this._playDuffTak(now, true);
      } else if (s === 15 && isDanger) {
        this._playDuffTak(now, false);
      }

      this.duffStep++;
      this._scheduleDuffTick();
    }, stepDurationMs);
  }

  stopHalalBackgroundSound() {
    if (this.duffInterval) {
      clearTimeout(this.duffInterval);
      this.duffInterval = null;
    }
    this._stopAtmosphericAmbiance();
  }

  updateMatchTension(lowestHpRatio = 1.0, isDanger = false, currentRound = 1) {
    if (!this.ctx) return;
    let targetTension = 0;
    if (lowestHpRatio < 0.25) targetTension = 1.0;
    else if (lowestHpRatio < 0.45) targetTension = 0.7;
    else if (lowestHpRatio < 0.7) targetTension = 0.35;

    if (currentRound >= 3) targetTension = Math.max(targetTension, 0.5);
    this.tensionLevel = targetTension;

    // Heartbeat for critical HP (< 22%)
    if (lowestHpRatio < 0.22 && this.ctx.state === 'running') {
      const now = this.ctx.currentTime;
      if (!this.lastHeartbeatTime || now - this.lastHeartbeatTime > 1.05) {
        this.lastHeartbeatTime = now;
        this.playHeartbeat();
      }
    }
  }

  playHeartbeat() {
    this._ensureAudio();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    // Sub-bass physiological "lub-dub"
    [0, 0.14].forEach((delay, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      const f = idx === 0 ? 58 : 50;
      osc.frequency.setValueAtTime(f, now + delay);
      osc.frequency.exponentialRampToValueAtTime(24, now + delay + 0.16);

      gain.gain.setValueAtTime(idx === 0 ? 0.75 : 0.6, now + delay);
      gain.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.16);

      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(now + delay);
      osc.stop(now + delay + 0.16);
    });
  }

  playCrowdGasp() {
    this._ensureAudio();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    const dur = 0.48;

    // Arena audience collective "Ooooh!"
    const bufferSize = Math.floor(this.ctx.sampleRate * dur);
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    // Vocal formant filters for natural "OH" sound
    const f1 = this.ctx.createBiquadFilter();
    f1.type = 'bandpass';
    f1.frequency.setValueAtTime(480, now);
    f1.frequency.exponentialRampToValueAtTime(380, now + dur);
    f1.Q.setValueAtTime(4.0, now);

    const f2 = this.ctx.createBiquadFilter();
    f2.type = 'bandpass';
    f2.frequency.setValueAtTime(850, now);
    f2.frequency.exponentialRampToValueAtTime(700, now + dur);
    f2.Q.setValueAtTime(3.5, now);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.01, now);
    gain.gain.linearRampToValueAtTime(0.65, now + 0.08);
    gain.gain.exponentialRampToValueAtTime(0.001, now + dur);

    noise.connect(f1);
    f1.connect(gain);
    noise.connect(f2);
    f2.connect(gain);
    gain.connect(this.sfxGain);

    noise.start(now);
  }

  playCrowdCheer(intensity = 1.0, duration = 2.0) {
    this._ensureAudio();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;

    // Multi-layered arena crowd roar
    const bufferSize = Math.floor(this.ctx.sampleRate * duration);
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(750, now);
    filter.frequency.linearRampToValueAtTime(1300, now + duration * 0.4);
    filter.frequency.exponentialRampToValueAtTime(800, now + duration);
    filter.Q.setValueAtTime(1.8, now);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.05, now);
    gain.gain.linearRampToValueAtTime(0.85 * intensity, now + 0.25);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);

    noise.start(now);
  }

  playFootstep(type = 'step') {
    this._ensureAudio();
    if (!this.ctx) return;
    const now = this.ctx.currentTime;

    if (type === 'land') {
      // Heavy two-foot landing thud on concrete/canvas
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(130, now);
      osc.frequency.exponentialRampToValueAtTime(32, now + 0.12);
      gain.gain.setValueAtTime(0.65, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(now);
      osc.stop(now + 0.12);
      this._playNoise(0.09, 800, 0.4);
    } else if (type === 'dash') {
      // Fast sneaker friction scuff
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(450, now);
      osc.frequency.exponentialRampToValueAtTime(180, now + 0.1);
      gain.gain.setValueAtTime(0.35, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(now);
      osc.stop(now + 0.1);
      this._playNoise(0.08, 1600, 0.3);
    } else {
      // Combat step
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(95, now);
      osc.frequency.exponentialRampToValueAtTime(38, now + 0.06);
      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
      osc.connect(gain);
      gain.connect(this.sfxGain);
      osc.start(now);
      osc.stop(now + 0.06);
    }
  }

  startBGM() {
    this.startHalalBackgroundSound();
  }

  stopBGM() {
    this.stopHalalBackgroundSound();
  }

  setSlowMotion(isSlow) {
    this.isSlowMotion = isSlow;
    if (this.masterGain && this.ctx) {
      const now = this.ctx.currentTime;
      this.masterGain.gain.exponentialRampToValueAtTime(isSlow ? 0.7 : 1.0, now + 0.1);
    }
  }
}

let soundInstance = null;
if (typeof window !== 'undefined') {
  if (!window.__GLOBAL_SOUND_ENGINE__) {
    window.__GLOBAL_SOUND_ENGINE__ = new SoundEngine();
  }
  soundInstance = window.__GLOBAL_SOUND_ENGINE__;
} else {
  soundInstance = new SoundEngine();
}

export const sound = soundInstance;
