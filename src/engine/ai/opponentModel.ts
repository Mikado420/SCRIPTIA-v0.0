import { GameState } from '../../types';
import { checkAffinity } from '../engineUtils';
import {
  ALL_CARD_IDS,
  MAX_COPIES,
  cardRoles,
  hasKeyword,
  isHiddenCard,
  isInteractionCard,
  removalReach,
  tpl,
} from './cardKnowledge';
import { PlayerId, buildAIView, otherPlayer } from './publicView';
import { calculateUnitStats } from '../engineUtils';
import { CardEstimate, DeckType, OpponentProfile, OpponentTendencies, PredictedResponse } from './types';

/**
 * 相手の行動履歴（公開情報のみ）。
 * 状態の差分から「相手が何をしたか」を記録する。
 */
export interface ObservationLog {
  /** instanceId → cardId（一度公開されたカード。移動しても二重計上しない） */
  revealed: Record<string, string>;
  /** 公開領域から相手の手札に戻ったことが分かっているカード（バウンス等）。instanceId → cardId */
  knownInHand: Record<string, string>;
  turnsObserved: number;
  unitsPlayed: number;
  spellsCast: number;
  interactionsUsed: number;
  runesSet: number;
  charges: number;
  attackOpportunities: number;
  playerAttacks: number;
  unitAttacks: number;
  guardOpportunities: number;
  guardsUsed: number;
  handSizeSum: number;
}

export const emptyObservationLog = (): ObservationLog => ({
  revealed: {},
  knownInHand: {},
  turnsObserved: 0,
  unitsPlayed: 0,
  spellsCast: 0,
  interactionsUsed: 0,
  runesSet: 0,
  charges: 0,
  attackOpportunities: 0,
  playerAttacks: 0,
  unitAttacks: 0,
  guardOpportunities: 0,
  guardsUsed: 0,
  handSizeSum: 0,
});

/** 公開ゾーン（場・アルカナ・アーカイブ・ドメイン）にあるカードを列挙 */
function publicCards(view: GameState, pid: PlayerId): { instanceId: string; cardId: string }[] {
  const p = view[pid];
  const out: { instanceId: string; cardId: string }[] = [];
  p.field.forEach(u => u.cards.forEach(c => out.push(c)));
  p.arcana.forEach(c => out.push(c));
  p.archive.forEach(c => out.push(c));
  if (p.domain) out.push(p.domain);
  return out.filter(c => !isHiddenCard(c.cardId));
}

/**
 * 相手の公開情報を観測し続け、AIターン開始時に OpponentProfile を作るクラス。
 *
 * 入力はフルの GameState だが、受け取った瞬間に buildAIView で非公開情報を伏せ、
 * 以降は伏せたビューしか扱わない。
 */
export class OpponentObserver {
  readonly aiId: PlayerId;
  readonly oppId: PlayerId;
  private log: ObservationLog = emptyObservationLog();
  private profiles = new Map<number, OpponentProfile>();
  private lastViewSource: GameState | null = null;
  private lastView: GameState | null = null;

  constructor(aiId: PlayerId = 'player2') {
    this.aiId = aiId;
    this.oppId = otherPlayer(aiId);
  }

  reset() {
    this.log = emptyObservationLog();
    this.profiles.clear();
    this.lastViewSource = null;
    this.lastView = null;
  }

  getLog(): ObservationLog {
    return this.log;
  }

  /**
   * 状態遷移を観測する。AIターンへの切り替わりを検出したら、
   * 遷移前（= AIのドロー前）のスナップショットで相手デッキ分析を1回だけ行う。
   */
  observe(prevState: GameState, nextState: GameState): OpponentProfile | null {
    if (prevState === nextState) return null;
    // 新しいゲームの開始を検出
    if (
      nextState.turnCount < prevState.turnCount ||
      (nextState.turnCount === 1 && prevState.turnCount !== 1) ||
      nextState.log.length < prevState.log.length
    ) {
      this.reset();
      return null;
    }
    const prev = this.lastViewSource === prevState && this.lastView ? this.lastView : buildAIView(prevState, this.aiId);
    const next = buildAIView(nextState, this.aiId);
    this.lastViewSource = nextState;
    this.lastView = next;
    this.recordDiff(prev, next);

    const becameAITurn = prev.currentPlayer === this.oppId && next.currentPlayer === this.aiId;
    if (becameAITurn && !this.profiles.has(next.turnCount)) {
      // reducer の NEXT_PHASE は「ターン交代 + ドロー」を1回で行うため、
      // 交代直前の状態 = AIドロー前の状態で分析する。
      const profile = analyzeOpponent(prev, this.aiId, this.log, next.turnCount, true);
      this.profiles.set(next.turnCount, profile);
      return profile;
    }
    return null;
  }

