/**
 * 効果音システムのテスト（ブラウザ不要）。
 * A. 盤面の変化 → 鳴らすSEの判定（detectSoundEvents）
 * B. 再生制御レイヤー（クールダウン・同時再生数・優先度・MAJOR）を擬似 Web Audio で検証
 */
import { createInitialState, gameReducer } from '../src/engine/gameEngine';
import { detectSoundEvents, SoundCue } from '../src/utils/soundEvents';
import { GameState, GameAction, UnitState, CardInstance } from '../src/types';

let pass = 0;
let fail = 0;
const assert = (cond: boolean, name: string, detail = '') => {
  if (cond) {
    console.log(`✅ [PASS] ${name}`);
    pass++;
  } else {
    console.error(`❌ [FAIL] ${name} ${detail}`);
    fail++;
  }
};

// ======================================================================
// A. 判定
// ======================================================================
const unit = (id: string, cardId: string, extra: Partial<UnitState> = {}): UnitState => ({
  instanceId: id,
  cards: [{ instanceId: id, cardId }],
  isRested: false,
  hasSummoningSickness: false,
  modifiers: [],
  ...extra,
});
const inst = (id: string, cardId: string): CardInstance => ({ instanceId: id, cardId });
const base = (): GameState => {
  const s = createInitialState();
  s.phase = 'ACTION';
  for (const pid of ['player1', 'player2'] as const) {
    s[pid].arcana = ['BR-01', 'BB-01', 'BG-01', 'BW-01', 'BD-01', 'BN-01'].map((c, i) => inst(`${pid}arc${i}`, c));
    s[pid].maxArcana = 10;
    s[pid].currentArcana = 10;
    s[pid].hand = [];
    s[pid].field = [];
    s[pid].archive = [];
    s[pid].runes = [];
  }
  return s;
};
const cues = (s: GameState, a: GameAction) => {
  const next = gameReducer(s, a);
  return { next, cues: detectSoundEvents(s, next) };
};
const ids = (c: SoundCue[]) => c.map(x => x.id).join(',');
const delayOf = (c: SoundCue[], id: string) => c.find(x => x.id === id)?.delay ?? -1;

