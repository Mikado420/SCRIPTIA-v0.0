import { GameState, Card, BoardUnit, PlayerState, GameAction, UnitState, CardInstance } from '../types';
import { getCard } from '../data/cards';
import { calculateUnitStats } from './engineUtils';
import { canUnitGuard } from './combatEngine';
import { getValidSpellTargets } from './spellSystem';

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
// 【思考型AIエンジン完全版：ScriptiaAIEngine】
// ======================================================================

export class ScriptiaAIEngine {

  // ----------------------------------------------------
  // 1. ユニット・盤面の評価スコアリング
  // ----------------------------------------------------

  private static getBarrierScore(barrier: number): number {
    const scores = [0, 100, 165, 210, 245, 275];
    return scores[Math.max(0, Math.min(5, barrier))] || 0;
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

  // ----------------------------------------------------
  // 2. 攻撃手順の最適化評価
  // ----------------------------------------------------

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

      // ① 相手プレイヤー攻撃
      if (!cannotAtkPlayer) {
        let pScore = (brk * 45);
        if (opponentBarrier <= 2) pScore += 40;

        if (opponentRunesCount > 0) {
          if (atk <= 20) pScore += 30; // 囮攻撃ボーナス
          else pScore -= 20; // 罠被弾リスク
        }
        pScore -= (attacker.currentDef ?? attacker.card.def ?? 20) * 0.2;

        if (opponentBarrier === 0) {
          pScore = 999999; // リーサル
        }

        if (pScore > maxScore) {
          maxScore = pScore;
          bestAttack = { attacker, targetType: 'PLAYER', score: pScore, reason: '相手プレイヤー/結界へ攻撃' };
        }
      }

      // ② 相手レストユニットへの有利トレード
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

  // ----------------------------------------------------
  // 3. 総合手番プラン（Turn Plan）の全探索
  // ----------------------------------------------------

  /**
   * マナチャージ有無、プレイカードの組み合わせ、攻撃結果をすべて考慮して最高評価プランを算出
   */
  public static planBestTurn(state: GameState): TurnPlan {
    const ai = state.opponent || state.player2;
    const player = state.player || state.player1;

    const aiHand = ai.hand.map(toFullCard);
    const aiArcana = ai.arcana.map(toFullCard);
    const aiField = ai.field.map(u => toBoardUnit(state, 'player2', u));
    const playerField = player.field.map(u => toBoardUnit(state, 'player1', u));

    const chargeOptions: (Card | null)[] = [null]; // チャージしない選択肢
    // 手札が2枚以上あれば、各カードをチャージする選択肢を追加
    if (aiHand.length >= 2 && aiArcana.length < 9) {
      for (const card of aiHand) {
        chargeOptions.push(card);
      }
    }

    let bestPlan: TurnPlan = {
      chargeCard: null,
      plays: [],
      attacks: [],
      totalScore: -999999,
      reason: '初期状態',
    };

    for (const chargeCard of chargeOptions) {
      // 仮想アルカナ＆仮想手札の構築
      const virtualArcana = chargeCard ? [...aiArcana, chargeCard] : [...aiArcana];
      const virtualHand = chargeCard ? aiHand.filter(c => c.instanceId !== chargeCard.instanceId) : [...aiHand];
      const virtualMana = virtualArcana.length;

      // 手札からコストと系統を満たすプレイ組み合わせを探索（深さ優先）
      const playableCombos = this.findPlayableCombinations(state, virtualHand, virtualMana, virtualArcana, aiField);

      for (const combo of playableCombos) {
        let planScore = 0;

        // 1. チャージの妥当性評価
        if (chargeCard) {
          const currentElements = new Set(aiArcana.map(c => c.element || c.system || '無'));
          const chargeEl = chargeCard.element || chargeCard.system;
          // 新属性解放なら大加点
          if (chargeEl && chargeEl !== '無' && chargeEl !== 'Neutral' && !currentElements.has(chargeEl)) {
            planScore += 65;
          }

          // チャージしたのにそのマナを使わずに余らせた場合は「無駄捨て」として大減点
          const totalCostUsed = combo.reduce((sum, act) => sum + act.card.cost, 0);
          if (totalCostUsed <= aiArcana.length) {
            planScore -= 60; // チャージしなくても出せたのに手札を捨てたペナルティ
          } else {
            planScore += 25; // チャージしたおかげで高コストや複数展開が実現できた報酬
          }
        }

        // 2. カードプレイによる盤面向上スコア
        for (const action of combo) {
          planScore += (action.card.cost * 18); // コスト消費に応じた基本出力価値
          const cType = action.card.cardType || action.card.type;
          if (cType === 'UNIT' || cType === 'Unit' || cType === 'EVOLUTION' || cType === 'Evolution') {
            planScore += (action.card.atk ?? 0) * 0.5 + (action.card.def ?? 0) * 0.6;
            const kw = (action.card.keywords || []) as string[];
            if (kw.includes('守護') || kw.includes('Guard')) planScore += 35;
          }
          if (action.card.id === 'BR-08') planScore += 45; // クリムゾン・ドラゴンの破壊付加価値
          if (action.card.id === 'BB-12') planScore += 40; // バウンス付加価値
        }

        // 3. 手札温存ボーナス（残手札1枚につき20点、手札0枚になる危険を防止）
        const remainingHandCount = virtualHand.length - combo.length;
        planScore += (remainingHandCount * 20);

        // 4. 攻撃シミュレーションと先読み (Lookahead & Opponent Analysis)
        
        // ① 自分のプレイ行動後の仮想盤面を構築する
        const virtualAiField = [...aiField];
        const virtualPlayerField = [...playerField];
        const oppBarrier = player.barrier;
        const oppRunesCount = player.runes.length;
        
        // プレイカードによる仮想盤面変化の適用
        for (const action of combo) {
          const cType = action.card.cardType || action.card.type;
          if (cType === 'UNIT' || cType === 'Unit' || cType === 'EVOLUTION' || cType === 'Evolution') {
            virtualAiField.push({
              instanceId: 'virtual_' + Math.random(),
              cards: [],
              isRested: false,
              hasSummoningSickness: !(action.card.keywords?.includes('速攻' as any) || action.card.keywords?.includes('Rush' as any)),
              modifiers: [],
              card: action.card,
              currentAtk: action.card.atk,
              currentDef: action.card.def,
              currentBrk: action.card.brk,
            });
          }
          // 仮想除去
          if (action.card.id === 'BR-08' || action.card.id === 'BR-12' || action.card.id === 'BD-11') {
             const targets = virtualPlayerField.sort((a,b) => (a.currentDef ?? 0) - (b.currentDef ?? 0));
             if (targets.length > 0 && (targets[0].currentDef ?? 0) <= 80) virtualPlayerField.shift();
          }
          // 仮想バウンス
          if (action.card.id === 'BB-09' || action.card.id === 'BB-12') {
             if (virtualPlayerField.length > 0) virtualPlayerField.shift();
          }
        }

        // ② 自ターンの攻撃シミュレーション
        const simulatedAttacks = this.evaluateAttacks(virtualAiField, virtualPlayerField, oppBarrier, oppRunesCount);
        const attackScore = simulatedAttacks.reduce((sum, att) => sum + att.score, 0);
        planScore += attackScore;

        // ③ 返しの相手ターンの反撃シミュレーション (1手先読み)
        // 自軍の攻撃したユニットをレスト状態にする
        for (const att of simulatedAttacks) {
           const vUnit = virtualAiField.find(u => u.instanceId === att.attacker.instanceId);
           if (vUnit) vUnit.isRested = true;
           if (att.targetType === 'UNIT' && att.targetUnit) {
              const idx = virtualPlayerField.findIndex(u => u.instanceId === att.targetUnit!.instanceId);
              if (idx !== -1) virtualPlayerField.splice(idx, 1);
           }
        }
        
        // 相手が反撃してくる場合の被害予測スコア（マイナス評価）
        let counterAttackPenalty = 0;
        for (const oppU of virtualPlayerField) {
           const atk = oppU.currentAtk ?? oppU.card.atk ?? 0;
           const vulnerable = virtualAiField.filter(u => u.isRested && (u.currentDef ?? u.card.def ?? 0) <= atk);
           if (vulnerable.length > 0) {
              vulnerable.sort((a, b) => this.evaluateUnit(b, true, 5) - this.evaluateUnit(a, true, 5));
              counterAttackPenalty += this.evaluateUnit(vulnerable[0], true, 5) * 0.8;
           } else {
              counterAttackPenalty += (oppU.currentBrk ?? oppU.card.brk ?? 1) * 30;
           }
        }
        planScore -= counterAttackPenalty;

        // ④ 相手のデッキタイプに基づく戦略的重み付け（Opponent Analysis）
        const isOppAggro = player.arcana.length <= 4 && virtualPlayerField.length >= 2;
        if (isOppAggro) {
           // 相手がアグロの場合、自軍の守護ユニット展開を高く評価
           const guardCount = virtualAiField.filter(u => u.card.keywords?.includes('Guard' as any) || u.card.keywords?.includes('守護' as any)).length;
           planScore += (guardCount * 40);
        } else {
           // 相手がコントロールの場合、手札温存とリソースを高く評価
           planScore += (remainingHandCount * 15);
        }

        if (planScore > bestPlan.totalScore) {
          bestPlan = {
            chargeCard,
            plays: combo,
            attacks: simulatedAttacks,
            totalScore: planScore,
            reason: chargeCard ? `カード[${chargeCard.name}]をチャージして最大展開` : `チャージ温存して展開`,
          };
        }
      }
    }

    return bestPlan;
  }

  // プレイ可能な組み合わせ探索ヘルパー
  public static findPlayableCombinations(
    state: GameState,
    hand: Card[],
    availableMana: number,
    arcana: Card[],
    field: BoardUnit[]
  ): CardPlayAction[][] {
    const results: CardPlayAction[][] = [[]]; // 何もプレイしない選択肢も含む

    // プレイ可能な単体カード
    const playableCards = hand.filter(c => {
      if (c.cost > availableMana) return false;
      if (!this.checkAffinity(c, arcana)) return false;
      if ((c.type === 'Spell' || c.cardType === 'SPELL') && c.targetReq && c.instanceId) {
        const validTargets = getValidSpellTargets(state, c.id, c.instanceId);
        if (validTargets.length === 0) return false;
      }
      return true;
    });

    // 単体プレイ
    for (const card of playableCards) {
      results.push([{ card }]);

      // 2枚コンボ（低コストの組み合わせ）
      const remainingMana = availableMana - card.cost;
      const secondCards = hand.filter(c => {
        if (c.instanceId === card.instanceId) return false;
        if (c.cost > remainingMana) return false;
        if (!this.checkAffinity(c, arcana)) return false;
        if ((c.type === 'Spell' || c.cardType === 'SPELL') && c.targetReq && c.instanceId) {
          const validTargets = getValidSpellTargets(state, c.id, c.instanceId);
          if (validTargets.length === 0) return false;
        }
        return true;
      });
      for (const sc of secondCards) {
        results.push([{ card }, { card: sc }]);
      }
    }

    return results;
  }

  // 守護判断
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

/**
 * プレイ可能カード一覧を取得するヘルパー（後方互換）
 */
export function getAIPlayableCards(state: GameState): (Card & { instanceId: string })[] {
  const ai = state.opponent || state.player2;
  const human = state.player || state.player1;
  const playable: (Card & { instanceId: string })[] = [];

  for (const cardInst of ai.hand) {
    const tpl = getCard(cardInst.cardId);
    if (tpl.cost > ai.currentArcana) continue;

    // 系統一致チェック
    const requiredSystem = tpl.element || tpl.system;
    if (requiredSystem && requiredSystem !== 'Neutral' && requiredSystem !== '無') {
      const norm = (s: string) => {
        if (s === 'Fire' || s === '火') return 'Fire';
        if (s === 'Water' || s === '水') return 'Water';
        if (s === 'Earth' || s === '地') return 'Earth';
        if (s === 'Light' || s === '光') return 'Light';
        if (s === 'Dark' || s === '闇') return 'Dark';
        return 'Neutral';
      };
      const hasSystem = ai.arcana.some(a => {
        const aTpl = getCard(a.cardId);
        return norm(aTpl.element || aTpl.system) === norm(requiredSystem);
      });
      if (!hasSystem) continue;
    }

    if (tpl.type === 'Evolution') {
      const hasTarget = ai.field.some(u => {
        const baseCard = getCard(u.cards[0].cardId);
        return baseCard.lineage === tpl.evolutionTarget;
      });
      if (!hasTarget) continue;
    }

    if (tpl.type === 'Spell') {
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
      
      // Generic check for spells with target requirements
      if (tpl.targetReq) {
        const validTargets = getValidSpellTargets(state, tpl.id, cardInst.instanceId);
        if (validTargets.length === 0) {
          continue;
        }
      }
    }

    playable.push({
      ...tpl,
      element: tpl.element || tpl.system,
      cardType: tpl.cardType || tpl.type,
      instanceId: cardInst.instanceId,
    });
  }

  return playable;
}

/**
 * カードプレイ時の具体的なGameActionを決定する（後方互換）
 */
export function getAIPlayAction(state: GameState, card: Card & { instanceId: string }): GameAction {
  const tpl = getCard(card.id);
  const ai = state.opponent || state.player2;
  const human = state.player || state.player1;

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
      evolutionTargetId: evoTarget ? evoTarget.instanceId : undefined,
      targetId,
    };
  }

