import React, { useEffect, useRef } from 'react';
import { GameState, Card, BoardUnit, PlayerState, GameAction, UnitState, CardInstance } from '../types';
import { getCard } from '../data/cards';
import { calculateUnitStats } from './engineUtils';
import { canUnitGuard } from './combatEngine';

/**
 * Helper to wrap raw UnitState into BoardUnit with live calculated stats & card data
 */
export function toBoardUnit(state: GameState, playerId: 'player1' | 'player2', unit: UnitState): BoardUnit {
  const card = getCard(unit.cards[0].cardId);
  const stats = calculateUnitStats(state, playerId, unit);
  return {
    ...unit,
    card,
    currentAtk: stats.atk,
    currentDef: stats.def,
    currentBrk: stats.brk,
  };
}

export interface AttackAction {
  attacker: BoardUnit;
  targetType: 'PLAYER' | 'UNIT';
  targetUnit?: BoardUnit;
  score: number;
  reason: string;
}

/**
 * SCRIPTIA Ver 0.07 高精度盤面・アクション評価AIエンジン
 */
export class ScriptiaAIEngine {

  // ==========================================
  // 1. 盤面およびカードの静的・動的評価関数
  // ==========================================

  /** 結界枚数に応じた非線形価値スコア（0に近づくほど価値増大） */
  private static getBarrierScore(barrier: number): number {
    const scores = [0, 100, 165, 210, 245, 275]; // 結界0〜5
    return scores[Math.max(0, Math.min(5, barrier))] || 0;
  }

  /** ユニットの戦力評価スコア */
  public static evaluateUnit(unit: BoardUnit | UnitState, isOwner: boolean, playerBarrier: number): number {
    const bUnit = (unit as BoardUnit).card ? (unit as BoardUnit) : ({
      ...unit,
      card: getCard(unit.cards[0].cardId),
    } as BoardUnit);

    const atk = bUnit.currentAtk ?? bUnit.card.atk ?? 0;
    const def = bUnit.currentDef ?? bUnit.card.def ?? 0;
    const brk = bUnit.currentBrk ?? bUnit.card.brk ?? 1;

    // 自爆ルールの特性上、耐久(DEF)を高く評価
    let value = (atk * 0.6) + (def * 0.7) + (brk * 25);

    // 状態による補正
    if (bUnit.isRested) {
      // レスト状態は相手から一方的に殴られるため価値が約40%低下
      value *= 0.6;
    }

    const keywords = bUnit.card.keywords || [];
    const hasRush = keywords.includes('速攻' as any) || keywords.includes('Rush');

    if (bUnit.hasSummoningSickness && !hasRush) {
      value *= 0.85;
    }

    // キーワード能力補正
    const hasGuard = keywords.includes('守護' as any) || keywords.includes('Guard');
    if (hasGuard) {
      // 結界がピンチの時ほど守護の価値が跳ね上がる
      const defenseUrgency = Math.max(0, 4 - playerBarrier) * 12;
      value += (25 + defenseUrgency);
    }
    if (keywords.includes('必殺' as any) || keywords.includes('Lethal')) {
      value += 40; // どんな大型とも相打ちできる抑止力
    }
    if (hasRush) {
      value += 20;
    }
    if (bUnit.card.cardType === 'EVOLUTION' || bUnit.card.type === 'Evolution') {
      value += 30; // 進化ユニットのカードスタック価値
    }

    return value;
  }

