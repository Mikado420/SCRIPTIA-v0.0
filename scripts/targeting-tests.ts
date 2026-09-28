import { createInitialState, gameReducer } from '../src/engine/gameEngine';
import { getCardTargetSpec, getRuneTargetSpec } from '../src/engine/targeting';
import { promptOptions } from '../src/engine/ai/simulation';
import { GameState, UnitState, CardInstance } from '../src/types';

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

const unit = (id: string, cardId: string): UnitState => ({
  instanceId: id,
  cards: [{ instanceId: id, cardId }],
  isRested: false,
  hasSummoningSickness: false,
  modifiers: [],
});
const inst = (id: string, cardId: string): CardInstance => ({ instanceId: id, cardId });

/** player1 の行動フェイズ。アルカナは全属性を満たす */
const base = (): GameState => {
  const s = createInitialState();
  s.phase = 'ACTION';
  s.player1.arcana = ['BR-01', 'BB-01', 'BG-01', 'BW-01', 'BD-01', 'BN-01'].map((c, i) => inst(`arc${i}`, c));
  s.player1.maxArcana = 10;
  s.player1.currentArcana = 10;
  s.player1.hand = [];
  s.player1.field = [];
  s.player1.archive = [];
  s.player2.field = [];
  s.player2.runes = [];
  return s;
};
const fieldIds = (s: GameState, pid: 'player1' | 'player2') => s[pid].field.map(u => u.instanceId);

// ---------------------------------------------------------------- BD-11 ネクロシア
const necro = (oppUnits: UnitState[]) => {
  const s = base();
  s.player1.field = [unit('parasite', 'BD-01')];
  s.player1.hand = [inst('necro', 'BD-11')];
  s.player2.field = oppUnits;
  return s;
};
{
  // DEF80以下が複数（BD-01:DEF20, BD-08:DEF50）+ DEF80超えなし
  const s = necro([unit('o1', 'BD-01'), unit('o2', 'BD-08')]);
  const spec = getCardTargetSpec(s, 'player1', 'BD-11');
  assert(spec?.candidates.length === 2 && spec.count === 1, 'BD-11: DEF80以下の候補が2体、1体選択');
  const r = gameReducer(s, { type: 'PLAY_CARD', instanceId: 'necro', evolutionTargetId: 'parasite', targetId: 'o2' });
  assert(fieldIds(r, 'player2').join() === 'o1', 'BD-11: 選択したユニットだけが破壊される', fieldIds(r, 'player2').join());
  const r2 = gameReducer(s, { type: 'PLAY_CARD', instanceId: 'necro', evolutionTargetId: 'parasite' });
  assert(r2.player2.field.length === 2, 'BD-11: 候補が複数で未選択なら先頭を勝手に破壊しない');
  const r3 = gameReducer(s, { type: 'PLAY_CARD', instanceId: 'necro', evolutionTargetId: 'parasite', targetId: 'parasite' });
  assert(r3.player1.field.length === 1 && r3.player2.field.length === 2, 'BD-11: 候補外（自分のユニット）は対象にできない');
}
{
  // DEF80以下が1体（もう1体はDEF90相当にする）
  const big = unit('big', 'BD-09');
  big.modifiers.push({ sourceId: 'test', atk: 0, def: 30, brk: 0, duration: 'PERMANENT' });
  const s = necro([unit('o1', 'BD-01'), big]);
  const r = gameReducer(s, { type: 'PLAY_CARD', instanceId: 'necro', evolutionTargetId: 'parasite' });
  assert(fieldIds(r, 'player2').join() === 'big', 'BD-11: 候補1体なら自動確定で破壊');
}
{
  const s = necro([]);
  const r = gameReducer(s, { type: 'PLAY_CARD', instanceId: 'necro', evolutionTargetId: 'parasite' });
  assert(r.player1.field[0]?.cards[0].cardId === 'BD-11' && r.log.some(l => l.includes('不発')), 'BD-11: 候補0なら進化はして効果は不発');
}
{
  const s = necro([unit('o1', 'BD-01')]);
  s.player1.field = [unit('wrong', 'BR-01')];
  const r = gameReducer(s, { type: 'PLAY_CARD', instanceId: 'necro', evolutionTargetId: 'wrong' });
  assert(r.player1.hand.length === 1 && r.player1.field[0].cards.length === 1, 'BD-11: 系譜の違うユニットには進化できない');
}