  /** そのAIターンのプロファイル。無ければ（途中から観測した等）現在の状態で1回だけ作る */
  getProfileForTurn(state: GameState): OpponentProfile {
    const existing = this.profiles.get(state.turnCount);
    if (existing) return existing;
    const view = buildAIView(state, this.aiId);
    const profile = analyzeOpponent(view, this.aiId, this.log, state.turnCount, false);
    this.profiles.set(state.turnCount, profile);
    return profile;
  }

  private recordDiff(prev: GameState, next: GameState) {
    const L = this.log;
    const opp = this.oppId;
    const pOpp = prev[opp];
    const nOpp = next[opp];

    // 公開領域から手札に戻ったカード（バウンス・置換効果など）は、相手の手札にあると分かる
    const prevPublic = publicCards(prev, opp);
    const nextPublicIds = new Set(publicCards(next, opp).map(c => c.instanceId));
    if (nOpp.hand.length > pOpp.hand.length) {
      for (const c of prevPublic) {
        if (!nextPublicIds.has(c.instanceId)) L.knownInHand[c.instanceId] = c.cardId;
      }
    }
    for (const id of Object.keys(L.knownInHand)) {
      if (nextPublicIds.has(id)) delete L.knownInHand[id];
    }
    // 手札枚数より多くは覚えておけない（伏せルーンとして置かれた等）
    const known = Object.keys(L.knownInHand);
    if (known.length > nOpp.hand.length) {
      known.slice(0, known.length - nOpp.hand.length).forEach(id => delete L.knownInHand[id]);
    }

    // 公開されたカード（instanceIdで重複排除）
    for (const c of publicCards(next, opp)) {
      if (!L.revealed[c.instanceId]) {
        L.revealed[c.instanceId] = c.cardId;
        const t = tpl(c.cardId);
        // 相手の手番中に新たに公開されたカードを行動として記録
        if (prev.currentPlayer === opp && next.currentPlayer === opp) {
          const onField = nOpp.field.some(u => u.cards.some(x => x.instanceId === c.instanceId));
          const inArchive = nOpp.archive.some(x => x.instanceId === c.instanceId);
          if (onField && (t.type === 'Unit' || t.type === 'Evolution')) L.unitsPlayed++;
          if (inArchive && t.type === 'Spell') L.spellsCast++;
          if (isInteractionCard(c.cardId) && (t.type === 'Spell' || onField)) L.interactionsUsed++;
        }
      }
    }

    if (prev.currentPlayer === opp && next.currentPlayer === opp) {
      if (nOpp.runes.length > pOpp.runes.length) L.runesSet++;
      if (nOpp.arcana.length > pOpp.arcana.length && next.flags.hasPlacedArcanaThisTurn && !prev.flags.hasPlacedArcanaThisTurn) {
        L.charges++;
      }
      // 攻撃の検出: 相手ユニットがアクティブ→レストになり、AI側の結界 or ユニットが減った
      const newlyRested = nOpp.field.filter(u => u.isRested && pOpp.field.some(pu => pu.instanceId === u.instanceId && !pu.isRested)).length;
      const barrierHit = next[this.aiId].barrier < prev[this.aiId].barrier;
      if (newlyRested > 0 || barrierHit) {
        if (barrierHit) L.playerAttacks++;
        else L.unitAttacks++;
      }
    }

    // 相手ターン開始時に、攻撃機会・手札枚数を記録
    if (prev.currentPlayer === this.aiId && next.currentPlayer === opp) {
      L.turnsObserved++;
      L.handSizeSum += nOpp.hand.length;
      L.attackOpportunities += nOpp.field.filter(u => !tpl(u.cards[0].cardId).keywords?.includes('CannotAttackPlayer')).length;
    }

    // AIの直接攻撃に対する守護の選択（GUARDプロンプトの解決）
    if (prev.prompt?.type === 'GUARD' && prev.prompt.playerId === opp && !next.prompt) {
      L.guardOpportunities++;
      const guarded = nOpp.field.filter(u => u.isRested).length > pOpp.field.filter(u => u.isRested).length ||
        nOpp.field.length < pOpp.field.length;
      if (guarded) L.guardsUsed++;
    }
  }
}

