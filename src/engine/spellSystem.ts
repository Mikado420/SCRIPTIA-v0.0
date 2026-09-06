import { GameState, CardInstance, CardTemplate, UnitState } from '../types';
import { getCard } from '../data/cards';
import { calculateUnitStats, findUnitAndOwner } from './engineUtils';
import { destroyUnit, bounceUnit, sendUnitToArcana } from './destroySystem';

/**
 * Validates if the player can afford and cast the given card from hand.
 */
export const canCastSpell = (
  state: GameState,
  instanceId: string
): { canCast: boolean; reason?: string } => {
  const p = state[state.currentPlayer];
  const cardInst = p.hand.find(c => c.instanceId === instanceId);
  if (!cardInst) return { canCast: false, reason: 'カードが手札に存在しません' };

  const tpl = getCard(cardInst.cardId);
  if (tpl.type !== 'Spell') return { canCast: false, reason: 'スペルカードではありません' };

  if (p.currentArcana < tpl.cost) return { canCast: false, reason: 'アルカナ（コスト）が不足しています' };

  const hasAffinity =
    tpl.system === 'Neutral' ||
    p.arcana.some(a => getCard(a.cardId).system === tpl.system);

  if (!hasAffinity) return { canCast: false, reason: '系統条件（アルカナの色）を満たしていません' };

  return { canCast: true };
};

/**
 * Returns list of valid target instance IDs for a given spell.
 * Specifically for BW-13 (聖者の祈り):
 * - Excludes the spell itself in pending.
 * - Excludes any other card in archive with cardId === 'BW-13'.
 */
export const getValidSpellTargets = (
  state: GameState,
  spellCardId: string,
  spellInstanceId?: string
): string[] => {
  const p = state[state.currentPlayer];
  const oppKey = state.currentPlayer === 'player1' ? 'player2' : 'player1';
  const opp = state[oppKey];

  switch (spellCardId) {
    case 'BR-12': // 相手のDEF20以下のユニット1体
      return opp.field
        .filter(u => calculateUnitStats(state, oppKey, u).def <= 20)
        .map(u => u.instanceId);

    case 'BB-12': // 相手のコスト5以下のユニット1体
      return opp.field
        .filter(u => getCard(u.cards[0].cardId).cost <= 5)
        .map(u => u.instanceId);

    case 'BG-13': // 相手のDEF60以下のユニット1体
      return opp.field
        .filter(u => calculateUnitStats(state, oppKey, u).def <= 60)
        .map(u => u.instanceId);

    case 'BW-12': // 相手のユニット1体
      return opp.field.map(u => u.instanceId);

    case 'BW-13': // 聖者の祈り: 自分のアーカイブから、このカード以外のスペルかルーン1枚
      // Strictly excludes itself (spellInstanceId) and any card with cardId === 'BW-13'
      return p.archive
        .filter(c => {
          if (spellInstanceId && c.instanceId === spellInstanceId) return false;
          if (c.cardId === 'BW-13') return false;
          const t = getCard(c.cardId);
          return t.type === 'Spell' || t.type === 'Rune';
        })
        .map(c => c.instanceId);

    case 'BD-13': // 相手のユニット1体 (DEF -30)
      return opp.field.map(u => u.instanceId);

    case 'BN-03': // 相手のドメイン1枚
      return opp.domain ? [opp.domain.instanceId] : [];

    case 'BN-04': // 相手のセットされているルーン1枚
      return opp.runes.map(r => r.instanceId);

    default:
      return [];
  }
};

/**
 * Moves spell to pending card zone and initiates TARGET_SELECTION mode.
 */
export const startSpellCast = (
  state: GameState,
  instanceId: string
): GameState => {
  const p = state[state.currentPlayer];
  const cardIdx = p.hand.findIndex(c => c.instanceId === instanceId);
  if (cardIdx === -1) return state;

  const check = canCastSpell(state, instanceId);
  if (!check.canCast) {
    state.log.push(check.reason || 'スペルを使用できません。');
    return state;
  }

  const [card] = p.hand.splice(cardIdx, 1);
  const tpl = getCard(card.cardId);

  // Place into Pending Card Zone
  p.pendingCard = card;

  // If spell requires a target, set prompt to TARGET_SELECTION
  if (tpl.targetReq) {
    const validTargets = getValidSpellTargets(state, tpl.id, card.instanceId);
    state.prompt = {
      type: 'TARGET_SELECTION',
      playerId: state.currentPlayer,
      sourceId: card.instanceId,
      spellCardId: tpl.id,
      validTargets,
      message: `【${tpl.name}】の対象を選択してください。`,
    };
    state.log.push(`${p.id} は 【${tpl.name}】 の詠唱を開始した（対象選択中）。`);
    return state;
  }

  // If spell does NOT require target (e.g. BR-13, BB-13, BG-12, BD-12)
  return resolveSpellCast(state, card.instanceId);
};