  /** 全体盤面評価値（AI視点：プラスならAI有利、マイナスならプレイヤー有利） */
  public static evaluateBoardState(state: GameState): number {
    const ai = (state as any).opponent || state.player2;
    const player = (state as any).player || state.player1;

    // 1. リーサル絶対判定
    const aiBoardUnits = ai.field.map((u: UnitState) => toBoardUnit(state, 'player2', u));
    const playerBoardUnits = player.field.map((u: UnitState) => toBoardUnit(state, 'player1', u));

    if (
      player.barrier === 0 &&
      aiBoardUnits.some((u: BoardUnit) =>
        !u.isRested &&
        !u.hasSummoningSickness &&
        !u.card.restrictions?.cannotAttackPlayer &&
        !u.card.keywords?.includes('CannotAttackPlayer')
      )
    ) {
      return 999999; // AIの確定勝利
    }
    if (
      ai.barrier === 0 &&
      playerBoardUnits.some((u: BoardUnit) => !u.isRested && !u.hasSummoningSickness)
    ) {
      return -999999; // AIの敗北危機
    }

    // 2. 結界スコア
    let score = this.getBarrierScore(ai.barrier) - this.getBarrierScore(player.barrier);

    // 3. 盤面戦力スコア
    const aiBoardScore = aiBoardUnits.reduce(
      (sum: number, u: BoardUnit) => sum + this.evaluateUnit(u, true, ai.barrier),
      0
    );
    const playerBoardScore = playerBoardUnits.reduce(
      (sum: number, u: BoardUnit) => sum + this.evaluateUnit(u, false, player.barrier),
      0
    );
    score += (aiBoardScore - playerBoardScore);

    // 4. 手札・リソーススコア（1枚 = 約25点）
    score += (ai.hand.length - player.hand.length) * 25;

    // 5. ルーン・ドメインの配置アドバンテージ
    score += (ai.runes.length * 30) - (player.runes.length * 35); // 相手の伏せルーンは警戒
    if (ai.domain) score += 40;
    if (player.domain) score -= 40;

    return score;
  }

  // ==========================================
  // 2. マナチャージ判定ルーチン
  // ==========================================

  /** 手札の中からチャージに最適な1枚を選定（不要ならnull） */
  public static selectManaChargeCard(ai: PlayerState): (Card & { instanceId: string }) | null {
    if (ai.hand.length === 0) return null;

    // アルカナに存在する系統を収集
    const currentElements = new Set(
      ai.arcana.map(c => {
        const tpl = getCard(c.cardId);
        return (c as any).element || tpl.element || tpl.system || '無';
      })
    );

    let bestCard: (Card & { instanceId: string }) | null = null;
    let highestChargeScore = -9999;

    for (const rawCard of ai.hand) {
      const tpl = getCard(rawCard.cardId);
      const card: Card & { instanceId: string } = {
        ...tpl,
        instanceId: rawCard.instanceId,
        element: tpl.element || tpl.system,
      };

      let chargeScore = 0;

      // ① 系統条件の解放ボーナス（最重要）
      const el = card.element || card.system || '無';
      if (el && el !== '無' && el !== 'Neutral' && !currentElements.has(el)) {
        chargeScore += 80;
      }

      // ② コストカーブ判定（現在マナより重すぎるカードはチャージ候補）
      const currentManaCapacity = ai.arcana.length;
      if (card.cost > currentManaCapacity + 2) {
        chargeScore += 40; // 2ターン先まで出せない重いカード
      } else if (card.cost === currentManaCapacity + 1) {
        chargeScore -= 30; // 次のターン綺麗に出せる本命カードはキープ
      }

      // ③ 手札の重複判定（同じカードが2枚以上あれば1枚チャージ）
      const duplicates = ai.hand.filter(c => c.cardId === card.id).length;
      if (duplicates > 1) {
        chargeScore += 35;
      }

      // ④ 守護カードの温存（結界ピンチ時は守護を手札に残す）
      const hasGuard = card.keywords?.includes('守護' as any) || card.keywords?.includes('Guard');
      if (hasGuard && ai.barrier <= 3) {
        chargeScore -= 50;
      }

      if (chargeScore > highestChargeScore) {
        highestChargeScore = chargeScore;
        bestCard = card;
      }
    }

    return bestCard;
  }

  // ==========================================
  // 3. 攻撃判定ルーチン（自爆根絶・有利トレード）
  // ==========================================

