import { GameState, Card, BoardUnit, PlayerState, UnitState, CardInstance } from '../types';
import { getCard } from '../data/cards';
import { calculateUnitStats } from './engineUtils';
import {
  AIDecision,
  OpponentProfile,
  analyzeOpponent as analyzeOpponentPublic,
  buildAIView,
  decideAction,
} from './ai';

export type { OpponentProfile } from './ai';

export interface CardPlayAction {
  card: Card;
  targetUnitId?: string;
  targetDomain?: boolean;
  targetRuneIndex?: number;
}

export interface AttackAction {
  attacker: BoardUnit;
  targetType: 'PLAYER' | 'UNIT';
  targetUnit?: BoardUnit;
  score: number;
  reason?: string;
}

export interface TurnPlan {
  chargeCard: Card | null;
  plays: CardPlayAction[];
  attacks: AttackAction[];
  totalScore: number;
  reason: string;
  decision?: AIDecision;
}

/**
 * カードインスタンスから完全な属性・制限値・能力を持つCardを生成
 */
export function toFullCard(ci: CardInstance | Card): Card {
  if ('system' in ci && 'type' in ci && 'cost' in ci && (ci as any).id) {
    const el = (ci as any).element || (ci as any).system;
    const cType = (ci as any).cardType || (ci as any).type;
    return {
      ...ci,
      element: el,
      cardType: cType,
      restrictions: (ci as any).restrictions || {
        cannotAttackPlayer: (ci as any).keywords?.includes('CannotAttackPlayer') || (ci as any).keywords?.includes('相手プレイヤーを攻撃できない'),
        cannotBeGuarded: (ci as any).keywords?.includes('CannotBeGuarded'),
        canAttackActive: (ci as any).keywords?.includes('CanAttackActive'),
      },
    } as Card;
  }
  const template = getCard((ci as CardInstance).cardId);
  const el = template.element || template.system;
  const cType = template.cardType || template.type;
  return {
    ...template,
    ...ci,
    id: template.id,
    name: template.name,
    cost: template.cost,
    system: template.system,
    type: template.type,
    lineage: template.lineage,
    atk: template.atk,
    def: template.def,
    brk: template.brk,
    keywords: template.keywords,
    effectText: template.effectText,
    element: el,
    cardType: cType,
    restrictions: template.restrictions || {
      cannotAttackPlayer: template.keywords?.includes('CannotAttackPlayer') || template.keywords?.includes('相手プレイヤーを攻撃できない' as any),
      cannotBeGuarded: template.keywords?.includes('CannotBeGuarded'),
      canAttackActive: template.keywords?.includes('CanAttackActive'),
    },
  };
}

/**
 * Raw UnitState をリアルタイムステータス付き BoardUnit に変換
 */
export function toBoardUnit(state: GameState, playerId: 'player1' | 'player2', unit: UnitState): BoardUnit {
  const card = getCard(unit.cards[0].cardId);
  const stats = calculateUnitStats(state, playerId, unit);
  const el = card.element || card.system;
  const cType = card.cardType || card.type;
  const fullCard: Card = {
    ...card,
    element: el,
    cardType: cType,
    restrictions: card.restrictions || {
      cannotAttackPlayer: card.keywords?.includes('CannotAttackPlayer') || card.keywords?.includes('相手プレイヤーを攻撃できない' as any),
      cannotBeGuarded: card.keywords?.includes('CannotBeGuarded'),
      canAttackActive: card.keywords?.includes('CanAttackActive'),
    },
  };

  return {
    ...unit,
    card: fullCard,
    currentAtk: stats.atk,
    currentDef: stats.def,
    currentBrk: stats.brk,
  };
}

// ======================================================================
// 後方互換API
// 実際のAI対戦は src/engine/ai/（探索型エンジン + ターンランナー）で行う。
// ここには既存テスト・ツールが利用しているヘルパーを残している。
// ======================================================================

export class ScriptiaAIEngine {
  /** 相手デッキ分析（公開情報のみ）。state.currentPlayer をAI側とみなす */
  public static analyzeOpponent(state: GameState): OpponentProfile {
    const aiId = state.currentPlayer;
    return analyzeOpponentPublic(buildAIView(state, aiId), aiId);
  }

