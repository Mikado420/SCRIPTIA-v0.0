import { GameState, Card, BoardUnit, PlayerState, GameAction, UnitState, CardInstance } from '../types';
import { getCard, CARDS } from '../data/cards';
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

export type OpponentProfile = {
  deckArchetypes: {
    type: string;
    probability: number;
  }[];
  cardProbabilities: {
    cardId: string;
    deckProbability: number;
    handProbability: number;
    threatLevel: number;
  }[];
  likelyStrategies: {
    strategy: string;
    probability: number;
  }[];
  observedCards: string[];
};

// ======================================================================
// 【思考型AIエンジン完全版：ScriptiaAIEngine】
// ======================================================================

export class ScriptiaAIEngine {

  // ----------------------------------------------------
  // 0. 相手デッキ・戦術の分析 (Opponent Analysis)
  // ----------------------------------------------------
  public static analyzeOpponent(state: GameState): OpponentProfile {
    const opp = state.currentPlayer === 'player2' ? state.player1 : state.player2;

    const observedCards = [
      ...opp.arcana.map(c => c.cardId),
      ...opp.field.map(u => u.cards[0].cardId),
      ...opp.archive.map(c => c.cardId),
    ];
    // 重複を排除
    const uniqueObserved = Array.from(new Set(observedCards));

    // アルカナから相手の使用属性を特定
    const elementCounts: Record<string, number> = {};
    uniqueObserved.forEach(cardId => {
      const card = getCard(cardId);
      const el = card.element || card.system || 'Neutral';
      elementCounts[el as string] = (elementCounts[el as string] || 0) + 1;
    });

    let aggroProb = 0.2;
    let controlProb = 0.2;
    let comboProb = 0.2;
    
    // デッキタイプの推論（盤面展開力やアルカナの枚数・属性から）
    if (opp.arcana.length <= 4 && opp.field.length >= 2) {
      aggroProb += 0.4;
    }
    if (elementCounts['Fire'] || elementCounts['Earth']) {
      aggroProb += 0.2;
    }
    if (elementCounts['Water'] || elementCounts['Dark'] || elementCounts['Light']) {
      controlProb += 0.3;
    }
    if (opp.arcana.length >= 5) {
      controlProb += 0.2;
    }
    if (opp.runes.length >= 2) {
      controlProb += 0.2;
      comboProb += 0.1;
    }

    // 確率の正規化
    const totalProb = aggroProb + controlProb + comboProb;
    aggroProb = parseFloat((aggroProb / totalProb).toFixed(2));
    controlProb = parseFloat((controlProb / totalProb).toFixed(2));
    comboProb = parseFloat((comboProb / totalProb).toFixed(2));

    const deckArchetypes = [
      { type: 'Aggro', probability: aggroProb },
      { type: 'Control', probability: controlProb },
      { type: 'Combo', probability: comboProb },
    ];

    const likelyStrategies = [
      { strategy: 'Early aggression', probability: aggroProb },
      { strategy: 'Board wipe / Removal', probability: controlProb },
      { strategy: 'Stall and survive', probability: controlProb * 0.8 },
    ].sort((a, b) => b.probability - a.probability);

    // 未公開カードや採用カードの脅威推測
    const cardProbabilities: OpponentProfile['cardProbabilities'] = [];
    const activeElements = Object.keys(elementCounts).filter(k => k !== 'Neutral' && k !== '無');
    
    CARDS.forEach(card => {
      const el = card.element || card.system || 'Neutral';
      const isNeutral = el === 'Neutral' || el === '無';
      // もし相手の使っている属性と合致しなければ、採用されている可能性は低い
      if (!isNeutral && !activeElements.includes(el as string) && activeElements.length > 0) return; 
      
      let baseDeckProb = 0.1;
      if (activeElements.includes(el as string) || isNeutral) {
        baseDeckProb = 0.5;
      }
      if (uniqueObserved.includes(card.id)) {
        baseDeckProb = 0.9; // 実際に見たカードは採用確率が高い
      }
      
      // 脅威レベルの算定（除去、守護、高打点など）
      let threatLevel = 0.1;
      if (card.targetReq === 'opponent_unit') threatLevel += 0.5;
      if (card.keywords?.includes('Guard' as any) || card.keywords?.includes('守護' as any)) threatLevel += 0.3;
      if (card.brk && card.brk >= 2) threatLevel += 0.4;
      if (card.type === 'Spell' || card.type === 'Rune') threatLevel += 0.2;

      threatLevel = Math.min(1.0, threatLevel);
      
      // 相手の手札に今ある可能性の概算
      const handProb = opp.hand.length > 0 ? parseFloat((baseDeckProb * (opp.hand.length / 40)).toFixed(2)) : 0;
      
      if (baseDeckProb > 0.3) {
        cardProbabilities.push({
          cardId: card.id,
          deckProbability: baseDeckProb,
          handProbability: handProb,
          threatLevel: parseFloat(threatLevel.toFixed(2))
        });
      }
    });

    // 脅威×採用確率でソートし、上位10枚をリストアップ
    cardProbabilities.sort((a, b) => (b.deckProbability * b.threatLevel) - (a.deckProbability * a.threatLevel));
    
    return {
      deckArchetypes,
      cardProbabilities: cardProbabilities.slice(0, 10),
      likelyStrategies,
      observedCards: uniqueObserved
    };
  }

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
  public static planBestTurn(state: GameState, oppProfile?: OpponentProfile): TurnPlan {
    const ai = state.opponent || state.player2;
    const player = state.player || state.player1;
    const profile = oppProfile || this.analyzeOpponent(state);

    const aiHand = ai.hand.map(toFullCard);
    const aiArcana = ai.arcana.map(toFullCard);
    const aiField = ai.field.map(u => toBoardUnit(state, 'player2', u));
    const playerField = player.field.map(u => toBoardUnit(state, 'player1', u));

    const chargeOptions: (Card | null)[] = [null];
    if (aiHand.length >= 2 && aiArcana.length < 9) {
      for (const card of aiHand) chargeOptions.push(card);
    }

    interface CandidatePlan {
       chargeCard: Card | null;
       plays: CardPlayAction[];
       virtualHand: Card[];
       virtualMana: number;
       baseScore: number;
       manaEfficiency: number;
    }
    const candidates: CandidatePlan[] = [];

    // Phase 1: Generate all playable combinations
    for (const chargeCard of chargeOptions) {
      const virtualArcana = chargeCard ? [...aiArcana, chargeCard] : [...aiArcana];
      const virtualHand = chargeCard ? aiHand.filter(c => c.instanceId !== chargeCard.instanceId) : [...aiHand];
      const virtualMana = virtualArcana.length;
      
      const playableCombos = this.findPlayableCombinations(state, virtualHand, virtualMana, virtualArcana, aiField);
      
      for (const combo of playableCombos) {
         let manaEfficiency = 0;
         if (chargeCard) {
            const currentElements = new Set(aiArcana.map(c => c.element || c.system || '無'));
            const chargeEl = chargeCard.element || chargeCard.system;
            if (chargeEl && chargeEl !== '無' && chargeEl !== 'Neutral' && !currentElements.has(chargeEl as string)) {
               manaEfficiency += 40;
            }
            const totalCostUsed = combo.reduce((sum, act) => sum + act.card.cost, 0);
            if (totalCostUsed <= aiArcana.length) {
               manaEfficiency -= 50; 
            } else {
               manaEfficiency += 30; 
            }
         }
         
         candidates.push({ chargeCard, plays: combo, virtualHand, virtualMana, baseScore: 0, manaEfficiency });
      }
    }

    // Phase 2: Apply plays and First-Pass Evaluation (Beam Search)
    const beamNodes = [];

    for (const cand of candidates) {
       const vMyField = [...aiField];
       const vOppField = [...playerField];
       
       for (const action of cand.plays) {
          const cType = action.card.cardType || action.card.type;
          if (cType === 'UNIT' || cType === 'Unit' || cType === 'EVOLUTION' || cType === 'Evolution') {
             vMyField.push({
                instanceId: 'virtual_' + Math.random(),
                cards: [], isRested: false,
                hasSummoningSickness: !(action.card.keywords?.includes('速攻' as any) || action.card.keywords?.includes('Rush' as any)),
                modifiers: [], card: action.card, currentAtk: action.card.atk, currentDef: action.card.def, currentBrk: action.card.brk,
             });
          }
          if (action.card.id === 'BR-08' || action.card.id === 'BR-12' || action.card.id === 'BD-11') {
             const targets = vOppField.sort((a,b) => (a.currentDef ?? 0) - (b.currentDef ?? 0));
             if (targets.length > 0 && (targets[0].currentDef ?? 0) <= 80) vOppField.shift();
          }
          if (action.card.id === 'BB-09' || action.card.id === 'BB-12') {
             if (vOppField.length > 0) vOppField.shift();
          }
       }
       
       let roughScore = this.evaluateBoardState(vMyField, vOppField, ai.barrier, player.barrier, cand.virtualHand.length - cand.plays.length, player.hand.length, cand.manaEfficiency);
       cand.baseScore = roughScore;
       
       beamNodes.push({ ...cand, myFieldAfterPlay: vMyField, oppFieldAfterPlay: vOppField });
    }

    // Keep top N (Beam Width = 15)
    beamNodes.sort((a,b) => b.baseScore - a.baseScore);
    const topNodes = beamNodes.slice(0, 15);

    let bestPlan: TurnPlan = {
      chargeCard: null, plays: [], attacks: [], totalScore: -999999, reason: '初期状態', debugLog: {}
    };

    // Phase 3: Deep Lookahead (My Attack -> Opponent Scenarios -> My Next Turn Lethal)
    for (const node of topNodes) {
       const myAttacks = this.evaluateAttacks(node.myFieldAfterPlay, node.oppFieldAfterPlay, player.barrier, player.runes.length);
       const myFieldAfterAttack = [...node.myFieldAfterPlay];
       const oppFieldAfterAttack = [...node.oppFieldAfterPlay];
       let oppBarrierAfterAttack = player.barrier;
       
       for (const att of myAttacks) {
          const atkU = myFieldAfterAttack.find(u => u.instanceId === att.attacker.instanceId);
          if (atkU) atkU.isRested = true;
          
          if (att.targetType === 'PLAYER') {
             oppBarrierAfterAttack -= (att.attacker.currentBrk ?? 1);
          } else if (att.targetType === 'UNIT' && att.targetUnit) {
             const idx = oppFieldAfterAttack.findIndex(u => u.instanceId === att.targetUnit!.instanceId);
             if (idx !== -1) oppFieldAfterAttack.splice(idx, 1);
          }
       }
       
       const scenarios = this.generateOpponentScenarios(
          myFieldAfterAttack, oppFieldAfterAttack, ai.barrier, oppBarrierAfterAttack, 
          node.virtualHand.length - node.plays.length, player.hand.length, node.manaEfficiency, profile
       );
       
       let expectedScore = 0;
       const scenarioLogs: any[] = [];
       
       for (const sc of scenarios) {
          let step3Bonus = 0;
          if (sc.oppBarrier <= 0) {
             const totalBrk = sc.myField.reduce((sum, u) => sum + (u.currentBrk ?? u.card.brk ?? 1), 0);
             if (totalBrk > 0) step3Bonus += 10000;
          }
          
          const finalScenarioScore = sc.score + step3Bonus;
          expectedScore += finalScenarioScore * sc.prob;
          scenarioLogs.push({ name: sc.name, prob: sc.prob, score: finalScenarioScore });
       }
       
       if (expectedScore > bestPlan.totalScore) {
          bestPlan = {
             chargeCard: node.chargeCard,
             plays: node.plays,
             attacks: myAttacks,
             totalScore: expectedScore,
             reason: node.chargeCard ? `カード[${node.chargeCard.name}]をチャージして展開` : `チャージ温存して展開`,
             debugLog: {
                selectedPlays: node.plays.map(p => p.card.name),
                expectedValue: expectedScore,
                opponentResponses: scenarioLogs
             }
          };
       }
    }
    
    return bestPlan;
  }

