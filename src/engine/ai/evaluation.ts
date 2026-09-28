import { CardTemplate, GameState, UnitState } from '../../types';
import { calculateUnitStats, checkAffinity } from '../engineUtils';
import { canUnitGuard } from '../combatEngine';
import { hasKeyword, isHiddenCard, isInteractionCard, removalReach, tpl } from './cardKnowledge';
import { PlayerId, otherPlayer } from './publicView';
import { EvaluationResult, OpponentProfile } from './types';

/**
 * 盤面評価。
 *
 * 「何をしたか」ではなく「その結果どういうゲーム状態になったか」だけを評価する。
 * そのため、カードを使ったこと・アルカナを置いたこと・何もしなかったこと自体には点を付けない。
 *
 * 優先順位（重みの桁で表現）:
 *   1. 勝利 / 敗北 (±1,000,000)
 *   2. 次の相手ターンでのリーサル被弾 / 次の自分ターンでのリーサル (数千)
 *   3. 結界・盤面（ユニットの除去・生存）(数十〜数百)
 *   4. アルカナ・手札・リソース・将来の展開 (数〜数十)
 *   5. リスク（反撃・推定脅威カード）は期待損失として減点
 */

export const WIN_SCORE = 1_000_000;
const LETHAL_THREAT = 6000;
const LETHAL_POTENTIAL = 900;

// 結界の価値（残り枚数に対して逓増的に重要になる）
const BARRIER_VALUE = [0, 120, 205, 265, 310, 345, 375, 400];
const barrierValue = (b: number) => {
  const c = Math.max(0, b);
  return c < BARRIER_VALUE.length ? BARRIER_VALUE[c] : BARRIER_VALUE[BARRIER_VALUE.length - 1] + (c - BARRIER_VALUE.length + 1) * 20;
};

// k枚目のアルカナの限界価値（序盤ほど大きく、終盤はほぼ0）
const MANA_MARGINAL = [0, 50, 45, 38, 30, 22, 15, 10, 6, 4, 3];
const arcanaValue = (n: number) => {
  let v = 0;
  for (let k = 1; k <= n; k++) v += MANA_MARGINAL[Math.min(k, MANA_MARGINAL.length - 1)] ?? 2;
  return v;
};

export interface EvalContext {
  me: PlayerId;
  profile?: OpponentProfile | null;
}

function bodyValue(t: CardTemplate, atk: number, def: number, brk: number): number {
  let v = 12 + atk * 0.9 + Math.max(0, def) * 0.7 + brk * 26;
  if (hasKeyword(t, 'CannotAttackPlayer')) v -= brk * 18 + 8;
  if (hasKeyword(t, 'Guard')) v += 16;
  if (hasKeyword(t, 'Lethal') || t.id === 'BD-03') v += 22;
  if (hasKeyword(t, 'CannotBeGuarded')) v += 14;
  if (hasKeyword(t, 'CanAttackActive') || t.id === 'BR-09') v += 10;
  if (t.id === 'BB-05' || t.id === 'BB-11') v += 14;
  if (t.id === 'BW-09') v += 10;
  if (t.id === 'BD-02') v -= 6;
  return Math.max(5, v);
}

export function unitValue(s: GameState, pid: PlayerId, u: UnitState): number {
  const t = tpl(u.cards[0].cardId);
  const st = calculateUnitStats(s, pid, u);
  return bodyValue(t, st.atk, st.def, st.brk) + (u.cards.length > 1 ? 6 * (u.cards.length - 1) : 0);
}

/** 不明なカード（ドローした未確認カード）1枚の平均的な価値 */
const UNKNOWN_CARD_VALUE = 45;

/**
 * 手札のカード1枚の価値。「持っていること」ではなく「出したら何になるか」の割引価値で測る。
 * そのため、出した方が盤面価値が高いカードは出す方が高評価になる。
 */