  public static evaluateUnit(unit: BoardUnit, isOwner: boolean, barrier: number): number {
    const atk = unit.currentAtk ?? unit.card.atk ?? 0;
    const def = unit.currentDef ?? unit.card.def ?? 0;
    const brk = unit.currentBrk ?? unit.card.brk ?? 1;

    let val = (atk * 0.6) + (def * 0.7) + (brk * 25);
    if (unit.isRested) val *= 0.6;
    const kw = (unit.card.keywords || []) as string[];
    const hasRush = kw.includes('速攻') || kw.includes('Rush');
    if (unit.hasSummoningSickness && !hasRush) val *= 0.85;

    if (kw.includes('守護') || kw.includes('Guard')) val += (25 + Math.max(0, 4 - barrier) * 12);
    if (kw.includes('必殺') || kw.includes('Lethal')) val += 40;
    if (hasRush) val += 20;
    if (unit.card.cardType === 'EVOLUTION' || unit.card.type === 'Evolution') val += 30;

    return val;
  }

  // 系統条件チェック
  public static checkAffinity(card: Card, arcana: Card[]): boolean {
    const el = card.element || card.system;
    if (!el || el === '無' || el === 'Neutral') return true;
    const norm = (e: string) => {
      if (e === '火' || e === 'Fire') return 'Fire';
      if (e === '水' || e === 'Water') return 'Water';
      if (e === '地' || e === 'Earth') return 'Earth';
      if (e === '光' || e === 'Light') return 'Light';
      if (e === '闇' || e === 'Dark') return 'Dark';
      return 'Neutral';
    };
    const target = norm(el);
    return arcana.some(a => norm((a.element || a.system) || '') === target);
  }

  /**
   * 単純な攻撃割り当て（ヒューリスティック）。
   * 探索エンジンでは使わないが、既存テスト・簡易判定用に残している。
   */
  public static evaluateAttacks(
    field: BoardUnit[],
    opponentField: BoardUnit[],
    opponentBarrier: number,
    opponentRunesCount: number
  ): AttackAction[] {
    const plannedAttacks: AttackAction[] = [];
    const available = field.filter(
      u => !u.isRested && (!u.hasSummoningSickness || u.card.keywords?.includes('速攻' as any) || u.card.keywords?.includes('Rush' as any))
    );
    const remainingEnemies = [...opponentField];

    for (const attacker of available) {
      const atk = attacker.currentAtk ?? attacker.card.atk ?? 0;
      const brk = attacker.currentBrk ?? attacker.card.brk ?? 1;
      let bestAttack: AttackAction | null = null;
      let maxScore = -99999;

      const cannotAtkPlayer =
        attacker.card.restrictions?.cannotAttackPlayer ||
        attacker.card.keywords?.includes('CannotAttackPlayer' as any) ||
        attacker.card.keywords?.includes('相手プレイヤーを攻撃できない' as any);

      if (!cannotAtkPlayer) {
        let pScore = (brk * 45);
        if (opponentBarrier <= 2) pScore += 40;
        if (opponentRunesCount > 0) {
          if (atk <= 20) pScore += 30; // 囮攻撃ボーナス
          else pScore -= 20; // 罠被弾リスク
        }
        pScore -= (attacker.currentDef ?? attacker.card.def ?? 20) * 0.2;
        if (opponentBarrier === 0) pScore = 999999; // リーサル

        if (pScore > maxScore) {
          maxScore = pScore;
          bestAttack = { attacker, targetType: 'PLAYER', score: pScore, reason: '相手プレイヤー/結界へ攻撃' };
        }
      }

      const targets = remainingEnemies.filter(e => e.isRested);
      for (const target of targets) {
        const tDef = target.currentDef ?? target.card.def ?? 0;
        const isLethal = attacker.card.keywords?.includes('必殺' as any) || attacker.card.keywords?.includes('Lethal' as any);
        if (atk < tDef && !isLethal) continue; // 自爆回避

        let uScore = 0;
        const targetVal = this.evaluateUnit(target, false, opponentBarrier);
        if (atk > tDef || isLethal) {
          uScore = 75 + targetVal;
        } else {
          const myVal = this.evaluateUnit(attacker, true, 5);
          if (targetVal >= myVal) uScore = 30 + (targetVal - myVal);
          else continue;
        }

        if (uScore > maxScore) {
          maxScore = uScore;
          bestAttack = {
            attacker,
            targetType: 'UNIT',
            targetUnit: target,
            score: uScore,
            reason: `相手の【${target.card.name}】へ有利トレード`,
          };
        }
      }

      if (bestAttack && bestAttack.score > 0) {
        plannedAttacks.push(bestAttack);
        if (bestAttack.targetType === 'UNIT' && bestAttack.targetUnit) {
          const idx = remainingEnemies.findIndex(e => e.instanceId === bestAttack!.targetUnit!.instanceId);
          if (idx !== -1) remainingEnemies.splice(idx, 1);
        }
      }
    }

    return plannedAttacks;
  }