  /** 最適な攻撃手を決定する（打つ手がない・自爆手しかない場合はnull） */
  public static selectBestAttack(state: GameState): AttackAction | null {
    const ai = (state as any).opponent || state.player2;
    const player = (state as any).player || state.player1;

    // 攻撃可能な自軍ユニットを抽出
    const attackers = ai.field
      .map((u: UnitState) => toBoardUnit(state, 'player2', u))
      .filter((u: BoardUnit) =>
        !u.isRested &&
        (!u.hasSummoningSickness || u.card.keywords?.includes('速攻' as any) || u.card.keywords?.includes('Rush'))
      );

    if (attackers.length === 0) return null;

    const candidates: AttackAction[] = [];

    for (const attacker of attackers) {
      const atk = attacker.currentAtk ?? attacker.card.atk ?? 0;
      const brk = attacker.currentBrk ?? attacker.card.brk ?? 1;
      const isCannotAttackPlayer = attacker.card.restrictions?.cannotAttackPlayer || attacker.card.keywords?.includes('CannotAttackPlayer');

      // ----------------------------------------
      // A. 相手プレイヤー（結界）への直接攻撃の評価
      // ----------------------------------------
      if (!isCannotAttackPlayer) {
        let directScore = 0;

        // ① リーサル（結界0で即死）判定
        if (player.barrier === 0) {
          // 相手にアクティブな守護がいなければ即座に勝利
          const hasActiveGuardian = player.field.some((u: UnitState) => {
            const b = toBoardUnit(state, 'player1', u);
            return !b.isRested && (b.card.keywords?.includes('守護' as any) || b.card.keywords?.includes('Guard'));
          });
          if (!hasActiveGuardian) {
            return {
              attacker,
              targetType: 'PLAYER',
              score: 999999,
              reason: 'リーサル直接攻撃（勝利確定）'
            };
          }
        }

        // ② 通常の結界ブレイク価値
        directScore += (brk * 45);

        // 相手の残結界が少ないほどフェイス攻撃の優先度UP
        if (player.barrier <= 2) directScore += 35;

        // ③ ルーン警戒補正（囮攻撃ルーチン）
        if (player.runes.length > 0) {
          // 相手がルーンを伏せている時は、小型（低ATK）から順に攻撃させて罠を踏ませる
          if (atk <= 20) {
            directScore += 30; // 小型による安全な囮ブレイク
          } else {
            directScore -= 20; // 大型で最初に罠を踏むリスクを低減
          }
        }

        // 攻撃後レストになるリスク減点
        directScore -= (attacker.currentDef ?? attacker.card.def ?? 20) * 0.2;

        candidates.push({
          attacker,
          targetType: 'PLAYER',
          score: directScore,
          reason: '相手プレイヤー/結界へ攻撃'
        });
      }

      // ----------------------------------------
      // B. 相手ユニットへの攻撃（有利トレード）
      // ----------------------------------------
      const canAttackActive = attacker.card.id === 'BR-09' || 
        attacker.card.keywords?.includes('CanAttackActive') || 
        attacker.card.effectText?.includes('アクティブ状態の相手ユニットを攻撃できる');
      
      const validTargets = player.field
        .map((target: UnitState) => toBoardUnit(state, 'player1', target))
        .filter((target: BoardUnit) => {
          if (canAttackActive) return true;
          return target.isRested; // 原則はレスト状態のみ
        });

      for (const target of validTargets) {
        const targetDef = target.currentDef ?? target.card.def ?? 0;
        const targetAtk = target.currentAtk ?? target.card.atk ?? 0;
        const targetValue = this.evaluateUnit(target, false, player.barrier);

        // 【最優先自爆チェック】攻撃側ATK < 防御側DEF は絶対除外
        if (atk < targetDef) {
          const hasLethal = attacker.card.keywords?.includes('必殺' as any) || attacker.card.keywords?.includes('Lethal');
          if (!hasLethal) {
            continue; // 自爆は評価せず除外
          }
        }

        let tradeScore = 0;

        if (atk > targetDef) {
          // 【一方的勝利（有利トレード）】無傷で相手を破壊
          tradeScore = 70 + targetValue;
          // 相手の脅威ユニットや高コストを倒すほど高得点
          if (target.card.cost >= 4) tradeScore += 30;
          if (target.card.keywords?.includes('守護' as any) || target.card.keywords?.includes('Guard')) {
            tradeScore += 25; // 邪魔なブロッカー排除
          }
        } else if (atk === targetDef || attacker.card.keywords?.includes('必殺' as any) || attacker.card.keywords?.includes('Lethal')) {
          // 【相打ち（1:1交換）】
          const myValue = this.evaluateUnit(attacker, true, ai.barrier);
          // 「相手の価値 > 自分の価値」の場合のみ相打ちを許可
          if (targetValue >= myValue) {
            tradeScore = 30 + (targetValue - myValue);
          } else {
            tradeScore = -50; // 自軍の大型で相手の小型と相打ちするのは損
          }
        }

        candidates.push({
          attacker,
          targetType: 'UNIT',
          targetUnit: target,
          score: tradeScore,
          reason: `敵ユニット[${target.card.name}]への有利トレード`
        });
      }
    }

    if (candidates.length === 0) return null;

    // スコア最高の攻撃手を採択
    candidates.sort((a, b) => b.score - a.score);
    return candidates[0].score > 0 ? candidates[0] : null;
  }

