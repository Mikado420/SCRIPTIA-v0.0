// Web Audio API Procedural Sound Engine for SCRIPTIA TCG
// Zero external asset dependencies - instant, zero-latency sound synthesis
//
// すべてのSEは play() を通り、カテゴリ・優先度・クールダウン・同時再生数で制御される。
// 重要な音（守護・破壊・結界・ルーン・勝敗）が軽い音に埋もれないようにしつつ、
// UI音どうしの自然な重なりは残す。

export type SoundCategory = 'UI' | 'CARD' | 'COMBAT' | 'EFFECT' | 'SYSTEM' | 'MAJOR';

export enum SoundPriority {
  LOW = 0,
  MEDIUM = 1,
  HIGH = 2,
  MAJOR = 3,
}

export type SoundId =
  | 'cardSelect'
  | 'cardConfirm'
  | 'cancel'
  | 'error'
  | 'cardSwipe'
  | 'detailOpen'
  | 'manaCharge'
  | 'summonUnit'
  | 'evolve'
  | 'spellCast'
  | 'attackLock'
  | 'attackStart'
  | 'attackHit'
  | 'guard'
  | 'cardDestroy'
  | 'bounce'
  | 'archiveSend'
  | 'archiveReturn'
  | 'barrierHit'
  | 'barrierBreak'
  | 'runeSet'
  | 'runeTrigger'
  | 'runeResolve'
  | 'turnStart'
  | 'victory'
  | 'defeat';

interface SoundSpec {
  category: SoundCategory;
  priority: SoundPriority;
  /** 同じSEを再び鳴らせるまでの最短間隔（ms） */
  cooldown: number;
  volume: number;
}

export const SOUND_SPECS: Record<SoundId, SoundSpec> = {
  cardSelect: { category: 'UI', priority: SoundPriority.LOW, cooldown: 45, volume: 1 },
  cardConfirm: { category: 'UI', priority: SoundPriority.LOW, cooldown: 60, volume: 1 },
  cancel: { category: 'UI', priority: SoundPriority.LOW, cooldown: 60, volume: 1 },
  error: { category: 'UI', priority: SoundPriority.LOW, cooldown: 180, volume: 1 },
  detailOpen: { category: 'UI', priority: SoundPriority.LOW, cooldown: 150, volume: 1 },
  attackLock: { category: 'UI', priority: SoundPriority.LOW, cooldown: 90, volume: 1 },
  cardSwipe: { category: 'CARD', priority: SoundPriority.MEDIUM, cooldown: 80, volume: 0.9 },
  manaCharge: { category: 'CARD', priority: SoundPriority.MEDIUM, cooldown: 150, volume: 1 },
  summonUnit: { category: 'CARD', priority: SoundPriority.MEDIUM, cooldown: 90, volume: 1 },
  evolve: { category: 'CARD', priority: SoundPriority.MEDIUM, cooldown: 150, volume: 0.9 },
  spellCast: { category: 'CARD', priority: SoundPriority.MEDIUM, cooldown: 120, volume: 1 },
  runeSet: { category: 'CARD', priority: SoundPriority.MEDIUM, cooldown: 120, volume: 1 },
  attackStart: { category: 'COMBAT', priority: SoundPriority.MEDIUM, cooldown: 80, volume: 1 },
  attackHit: { category: 'COMBAT', priority: SoundPriority.MEDIUM, cooldown: 70, volume: 0.9 },
  barrierHit: { category: 'COMBAT', priority: SoundPriority.MEDIUM, cooldown: 90, volume: 1 },
  guard: { category: 'COMBAT', priority: SoundPriority.HIGH, cooldown: 120, volume: 1 },
  bounce: { category: 'EFFECT', priority: SoundPriority.MEDIUM, cooldown: 90, volume: 1 },
  archiveSend: { category: 'EFFECT', priority: SoundPriority.MEDIUM, cooldown: 90, volume: 0.9 },
  archiveReturn: { category: 'EFFECT', priority: SoundPriority.MEDIUM, cooldown: 120, volume: 1 },
  cardDestroy: { category: 'EFFECT', priority: SoundPriority.HIGH, cooldown: 70, volume: 1 },
  barrierBreak: { category: 'EFFECT', priority: SoundPriority.HIGH, cooldown: 120, volume: 0.9 },
  runeTrigger: { category: 'EFFECT', priority: SoundPriority.HIGH, cooldown: 300, volume: 0.9 },
  runeResolve: { category: 'EFFECT', priority: SoundPriority.HIGH, cooldown: 200, volume: 1 },
  turnStart: { category: 'SYSTEM', priority: SoundPriority.MEDIUM, cooldown: 400, volume: 1 },
  victory: { category: 'MAJOR', priority: SoundPriority.MAJOR, cooldown: 2000, volume: 1 },
  defeat: { category: 'MAJOR', priority: SoundPriority.MAJOR, cooldown: 2000, volume: 1 },
};