  public static evaluateBoardState(
    myField: BoardUnit[],
    oppField: BoardUnit[],
    myBarrier: number,
    oppBarrier: number,
    myHandCount: number,
    oppHandCount: number,
    manaEfficiency: number
  ): number {
    let score = 0;
    score += this.getBarrierScore(myBarrier);
    score -= this.getBarrierScore(oppBarrier) * 1.5; 
    
    for (const u of myField) score += this.evaluateUnit(u, true, myBarrier);
    for (const u of oppField) score -= this.evaluateUnit(u, false, oppBarrier);
    
    score += myHandCount * 20;
    score -= oppHandCount * 15;
    score += manaEfficiency;

    if (oppBarrier <= 0) {
      if (myField.some(u => !u.isRested && !u.card.restrictions?.cannotAttackPlayer)) score += 50000;
    }
    if (myBarrier <= 0) {
      if (oppField.some(u => !u.isRested && !u.card.restrictions?.cannotAttackPlayer)) score -= 50000;
    }
    
    return score;
  }

  private static generateOpponentScenarios(
    myField: BoardUnit[],
    oppField: BoardUnit[],
    myBarrier: number,
    oppBarrier: number,
    myHandCount: number,
    oppHandCount: number,
    manaEfficiency: number,
    profile: OpponentProfile
  ) {
    const scenarios = [];
    
    let pRemoval = profile.likelyStrategies.find(s => s.strategy.includes('Removal'))?.probability || 0;
    let pAggro = profile.deckArchetypes.find(a => a.type === 'Aggro')?.probability || 0;
    let pDef = profile.deckArchetypes.find(a => a.type === 'Control')?.probability || 0;
    
    const sumP = pRemoval + pAggro + pDef;
    if (sumP > 0.8) {
       const scale = 0.8 / sumP;
       pRemoval *= scale;
       pAggro *= scale;
       pDef *= scale;
    }
    const pBase = Math.max(0, 1 - (pRemoval + pAggro + pDef));

    if (pRemoval > 0) {
      const sMyField = [...myField];
      if (sMyField.length > 0) {
        sMyField.sort((a,b) => this.evaluateUnit(b, true, myBarrier) - this.evaluateUnit(a, true, myBarrier));
        sMyField.shift();
      }
      scenarios.push({ name: 'Removal', prob: pRemoval, ...this.simulateAttacksAndEval([...oppField], sMyField, myBarrier, oppBarrier, myHandCount, oppHandCount, manaEfficiency) });
    }

    if (pAggro > 0) {
      const sOppField = [...oppField];
      sOppField.push({
        instanceId: 'v_opp_rush', cards: [], isRested: false, hasSummoningSickness: false, modifiers: [],
        card: { id: 'v_rush', name: 'Virtual Rush', cost: 3, system: 'Fire', type: 'Unit', atk: 30, def: 20, brk: 1, keywords: ['Rush' as any] },
        currentAtk: 30, currentDef: 20, currentBrk: 1
      });
      scenarios.push({ name: 'Aggro', prob: pAggro, ...this.simulateAttacksAndEval(sOppField, [...myField], myBarrier, oppBarrier, myHandCount, oppHandCount, manaEfficiency) });
    }

    if (pDef > 0) {
      const sOppField = [...oppField];
      sOppField.push({
        instanceId: 'v_opp_guard', cards: [], isRested: false, hasSummoningSickness: false, modifiers: [],
        card: { id: 'v_guard', name: 'Virtual Guard', cost: 3, system: 'Water', type: 'Unit', atk: 20, def: 40, brk: 1, keywords: ['Guard' as any] },
        currentAtk: 20, currentDef: 40, currentBrk: 1
      });
      scenarios.push({ name: 'Defense', prob: pDef, ...this.simulateAttacksAndEval(sOppField, [...myField], myBarrier, oppBarrier, myHandCount, oppHandCount, manaEfficiency) });
    }

    scenarios.push({ name: 'Base', prob: pBase, ...this.simulateAttacksAndEval([...oppField], [...myField], myBarrier, oppBarrier, myHandCount, oppHandCount, manaEfficiency) });

    return scenarios;
  }