// ---------------------------------------------------------------- BD-10 バグラザード
{
  const s = base();
  s.player1.hand = [inst('bagra', 'BD-10')];
  s.player1.archive = [inst('d1', 'BD-01'), inst('d2', 'BD-12'), inst('d3', 'BD-08'), inst('f1', 'BR-01')];
  const spec = getCardTargetSpec(s, 'player1', 'BD-10');
  assert(spec?.candidates.join() === 'd1,d2,d3' && spec.count === 2 && spec.optional, 'BD-10: 候補は自分のアーカイブの闇カードのみ、2枚・任意');
  const r = gameReducer(s, { type: 'PLAY_CARD', instanceId: 'bagra', targetId: 'd1,d3' });
  const hand = r.player1.hand.map(c => c.instanceId).sort().join();
  assert(hand === 'd1,d3' && r.player1.archive.length === 2, 'BD-10: 選択した2枚が手札に戻る', hand);
  const rNo = gameReducer(s, { type: 'PLAY_CARD', instanceId: 'bagra' });
  assert(rNo.player1.field.length === 1 && rNo.player1.hand.length === 0 && rNo.player1.archive.length === 4, 'BD-10: 0枚（使わない）でも召喚される');
  const rBad = gameReducer(s, { type: 'PLAY_CARD', instanceId: 'bagra', targetId: 'd1,f1' });
  assert(rBad.player1.hand.length === 0, 'BD-10: 闇以外を含む選択は無効');
  const rOne = gameReducer(s, { type: 'PLAY_CARD', instanceId: 'bagra', targetId: 'd1' });
  assert(rOne.player1.hand.length === 0, 'BD-10: 候補が2枚以上ある時に1枚だけの選択は無効（テキストどおり2枚）');
}