  /**
   * 1ターン分の最善プラン（探索エンジンの結果を旧形式に変換）。
   * AIは player2 として扱う。
   */
  public static planBestTurn(state: GameState, oppProfile?: OpponentProfile): TurnPlan {
    const aiId = 'player2' as const;
    const profile = oppProfile || analyzeOpponentPublic(buildAIView(state, aiId), aiId);
    const decision = decideAction(state, aiId, { profile });
    const ai = state[aiId];
    const human = state.player1;

    const plan: TurnPlan = { chargeCard: null, plays: [], attacks: [], totalScore: decision.expectedValue, reason: decision.reason, decision };
    for (const step of decision.line) {
      const a = step.action;
      if (a.type === 'PLACE_ARCANA') {
        const inst = ai.hand.find(c => c.instanceId === a.instanceId);
        if (inst) plan.chargeCard = toFullCard(inst);
      } else if (a.type === 'PLAY_CARD') {
        const inst = ai.hand.find(c => c.instanceId === a.instanceId);
        if (inst) plan.plays.push({ card: toFullCard(inst), targetUnitId: a.targetId });
      } else if (a.type === 'DECLARE_ATTACK') {
        const unit = ai.field.find(u => u.instanceId === a.attackerId);
        if (!unit) continue;
        const target = a.targetId ? human.field.find(u => u.instanceId === a.targetId) : undefined;
        plan.attacks.push({
          attacker: toBoardUnit(state, aiId, unit),
          targetType: a.targetId ? 'UNIT' : 'PLAYER',
          targetUnit: target ? toBoardUnit(state, 'player1', target) : undefined,
          score: decision.expectedValue,
          reason: step.label,
        });
      }
    }
    return plan;
  }

  // 守護判断（旧ヒューリスティック。探索エンジンは decidePromptResponse を使う）
  public static shouldGuard(state: GameState, attacker: BoardUnit, availableGuardians: BoardUnit[]): BoardUnit | null {
    if (availableGuardians.length === 0) return null;
    const ai = state.opponent || state.player2;
    const atk = attacker.currentAtk ?? attacker.card.atk ?? 0;
    const brk = attacker.currentBrk ?? attacker.card.brk ?? 1;

    for (const g of availableGuardians) {
      const def = g.currentDef ?? g.card.def ?? 0;
      if (def > atk) return g; // 相手自爆なら即守護
      if (ai.barrier <= brk) return g; // 即死回避の身代わり
      if (g.card.id === 'BD-02' && brk >= 2) return g; // マリーの有効活用
      if (def === atk && attacker.card.cost >= g.card.cost) return g; // 有利相打ち
    }
    return null;
  }

  // 互換性ヘルパー：個別最高攻撃の選択
  public static selectBestAttack(state: GameState): AttackAction | null {
    const ai = state.opponent || state.player2;
    const player = state.player || state.player1;
    const aiField = ai.field.map(u => toBoardUnit(state, 'player2', u));
    const playerField = player.field.map(u => toBoardUnit(state, 'player1', u));
    const attacks = this.evaluateAttacks(aiField, playerField, player.barrier, player.runes.length);
    if (attacks.length === 0) return null;
    return attacks.sort((a, b) => b.score - a.score)[0];
  }

  // 互換性ヘルパー：マナチャージ候補選定
  public static selectManaChargeCard(playerState: PlayerState): Card | null {
    const hand = playerState.hand.map(toFullCard);
    if (hand.length <= 1) return null;
    return hand.sort((a, b) => a.cost - b.cost)[0] || null;
  }
}
