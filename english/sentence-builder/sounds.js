class SoundManager {
  constructor() {
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.masterGain = this.ctx.createGain();
    this.masterGain.connect(this.ctx.destination);
    this.masterGain.gain.value = 0.3; // Reduce overall volume
    this.initialized = false;
    this.isMuted = false;
  }

  toggleMute() {
    this.isMuted = !this.isMuted;
    console.log("Toggle Mute:", this.isMuted);
    
    // Use currentTime for precise timing and cancelScheduledValues to override any automation
    const now = this.ctx.currentTime;
    this.masterGain.gain.cancelScheduledValues(now);
    
    if (this.isMuted) {
      this.masterGain.gain.setValueAtTime(0, now);
      return true;
    } else {
      this.masterGain.gain.setValueAtTime(0.3, now);
      return false;
    }
  }

  // Initialize on first user interaction to bypass autoplay policy
  async init() {
    if (!this.initialized) {
      if (this.ctx.state === "suspended") {
        await this.ctx.resume();
      }
      this.initialized = true;
    }
    
    // Always enforce the current mute state on initialization or re-check
    const now = this.ctx.currentTime;
    this.masterGain.gain.cancelScheduledValues(now);
    this.masterGain.gain.setValueAtTime(this.isMuted ? 0 : 0.3, now);
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
  }
}