{
  const s = base();
  s.player1.hand = [inst('u', 'BR-01')];
  const r = cues(s, { type: 'PLAY_CARD', instanceId: 'u' });
  assert(ids(r.cues) === 'summonUnit', '召喚 → summonUnit のみ', ids(r.cues));
}
{
  const s = base();
  s.player1.field = [unit('base', 'BR-01')];
  s.player1.hand = [inst('evo', 'BR-11')];
  const r = cues(s, { type: 'PLAY_CARD', instanceId: 'evo', evolutionTargetId: 'base' });
  assert(ids(r.cues) === 'evolve', '進化 → evolve のみ（召喚・破壊と誤判定しない）', ids(r.cues));
}
{
  const s = base();
  s.player1.hand = [inst('sp', 'BB-13')];
  const r = cues(s, { type: 'PLAY_CARD', instanceId: 'sp' });
  assert(ids(r.cues) === 'spellCast', 'スペル → spellCast', ids(r.cues));
}
{
  const s = base();
  s.player1.field = [unit('a', 'BD-08')]; // ATK50
  s.player2.field = [unit('d', 'BR-01', { isRested: true })]; // DEF20
  const r = cues(s, { type: 'DECLARE_ATTACK', attackerId: 'a', targetId: 'd' });
  assert(ids(r.cues) === 'attackHit,cardDestroy' && delayOf(r.cues, 'cardDestroy') > delayOf(r.cues, 'attackHit'), '攻撃 → 命中 → 破壊（破壊は少し後）', JSON.stringify(r.cues));
}
{
  const s = base();
  s.player1.field = [unit('a', 'BR-01')];
  const r = cues(s, { type: 'DECLARE_ATTACK', attackerId: 'a' });
  assert(
    ids(r.cues) === 'barrierHit,barrierBreak' && delayOf(r.cues, 'barrierBreak') > 0 && !r.cues.some(c => c.id === 'cardDestroy'),
    '直接攻撃 → 結界Hit → 結界Break',
    JSON.stringify(r.cues),
  );
}
{
  const s = base();
  s.player1.field = [unit('a', 'BD-08')];
  s.player2.field = [unit('g', 'BN-01')]; // 守護持ち（AIは自動で守護を判断）
  s.player2.barrier = 1; // 守護せざるを得ない状況
  const r = cues(s, { type: 'DECLARE_ATTACK', attackerId: 'a' });
  const order = r.cues.map(c => c.id);
  assert(
    order[0] === 'guard' && order.includes('attackHit') && !order.includes('barrierBreak') && !order.includes('barrierHit'),
    '攻撃 → 守護（結界SEは鳴らない、ShieldBreakの流用なし）',
    JSON.stringify(r.cues),
  );
}
{
  // 人間が守護を選ぶ
  const s = base();
  s.currentPlayer = 'player2';
  s.player2.field = [unit('a', 'BD-08')];
  s.player1.field = [unit('g', 'BN-01')];
  const r1 = cues(s, { type: 'DECLARE_ATTACK', attackerId: 'a' });
  assert(r1.next.prompt?.type === 'GUARD' && r1.cues.length === 0, 'AI攻撃 → 守護の選択待ちの間は命中SEを鳴らさない', ids(r1.cues));
  const r2 = cues(r1.next, { type: 'RESOLVE_GUARD', guarderId: 'g' });
  assert(r2.cues[0]?.id === 'guard', '人間が守護 → guard', ids(r2.cues));
}
{
  const s = base();
  s.player1.hand = [inst('sp', 'BB-12')];
  s.player2.field = [unit('t', 'BR-01')];
  const r = cues(s, { type: 'PLAY_CARD', instanceId: 'sp', targetId: 't' });
  assert(ids(r.cues) === 'spellCast,bounce', 'バウンス → bounce（破壊SEと区別）', ids(r.cues));
}
{
  const s = base();
  s.player1.hand = [inst('sp', 'BG-13')];
  s.player2.field = [unit('t', 'BR-01')];
  const r = cues(s, { type: 'PLAY_CARD', instanceId: 'sp', targetId: 't' });
  assert(ids(r.cues) === 'spellCast,archiveSend', 'アルカナに置く → archiveSend（破壊SEと区別）', ids(r.cues));
}
{
  const s = base();
  s.player1.hand = [inst('sp', 'BD-12')];
  s.player2.hand = [inst('h', 'BR-01')];
  const r = cues(s, { type: 'PLAY_CARD', instanceId: 'sp' });
  assert(ids(r.cues) === 'spellCast,archiveSend', '手札を捨てさせる → archiveSend', ids(r.cues));
}
{
  const s = base();
  s.player1.hand = [inst('ana', 'BW-08')];
  s.player1.archive = [inst('sp', 'BR-12')];
  const r = cues(s, { type: 'PLAY_CARD', instanceId: 'ana', targetId: 'sp' });
  assert(ids(r.cues) === 'summonUnit,archiveReturn', 'アーカイブ回収 → archiveReturn', ids(r.cues));
}
{
  // ルーン: 結界破壊でプロンプト → 発動
  const s = base();
  s.player1.field = [unit('a', 'BR-01')];
  s.player2.field = [unit('t', 'BB-02')];
  s.player2.runes = [inst('rn', 'BD-14')];
  const r1 = cues(s, { type: 'DECLARE_ATTACK', attackerId: 'a' });
  assert(
    ids(r1.cues) === 'barrierHit,barrierBreak,runeTrigger' && delayOf(r1.cues, 'runeTrigger') > delayOf(r1.cues, 'barrierBreak'),
    'ルーン: 結界Break の後に発動の割り込み音',
    JSON.stringify(r1.cues),
  );
  const r2 = cues(r1.next, { type: 'RESOLVE_TRIGGER', apply: true, targetId: 'a' });
  assert(ids(r2.cues) === 'runeResolve,cardDestroy', 'ルーン発動 → runeResolve → 破壊', ids(r2.cues));
}
{
  const s = base();
  s.player1.hand = [inst('r', 'BN-05')];
  const r = cues(s, { type: 'PLAY_CARD', instanceId: 'r' });
  assert(ids(r.cues) === 'runeSet', 'ルーン設置 → runeSet', ids(r.cues));
}
{
  // AIの召喚・攻撃も同じ判定を通る
  const s = base();
  s.currentPlayer = 'player2';
  s.player2.hand = [inst('u', 'BB-02')];
  s.player2.field = [unit('a', 'BD-08')];
  const r1 = cues(s, { type: 'PLAY_CARD', instanceId: 'u' });
  assert(ids(r1.cues) === 'summonUnit', 'AI召喚 → summonUnit', ids(r1.cues));
  const r2 = cues(r1.next, { type: 'DECLARE_ATTACK', attackerId: 'a' });
  assert(ids(r2.cues) === 'barrierHit,barrierBreak', 'AI攻撃 → 結界Hit → Break', ids(r2.cues));
}
{
  const s = base();
  s.phase = 'ARCANA_PLACEMENT';
  s.player1.hand = [inst('c', 'BR-01')];
  const r = cues(s, { type: 'PLACE_ARCANA', instanceId: 'c' });
  assert(ids(r.cues) === 'manaCharge', 'アルカナ配置 → manaCharge のみ（フェイズ移行音と重ねない）', ids(r.cues));
  const s2 = base();
  s2.phase = 'ARCANA_PLACEMENT';
  const r2 = cues(s2, { type: 'NEXT_PHASE' });
  assert(r2.cues.length === 0, '配置せず行動へ → 状態由来SEなし（ボタンの決定音だけで二重にしない）', ids(r2.cues));
}
{
  const s = base();
  const r = cues(s, { type: 'NEXT_PHASE' });
  assert(r.cues.length === 0, 'ターン終了（相手へ）では状態由来SEは鳴らない（ターン開始音は別の1か所）', ids(r.cues));
}
{
  const s = base();
  s.player1.field = [unit('a', 'BR-01')];
  s.player2.barrier = 0;
  const r = cues(s, { type: 'DECLARE_ATTACK', attackerId: 'a' });
  assert(r.next.winner === 'player1' && r.cues.some(c => c.id === 'victory') && delayOf(r.cues, 'victory') > 0, '勝利 → victory（最後に）', JSON.stringify(r.cues));
  const s2 = base();
  s2.currentPlayer = 'player2';
  s2.player2.field = [unit('a', 'BR-01')];
  s2.player1.barrier = 0;
  const r2 = cues(s2, { type: 'DECLARE_ATTACK', attackerId: 'a' });
  assert(r2.cues.some(c => c.id === 'defeat'), '敗北 → defeat', ids(r2.cues));
}
{
  const s = base();
  s.player1.field = [unit('a', 'BR-01')];
  s.player2.barrier = 2;
  for (let i = 0; i < 30; i++) s.log.push('...');
  const fresh = createInitialState();
  assert(detectSoundEvents(s, fresh).length === 0, '新しい対戦の開始では何も鳴らさない（盤面が消えても破壊音を出さない）');
}