function handCardValue(cardId: string, castableSoon: boolean): number {
  if (isHiddenCard(cardId)) return UNKNOWN_CARD_VALUE;
  const t = tpl(cardId);
  let v: number;
  if (t.type === 'Unit') v = bodyValue(t, t.atk ?? 0, t.def ?? 0, t.brk ?? 0) * 0.55;
  else if (t.type === 'Evolution') v = bodyValue(t, t.atk ?? 0, t.def ?? 0, t.brk ?? 0) * 0.45;
  else v = 36;
  if (isInteractionCard(cardId)) v += 6;
  return v + (castableSoon ? 10 : 0);
}

interface Attacker {
  brk: number;
  cannotBeGuarded: boolean;
}

/** 攻撃側が守護を考慮してもリーサル（結界0からの直接攻撃）を取れるか */
export function canLethal(attackers: Attacker[], guards: number, barrier: number): boolean {
  const hits = remainingHits(attackers, guards);
  let b = barrier;
  for (const brk of hits) {
    if (b <= 0 && brk > 0) return true;
    b = Math.max(0, b - brk);
  }
  return false;
}

/** 守護で止められる攻撃（BRKの大きい順）を取り除いた、通る攻撃のBRK列（降順） */
function remainingHits(attackers: Attacker[], guards: number): number[] {
  const sorted = [...attackers].sort((a, b) => b.brk - a.brk);
  let g = guards;
  const hits: number[] = [];
  for (const a of sorted) {
    if (!a.cannotBeGuarded && g > 0) {
      g--;
      continue;
    }
    hits.push(a.brk);
  }
  return hits;
}

function potentialDamage(attackers: Attacker[], guards: number, barrier: number): number {
  const total = remainingHits(attackers, guards).reduce((a, b) => a + b, 0);
  return Math.min(barrier, total);
}