  // ==========================================
  // 4. 守護（迎撃）判断ルーチン
  // ==========================================

  /** プレイヤーの直接攻撃に対して、AIが守護を行うべきかを判定 */
  public static shouldGuard(
    state: GameState, 
    attacker: BoardUnit, 
    availableGuardians: BoardUnit[]
  ): BoardUnit | null {
    if (availableGuardians.length === 0) return null;

    const ai = (state as any).opponent || state.player2;
    const attackerAtk = attacker.currentAtk ?? attacker.card.atk ?? 0;
    const attackerBrk = attacker.currentBrk ?? attacker.card.brk ?? 1;

    for (const guardian of availableGuardians) {
      const def = guardian.currentDef ?? guardian.card.def ?? 0;

      // ① 相手が自爆する理想的な迎撃 (guardian.DEF > attacker.ATK)
      if (def > attackerAtk) {
        return guardian; // 無傷で相手を自滅させられるので100%守護
      }

      // ② 自軍結界が0、またはこの攻撃で即死する場合 (リーサル防衛)
      if (ai.barrier <= 0 || ai.barrier <= attackerBrk) {
        return guardian; // 敗北を避けるために身代わり
      }

      // ③ 【BD-02】マリー等の自壊・低コスト守護の使い所
      if (guardian.card.id === 'BD-02' && attackerBrk >= 2) {
        return guardian; // 2ブレイク以上を防げるなら身代わり価値あり
      }

      // ④ 相打ちトレード
      if (def === attackerAtk) {
        if (attacker.card.cost >= guardian.card.cost) {
          return guardian; // 同等以上のコスト交換なら守護成立
        }
      }
    }

    // 結界に十分余裕があり(3〜5枚)、守護ユニットが一方的に死ぬ場合はスルー
    return null;
  }
}

/** 使用可能マナと系統条件、空き枠を満たすAIの手札カード一覧を取得 */
export function getAIPlayableCards(state: GameState): (Card & { instanceId: string })[] {
  const ai = state.player2;
  const human = state.player1;
  const currentArcana = ai.currentArcana;

  const currentAffinities = new Set(ai.arcana.map(a => getCard(a.cardId).system));

  const playable: (Card & { instanceId: string })[] = [];

  for (const cardInst of ai.hand) {
    const tpl = getCard(cardInst.cardId);
    if (currentArcana < tpl.cost) continue;

    // Affinity check
    const hasAffinity = tpl.system === 'Neutral' || currentAffinities.has(tpl.system);
    if (!hasAffinity) continue;

    // Type constraints
    if (tpl.type === 'Unit' && ai.field.length >= 6) continue;
    if (tpl.type === 'Evolution') {
      const hasTarget = ai.field.some(
        u => getCard(u.cards[0].cardId).lineage === tpl.evolutionTarget
      );
      if (!hasTarget) continue;
    }
    if (tpl.type === 'Rune' && ai.runes.length >= 2) continue;
    if (tpl.type === 'Domain' && ai.domain) continue;

    // Specific spell targets requirement check
    if (tpl.type === 'Spell') {
      if (tpl.id === 'BR-12' && !human.field.some(u => calculateUnitStats(state, 'player1', u).def <= 20)) {
        continue;
      }
      if (tpl.id === 'BB-12' && !human.field.some(u => getCard(u.cards[0].cardId).cost <= 5)) {
        continue;
      }
      if (tpl.id === 'BG-13' && !human.field.some(u => calculateUnitStats(state, 'player1', u).def <= 60)) {
        continue;
      }
      if (tpl.id === 'BW-12' && !human.field.some(u => !u.isRested)) {
        continue;
      }
      if (tpl.id === 'BW-13' && !ai.archive.some(c => ['Spell', 'Rune'].includes(getCard(c.cardId).type))) {
        continue;
      }
      if (tpl.id === 'BD-12' && human.hand.length === 0) {
        continue;
      }
      if (tpl.id === 'BD-13' && human.field.length === 0) {
        continue;
      }
      if (tpl.id === 'BN-03' && !human.domain) {
        continue;
      }
      if (tpl.id === 'BN-04' && human.runes.length === 0) {
        continue;
      }
    }

    playable.push({
      ...tpl,
      instanceId: cardInst.instanceId,
    });
  }

  return playable;
}