// ======================================================================
// B. 再生制御レイヤー（擬似 Web Audio）
// ======================================================================
class FakeParam {
  value: number;
  events: string[] = [];
  constructor(v = 0) {
    this.value = v;
  }
  setValueAtTime(v: number) {
    this.events.push(`set:${v.toFixed(3)}`);
    return this;
  }
  linearRampToValueAtTime(v: number) {
    this.events.push(`lin:${v.toFixed(3)}`);
    this.value = v; // 擬似: ランプ先の値を即時反映
    return this;
  }
  exponentialRampToValueAtTime(v: number) {
    this.events.push(`exp:${v.toFixed(3)}`);
    return this;
  }
  cancelScheduledValues() {
    this.events.push('cancel');
    return this;
  }
}
class FakeNode {
  connect() {}
  disconnect() {}
}
class FakeGain extends FakeNode {
  gain = new FakeParam(1);
}
class FakeSource extends FakeNode {
  frequency = new FakeParam(440);
  type = 'sine';
  buffer: unknown = null;
  onended: (() => void) | null = null;
  stops: number[] = [];
  start() {}
  stop(t = 0) {
    this.stops.push(t);
  }
}
class FakeCtx {
  currentTime = 0;
  state = 'running';
  sampleRate = 8000;
  destination = new FakeNode();
  gains: FakeGain[] = [];
  createGain() {
    const g = new FakeGain();
    this.gains.push(g);
    return g;
  }
  createOscillator() {
    return new FakeSource();
  }
  createBufferSource() {
    return new FakeSource();
  }
  createBiquadFilter() {
    return Object.assign(new FakeNode(), { type: 'lowpass', frequency: new FakeParam(), Q: new FakeParam() });
  }
  createDynamicsCompressor() {
    return Object.assign(new FakeNode(), {
      threshold: new FakeParam(),
      knee: new FakeParam(),
      ratio: new FakeParam(),
      attack: new FakeParam(),
      release: new FakeParam(),
    });
  }
  createBuffer(_c: number, len: number, sr: number) {
    return { sampleRate: sr, getChannelData: () => new Float32Array(len) };
  }
  resume() {
    return Promise.resolve();
  }
}

