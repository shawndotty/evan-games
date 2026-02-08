class SoundManager {
  constructor() {
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.masterGain = this.ctx.createGain();
    this.masterGain.connect(this.ctx.destination);
    this.masterGain.gain.value = 0.3; // Reduce overall volume
    this.initialized = false;

    // Pencil sound nodes
    this.pencilOsc = null;
    this.pencilGain = null;
    this.pencilFilter = null;
    this.isPencilPlaying = false;
  }

  // Initialize on first user interaction to bypass autoplay policy
  async init() {
    if (!this.initialized) {
      if (this.ctx.state === "suspended") {
        await this.ctx.resume();
      }
      this.initialized = true;
    }
  }

  // --- Pencil Sound Effect ---
  startPencil() {
    this.init();
    if (this.isPencilPlaying) return;
    this.isPencilPlaying = true;

    // Create White Noise Buffer
    const bufferSize = this.ctx.sampleRate * 2; // 2 seconds buffer
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    // Create Source
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;
    noise.loop = true;

    // Create Filter (Bandpass to simulate paper friction)
    const filter = this.ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = 800; // Center frequency
    filter.Q.value = 0.7; // Quality factor

    // Create Gain
    const gain = this.ctx.createGain();
    gain.gain.value = 0; // Start silent

    // Connect graph
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    // Start source
    noise.start();

    // Store references
    this.pencilSource = noise;
    this.pencilGain = gain;
    this.pencilFilter = filter;

    // Fade in quickly
    gain.gain.setTargetAtTime(0.4, this.ctx.currentTime, 0.02);

    // Add subtle variation
    this.pencilInterval = setInterval(() => {
      if (this.pencilFilter) {
        // Randomize filter freq slightly to simulate stroke texture
        this.pencilFilter.frequency.setTargetAtTime(
          600 + Math.random() * 400,
          this.ctx.currentTime,
          0.05,
        );
      }
    }, 100);
  }

  stopPencil() {
    if (!this.isPencilPlaying || !this.pencilGain) return;

    // Fade out quickly
    this.pencilGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.05);

    const source = this.pencilSource;
    const interval = this.pencilInterval;

    // Stop after fade out
    setTimeout(() => {
      if (source) source.stop();
      if (interval) clearInterval(interval);
    }, 100);

    this.isPencilPlaying = false;
    this.pencilSource = null;
    this.pencilGain = null;
    this.pencilFilter = null;
  }

  playTone(freq, type, duration, startTime = 0) {
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(freq, this.ctx.currentTime + startTime);

    gain.gain.setValueAtTime(0.5, this.ctx.currentTime + startTime);
    gain.gain.exponentialRampToValueAtTime(
      0.01,
      this.ctx.currentTime + startTime + duration,
    );

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start(this.ctx.currentTime + startTime);
    osc.stop(this.ctx.currentTime + startTime + duration);
  }

  click() {
    this.init();
    // Short high-pitched blip
    this.playTone(800, "sine", 0.1);
  }

  correct() {
    this.init();
    // Ding-Dong effect (High C -> E)
    this.playTone(523.25, "sine", 0.3, 0); // C5
    this.playTone(659.25, "sine", 0.6, 0.1); // E5
  }

  wrong() {
    this.init();
    // Low buzz/thud
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(150, this.ctx.currentTime);
    osc.frequency.linearRampToValueAtTime(100, this.ctx.currentTime + 0.3);

    gain.gain.setValueAtTime(0.3, this.ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.01, this.ctx.currentTime + 0.3);

    osc.connect(gain);
    gain.connect(this.masterGain);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.3);
  }

  win() {
    this.init();
    // Victory fanfare (C Major Arpeggio)
    const now = 0;
    const speed = 0.15;
    this.playTone(523.25, "triangle", 0.3, now); // C5
    this.playTone(659.25, "triangle", 0.3, now + speed); // E5
    this.playTone(783.99, "triangle", 0.3, now + speed * 2); // G5
    this.playTone(1046.5, "triangle", 0.8, now + speed * 3); // C6
  }

  lose() {
    this.init();
    // Sad trombone-ish descent
    const now = 0;
    const speed = 0.3;
    this.playTone(392.0, "triangle", 0.4, now); // G4
    this.playTone(369.99, "triangle", 0.4, now + speed); // F#4
    this.playTone(349.23, "triangle", 0.4, now + speed * 2); // F4

    // Final long low note
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(329.63, this.ctx.currentTime + speed * 3); // E4
    osc.frequency.linearRampToValueAtTime(
      250,
      this.ctx.currentTime + speed * 3 + 1.0,
    ); // Slide down

    gain.gain.setValueAtTime(0.3, this.ctx.currentTime + speed * 3);
    gain.gain.linearRampToValueAtTime(
      0.01,
      this.ctx.currentTime + speed * 3 + 1.0,
    );

    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(this.ctx.currentTime + speed * 3);
    osc.stop(this.ctx.currentTime + speed * 3 + 1.0);
  }
}

const sounds = new SoundManager();