const DECK_TYPE_LABEL: Record<DeckType, string> = {
  Aggro: 'アグロ（速攻）',
  Midrange: 'ミッドレンジ',
  Control: 'コントロール（除去・守護）',
  Ramp: 'ランプ（大型展開）',
  Tempo: 'テンポ（バウンス・妨害）',
  Unknown: '不明',
};

/** カード1枚がデッキタイプの推定に与える寄与 */
function archetypeFeatures(cardId: string): Record<DeckType, number> {
  const t = tpl(cardId);
  const roles = cardRoles(cardId);
  const f: Record<DeckType, number> = { Aggro: 0, Midrange: 0, Control: 0, Ramp: 0, Tempo: 0, Unknown: 0 };
  const isUnit = t.type === 'Unit' || t.type === 'Evolution';
  if (isUnit && t.cost <= 2 && (t.atk ?? 0) >= 20 && !hasKeyword(t, 'CannotAttackPlayer')) f.Aggro += 1.2;
  if (roles.includes('rush') || roles.includes('buff')) f.Aggro += 1.2;
  if (t.id === 'BR-15') f.Aggro += 1;
  if (isUnit && t.cost >= 3 && t.cost <= 5 && !roles.includes('guard')) f.Midrange += 0.9;
  if (roles.includes('removal')) f.Control += 1.1;
  if (roles.includes('guard')) f.Control += 0.8;
  if (roles.includes('trap')) f.Control += 0.8;
  if (roles.includes('draw') || roles.includes('recursion')) f.Control += 0.5;
  if (roles.includes('ramp')) f.Ramp += 1.6;
  if (isUnit && t.cost >= 6) f.Ramp += 1.1;
  if (roles.includes('bounce') || roles.includes('tap') || roles.includes('discard')) f.Tempo += 1.2;
  return f;
}

const clamp01 = (x: number) => Math.max(0, Math.min(1, x));

/**
 * 相手デッキ分析。公開情報（view）と行動履歴だけを使う。
 */
