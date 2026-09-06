import { GameState, UnitState, PlayerState, CardInstance } from '../types';
import { getCard } from '../data/cards';
import { findUnitAndOwner, calculateUnitStats } from './engineUtils';

export type UnitDestroyedListener = (state: GameState, destroyedUnit: UnitState, ownerPlayerId: string) => void;

// Active listeners for ON_UNIT_DESTROYED
const unitDestroyedListeners: UnitDestroyedListener[] = [];

export const registerOnUnitDestroyedListener = (listener: UnitDestroyedListener) => {
  unitDestroyedListeners.push(listener);
  return () => {
    const idx = unitDestroyedListeners.indexOf(listener);
    if (idx !== -1) unitDestroyedListeners.splice(idx, 1);
  };
};

export const clearOnUnitDestroyedListeners = () => {
  unitDestroyedListeners.length = 0;
};

/**
 * Destroy a unit adhering to SCRIPTIA v0.07 Rules:
 * 1. BEFORE_UNIT_DESTROYED replacement effects (BB-05, BB-11):
 *    - Cancel archive move, return cards to hand.
 *    - Absolutely do NOT trigger ON_UNIT_DESTROYED events or listeners.
 * 2. Invariant Principle 4 (Evolution Separation):
 *    - All cards in unit.cards are separated into independent cards in the destination zone.
 * 3. Normal destruction triggers ON_UNIT_DESTROYED (BD-15 altar, listeners).
 */
export const destroyUnit = (state: GameState, instanceId: string): GameState => {
  const found = findUnitAndOwner(state, instanceId);
  if (!found) return state;

  const { unit, player, playerId } = found;
  const oppKey = playerId === 'player1' ? 'player2' : 'player1';
  const topCard = unit.cards[0];
  const tpl = getCard(topCard.cardId);

  // 1. Replacement Effect: BEFORE_UNIT_DESTROYED (BB-05, BB-11)
  // Instead of being destroyed to archive, return to hand
  if (tpl.id === 'BB-05' || tpl.id === 'BB-11') {
    player.field = player.field.filter(u => u.instanceId !== instanceId);
    // Separate evolution cards into individual cards in hand
    player.hand.push(...unit.cards);
    state.log.push(`【${tpl.name}】は破壊されるかわりに手札に戻った。`);

    // BB-15 Domain check (bounce / return to hand)
    if (state[oppKey].domain?.cardId === 'BB-15' && !state.flags.domain15Used) {
      if (state[oppKey].deck.length > 0) {
        state[oppKey].hand.push(state[oppKey].deck.pop()!);
        state.log.push(`【知恵の回廊】の効果で ${oppKey} はカードを1枚引いた。`);
        state.flags.domain15Used = true;
      }
    }

    // CRITICAL: Return immediately WITHOUT firing ON_UNIT_DESTROYED!
    return state;
  }

  // 2. Normal Destruction:
  player.field = player.field.filter(u => u.instanceId !== instanceId);
  // Separate evolution stack into individual cards in archive
  player.archive.push(...unit.cards);
  state.log.push(`【${tpl.name}】は破壊された。`);

  // 3. Fire ON_UNIT_DESTROYED listeners
  unitDestroyedListeners.forEach(listener => {
    try {
      listener(state, unit, playerId);
    } catch (e) {
      console.error('Error in ON_UNIT_DESTROYED listener:', e);
    }
  });

  // BD-15 死霊の祭壇 (Altar of the Dead Domain trigger for own unit destroyed)
  if (player.domain?.cardId === 'BD-15' && !state.flags.domain15Used) {
    const oppField = state[oppKey].field;
    if (oppField.length > 0) {
      const target = oppField[Math.floor(Math.random() * oppField.length)];
      target.modifiers.push({
        sourceId: 'BD-15',
        atk: 0,
        def: -20,
        brk: 0,
        duration: 'UNTIL_NEXT_TURN_END',
      });
      state.log.push(`【死霊の祭壇】の効果で 【${getCard(target.cards[0].cardId).name}】 のDEF-20（次のターン終了時まで）。`);
      state.flags.domain15Used = true;
      // Check if target DEF <= 0 immediately
      if (calculateUnitStats(state, oppKey, target).def <= 0) {
        return destroyUnit(state, target.instanceId);
      }
    }
  }

  return state;
};

/**
 * Bounce a unit to owner's hand, separating all evolution cards
 */
export const bounceUnit = (state: GameState, instanceId: string): GameState => {
  const found = findUnitAndOwner(state, instanceId);
  if (!found) return state;

  const { unit, player, playerId } = found;
  const oppKey = playerId === 'player1' ? 'player2' : 'player1';

  player.field = player.field.filter(u => u.instanceId !== instanceId);
  // Separate evolution cards
  player.hand.push(...unit.cards);
  state.log.push(`【${getCard(unit.cards[0].cardId).name}】は手札に戻された。`);

  // BB-15 Domain Check
  if (state[oppKey].domain?.cardId === 'BB-15' && !state.flags.domain15Used) {
    if (state[oppKey].deck.length > 0) {
      state[oppKey].hand.push(state[oppKey].deck.pop()!);
      state.log.push(`【知恵の回廊】の効果で ${oppKey} はカードを1枚引いた。`);
      state.flags.domain15Used = true;
    }
  }

  return state;
};

/**
 * Send a unit to player's arcana, separating all evolution cards and granting mana
 */
export const sendUnitToArcana = (state: GameState, instanceId: string, targetPlayerKey: 'player1' | 'player2'): GameState => {
  const found = findUnitAndOwner(state, instanceId);
  if (!found) return state;

  const { unit, player } = found;
  player.field = player.field.filter(u => u.instanceId !== instanceId);

  const targetPlayer = state[targetPlayerKey];
  // Invariant Principle 4: All cards are separated and placed into Arcana
  targetPlayer.arcana.push(...unit.cards);
  targetPlayer.maxArcana += unit.cards.length;
  targetPlayer.currentArcana += unit.cards.length;
  state.log.push(`【${getCard(unit.cards[0].cardId).name}】（${unit.cards.length}枚）はアルカナに送られた。`);

  return state;
};