// ---------------------------------------------------------------- その他の対象指定
{
  const s = base();
  s.player1.hand = [inst('drag', 'BR-08')];
  s.player2.field = [unit('o1', 'BD-01'), unit('o2', 'BB-01'), unit('big', 'BD-08')];
  const spec = getCardTargetSpec(s, 'player1', 'BR-08');
  assert(!spec?.candidates.includes('big'), 'BR-08: DEF40超えは候補に入らない');
  const r = gameReducer(s, { type: 'PLAY_CARD', instanceId: 'drag', targetId: 'o2' });
  assert(fieldIds(r, 'player2').join() === 'o1,big', 'BR-08: 選択したユニットだけ破壊');
}
{
  const s = base();
  s.player1.hand = [inst('tide', 'BB-09'), inst('quel', 'BW-05')];
  s.player2.field = [unit('o1', 'BD-01'), unit('o2', 'BB-01')];
  const r = gameReducer(s, { type: 'PLAY_CARD', instanceId: 'tide', targetId: 'o2' });
  assert(fieldIds(r, 'player2').join() === 'o1' && r.player2.hand.some(c => c.instanceId === 'o2'), 'BB-09: 選択したユニットだけ手札に戻る');
  const r2 = gameReducer(s, { type: 'PLAY_CARD', instanceId: 'quel', targetId: 'o2' });
  assert(!r2.player2.field[0].isRested && r2.player2.field[1].isRested, 'BW-05: 選択したユニットだけレスト');
}
{
  const s = base();
  s.player1.hand = [inst('ana', 'BW-08')];
  s.player1.archive = [inst('sp1', 'BR-12'), inst('sp2', 'BN-04'), inst('u1', 'BR-01')];
  const r = gameReducer(s, { type: 'PLAY_CARD', instanceId: 'ana', targetId: 'sp2' });
  assert(r.player1.hand.map(c => c.instanceId).join() === 'sp2', 'BW-08: 選択したスペル/ルーン1枚だけ手札に戻る');
  const rBad = gameReducer(s, { type: 'PLAY_CARD', instanceId: 'ana', targetId: 'u1' });
  assert(rBad.player1.hand.length === 0, 'BW-08: ユニットは選択できない');
}
{
  // スペル: 候補外の対象を拒否、BN-04 は選んだルーンだけ
  const s = base();
  s.player1.hand = [inst('dart', 'BR-12'), inst('dispel', 'BN-04')];
  s.player2.field = [unit('small', 'BD-01'), unit('big', 'BD-08')];
  s.player2.runes = [inst('r1', 'BD-14'), inst('r2', 'BB-14')];
  const r = gameReducer(s, { type: 'PLAY_CARD', instanceId: 'dart', targetId: 'big' });
  assert(r.player2.field.length === 2, 'BR-12: 条件外（DEF20超え）の対象は破壊されない');
  const r2 = gameReducer(s, { type: 'PLAY_CARD', instanceId: 'dart', targetId: 'small' });
  assert(fieldIds(r2, 'player2').join() === 'big', 'BR-12: 条件内の選択対象を破壊');
  const r3 = gameReducer(s, { type: 'PLAY_CARD', instanceId: 'dispel', targetId: 'r2' });
  assert(r3.player2.runes.map(c => c.instanceId).join() === 'r1', 'BN-04: 選択したルーンだけ手札に戻る');
  const r4 = gameReducer(s, { type: 'PLAY_CARD', instanceId: 'dispel' });
  assert(r4.prompt?.type === 'TARGET_SELECTION' && r4.prompt.validTargets?.join() === 'r1,r2', 'BN-04: 対象未指定なら選択プロンプトになる（先頭を選ばない）');
}
{
  // ルーン（結界破壊時）
  const mk = (rune: string) => {
    const s = base();
    s.player1.runes = [inst('rn', rune)];
    s.player2.field = [unit('o1', 'BD-01'), unit('o2', 'BB-01'), unit('o3', 'BG-01')];
    s.prompt = { type: 'RUNE_TRIGGER', playerId: 'player1', sourceId: 'rn', message: '' };
    return s;
  };
  const r = gameReducer(mk('BD-14'), { type: 'RESOLVE_TRIGGER', apply: true, targetId: 'o3' });
  assert(fieldIds(r, 'player2').join() === 'o1,o2', 'BD-14: 選択したユニットだけ破壊');
  const rNo = gameReducer(mk('BD-14'), { type: 'RESOLVE_TRIGGER', apply: true });
  assert(rNo.player2.field.length === 3, 'BD-14: 候補が複数で未選択なら先頭を破壊しない');
  const rW = gameReducer(mk('BW-14'), { type: 'RESOLVE_TRIGGER', apply: true, targetId: 'o1,o3' });
  assert(rW.player2.field.map(u => u.isRested).join() === 'true,false,true', 'BW-14: 選択した2体だけレスト');
  const spec = getRuneTargetSpec(mk('BW-14'), 'player1', 'BW-14');
  assert(spec?.count === 2 && spec.candidates.length === 3, 'BW-14: 3体から2体選択');
  const opts = promptOptions(mk('BW-14'));
  assert(opts.filter(o => o.type === 'RESOLVE_TRIGGER' && o.apply).length === 3, 'AI: ルーンの合法な対象の組み合わせ（3C2=3通り）を列挙');
}

// ---------------------------------------------------------------- ランダム効果は変わらない
{
  const orig = Math.random;
  const s = base();
  s.player1.hand = [inst('hyde', 'BD-06'), inst('whisper', 'BD-12')];
  s.player2.hand = [inst('h0', 'BR-01'), inst('h1', 'BR-02'), inst('h2', 'BR-03')];
  Math.random = () => 0.99;
  const r = gameReducer(s, { type: 'PLAY_CARD', instanceId: 'hyde' });
  const r2 = gameReducer(s, { type: 'PLAY_CARD', instanceId: 'whisper' });
  Math.random = orig;
  assert(r.player2.archive.map(c => c.instanceId).join() === 'h2' && r2.player2.archive.map(c => c.instanceId).join() === 'h2', 'ランダム効果（BD-06/BD-12）は従来どおり Math.random で選ばれる');
}

console.log(`\n対象選択テスト: 全${pass + fail}件中 ${pass}件 PASS / ${fail}件 FAIL`);
process.exit(fail > 0 ? 1 : 0);