export function analyzeOpponent(
  view: GameState,
  aiId: PlayerId,
  log: ObservationLog = emptyObservationLog(),
  turn: number = view.turnCount,
  analyzedBeforeDraw = false,
): OpponentProfile {
  const oppId = otherPlayer(aiId);
  const opp = view[oppId];

  // ---- 公開されたカード（履歴 + 現在の公開ゾーン）----
  const revealed: Record<string, string> = { ...log.revealed };
  publicCards(view, oppId).forEach(c => (revealed[c.instanceId] = c.cardId));
  const revealedCounts: Record<string, number> = {};
  Object.values(revealed).forEach(id => (revealedCounts[id] = (revealedCounts[id] || 0) + 1));
  const observedCards = Object.keys(revealedCounts);
  const revealedTotal = Object.values(revealedCounts).reduce((a, b) => a + b, 0);

  // ---- 系統 ----
  const elementWeight: Record<string, number> = {};
  Object.entries(revealedCounts).forEach(([id, n]) => {
    const sys = tpl(id).system;
    if (sys === 'Neutral') return;
    // アルカナは「デッキに入っているカード」を示す良い手掛かり
    elementWeight[sys] = (elementWeight[sys] || 0) + n;
  });
  const elemTotal = Object.values(elementWeight).reduce((a, b) => a + b, 0);
  const elements = Object.entries(elementWeight)
    .map(([element, w]) => ({ element, weight: elemTotal > 0 ? w / elemTotal : 0 }))
    .sort((a, b) => b.weight - a.weight);

  // ---- 行動傾向 ----
  const turns = Math.max(1, log.turnsObserved);
  const tendencies: OpponentTendencies = {
    aggression: log.attackOpportunities > 0 ? clamp01((log.playerAttacks + 0.5) / (log.attackOpportunities + 1)) : 0.6,
    removalRate: clamp01((log.interactionsUsed + 0.3) / (turns + 1)),
    developmentRate: clamp01((log.unitsPlayed + 0.5) / (turns + 1)),
    guardRate: log.guardOpportunities > 0 ? clamp01((log.guardsUsed + 0.5) / (log.guardOpportunities + 1)) : 0.6,
    chargeRate: clamp01((log.charges + 1) / (turns + 1)),
    avgHandSize: log.turnsObserved > 0 ? log.handSizeSum / log.turnsObserved : opp.hand.length,
    sampleTurns: log.turnsObserved,
  };

  // ---- デッキタイプ ----
  const typeScore: Record<DeckType, number> = { Aggro: 1, Midrange: 1.2, Control: 1, Ramp: 0.8, Tempo: 0.8, Unknown: 0 };
  Object.entries(revealedCounts).forEach(([id, n]) => {
    const f = archetypeFeatures(id);
    (Object.keys(f) as DeckType[]).forEach(k => (typeScore[k] += f[k] * n));
  });
  // 行動からの補正
  typeScore.Aggro += tendencies.aggression * 2 * Math.min(1, log.turnsObserved / 3);
  typeScore.Control += (tendencies.removalRate * 2 + (tendencies.avgHandSize >= 5 ? 0.8 : 0)) * Math.min(1, log.turnsObserved / 3);
  typeScore.Ramp += opp.maxArcana >= 7 ? 1 : 0;
  const types: DeckType[] = ['Aggro', 'Midrange', 'Control', 'Ramp', 'Tempo'];
  const sum = types.reduce((a, k) => a + Math.max(0, typeScore[k]), 0) || 1;
  const deckTypeScores = types
    .map(type => ({ type, probability: Math.max(0, typeScore[type]) / sum }))
    .sort((a, b) => b.probability - a.probability);
  const top = deckTypeScores[0];
  const margin = top.probability - (deckTypeScores[1]?.probability ?? 0);
  // 観測量が少ないほど確信度は低い
  const evidence = 1 - Math.exp(-(revealedTotal + log.turnsObserved * 2) / 10);
  const deckTypeConfidence = clamp01((0.35 + margin * 2.5) * evidence);
  const deckType: DeckType = revealedTotal === 0 && log.turnsObserved === 0 ? 'Unknown' : top.type;

  // ---- 採用候補カード & 手札にある確率 ----
  const knownHand = Object.values(log.knownInHand).slice(0, opp.hand.length);
  const unknownPool = Math.max(1, opp.hand.length + opp.deck.length);
  const nextMana = opp.maxArcana + (opp.hand.length > 0 ? 1 : 0);
  const knownElements = new Set(elements.map(e => e.element));
  const candidateCards: CardEstimate[] = [];
  for (const cardId of ALL_CARD_IDS) {
    const t = tpl(cardId);
    const seen = revealedCounts[cardId] || 0;
    let deckProbability: number;
    if (seen > 0) deckProbability = 1;
    else if (t.system === 'Neutral') deckProbability = 0.35;
    else if (knownElements.size === 0) deckProbability = 0.2;
    else if (knownElements.has(t.system)) {
      const w = elements.find(e => e.element === t.system)?.weight ?? 0;
      deckProbability = 0.35 + 0.35 * w;
    } else deckProbability = knownElements.size >= 2 ? 0.02 : 0.08;
    // デッキタイプとの相性
    const f = archetypeFeatures(cardId);
    const fit = deckType === 'Unknown' ? 0 : f[deckType] ?? 0;
    if (seen === 0) deckProbability = clamp01(deckProbability * (1 + 0.15 * fit * deckTypeConfidence));

    // 残り枚数の期待値（採用時は平均3枚を想定）
    const expectedCopies = Math.max(0, Math.min(MAX_COPIES, Math.max(seen, 3)) - seen) * deckProbability;
    const remaining = Math.max(0, expectedCopies);
    const perDraw = Math.min(1, remaining / unknownPool);
    const handProbability = knownHand.includes(cardId)
      ? 1
      : opp.hand.length > 0
        ? clamp01(1 - Math.pow(1 - perDraw, Math.max(0, opp.hand.length - knownHand.length)))
        : 0;

    const castableNextTurn =
      t.cost <= nextMana &&
      (t.system === 'Neutral' || checkAffinity(t.system, opp.arcana)) &&
      (t.type !== 'Evolution' || opp.field.some(u => tpl(u.cards[0].cardId).lineage === t.evolutionTarget));

    candidateCards.push({
      cardId,
      name: t.name,
      deckProbability: round2(deckProbability),
      handProbability: round2(handProbability),
      seenCopies: seen,
      threatLevel: round2(baseThreat(cardId)),
      castableNextTurn,
    });
  }
  candidateCards.sort((a, b) => b.deckProbability - a.deckProbability || b.threatLevel - a.threatLevel);

  // ---- 脅威カード（AIの現在の盤面に対して）----
  const aiField = view[aiId].field;
  const threats = candidateCards
    .filter(c => c.deckProbability >= 0.15)
    .map(c => {
      let situational = c.threatLevel;
      const reachAny = aiField.some(u => {
        const st = calculateUnitStats(view, aiId, u);
        return removalReach(c.cardId, { def: st.def, cost: tpl(u.cards[0].cardId).cost }) > 0;
      });
      if (isInteractionCard(c.cardId)) situational *= reachAny ? 1.2 : 0.4;
      return { ...c, threatLevel: round2(clamp01(situational)) };
    })
    .sort(
      (a, b) =>
        b.threatLevel * b.handProbability * (b.castableNextTurn ? 1 : 0.4) -
        a.threatLevel * a.handProbability * (a.castableNextTurn ? 1 : 0.4),
    )
    .slice(0, 10);

  return {
    turn,
    analyzedBeforeDraw,
    deckType,
    deckTypeLabel: DECK_TYPE_LABEL[deckType],
    deckTypeConfidence: round2(deckTypeConfidence),
    deckTypeScores: deckTypeScores.map(d => ({ ...d, probability: round2(d.probability) })),
    elements: elements.map(e => ({ ...e, weight: round2(e.weight) })),
    observedCards,
    revealedCounts,
    knownHandCards: knownHand,
    candidateCards: candidateCards.filter(c => c.deckProbability >= 0.15).slice(0, 20),
    threats,
    tendencies,
    resources: {
      hand: opp.hand.length,
      deck: opp.deck.length,
      maxArcana: opp.maxArcana,
      runes: opp.runes.length,
      barrier: opp.barrier,
      field: opp.field.length,
      hasDomain: !!opp.domain,
    },
  };
}