let wall = 0;
const g = globalThis as unknown as Record<string, unknown>;
const store: Record<string, string> = {};
g.localStorage = { getItem: (k: string) => store[k] ?? null, setItem: (k: string, v: string) => (store[k] = v) };
g.window = { AudioContext: FakeCtx, addEventListener() {}, removeEventListener() {} };
Object.defineProperty(globalThis.performance, 'now', { value: () => wall, configurable: true });
const realSetTimeout = globalThis.setTimeout;
(globalThis as unknown as { setTimeout: unknown }).setTimeout = () => 0; // ノード解放タイマーは不要

const run = async () => {
  const { soundManager, SoundPriority } = await import('../src/utils/soundManager');
  const ctx = () => (soundManager as unknown as { ctx: FakeCtx }).ctx;
  const advance = (ms: number) => {
    wall += ms;
    ctx().currentTime += ms / 1000;
  };
  const voices = () => soundManager.debugVoices();
  const live = () => voices().filter(v => !v.releasing);
  const reset = () => {
    advance(5000);
  };

  // 1. 高速カードタップ: 100ms に10回 → クールダウンで間引かれる
  soundManager.playCardTouch();
  let started = 1;
  for (let i = 0; i < 9; i++) {
    advance(10);
    const before = voices().length;
    soundManager.playCardTouch();
    if (voices().length > before) started++;
  }
  assert(started >= 2 && started <= 3, `高速タップ10回 → ${started}回だけ鳴る（クールダウン45ms）`);
  reset();

  // 2. 選択 → 決定: UI音は排他にしない
  soundManager.playCardTouch();
  soundManager.playCardConfirm();
  assert(live().map(v => v.id).join() === 'cardSelect,cardConfirm', 'カード選択と決定は自然に重なる', live().map(v => v.id).join());
  reset();

  // 3. 同じSEの二重呼び出しは1回（発火元が重複しても吸収）
  soundManager.playSummonUnit();
  soundManager.playSummonUnit();
  assert(voices().filter(v => v.id === 'summonUnit').length === 1, '同じSEの同時二重呼び出しは1回に吸収');
  reset();

  // 4. 高優先度が来たら低優先度はフェード、中優先度は減衰
  soundManager.playCardTouch();
  soundManager.playSummonUnit();
  const summonLevelBefore = voices().find(v => v.id === 'summonUnit')!.level;
  soundManager.playCardDestroy();
  const vs = voices();
  assert(vs.find(v => v.id === 'cardSelect')?.releasing === true, '破壊（高）→ UI音（低）は短くフェードアウト');
  const summonAfter = vs.find(v => v.id === 'summonUnit')!;
  assert(!summonAfter.releasing && summonAfter.level < summonLevelBefore && summonAfter.level > 0, `破壊（高）→ 召喚（中）は止めずに減衰（${summonLevelBefore.toFixed(2)} → ${summonAfter.level.toFixed(2)}）`);
  assert(vs.find(v => v.id === 'cardDestroy')?.releasing === false, '破壊は鳴る');
  reset();

  // 5. カテゴリの同時再生数（EFFECT=3）: 4つ目は古い低い方を譲らせる
  soundManager.playBounce();
  advance(1);
  soundManager.playArchiveSend();
  advance(1);
  soundManager.playArchiveReturn();
  advance(1);
  soundManager.playCardDestroy();
  const eff = live().filter(v => v.category === 'EFFECT');
  assert(eff.length <= 3 && eff.some(v => v.id === 'cardDestroy') && !eff.some(v => v.id === 'bounce'), `EFFECT は同時3つまで。最も古い中優先度を譲る（${eff.map(v => v.id).join()}）`);
  reset();

  // 6. 同時再生が多いほど、新しい低〜中優先度の音量を下げる。高優先度は下げない
  soundManager.playCardTouch();
  soundManager.playCardSwipe();
  soundManager.playSummonUnit();
  const spell = (() => {
    soundManager.playSpellCast();
    return voices().find(v => v.id === 'spellCast')!;
  })();
  assert(spell.level < 1, `混雑時の中優先度SEは少し下がる（${spell.level.toFixed(2)}）`);
  soundManager.playGuard();
  assert(voices().find(v => v.id === 'guard')!.level === 1, '守護（高）は混雑していても下げない');
  reset();

  // 7. 攻撃 → 破壊 → 結界 → ルーン の連続（実際の遅延どおり）
  soundManager.playAttackStart();
  advance(200);
  soundManager.playAttackClash();
  advance(150);
  soundManager.playCardDestroy();
  advance(90);
  soundManager.playBarrierBreak();
  advance(170);
  soundManager.playRuneTrigger();
  const peak = live();
  assert(peak.length <= 4, `連続イベントでも同時に鳴るのは${peak.length}音まで（${peak.map(v => v.id).join()}）`);
  assert(peak.some(v => v.id === 'runeTrigger') && peak.some(v => v.id === 'barrierBreak'), '重要な音（結界・ルーン）は埋もれず残る');
  reset();

  // 8. MAJOR: 他の音をフェードし、1つだけ明瞭に。鳴っている間は軽い音を出さない
  soundManager.playSummonUnit();
  soundManager.playBarrierBreak();
  soundManager.playVictory();
  assert(live().map(v => v.id).join() === 'victory', '勝利は他の音をフェードして単独で鳴る', live().map(v => v.id).join());
  assert(voices().find(v => v.id === 'victory')!.level === 1, '勝利は減衰しない');
  soundManager.playCardTouch();
  assert(!voices().some(v => v.id === 'cardSelect'), '勝利中のUI音は鳴らさない');
  advance(300);
  soundManager.playDefeat();
  assert(live().filter(v => v.category === 'MAJOR').length === 1, 'MAJOR は同時に1つだけ');
  reset();

  // 9. ミュート
  soundManager.setMute(true);
  soundManager.playGuard();
  assert(live().length === 0 && store.scriptia_se_muted === 'true', 'ミュート中は鳴らず、設定が保存される');
  soundManager.setMute(false);

  // 10. 追加SEがすべて制御レイヤーを通る
  const added = ['playCardSelect', 'playCardConfirm', 'playCancel', 'playError', 'playAttackStart', 'playAttackHit', 'playGuard', 'playBarrierHit', 'playBarrierBreak', 'playSpellCast', 'playBounce', 'playArchiveSend', 'playArchiveReturn', 'playRuneSet', 'playRuneResolve', 'playVictory', 'playDefeat'];
  let ok = true;
  for (const m of added) {
    reset();
    (soundManager as unknown as Record<string, () => void>)[m]();
    if (voices().length !== 1) ok = false;
  }
  assert(ok, `追加SE ${added.length}種はすべて制御レイヤー経由で1音ずつ鳴る`);
  assert(SoundPriority.MAJOR > SoundPriority.HIGH, '優先度の順序');

  (globalThis as unknown as { setTimeout: unknown }).setTimeout = realSetTimeout;
  console.log(`\n効果音テスト: 全${pass + fail}件中 ${pass}件 PASS / ${fail}件 FAIL`);
  process.exit(fail > 0 ? 1 : 0);
};
run();