/**
 * Cancels a pending spell cast and returns the card to hand.
 */
export const cancelSpellCast = (state: GameState): GameState => {
  const p = state[state.currentPlayer];
  if (p.pendingCard) {
    p.hand.push(p.pendingCard);
    p.pendingCard = null;
  }
  if (state.prompt?.type === 'TARGET_SELECTION') {
    state.prompt = null;
  }
  state.log.push('スペルの詠唱をキャンセルした。');
  return state;
};

/**
 * Resolves a pending spell with the selected target, deducts cost,
 * executes effects, and moves the spell from pending to archive.
 */
export const resolveSpellCast = (
  state: GameState,
  spellInstanceId: string,
  targetId?: string
): GameState => {
  const p = state[state.currentPlayer];
  const oppKey = state.currentPlayer === 'player1' ? 'player2' : 'player1';
  const opp = state[oppKey];

  // Retrieve pending card (or from hand if called directly)
  let card: CardInstance | null = null;
  if (p.pendingCard && p.pendingCard.instanceId === spellInstanceId) {
    card = p.pendingCard;
    p.pendingCard = null;
  } else {
    const idx = p.hand.findIndex(c => c.instanceId === spellInstanceId);
    if (idx !== -1) {
      card = p.hand.splice(idx, 1)[0];
    }
  }

  if (!card) return state;

  const tpl = getCard(card.cardId);

  // Validate cost deduction
  p.currentArcana = Math.max(0, p.currentArcana - tpl.cost);
  state.log.push(`${p.id} はスペル 【${tpl.name}】 を発動！`);
  state.prompt = null;

  // Execute spell effects
  if (tpl.id === 'BR-12' && targetId) {
    state = destroyUnit(state, targetId);
  } else if (tpl.id === 'BR-13') {
    p.field.forEach(u =>
      u.modifiers.push({
        sourceId: 'BR-13',
        atk: 20,
        def: 0,
        brk: 0,
        duration: 'UNTIL_TURN_END',
      })
    );
  } else if (tpl.id === 'BB-12' && targetId) {
    state = bounceUnit(state, targetId);
  } else if (tpl.id === 'BB-13') {
    if (p.deck.length > 0) p.hand.push(p.deck.pop()!);
    if (p.deck.length > 0) p.hand.push(p.deck.pop()!);
  } else if (tpl.id === 'BG-12') {
    if (p.deck.length > 0) {
      p.arcana.push(p.deck.pop()!);
      p.maxArcana++;
      p.currentArcana++;
    }
  } else if (tpl.id === 'BG-13' && targetId) {
    state = sendUnitToArcana(state, targetId, oppKey);
  } else if (tpl.id === 'BW-12' && targetId) {
    const t = findUnitAndOwner(state, targetId);
    if (t) t.unit.isRested = true;
  } else if (tpl.id === 'BW-13' && targetId) {
    // Strictly retrieve non-BW-13 spell or rune from archive
    const aIdx = p.archive.findIndex(c => c.instanceId === targetId);
    if (aIdx !== -1) {
      const retrieved = p.archive.splice(aIdx, 1)[0];
      p.hand.push(retrieved);
      state.log.push(`【聖者の祈り】の効果でアーカイブから 【${getCard(retrieved.cardId).name}】 を手札に加えた。`);
    }
  } else if (tpl.id === 'BD-12') {
    if (opp.hand.length > 0) {
      const randIdx = Math.floor(Math.random() * opp.hand.length);
      opp.archive.push(opp.hand.splice(randIdx, 1)[0]);
    }
  } else if (tpl.id === 'BD-13' && targetId) {
    const t = findUnitAndOwner(state, targetId);
    if (t) {
      t.unit.modifiers.push({
        sourceId: 'BD-13',
        atk: 0,
        def: -30,
        brk: 0,
        duration: 'UNTIL_TURN_END',
      });
      if (calculateUnitStats(state, t.playerId, t.unit).def <= 0) {
        state = destroyUnit(state, targetId);
      }
    }
  } else if (tpl.id === 'BN-03' && opp.domain) {
    opp.archive.push(opp.domain);
    opp.domain = null;
    state.log.push(`相手のドメインが破壊されアーカイブに送られた。`);
  } else if (tpl.id === 'BN-04' && targetId) {
    const rIdx = opp.runes.findIndex(r => r.instanceId === targetId);
    if (rIdx !== -1) {
      opp.hand.push(opp.runes.splice(rIdx, 1)[0]);
      state.log.push(`相手のルーンが手札に戻された。`);
    }
  }

  // Spell moves from Pending to Archive
  p.archive.push(card);
  return state;
};