/** カテゴリごとの同時再生数。UIは自然に重なってよい */
export const CATEGORY_MAX_CONCURRENT: Record<SoundCategory, number> = {
  UI: 4,
  CARD: 3,
  COMBAT: 3,
  EFFECT: 3,
  SYSTEM: 2,
  MAJOR: 1,
};

interface Voice {
  id: SoundId;
  spec: SoundSpec;
  gain: GainNode;
  sources: AudioScheduledSourceNode[];
  startedAt: number;
  endAt: number;
  /** フェードアウト中（止める途中）の声は数に入れない */
  releasing: boolean;
}

type Build = (ctx: AudioContext, out: AudioNode, t: number, v: VoiceKit) => number;

/** SEの組み立て用。作ったソースを自動で登録し、途中停止できるようにする */
interface VoiceKit {
  osc: (type: OscillatorType, dest: AudioNode) => OscillatorNode;
  noise: (dest: AudioNode) => AudioBufferSourceNode;
  gain: (dest: AudioNode) => GainNode;
  filter: (type: BiquadFilterType, dest: AudioNode) => BiquadFilterNode;
}

const FADE_STEAL = 0.04;
const FADE_MAJOR = 0.08;

class SoundManager {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private isMuted: boolean = false;
  private noiseBuffer: AudioBuffer | null = null;
  private voices: Voice[] = [];
  private lastPlayed = new Map<SoundId, number>();

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
        // 全SE共通の出口。重なった時の音割れをコンプレッサーで抑える
        const comp = this.ctx.createDynamicsCompressor();
        comp.threshold.value = -14;
        comp.knee.value = 12;
        comp.ratio.value = 4;
        comp.attack.value = 0.003;
        comp.release.value = 0.15;
        this.master = this.ctx.createGain();
        this.master.gain.value = 0.9;
        this.master.connect(comp);
        comp.connect(this.ctx.destination);
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
    if (this.isMuted) this.stopAll();
    return this.isMuted;
  }

  public setMute(muted: boolean): void {
    this.isMuted = muted;
    try {
      localStorage.setItem('scriptia_se_muted', String(this.isMuted));
    } catch {
      // ignore
    }
    if (this.isMuted) this.stopAll();
  }

  public getMuted(): boolean {
    return this.isMuted;
  }

  // ===================================================================
  // 再生制御
  // ===================================================================

  private fadeOut(v: Voice, now: number, time: number) {
    if (v.releasing) return;
    v.releasing = true;
    try {
      v.gain.gain.cancelScheduledValues(now);
      v.gain.gain.setValueAtTime(v.gain.gain.value, now);
      v.gain.gain.linearRampToValueAtTime(0, now + time);
      v.sources.forEach(s => {
        try {
          s.stop(now + time + 0.01);
        } catch {
          // already stopped
        }
      });
    } catch {
      // ignore
    }
    v.endAt = Math.min(v.endAt, now + time + 0.01);
  }

  private duck(v: Voice, now: number, level: number) {
    if (v.releasing) return;
    try {
      v.gain.gain.cancelScheduledValues(now);
      v.gain.gain.setValueAtTime(v.gain.gain.value, now);
      v.gain.gain.linearRampToValueAtTime(v.gain.gain.value * level, now + 0.03);
    } catch {
      // ignore
    }
  }

  private stopAll() {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    this.voices.forEach(v => this.fadeOut(v, now, FADE_STEAL));
  }

  /** 同時再生数・優先度・クールダウンを判定し、許可された時だけ build を実行する */
  private play(id: SoundId, build: Build): void {
    if (this.isMuted) return;
    const ctx = this.ensureContext();
    if (!ctx || !this.master) return;
    const spec = SOUND_SPECS[id];
    const now = ctx.currentTime;
    const wall = typeof performance !== 'undefined' ? performance.now() : Date.now();

    // 1. 同じSEの連打を抑える
    const last = this.lastPlayed.get(id);
    if (last !== undefined && wall - last < spec.cooldown) return;

    this.voices = this.voices.filter(v => v.endAt > now);
    const active = this.voices.filter(v => !v.releasing);

    // 2. 勝敗（MAJOR）が鳴っている間は、軽い音を鳴らさず、それ以外も控えめにする
    const majorPlaying = active.some(v => v.spec.category === 'MAJOR');
    if (majorPlaying && spec.priority < SoundPriority.MEDIUM) return;

    // 3. カテゴリの同時再生数。満杯なら、自分以下の優先度で最も古い声を短くフェードして譲ってもらう
    const same = active.filter(v => v.spec.category === spec.category);
    if (same.length >= CATEGORY_MAX_CONCURRENT[spec.category]) {
      const victim = same
        .filter(v => v.spec.priority <= spec.priority)
        .sort((a, b) => a.spec.priority - b.spec.priority || a.startedAt - b.startedAt)[0];
      if (!victim) return;
      this.fadeOut(victim, now, FADE_STEAL);
    }

    // 4. 優先度の高い音が来たら、競合する低い音を下げる
    if (spec.priority === SoundPriority.MAJOR) {
      active.forEach(v => {
        if (v.spec.category !== 'MAJOR') this.fadeOut(v, now, FADE_MAJOR);
      });
    } else if (spec.priority === SoundPriority.HIGH) {
      active.forEach(v => {
        if (v.spec.priority === SoundPriority.LOW) this.fadeOut(v, now, FADE_STEAL);
        else if (v.spec.priority === SoundPriority.MEDIUM) this.duck(v, now, 0.55);
      });
    }

    // 5. 同時に鳴っている数が多いほど、低〜中優先度の新しい音を少し下げる（MAJORは下げない）
    let level = spec.volume;
    const busy = active.filter(v => !v.releasing).length;
    if (spec.priority < SoundPriority.HIGH && busy >= 2) level *= Math.max(0.55, 1 - 0.15 * (busy - 1));
    if (majorPlaying && spec.priority < SoundPriority.MAJOR) level *= 0.4;

    const out = ctx.createGain();
    out.gain.value = level;
    out.connect(this.master);
    const sources: AudioScheduledSourceNode[] = [];
    const kit: VoiceKit = {
      osc: (type, dest) => {
        const o = ctx.createOscillator();
        o.type = type;
        o.connect(dest);
        sources.push(o);
        return o;
      },
      noise: dest => {
        const n = ctx.createBufferSource();
        n.buffer = this.getNoiseBuffer(ctx);
        n.connect(dest);
        sources.push(n);
        return n;
      },
      gain: dest => {
        const g = ctx.createGain();
        g.connect(dest);
        return g;
      },
      filter: (type, dest) => {
        const f = ctx.createBiquadFilter();
        f.type = type;
        f.connect(dest);
        return f;
      },
    };

    let duration = 0.3;
    try {
      duration = build(ctx, out, now, kit);
    } catch {
      return;
    }
    this.lastPlayed.set(id, wall);
    const voice: Voice = { id, spec, gain: out, sources, startedAt: now, endAt: now + duration + 0.05, releasing: false };
    this.voices.push(voice);
    // 鳴り終わった声のノードを解放する（途中で止めた場合も endAt 以降に解放される）
    setTimeout(() => {
      try {
        out.disconnect();
      } catch {
        // ignore
      }
    }, (duration + 0.3) * 1000);
  }

  /** テスト・デバッグ用: 現在鳴っている声 */
  public debugVoices(): { id: SoundId; priority: SoundPriority; category: SoundCategory; level: number; releasing: boolean }[] {
    const now = this.ctx?.currentTime ?? 0;
    return this.voices
      .filter(v => v.endAt > now)
      .map(v => ({ id: v.id, priority: v.spec.priority, category: v.spec.category, level: v.gain.gain.value, releasing: v.releasing }));
  }

  /** ゲーム状態の変化から検出したイベント名でSEを鳴らす */
  public playEvent(id: SoundId): void {
    const fn = (this as unknown as Record<string, () => void>)[METHOD_OF[id]];
    if (typeof fn === 'function') fn.call(this);
  }

  // ===================================================================
  // 既存SE（音色は従来どおり。出力先だけ制御レイヤー経由に変更）
  // ===================================================================

  // 1. playCardTouch(): 軽快なカードタップ音（高音クリック）＝カード選択
  public playCardTouch(): void {
    this.play('cardSelect', (_ctx, out, now, k) => {
      const gain = k.gain(out);
      const osc = k.osc('triangle', gain);
      osc.frequency.setValueAtTime(1200, now);
      osc.frequency.exponentialRampToValueAtTime(300, now + 0.04);
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.045);
      osc.start(now);
      osc.stop(now + 0.05);
      return 0.05;
    });
  }

  public playCardSelect(): void {
    this.playCardTouch();
  }

  // 2. playCardSwipe(): 風切り音（ノイズスイープ）＝手札のカードを持ち上げた時
  public playCardSwipe(): void {
    this.play('cardSwipe', (_ctx, out, now, k) => {
      const gain = k.gain(out);
      const filter = k.filter('bandpass', gain);
      const noise = k.noise(filter);
      filter.frequency.setValueAtTime(600, now);
      filter.frequency.exponentialRampToValueAtTime(2200, now + 0.08);
      filter.frequency.exponentialRampToValueAtTime(400, now + 0.16);
      filter.Q.setValueAtTime(3.0, now);
      gain.gain.setValueAtTime(0.01, now);
      gain.gain.linearRampToValueAtTime(0.28, now + 0.06);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
      noise.start(now);
      noise.stop(now + 0.2);
      return 0.2;
    });
  }

  // 3. playDetailOpen(): 重厚な本を開くような低音スイープ（0.7秒長押し時）
  public playDetailOpen(): void {
    this.play('detailOpen', (_ctx, out, now, k) => {
      const oscGain = k.gain(out);
      const osc = k.osc('sine', oscGain);
      osc.frequency.setValueAtTime(180, now);
      osc.frequency.exponentialRampToValueAtTime(55, now + 0.35);
      oscGain.gain.setValueAtTime(0.35, now);
      oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.38);
      osc.start(now);
      osc.stop(now + 0.4);

      const nGain = k.gain(out);
      const filter = k.filter('bandpass', nGain);
      const noise = k.noise(filter);
      filter.frequency.setValueAtTime(800, now);
      filter.frequency.linearRampToValueAtTime(400, now + 0.25);
      filter.Q.setValueAtTime(1.5, now);
      nGain.gain.setValueAtTime(0.18, now);
      nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
      noise.start(now);
      noise.stop(now + 0.3);
      return 0.4;
    });
  }

  // 4. playManaCharge(): 澄んだ魔力のチャイム音（正弦波アルペジオ 880Hz→1320Hz）
  public playManaCharge(): void {
    this.play('manaCharge', (_ctx, out, now, k) => {
      const notes = [880, 1108.7, 1318.5, 1760];
      notes.forEach((freq, idx) => {
        const noteTime = now + idx * 0.045;
        const gain = k.gain(out);
        const osc = k.osc('sine', gain);
        osc.frequency.setValueAtTime(freq, noteTime);
        gain.gain.setValueAtTime(0.0001, now);
        gain.gain.setValueAtTime(0.22, noteTime);
        gain.gain.exponentialRampToValueAtTime(0.001, noteTime + 0.28);
        osc.start(noteTime);
        osc.stop(noteTime + 0.3);
      });
      return 0.45;
    });
  }

  // 5. playSummonUnit(): 重厚なカード着地音（低周波キック＋ブラスト音）
  public playSummonUnit(): void {
    this.play('summonUnit', (_ctx, out, now, k) => {
      const kickGain = k.gain(out);
      const kick = k.osc('sine', kickGain);
      kick.frequency.setValueAtTime(220, now);
      kick.frequency.exponentialRampToValueAtTime(42, now + 0.22);
      kickGain.gain.setValueAtTime(0.55, now);
      kickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
      kick.start(now);
      kick.stop(now + 0.32);

      const nGain = k.gain(out);
      const filter = k.filter('lowpass', nGain);
      const noise = k.noise(filter);
      filter.frequency.setValueAtTime(1400, now);
      filter.frequency.exponentialRampToValueAtTime(150, now + 0.25);
      nGain.gain.setValueAtTime(0.3, now);
      nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.26);
      noise.start(now);
      noise.stop(now + 0.28);
      return 0.32;
    });
  }

  // 6. playEvolve(): エネルギー上昇・変化（周波数変調FMシンセ音）
  public playEvolve(): void {
    this.play('evolve', (ctx, out, now, k) => {
      const carrierGain = k.gain(out);
      const carrier = k.osc('sawtooth', carrierGain);
      const modGain = ctx.createGain();
      const mod = ctx.createOscillator();
      mod.connect(modGain);
      modGain.connect(carrier.frequency);

      mod.frequency.setValueAtTime(120, now);
      mod.frequency.linearRampToValueAtTime(480, now + 0.35);
      modGain.gain.setValueAtTime(400, now);
      modGain.gain.linearRampToValueAtTime(80, now + 0.4);

      carrier.frequency.setValueAtTime(280, now);
      carrier.frequency.exponentialRampToValueAtTime(650, now + 0.2);
      carrier.frequency.exponentialRampToValueAtTime(180, now + 0.45);
      carrierGain.gain.setValueAtTime(0.35, now);
      carrierGain.gain.linearRampToValueAtTime(0.45, now + 0.15);
      carrierGain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);

      mod.start(now);
      carrier.start(now);
      mod.stop(now + 0.55);
      carrier.stop(now + 0.55);
      return 0.55;
    });
  }

  // 7. playAttackLock(): 照準ロックオン音（短いビープ 1200Hz）
  public playAttackLock(): void {
    this.play('attackLock', (_ctx, out, now, k) => {
      const gain = k.gain(out);
      const osc = k.osc('sine', gain);
      osc.frequency.setValueAtTime(1200, now);
      osc.frequency.setValueAtTime(1400, now + 0.035);
      gain.gain.setValueAtTime(0.22, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
      osc.start(now);
      osc.stop(now + 0.09);
      return 0.09;
    });
  }

  // 8. playAttackClash(): 激突打撃音（歪みノイズ＋重低音インパクト）＝攻撃命中
  public playAttackClash(): void {
    this.play('attackHit', (_ctx, out, now, k) => {
      const oscGain = k.gain(out);
      const osc = k.osc('triangle', oscGain);
      osc.frequency.setValueAtTime(320, now);
      osc.frequency.exponentialRampToValueAtTime(35, now + 0.28);
      oscGain.gain.setValueAtTime(0.65, now);
      oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      osc.start(now);
      osc.stop(now + 0.38);

      const nGain = k.gain(out);
      const filter = k.filter('bandpass', nGain);
      const noise = k.noise(filter);
      filter.frequency.setValueAtTime(950, now);
      filter.Q.setValueAtTime(3.0, now);
      nGain.gain.setValueAtTime(0.45, now);
      nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
      noise.start(now);
      noise.stop(now + 0.28);
      return 0.38;
    });
  }

  public playAttackHit(): void {
    this.playAttackClash();
  }

  // 9. playCardDestroy(): 砕け散る消滅音（減衰ノイズクラッシュ）
  public playCardDestroy(): void {
    this.play('cardDestroy', (_ctx, out, now, k) => {
      const gain = k.gain(out);
      const filter = k.filter('highpass', gain);
      const noise = k.noise(filter);
      filter.frequency.setValueAtTime(1800, now);
      filter.frequency.exponentialRampToValueAtTime(300, now + 0.35);
      gain.gain.setValueAtTime(0.4, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.38);
      noise.start(now);
      noise.stop(now + 0.4);
      return 0.4;
    });
  }

  // 10. playShieldBreak(): クリスタルガラスが割れる鋭い破砕音＝結界破壊
  public playShieldBreak(): void {
    this.play('barrierBreak', (_ctx, out, now, k) => {
      [2400, 3100, 4200, 5600].forEach(f => {
        const gain = k.gain(out);
        const osc = k.osc('sine', gain);
        osc.frequency.setValueAtTime(f, now);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
        osc.start(now);
        osc.stop(now + 0.48);
      });
      const nGain = k.gain(out);
      const filter = k.filter('bandpass', nGain);
      const noise = k.noise(filter);
      filter.frequency.setValueAtTime(3800, now);
      filter.Q.setValueAtTime(4.0, now);
      nGain.gain.setValueAtTime(0.5, now);
      nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
      noise.start(now);
      noise.stop(now + 0.38);
      return 0.48;
    });
  }

  public playBarrierBreak(): void {
    this.playShieldBreak();
  }

  // 11. playRuneTrigger(): ルーン発動の割り込み警告音（ツインホーン 700Hz/900Hz）
  public playRuneTrigger(): void {
    this.play('runeTrigger', (_ctx, out, now, k) => {
      [700, 900].forEach(f => {
        const gain = k.gain(out);
        const osc = k.osc('sawtooth', gain);
        osc.frequency.setValueAtTime(f, now);
        gain.gain.setValueAtTime(0.18, now);
        gain.gain.setValueAtTime(0.22, now + 0.15);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
        osc.start(now);
        osc.stop(now + 0.6);
      });
      return 0.6;
    });
  }

  // 12. playTurnStart(): カードドロー・ターン開始音
  public playTurnStart(): void {
    this.play('turnStart', (_ctx, out, now, k) => {
      const gain = k.gain(out);
      const filter = k.filter('bandpass', gain);
      const noise = k.noise(filter);
      filter.frequency.setValueAtTime(2400, now);
      filter.frequency.linearRampToValueAtTime(1100, now + 0.12);
      filter.Q.setValueAtTime(2.5, now);
      gain.gain.setValueAtTime(0.01, now);
      gain.gain.linearRampToValueAtTime(0.35, now + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
      noise.start(now);
      noise.stop(now + 0.18);

      const cGain = k.gain(out);
      const chime = k.osc('sine', cGain);
      chime.frequency.setValueAtTime(523.25, now + 0.05);
      chime.frequency.exponentialRampToValueAtTime(659.25, now + 0.2);
      cGain.gain.setValueAtTime(0.001, now);
      cGain.gain.setValueAtTime(0.2, now + 0.05);
      cGain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
      chime.start(now + 0.05);
      chime.stop(now + 0.5);
      return 0.5;
    });
  }

  // ===================================================================
  // 追加SE
  // ===================================================================

  /** 決定: 選択より少し強いクリック */
  public playCardConfirm(): void {
    this.play('cardConfirm', (_ctx, out, now, k) => {
      const g = k.gain(out);
      const o = k.osc('triangle', g);
      o.frequency.setValueAtTime(900, now);
      o.frequency.exponentialRampToValueAtTime(420, now + 0.05);
      g.gain.setValueAtTime(0.26, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.07);
      o.start(now);
      o.stop(now + 0.08);
      const g2 = k.gain(out);
      const o2 = k.osc('sine', g2);
      o2.frequency.setValueAtTime(1760, now + 0.012);
      g2.gain.setValueAtTime(0.0001, now);
      g2.gain.setValueAtTime(0.1, now + 0.012);
      g2.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
      o2.start(now);
      o2.stop(now + 0.09);
      return 0.09;
    });
  }

  /** キャンセル: 下がる2音 */
  public playCancel(): void {
    this.play('cancel', (_ctx, out, now, k) => {
      [720, 520].forEach((f, i) => {
        const t = now + i * 0.045;
        const g = k.gain(out);
        const o = k.osc('triangle', g);
        o.frequency.setValueAtTime(f, t);
        g.gain.setValueAtTime(0.0001, now);
        g.gain.setValueAtTime(0.14, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
        o.start(t);
        o.stop(t + 0.06);
      });
      return 0.11;
    });
  }

  /** エラー: 低く短い2連のブザー（控えめ） */
  public playError(): void {
    this.play('error', (_ctx, out, now, k) => {
      const lp = k.filter('lowpass', out);
      lp.frequency.value = 900;
      [0, 0.08].forEach(d => {
        const g = k.gain(lp);
        const o = k.osc('square', g);
        o.frequency.setValueAtTime(185, now + d);
        g.gain.setValueAtTime(0.0001, now);
        g.gain.setValueAtTime(0.11, now + d);
        g.gain.exponentialRampToValueAtTime(0.001, now + d + 0.06);
        o.start(now + d);
        o.stop(now + d + 0.07);
      });
      return 0.16;
    });
  }

  /** 攻撃開始: 短い発射音（魔力の矢が放たれる） */
  public playAttackStart(): void {
    this.play('attackStart', (_ctx, out, now, k) => {
      const g = k.gain(out);
      const f = k.filter('bandpass', g);
      const n = k.noise(f);
      f.frequency.setValueAtTime(500, now);
      f.frequency.exponentialRampToValueAtTime(2600, now + 0.09);
      f.Q.value = 2.2;
      g.gain.setValueAtTime(0.01, now);
      g.gain.linearRampToValueAtTime(0.24, now + 0.03);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
      n.start(now);
      n.stop(now + 0.13);
      const g2 = k.gain(out);
      const o = k.osc('triangle', g2);
      o.frequency.setValueAtTime(380, now);
      o.frequency.exponentialRampToValueAtTime(900, now + 0.08);
      g2.gain.setValueAtTime(0.12, now);
      g2.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
      o.start(now);
      o.stop(now + 0.11);
      return 0.13;
    });
  }

  /** 守護: 真鍮の盾に弾かれる金属音＋結界の響き */
  public playGuard(): void {
    this.play('guard', (_ctx, out, now, k) => {
      // 非整数倍の倍音で金属らしい響きにする
      [[620, 0.22], [620 * 2.76, 0.1], [620 * 5.4, 0.05]].forEach(([f, a]) => {
        const g = k.gain(out);
        const o = k.osc('sine', g);
        o.frequency.setValueAtTime(f, now);
        g.gain.setValueAtTime(a, now);
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.38);
        o.start(now);
        o.stop(now + 0.4);
      });
      const ng = k.gain(out);
      const nf = k.filter('bandpass', ng);
      const n = k.noise(nf);
      nf.frequency.value = 2600;
      nf.Q.value = 5;
      ng.gain.setValueAtTime(0.3, now);
      ng.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
      n.start(now);
      n.stop(now + 0.07);
      const bg = k.gain(out);
      const b = k.osc('sine', bg);
      b.frequency.setValueAtTime(160, now);
      b.frequency.exponentialRampToValueAtTime(90, now + 0.2);
      bg.gain.setValueAtTime(0.25, now);
      bg.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
      b.start(now);
      b.stop(now + 0.24);
      return 0.4;
    });
  }

  /** 結界Hit: 結界に打ち込まれる鈍い衝撃（割れる前） */
  public playBarrierHit(): void {
    this.play('barrierHit', (_ctx, out, now, k) => {
      const g = k.gain(out);
      const o = k.osc('sine', g);
      o.frequency.setValueAtTime(200, now);
      o.frequency.exponentialRampToValueAtTime(60, now + 0.18);
      g.gain.setValueAtTime(0.5, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
      o.start(now);
      o.stop(now + 0.24);
      const ng = k.gain(out);
      const nf = k.filter('bandpass', ng);
      const n = k.noise(nf);
      nf.frequency.setValueAtTime(1300, now);
      nf.Q.value = 1.6;
      ng.gain.setValueAtTime(0.28, now);
      ng.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
      n.start(now);
      n.stop(now + 0.13);
      return 0.24;
    });
  }

  /** スペル発動: 魔力が立ちのぼるきらめき */
  public playSpellCast(): void {
    this.play('spellCast', (_ctx, out, now, k) => {
      [660, 990, 1320].forEach((f, i) => {
        const t = now + i * 0.03;
        const g = k.gain(out);
        const o = k.osc('sine', g);
        o.frequency.setValueAtTime(f, t);
        o.frequency.exponentialRampToValueAtTime(f * 1.5, t + 0.25);
        g.gain.setValueAtTime(0.0001, now);
        g.gain.linearRampToValueAtTime(0.13, t + 0.03);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
        o.start(t);
        o.stop(t + 0.32);
      });
      const ng = k.gain(out);
      const nf = k.filter('highpass', ng);
      const n = k.noise(nf);
      nf.frequency.value = 5000;
      ng.gain.setValueAtTime(0.0001, now);
      ng.gain.linearRampToValueAtTime(0.09, now + 0.08);
      ng.gain.exponentialRampToValueAtTime(0.001, now + 0.32);
      n.start(now);
      n.stop(now + 0.34);
      return 0.36;
    });
  }

  /** 手札へ戻す: 吸い込まれて戻る（逆再生のような立ち上がり） */
  public playBounce(): void {
    this.play('bounce', (_ctx, out, now, k) => {
      const g = k.gain(out);
      const o = k.osc('sine', g);
      o.frequency.setValueAtTime(320, now);
      o.frequency.exponentialRampToValueAtTime(1100, now + 0.18);
      g.gain.setValueAtTime(0.0001, now);
      g.gain.exponentialRampToValueAtTime(0.2, now + 0.16);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.21);
      o.start(now);
      o.stop(now + 0.22);
      const ng = k.gain(out);
      const nf = k.filter('bandpass', ng);
      const n = k.noise(nf);
      nf.frequency.setValueAtTime(700, now);
      nf.frequency.exponentialRampToValueAtTime(3000, now + 0.18);
      nf.Q.value = 2;
      ng.gain.setValueAtTime(0.0001, now);
      ng.gain.exponentialRampToValueAtTime(0.14, now + 0.16);
      ng.gain.exponentialRampToValueAtTime(0.001, now + 0.21);
      n.start(now);
      n.stop(now + 0.22);
      return 0.22;
    });
  }

  /** アーカイブ送り: すっと消える */
  public playArchiveSend(): void {
    this.play('archiveSend', (_ctx, out, now, k) => {
      const ng = k.gain(out);
      const nf = k.filter('bandpass', ng);
      const n = k.noise(nf);
      nf.frequency.setValueAtTime(3600, now);
      nf.frequency.exponentialRampToValueAtTime(700, now + 0.25);
      nf.Q.value = 1.4;
      ng.gain.setValueAtTime(0.16, now);
      ng.gain.exponentialRampToValueAtTime(0.001, now + 0.27);
      n.start(now);
      n.stop(now + 0.28);
      const g = k.gain(out);
      const o = k.osc('sine', g);
      o.frequency.setValueAtTime(520, now);
      o.frequency.exponentialRampToValueAtTime(140, now + 0.24);
      g.gain.setValueAtTime(0.1, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.26);
      o.start(now);
      o.stop(now + 0.28);
      return 0.28;
    });
  }

  /** アーカイブから回収: 魔力が戻ってくる上昇2音 */
  public playArchiveReturn(): void {
    this.play('archiveReturn', (_ctx, out, now, k) => {
      [659.25, 987.77].forEach((f, i) => {
        const t = now + i * 0.07;
        const g = k.gain(out);
        const o = k.osc('sine', g);
        o.frequency.setValueAtTime(f, t);
        g.gain.setValueAtTime(0.0001, now);
        g.gain.linearRampToValueAtTime(0.16, t + 0.02);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.24);
        o.start(t);
        o.stop(t + 0.26);
      });
      const ng = k.gain(out);
      const nf = k.filter('bandpass', ng);
      const n = k.noise(nf);
      nf.frequency.setValueAtTime(900, now);
      nf.frequency.exponentialRampToValueAtTime(2800, now + 0.2);
      ng.gain.setValueAtTime(0.0001, now);
      ng.gain.linearRampToValueAtTime(0.07, now + 0.12);
      ng.gain.exponentialRampToValueAtTime(0.001, now + 0.24);
      n.start(now);
      n.stop(now + 0.26);
      return 0.33;
    });
  }

  /** ルーン・ドメインの設置: 封印を押すような低い音＋小さな鐘 */
  public playRuneSet(): void {
    this.play('runeSet', (_ctx, out, now, k) => {
      const g = k.gain(out);
      const o = k.osc('triangle', g);
      o.frequency.setValueAtTime(300, now);
      o.frequency.exponentialRampToValueAtTime(140, now + 0.12);
      g.gain.setValueAtTime(0.3, now);
      g.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
      o.start(now);
      o.stop(now + 0.16);
      const cg = k.gain(out);
      const c = k.osc('sine', cg);
      c.frequency.setValueAtTime(1174.66, now + 0.05);
      cg.gain.setValueAtTime(0.0001, now);
      cg.gain.setValueAtTime(0.09, now + 0.05);
      cg.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
      c.start(now + 0.05);
      c.stop(now + 0.26);
      return 0.26;
    });
  }

  /** ルーンの効果解決: 神秘的なゆらぎ */
  public playRuneResolve(): void {
    this.play('runeResolve', (ctx, out, now, k) => {
      const trem = ctx.createOscillator();
      const tremDepth = ctx.createGain();
      tremDepth.gain.value = 0.06;
      trem.frequency.value = 11;
      trem.connect(tremDepth);
      const body = k.gain(out);
      body.gain.setValueAtTime(0.0001, now);
      body.gain.linearRampToValueAtTime(0.14, now + 0.05);
      body.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
      tremDepth.connect(body.gain);
      [523.25, 783.99, 1046.5].forEach(f => {
        const o = k.osc('triangle', body);
        o.frequency.setValueAtTime(f, now);
        o.frequency.linearRampToValueAtTime(f * 1.02, now + 0.45);
        o.start(now);
        o.stop(now + 0.47);
      });
      trem.start(now);
      trem.stop(now + 0.47);
      return 0.47;
    });
  }

  /** 勝利: 控えめなファンファーレ（真鍮の和音） */
  public playVictory(): void {
    this.play('victory', (_ctx, out, now, k) => {
      const notes = [523.25, 659.25, 783.99, 1046.5];
      notes.forEach((f, i) => {
        const t = now + i * 0.11;
        const last = i === notes.length - 1;
        const len = last ? 1.0 : 0.3;
        const g = k.gain(out);
        const o = k.osc('triangle', g);
        o.frequency.setValueAtTime(f, t);
        g.gain.setValueAtTime(0.0001, now);
        g.gain.linearRampToValueAtTime(last ? 0.2 : 0.16, t + 0.02);
        g.gain.exponentialRampToValueAtTime(0.001, t + len);
        o.start(t);
        o.stop(t + len + 0.02);
      });
      // 最後に和音を薄く重ねる
      const chordAt = now + 0.33;
      [523.25, 659.25, 783.99].forEach(f => {
        const g = k.gain(out);
        const o = k.osc('sine', g);
        o.frequency.setValueAtTime(f, chordAt);
        g.gain.setValueAtTime(0.0001, now);
        g.gain.linearRampToValueAtTime(0.07, chordAt + 0.05);
        g.gain.exponentialRampToValueAtTime(0.001, chordAt + 1.0);
        o.start(chordAt);
        o.stop(chordAt + 1.02);
      });
      return 1.36;
    });
  }

  /** 敗北: 低く静かに下がる終止 */
  public playDefeat(): void {
    this.play('defeat', (_ctx, out, now, k) => {
      const lp = k.filter('lowpass', out);
      lp.frequency.value = 1200;
      [392, 329.63, 261.63].forEach((f, i) => {
        const t = now + i * 0.28;
        const last = i === 2;
        const len = last ? 1.0 : 0.4;
        const g = k.gain(lp);
        const o = k.osc('triangle', g);
        o.frequency.setValueAtTime(f, t);
        if (last) o.frequency.linearRampToValueAtTime(f * 0.97, t + len);
        g.gain.setValueAtTime(0.0001, now);
        g.gain.linearRampToValueAtTime(0.16, t + 0.04);
        g.gain.exponentialRampToValueAtTime(0.001, t + len);
        o.start(t);
        o.stop(t + len + 0.02);
      });
      return 1.6;
    });
  }
}

const METHOD_OF: Record<SoundId, string> = {
  cardSelect: 'playCardSelect',
  cardConfirm: 'playCardConfirm',
  cancel: 'playCancel',
  error: 'playError',
  cardSwipe: 'playCardSwipe',
  detailOpen: 'playDetailOpen',
  manaCharge: 'playManaCharge',
  summonUnit: 'playSummonUnit',
  evolve: 'playEvolve',
  spellCast: 'playSpellCast',
  attackLock: 'playAttackLock',
  attackStart: 'playAttackStart',
  attackHit: 'playAttackHit',
  guard: 'playGuard',
  cardDestroy: 'playCardDestroy',
  bounce: 'playBounce',
  archiveSend: 'playArchiveSend',
  archiveReturn: 'playArchiveReturn',
  barrierHit: 'playBarrierHit',
  barrierBreak: 'playBarrierBreak',
  runeSet: 'playRuneSet',
  runeTrigger: 'playRuneTrigger',
  runeResolve: 'playRuneResolve',
  turnStart: 'playTurnStart',
  victory: 'playVictory',
  defeat: 'playDefeat',
};

export const soundManager = new SoundManager();