/** カードプレイ時の具体的なGameActionを決定する */
export function getAIPlayAction(state: GameState, card: Card & { instanceId: string }): GameAction {
  const tpl = getCard(card.id);
  const ai = state.player2;
  const human = state.player1;

  if (tpl.type === 'Evolution') {
    const evoTarget = ai.field.find(
      u => getCard(u.cards[0].cardId).lineage === tpl.evolutionTarget
    );
    let targetId: string | undefined;
    if (tpl.targetReq === 'opponent_unit' && human.field.length > 0) {
      const valid = human.field.filter(u => calculateUnitStats(state, 'player1', u).def <= 80);
      if (valid.length > 0) targetId = valid[0].instanceId;
    }
    return {
      type: 'PLAY_CARD',
      instanceId: card.instanceId,
      evolutionTargetId: evoTarget?.instanceId,
      targetId,
    };
  }

  if (tpl.type === 'Unit') {
    if (tpl.id === 'BR-08') {
      const target = human.field.find(u => calculateUnitStats(state, 'player1', u).def <= 40);
      return { type: 'PLAY_CARD', instanceId: card.instanceId, targetId: target?.instanceId };
    }
    if (tpl.id === 'BB-09') {
      if (human.field.length > 0) {
        const sorted = [...human.field].sort(
          (a, b) => calculateUnitStats(state, 'player1', b).atk - calculateUnitStats(state, 'player1', a).atk
        );
        return { type: 'PLAY_CARD', instanceId: card.instanceId, targetId: sorted[0].instanceId };
      }
    }
    if (tpl.id === 'BW-05') {
      const active = human.field.find(u => !u.isRested);
      return { type: 'PLAY_CARD', instanceId: card.instanceId, targetId: active?.instanceId };
    }
    if (tpl.id === 'BW-08') {
      const item = ai.archive.find(c => ['Spell', 'Rune'].includes(getCard(c.cardId).type));
      return { type: 'PLAY_CARD', instanceId: card.instanceId, targetId: item?.instanceId };
    }
    if (tpl.id === 'BD-10') {
      const darkCards = ai.archive.filter(c => getCard(c.cardId).system === 'Dark');
      return { type: 'PLAY_CARD', instanceId: card.instanceId, targetId: darkCards.slice(0, 2).map(c => c.instanceId).join(',') };
    }
    return { type: 'PLAY_CARD', instanceId: card.instanceId };
  }

  if (tpl.type === 'Spell') {
    if (tpl.id === 'BR-12') {
      const target = human.field.find(u => calculateUnitStats(state, 'player1', u).def <= 20);
      return { type: 'PLAY_CARD', instanceId: card.instanceId, targetId: target?.instanceId };
    }
    if (tpl.id === 'BB-12') {
      const target = human.field.find(u => getCard(u.cards[0].cardId).cost <= 5);
      return { type: 'PLAY_CARD', instanceId: card.instanceId, targetId: target?.instanceId };
    }
    if (tpl.id === 'BG-13') {
      const target = human.field.find(u => calculateUnitStats(state, 'player1', u).def <= 60);
      return { type: 'PLAY_CARD', instanceId: card.instanceId, targetId: target?.instanceId };
    }
    if (tpl.id === 'BW-12') {
      const active = human.field.find(u => !u.isRested);
      return { type: 'PLAY_CARD', instanceId: card.instanceId, targetId: active?.instanceId };
    }
    if (tpl.id === 'BW-13') {
      const item = ai.archive.find(c => ['Spell', 'Rune'].includes(getCard(c.cardId).type));
      return { type: 'PLAY_CARD', instanceId: card.instanceId, targetId: item?.instanceId };
    }
    if (tpl.id === 'BD-13') {
      return { type: 'PLAY_CARD', instanceId: card.instanceId, targetId: human.field[0]?.instanceId };
    }
    if (tpl.id === 'BN-04') {
      return { type: 'PLAY_CARD', instanceId: card.instanceId, targetId: human.runes[0]?.instanceId };
    }
    return { type: 'PLAY_CARD', instanceId: card.instanceId };
  }

  return { type: 'PLAY_CARD', instanceId: card.instanceId };
}