  private static simulateAttacksAndEval(
    attackerField: BoardUnit[],
    defenderField: BoardUnit[],
    defenderBarrier: number,
    attackerBarrier: number,
    defenderHandCount: number,
    attackerHandCount: number,
    manaEfficiency: number
  ) {
    let simDefenderBarrier = defenderBarrier;
    const simAttackerField = [...attackerField];
    const simDefenderField = [...defenderField];
    
    const attacks = this.evaluateAttacks(simAttackerField, simDefenderField, simDefenderBarrier, 0); 
    
    for (const att of attacks) {
       const atkU = simAttackerField.find(u => u.instanceId === att.attacker.instanceId);
       if (atkU) atkU.isRested = true;
       
       if (att.targetType === 'PLAYER') {
         simDefenderBarrier -= (att.attacker.currentBrk ?? 1);
       } else if (att.targetType === 'UNIT' && att.targetUnit) {
         const idx = simDefenderField.findIndex(u => u.instanceId === att.targetUnit!.instanceId);
         if (idx !== -1) simDefenderField.splice(idx, 1);
       }
    }
    
    const score = this.evaluateBoardState(simDefenderField, simAttackerField, simDefenderBarrier, attackerBarrier, defenderHandCount, attackerHandCount, manaEfficiency);
    
    return { score, myField: simDefenderField, oppField: simAttackerField, myBarrier: simDefenderBarrier, oppBarrier: attackerBarrier };
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
