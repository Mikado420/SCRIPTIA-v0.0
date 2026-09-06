// Web Audio API Procedural Sound Engine for SCRIPTIA TCG
// Zero external asset dependencies - instant, zero-latency sound synthesis

class SoundManager {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = false;
  private noiseBuffer: AudioBuffer | null = null;

  constructor() {
    try {
      const saved = localStorage.getItem('scriptia_se_muted');
      this.isMuted = saved === 'true';
    } catch {
      this.isMuted = false;
    }

    // Auto resume / init on first user gesture
    const initAudio = () => {
      this.ensureContext();
      window.removeEventListener('pointerdown', initAudio);
      window.removeEventListener('touchstart', initAudio);
      window.removeEventListener('click', initAudio);
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('pointerdown', initAudio, { once: true });
      window.addEventListener('touchstart', initAudio, { once: true });
      window.addEventListener('click', initAudio, { once: true });
    }
  }

  private ensureContext(): AudioContext | null {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtxClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtxClass) {
        this.ctx = new AudioCtxClass();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  private getNoiseBuffer(ctx: AudioContext): AudioBuffer {
    if (this.noiseBuffer && this.noiseBuffer.sampleRate === ctx.sampleRate) {
      return this.noiseBuffer;
    }
    const bufferSize = ctx.sampleRate * 1.5;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    this.noiseBuffer = buffer;
    return buffer;
  }

  public toggleMute(): boolean {
    this.isMuted = !this.isMuted;
    try {
      localStorage.setItem('scriptia_se_muted', String(this.isMuted));
    } catch {
      // ignore
    }
    return this.isMuted;
  }

  public setMute(muted: boolean): void {
    this.isMuted = muted;
    try {
      localStorage.setItem('scriptia_se_muted', String(this.isMuted));
    } catch {
      // ignore
    }
  }

  public getMuted(): boolean {
    return this.isMuted;
  }

  // 1. playCardTouch(): 軽快なカードタップ音（高音クリック）
  public playCardTouch(): void {
    if (this.isMuted) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(1200, now);
    osc.frequency.exponentialRampToValueAtTime(300, now + 0.04);

    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.045);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.05);
  }

  // 2. playCardSwipe(): 風切り音（ノイズスイープ）
  public playCardSwipe(): void {
    if (this.isMuted) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const noise = ctx.createBufferSource();
    noise.buffer = this.getNoiseBuffer(ctx);

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(600, now);
    filter.frequency.exponentialRampToValueAtTime(2200, now + 0.08);
    filter.frequency.exponentialRampToValueAtTime(400, now + 0.16);
    filter.Q.setValueAtTime(3.0, now);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.01, now);
    gain.gain.linearRampToValueAtTime(0.28, now + 0.06);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    noise.start(now);
    noise.stop(now + 0.2);
  }

  // 3. playDetailOpen(): 重厚な本を開くような低音スイープ（0.7秒長押し時）
  public playDetailOpen(): void {
    if (this.isMuted) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;

    // Deep page thud + low sweep
    const osc = ctx.createOscillator();
    const oscGain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(180, now);
    osc.frequency.exponentialRampToValueAtTime(55, now + 0.35);

    oscGain.gain.setValueAtTime(0.35, now);
    oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.38);

    osc.connect(oscGain);
    oscGain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.4);

    // Parchment friction whisper
    const noise = ctx.createBufferSource();
    noise.buffer = this.getNoiseBuffer(ctx);
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(800, now);
    filter.frequency.linearRampToValueAtTime(400, now + 0.25);
    filter.Q.setValueAtTime(1.5, now);

    const nGain = ctx.createGain();
    nGain.gain.setValueAtTime(0.18, now);
    nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);

    noise.connect(filter);
    filter.connect(nGain);
    nGain.connect(ctx.destination);

    noise.start(now);
    noise.stop(now + 0.3);
  }

  // 4. playManaCharge(): 澄んだ魔力のチャイム音（正弦波アルペジオ 880Hz→1320Hz）
  public playManaCharge(): void {
    if (this.isMuted) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const notes = [880, 1108.7, 1318.5, 1760]; // A5 -> C#6 -> E6 -> A6

    notes.forEach((freq, idx) => {
      const noteTime = now + idx * 0.045;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, noteTime);

      gain.gain.setValueAtTime(0.22, noteTime);
      gain.gain.exponentialRampToValueAtTime(0.001, noteTime + 0.28);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(noteTime);
      osc.stop(noteTime + 0.3);
    });
  }

  // 5. playSummonUnit(): 重厚なカード着地音（低周波キック＋ブラスト音）
  public playSummonUnit(): void {
    if (this.isMuted) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;

    // Low Frequency Kick / Slam
    const kick = ctx.createOscillator();
    const kickGain = ctx.createGain();

    kick.type = 'sine';
    kick.frequency.setValueAtTime(220, now);
    kick.frequency.exponentialRampToValueAtTime(42, now + 0.22);

    kickGain.gain.setValueAtTime(0.55, now);
    kickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

    kick.connect(kickGain);
    kickGain.connect(ctx.destination);
    kick.start(now);
    kick.stop(now + 0.32);

    // Energy blast impact
    const noise = ctx.createBufferSource();
    noise.buffer = this.getNoiseBuffer(ctx);
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1400, now);
    filter.frequency.exponentialRampToValueAtTime(150, now + 0.25);

    const nGain = ctx.createGain();
    nGain.gain.setValueAtTime(0.3, now);
    nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.26);

    noise.connect(filter);
    filter.connect(nGain);
    nGain.connect(ctx.destination);

    noise.start(now);
    noise.stop(now + 0.28);
  }

  // 6. playEvolve(): 派手なエネルギー爆発音（周波数変調FMシンセ音）
  public playEvolve(): void {
    if (this.isMuted) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;

    // Carrier
    const carrier = ctx.createOscillator();
    const carrierGain = ctx.createGain();

    // Modulator
    const mod = ctx.createOscillator();
    const modGain = ctx.createGain();

    mod.frequency.setValueAtTime(120, now);
    mod.frequency.linearRampToValueAtTime(480, now + 0.35);

    modGain.gain.setValueAtTime(400, now);
    modGain.gain.linearRampToValueAtTime(80, now + 0.4);

    mod.connect(carrier.frequency);

    carrier.type = 'sawtooth';
    carrier.frequency.setValueAtTime(280, now);
    carrier.frequency.exponentialRampToValueAtTime(650, now + 0.2);
    carrier.frequency.exponentialRampToValueAtTime(180, now + 0.45);

    carrierGain.gain.setValueAtTime(0.35, now);
    carrierGain.gain.linearRampToValueAtTime(0.45, now + 0.15);
    carrierGain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);

    carrier.connect(carrierGain);
    carrierGain.connect(ctx.destination);

    mod.start(now);
    carrier.start(now);
    mod.stop(now + 0.55);
    carrier.stop(now + 0.55);
  }

  // 7. playAttackLock(): 照準ロックオン音（短いビープ 1200Hz）
  public playAttackLock(): void {
    if (this.isMuted) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(1200, now);
    osc.frequency.setValueAtTime(1400, now + 0.035);

    gain.gain.setValueAtTime(0.22, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.09);
  }

  // 8. playAttackClash(): 激突打撃音（歪みノイズ＋重低音インパクト）
  public playAttackClash(): void {
    if (this.isMuted) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;

    // Bass slam
    const osc = ctx.createOscillator();
    const oscGain = ctx.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(320, now);
    osc.frequency.exponentialRampToValueAtTime(35, now + 0.28);

    oscGain.gain.setValueAtTime(0.65, now);
    oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

    osc.connect(oscGain);
    oscGain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.38);

    // Distortion / metal crunch noise
    const noise = ctx.createBufferSource();
    noise.buffer = this.getNoiseBuffer(ctx);

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(950, now);
    filter.Q.setValueAtTime(3.0, now);

    const nGain = ctx.createGain();
    nGain.gain.setValueAtTime(0.45, now);
    nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

    noise.connect(filter);
    filter.connect(nGain);
    nGain.connect(ctx.destination);

    noise.start(now);
    noise.stop(now + 0.28);
  }

  // 9. playCardDestroy(): 砕け散る消滅音（減衰ノイズクラッシュ）
  public playCardDestroy(): void {
    if (this.isMuted) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const noise = ctx.createBufferSource();
    noise.buffer = this.getNoiseBuffer(ctx);

    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(1800, now);
    filter.frequency.exponentialRampToValueAtTime(300, now + 0.35);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.4, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.38);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    noise.start(now);
    noise.stop(now + 0.4);
  }

  // 10. playShieldBreak(): クリスタルガラスが割れる鋭い破砕音（高音ベル＋ノイズバースト）
  public playShieldBreak(): void {
    if (this.isMuted) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;

    // High Glass Bell chime cluster
    const glassFreqs = [2400, 3100, 4200, 5600];
    glassFreqs.forEach((f) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, now);

      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.48);
    });

    // Glass Shatter Noise Burst
    const noise = ctx.createBufferSource();
    noise.buffer = this.getNoiseBuffer(ctx);

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(3800, now);
    filter.Q.setValueAtTime(4.0, now);

    const nGain = ctx.createGain();
    nGain.gain.setValueAtTime(0.5, now);
    nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

    noise.connect(filter);
    filter.connect(nGain);
    nGain.connect(ctx.destination);

    noise.start(now);
    noise.stop(now + 0.38);
  }

  // 11. playRuneTrigger(): 緊急割り込み警告音（サイン波ツインホーン 700Hz/900Hz）
  public playRuneTrigger(): void {
    if (this.isMuted) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const freqs = [700, 900];

    freqs.forEach((f) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(f, now);

      gain.gain.setValueAtTime(0.18, now);
      gain.gain.setValueAtTime(0.22, now + 0.15);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.55);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.6);
    });
  }

  // 12. playTurnStart(): カードドロー・ターン開始音（シャッという風切り音）
  public playTurnStart(): void {
    if (this.isMuted) return;
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;

    // Card Draw Shuff
    const noise = ctx.createBufferSource();
    noise.buffer = this.getNoiseBuffer(ctx);

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(2400, now);
    filter.frequency.linearRampToValueAtTime(1100, now + 0.12);
    filter.Q.setValueAtTime(2.5, now);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.01, now);
    gain.gain.linearRampToValueAtTime(0.35, now + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    noise.start(now);
    noise.stop(now + 0.18);

    // Subtle gong / bell
    const chime = ctx.createOscillator();
    const cGain = ctx.createGain();

    chime.type = 'sine';
    chime.frequency.setValueAtTime(523.25, now + 0.05); // C5
    chime.frequency.exponentialRampToValueAtTime(659.25, now + 0.2); // E5

    cGain.gain.setValueAtTime(0.001, now);
    cGain.gain.setValueAtTime(0.2, now + 0.05);
    cGain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);

    chime.connect(cGain);
    cGain.connect(ctx.destination);

    chime.start(now + 0.05);
    chime.stop(now + 0.5);
  }
}

export const soundManager = new SoundManager();