/**
 * 従来の即時計算インターフェース互換関数（ScriptiaAIEngineを使用）
 */
export function computeNextAIAction(state: GameState): GameAction | null {
  if (state.winner) return null;

  // 1. Handle Prompts targeting Player 2 (AI)
  if (state.prompt && state.prompt.playerId === 'player2') {
    if (state.prompt.type === 'GUARD') {
      const opp = state.player2;
      const guarders = opp.field
        .map(u => toBoardUnit(state, 'player2', u))
        .filter(u => !u.isRested && canUnitGuard(u));

      if (guarders.length === 0) {
        return { type: 'RESOLVE_GUARD' };
      }

      let attacker: BoardUnit = {
        instanceId: 'dummy',
        cards: [],
        isRested: false,
        hasSummoningSickness: false,
        modifiers: [],
        card: { id: 'dummy', name: '敵', cost: 3, system: 'Neutral', type: 'Unit', atk: 30, def: 30, brk: 1 },
        currentAtk: 30,
        currentDef: 30,
        currentBrk: 1,
      };

      if (state.prompt.attackerId) {
        const aUnit = state.player1.field.find(u => u.instanceId === state.prompt!.attackerId);
        if (aUnit) {
          attacker = toBoardUnit(state, 'player1', aUnit);
        }
      }

      const chosenGuarder = ScriptiaAIEngine.shouldGuard(state, attacker, guarders);
      if (chosenGuarder) {
        return { type: 'RESOLVE_GUARD', guarderId: chosenGuarder.instanceId };
      }
      return { type: 'RESOLVE_GUARD' };
    }

    if (state.prompt.type === 'TRIGGER' || state.prompt.type === 'RUNE_TRIGGER') {
      return { type: 'RESOLVE_TRIGGER', apply: true };
    }

    return null;
  }

  // 2. Only act when it is Player 2's turn
  if (state.currentPlayer !== 'player2') return null;

  const ai = state.player2;

  // 3. Arcana Placement Phase
  if (state.phase === 'ARCANA_PLACEMENT') {
    if (!state.flags.hasPlacedArcanaThisTurn && ai.hand.length > 0) {
      const chargeCard = ScriptiaAIEngine.selectManaChargeCard(ai);
      if (chargeCard) {
        return { type: 'PLACE_ARCANA', instanceId: chargeCard.instanceId };
      }
    }
    return { type: 'NEXT_PHASE' };
  }

  // 4. Action Phase
  if (state.phase === 'ACTION') {
    // 4A. Play playable card
    const playable = getAIPlayableCards(state);
    if (playable.length > 0) {
      const bestCard = [...playable].sort((a, b) => b.cost - a.cost)[0];
      return getAIPlayAction(state, bestCard);
    }

    // 4B. Attack
    const bestAttack = ScriptiaAIEngine.selectBestAttack(state);
    if (bestAttack) {
      if (bestAttack.targetType === 'PLAYER') {
        return { type: 'DECLARE_ATTACK', attackerId: bestAttack.attacker.instanceId };
      }
      if (bestAttack.targetUnit) {
        return {
          type: 'DECLARE_ATTACK',
          attackerId: bestAttack.attacker.instanceId,
          targetId: bestAttack.targetUnit.instanceId,
        };
      }
    }

    // End turn
    return { type: 'NEXT_PHASE' };
  }

  return { type: 'NEXT_PHASE' };
}

/**
 * React Hook that reliably drives AI turns
 */
export function useAIEngine(state: GameState, dispatch: React.Dispatch<GameAction>) {
  const isAITurn = state.currentPlayer === 'player2';
  const isAIPrompt = state.prompt?.playerId === 'player2';

  useEffect(() => {
    if (state.winner) return;
    if (!isAIPrompt && !isAITurn) return;

    // If AI prompt (like GUARD), resolve it quickly
    if (isAIPrompt) {
      const timer = setTimeout(() => {
        const action = computeNextAIAction(state);
        if (action) dispatch(action);
      }, 700);
      return () => clearTimeout(timer);
    }
  }, [state, isAIPrompt, isAITurn, dispatch]);

  return {
    isAIThinking: isAITurn || isAIPrompt,
  };
}