function baseThreat(cardId: string): number {
  const t = tpl(cardId);
  const roles = cardRoles(cardId);
  let th = 0.1;
  if (roles.includes('removal')) th += 0.55;
  if (roles.includes('bounce')) th += 0.4;
  if (roles.includes('tap') || roles.includes('debuff')) th += 0.25;
  if (roles.includes('finisher')) th += 0.35;
  if (roles.includes('rush')) th += 0.2;
  if (roles.includes('trap')) th += 0.2;
  if (roles.includes('guard')) th += 0.1;
  if ((t.atk ?? 0) >= 50) th += 0.15;
  return clamp01(th);
}

const round2 = (x: number) => Math.round(x * 100) / 100;

/**
 * 相手の次ターンの主行動を確率的に予測する（互いに排他なシナリオの分布）。
 * 非公開情報は確率として扱い、確定情報とはみなさない。
 */
export function predictOpponentActions(view: GameState, aiId: PlayerId, profile: OpponentProfile, maxScenarios = 4): PredictedResponse[] {
  const oppId = otherPlayer(aiId);
  const opp = view[oppId];
  const me = view[aiId];
  // 相手ターン開始時にドローするので手札は最低1枚になる
  const handAtTurn = opp.hand.length + (opp.deck.length > 0 ? 1 : 0);
  const mana = opp.maxArcana + (handAtTurn >= 1 ? profile.tendencies.chargeRate >= 0.3 ? 1 : 0 : 0);
  const castable = (cardId: string) => {
    const t = tpl(cardId);
    if (t.cost > mana) return false;
    if (t.system !== 'Neutral' && !checkAffinity(t.system, opp.arcana)) return false;
    if (t.type === 'Evolution') return opp.field.some(u => tpl(u.cards[0].cardId).lineage === t.evolutionTarget);
    if (t.type === 'Unit') return opp.field.length < 6;
    return true;
  };
  const handProb = (c: CardEstimate) => {
    // 次ターンのドロー分を加味
    const unknown = Math.max(1, opp.hand.length + opp.deck.length);
    const extra = opp.deck.length > 0 ? Math.min(1, Math.max(0, 3 - c.seenCopies) * c.deckProbability / unknown) : 0;
    return clamp01(1 - (1 - c.handProbability) * (1 - extra));
  };

  const responses: PredictedResponse[] = [];
  if (handAtTurn === 0) {
    responses.push({ id: 'attackOnly', kind: 'attackOnly', label: '攻撃のみ（手札なし）', probability: 1 });
    return responses;
  }

  // 除去・干渉: AIの盤面に対象がある場合のみ意味がある
  const interaction = profile.candidateCards
    .filter(c => isInteractionCard(c.cardId) && castable(c.cardId))
    .filter(c =>
      me.field.some(u => removalReach(c.cardId, { def: calculateUnitStats(view, aiId, u).def, cost: tpl(u.cards[0].cardId).cost }) > 0),
    )
    .map(c => ({ c, p: handProb(c) * (0.6 + 0.4 * profile.tendencies.removalRate), impact: c.threatLevel }))
    .filter(x => x.p > 0.03)
    .sort((a, b) => b.p * b.impact - a.p * a.impact);

  // 決定力のあるユニット（BRK2 / 速攻 / 守護されない）
  const finishers = profile.candidateCards
    .filter(c => !isInteractionCard(c.cardId) && castable(c.cardId))
    .filter(c => {
      const r = cardRoles(c.cardId);
      return r.includes('finisher') || r.includes('rush');
    })
    .map(c => ({ c, p: handProb(c) * 0.7, impact: c.threatLevel }))
    .filter(x => x.p > 0.05)
    .sort((a, b) => b.p * b.impact - a.p * a.impact);

  let remaining = 1;
  const slots = Math.max(1, maxScenarios - 2);
  const picked = [...interaction.slice(0, slots), ...finishers.slice(0, 1)]
    .sort((a, b) => b.p * b.impact - a.p * a.impact)
    .slice(0, slots);
  for (const { c, p } of picked) {
    const prob = remaining * Math.min(0.85, p);
    if (prob < 0.03) continue;
    const t = tpl(c.cardId);
    const kind = isInteractionCard(c.cardId) ? (cardRoles(c.cardId).includes('removal') ? 'removal' : 'interaction') : 'finisher';
    responses.push({ id: `card:${c.cardId}`, kind, label: `${t.name}${kind === 'removal' ? '（除去）' : kind === 'interaction' ? '（妨害）' : '（展開）'}`, probability: prob, cardId: c.cardId });
    remaining -= prob;
  }

  // 一般的な展開: 最も採用されていそうな、出せるユニット
  const units = profile.candidateCards
    .filter(c => {
      const t = tpl(c.cardId);
      return (t.type === 'Unit') && castable(c.cardId) && !responses.some(r => r.cardId === c.cardId);
    })
    .sort((a, b) => b.deckProbability * (1 + tpl(b.cardId).cost / 10) - a.deckProbability * (1 + tpl(a.cardId).cost / 10));
  if (units.length > 0 && remaining > 0.05) {
    const pAnyUnit = clamp01(1 - units.slice(0, 6).reduce((acc, u) => acc * (1 - handProb(u)), 1));
    const pDevelop = remaining * clamp01(Math.max(pAnyUnit, 0.25) * (0.5 + 0.5 * profile.tendencies.developmentRate));
    if (pDevelop >= 0.03) {
      const u = units[0];
      responses.push({ id: `develop:${u.cardId}`, kind: 'develop', label: `ユニット展開（${tpl(u.cardId).name} 等）`, probability: pDevelop, cardId: u.cardId });
      remaining -= pDevelop;
    }
  }

  responses.push({ id: 'attackOnly', kind: 'attackOnly', label: '攻撃・温存のみ', probability: Math.max(0, remaining) });
  const total = responses.reduce((a, r) => a + r.probability, 0) || 1;
  return responses.map(r => ({ ...r, probability: round2(r.probability / total) })).filter(r => r.probability > 0);
}