export function evaluateState(s: GameState, ctx: EvalContext): EvaluationResult {
  const me = ctx.me;
  const oppId = otherPlayer(me);
  if (s.winner) {
    const total = s.winner === me ? WIN_SCORE : -WIN_SCORE;
    return { total, breakdown: { terminal: total } };
  }
  const my = s[me];
  const op = s[oppId];
  const b: Record<string, number> = {};

  // ---------- 1. 結界 ----------
  b.barrier = barrierValue(my.barrier) - 1.1 * barrierValue(op.barrier);

  // ---------- 2. 盤面 ----------
  const myUnits = my.field.map(u => ({ u, st: calculateUnitStats(s, me, u), val: unitValue(s, me, u), t: tpl(u.cards[0].cardId) }));
  const opUnits = op.field.map(u => ({ u, st: calculateUnitStats(s, oppId, u), val: unitValue(s, oppId, u), t: tpl(u.cards[0].cardId) }));
  b.board = myUnits.reduce((a, x) => a + x.val, 0) - opUnits.reduce((a, x) => a + x.val, 0);

  // 相手の「今ターン中」か（相手ターンの行動を仮想実行している最中）
  const inOpponentAction = s.currentPlayer === oppId && s.phase === 'ACTION';

  // ---------- 3. 次の相手ターンの脅威（反撃リスク） ----------
  const oppCanAct = (x: typeof opUnits[number]) => (inOpponentAction ? !x.u.isRested && !x.u.hasSummoningSickness : true);
  const oppAttackers: Attacker[] = opUnits
    .filter(x => oppCanAct(x) && !hasKeyword(x.t, 'CannotAttackPlayer'))
    .map(x => ({ brk: x.st.brk, cannotBeGuarded: hasKeyword(x.t, 'CannotBeGuarded') }));
  const myGuards = my.field.filter(u => canUnitGuard(u)).length;
  const aggression = ctx.profile ? ctx.profile.tendencies.aggression : 0.6;

  b.lethalThreat = canLethal(oppAttackers, myGuards, my.barrier) ? -LETHAL_THREAT : 0;
  const dmg = potentialDamage(oppAttackers, myGuards, my.barrier);
  b.damageThreat = -(barrierValue(my.barrier) - barrierValue(my.barrier - dmg)) * (0.3 + 0.4 * aggression);

  // 自軍ユニットの被撃破リスク（レスト中のユニットは相手ターンに攻撃されうる）
  let exposure = 0;
  const killers = opUnits.filter(oppCanAct).map(x => ({
    atk: x.st.atk,
    lethal: hasKeyword(x.t, 'Lethal') || x.t.id === 'BD-03',
    active: hasKeyword(x.t, 'CanAttackActive') || x.t.id === 'BR-09',
    used: false,
  }));
  const vulnerable = [...myUnits].sort((a, c) => c.val - a.val);
  for (const v of vulnerable) {
    const k = killers.find(k => !k.used && (v.u.isRested || k.active) && (k.atk > v.st.def || k.lethal));
    if (k) {
      k.used = true;
      exposure += v.val * 0.5;
    }
  }
  b.exposure = -exposure;

  // ---------- 4. 推定脅威カードによる除去リスク ----------
  let removalRisk = 0;
  if (ctx.profile && !inOpponentAction && op.hand.length > 0) {
    const threats = ctx.profile.threats.filter(c => c.castableNextTurn && c.handProbability > 0).slice(0, 8);
    const hits = myUnits
      .map(x => {
        let miss = 1;
        for (const c of threats) {
          const reach = removalReach(c.cardId, { def: x.st.def, cost: x.t.cost });
          if (reach > 0) miss *= 1 - c.handProbability * reach;
        }
        return x.val * (1 - miss);
      })
      .sort((a, c) => c - a);
    // 1ターンに使える除去は多くても1〜2枚
    removalRisk = (hits[0] || 0) * 0.6 + (hits[1] || 0) * 0.2;
  }
  b.removalRisk = -removalRisk;

  // ---------- 5. 次の自分ターンの圧力 ----------
  const myAttackers: Attacker[] = myUnits
    .filter(x => !hasKeyword(x.t, 'CannotAttackPlayer'))
    .map(x => ({ brk: x.st.brk, cannotBeGuarded: hasKeyword(x.t, 'CannotBeGuarded') }));
  const oppGuards = opUnits.filter(x => hasKeyword(x.t, 'Guard')).length;
  b.lethalPotential = canLethal(myAttackers, oppGuards, op.barrier) ? LETHAL_POTENTIAL * (op.runes.length > 0 ? 0.35 : 0.5) : 0;
  const myDmg = potentialDamage(myAttackers, oppGuards, op.barrier);
  b.pressure = (barrierValue(op.barrier) - barrierValue(op.barrier - myDmg)) * 0.25;

  // ---------- 6. 手札・アルカナ・将来の展開 ----------
  const myArcanaCount = my.arcana.length;
  const handVals = my.hand
    .map(c => {
      if (isHiddenCard(c.cardId)) return handCardValue(c.cardId, false);
      const t = tpl(c.cardId);
      const affinityNow = checkAffinity(t.system, my.arcana);
      const affinityByCharge = my.hand.some(o => o.instanceId !== c.instanceId && !isHiddenCard(o.cardId) && tpl(o.cardId).system === t.system);
      const castableSoon = t.cost <= myArcanaCount + 1 && (affinityNow || affinityByCharge);
      return handCardValue(c.cardId, castableSoon);
    })
    .sort((a, c) => c - a);
  // 同じ手札でも枚数が増えるほど1枚あたりの価値は逓減する
  b.hand = handVals.reduce((a, v, i) => a + v * Math.pow(0.92, i), 0);
  b.oppHand = -Array.from({ length: op.hand.length }).reduce<number>((a, _, i) => a + UNKNOWN_CARD_VALUE * 0.9 * Math.pow(0.92, i), 0);

  b.arcana = arcanaValue(myArcanaCount) - 0.85 * arcanaValue(op.arcana.length);

  b.runesDomain = (my.runes.length - op.runes.length) * 22 + ((my.domain ? 1 : 0) - (op.domain ? 1 : 0)) * 18;

  // ---------- 7. デッキ切れ ----------
  b.deck = (my.deck.length === 0 ? -3000 : 0) + (op.deck.length === 0 ? 3000 : 0);

  let total = 0;
  for (const k in b) total += b[k];
  return { total, breakdown: b };
}

export const evaluate = (s: GameState, ctx: EvalContext) => evaluateState(s, ctx).total;