  if (tpl.type === 'Spell') {
    let targetId: string | undefined;
    if (tpl.id === 'BB-12') {
      const valid = human.field.filter(u => getCard(u.cards[0].cardId).cost <= 5);
      if (valid.length > 0) {
        valid.sort((a, b) => getCard(b.cards[0].cardId).cost - getCard(a.cards[0].cardId).cost);
        targetId = valid[0].instanceId;
      }
    } else if (tpl.id === 'BG-13') {
      const valid = human.field.filter(u => calculateUnitStats(state, 'player1', u).def <= 60);
      if (valid.length > 0) {
        valid.sort((a, b) => calculateUnitStats(state, 'player1', b).def - calculateUnitStats(state, 'player1', a).def);
        targetId = valid[0].instanceId;
      }
    } else if (tpl.id === 'BW-12') {
      const activeUnits = human.field.filter(u => !u.isRested);
      if (activeUnits.length > 0) {
        activeUnits.sort((a, b) => calculateUnitStats(state, 'player1', b).atk - calculateUnitStats(state, 'player1', a).atk);
        targetId = activeUnits[0].instanceId;
      }
    } else if (tpl.id === 'BW-13') {
      const validArchive = ai.archive.filter(c => ['Spell', 'Rune'].includes(getCard(c.cardId).type));
      if (validArchive.length > 0) {
        targetId = validArchive[0].instanceId;
      }
    }

    if (!targetId && tpl.targetReq) {
      const validTargets = getValidSpellTargets(state, tpl.id, card.instanceId);
      if (validTargets.length > 0) {
        // Just pick the first valid target as fallback
        targetId = validTargets[0];
      }
    }

    return {
      type: 'PLAY_CARD',
      instanceId: card.instanceId,
      targetId,
    };
  }

  // 通常ユニット・ドメイン・ルーン
  let targetId: string | undefined;
  if (tpl.id === 'BR-08' && human.field.length > 0) {
    const valid = human.field.filter(u => calculateUnitStats(state, 'player1', u).def <= 30);
    if (valid.length > 0) {
      valid.sort((a, b) => calculateUnitStats(state, 'player1', b).def - calculateUnitStats(state, 'player1', a).def);
      targetId = valid[0].instanceId;
    }
  }

  return {
    type: 'PLAY_CARD',
    instanceId: card.instanceId,
    targetId,
  };
}
