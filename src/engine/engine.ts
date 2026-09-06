import { GameState, GameAction, PlayerState, UnitState, CardInstance, CardTemplate, System } from '../types';
import { CARDS, getCard } from '../data/cards';

let instanceCounter = 0;
const createInstance = (cardId: string): CardInstance => ({ instanceId: `inst_${instanceCounter++}`, cardId });

const generateDeck = (system: System): CardInstance[] => {
  const cardsOfSystem = Object.values(CARDS).filter(c => c.system === system || c.system === 'Neutral');
  const deck: CardInstance[] = [];
  // Build a 40 card deck by repeating available cards
  while (deck.length < 40) {
    for (const card of cardsOfSystem) {
      if (deck.length < 40) deck.push(createInstance(card.id));
    }
  }
  // Simple shuffle
  return deck.sort(() => Math.random() - 0.5);
};

export const createInitialState = (): GameState => {
  const p1Deck = generateDeck('Fire');
  const p2Deck = generateDeck('Water');

  return {
    player1: {
      id: 'player1',
      deck: p1Deck.slice(4),
      hand: p1Deck.slice(0, 4),
      arcana: [], maxArcana: 0, currentArcana: 0, barrier: 5, field: [], runes: [], domain: null, archive: []
    },
    player2: {
      id: 'player2',
      deck: p2Deck.slice(4),
      hand: p2Deck.slice(0, 4),
      arcana: [], maxArcana: 0, currentArcana: 0, barrier: 5, field: [], runes: [], domain: null, archive: []
    },
    currentPlayer: 'player1',
    turnCount: 1,
    phase: 'ARCANA_PLACEMENT',
    log: ['Game started. Player 1 goes first. Phase: ARCANA_PLACEMENT'],
    prompt: null,
    winner: null,
    hasPlacedArcanaThisTurn: false
  };
};

// Helper functions
const getPlayer = (state: GameState, id: string): PlayerState => state[id as 'player1' | 'player2'];
const getOpponentId = (id: string): 'player1' | 'player2' => id === 'player1' ? 'player2' : 'player1';

const findUnit = (state: GameState, instanceId: string): { unit: UnitState, player: PlayerState } | null => {
  let u = state.player1.field.find(u => u.instanceId === instanceId);
  if (u) return { unit: u, player: state.player1 };
  u = state.player2.field.find(u => u.instanceId === instanceId);
  if (u) return { unit: u, player: state.player2 };
  return null;
};

const destroyUnit = (state: GameState, instanceId: string): GameState => {
  const newState = { ...state };
  const found = findUnit(newState, instanceId);
  if (!found) return newState;
  const { unit, player } = found;
  
  // Handle replacement effects like BB-05 (Bounce instead of destroy)
  const template = getCard(unit.cards[0].cardId);
  if (template.id === 'BB-05' || template.id === 'BB-11') {
    player.field = player.field.filter(u => u.instanceId !== instanceId);
    player.hand.push(...unit.cards);
    newState.log.push(`${template.name} returned to hand instead of being destroyed.`);
    return newState;
  }

  player.field = player.field.filter(u => u.instanceId !== instanceId);
  player.archive.push(...unit.cards);
  newState.log.push(`${template.name} was destroyed.`);
  return newState;
};

const checkWinCondition = (state: GameState, opponentKey: 'player1' | 'player2', brk: number): GameState => {
  const oldBarrier = state[opponentKey].barrier;
  state[opponentKey].barrier = Math.max(0, oldBarrier - brk);
  state.log.push(`Direct Attack broke ${brk} barrier(s). (Remaining: ${state[opponentKey].barrier})`);

  if (oldBarrier === 0 && brk > 0) {
    state.winner = state.currentPlayer;
    state.log.push(`${state.currentPlayer} wins by Direct Attack!`);
  }
  return state;
};

const resolveCombat = (state: GameState, attackerId: string, defenderId: string): GameState => {
  const attackerData = findUnit(state, attackerId);
  const defenderData = findUnit(state, defenderId);
  if (!attackerData || !defenderData) return state;

  const attacker = attackerData.unit;
  const defender = defenderData.unit;
  const aTpl = getCard(attacker.cards[0].cardId);
  const dTpl = getCard(defender.cards[0].cardId);

  const atk = (aTpl.atk || 0) + attacker.modifiers.atk;
  const def = (dTpl.def || 0) + defender.modifiers.def;

  let newState = { ...state };
  newState.log.push(`Combat: ${aTpl.name} (ATK ${atk}) vs ${dTpl.name} (DEF ${def})`);

  let aDestroyed = false;
  let dDestroyed = false;

  if (atk > def) dDestroyed = true;
  else if (atk === def) { aDestroyed = true; dDestroyed = true; }
  else { aDestroyed = true; }

  if (aTpl.keywords?.includes('Lethal')) dDestroyed = true;
  if (dTpl.keywords?.includes('Lethal')) aDestroyed = true;

  if (dDestroyed) newState = destroyUnit(newState, defenderId);
  if (aDestroyed) newState = destroyUnit(newState, attackerId);

  return newState;
};

export const gameReducer = (state: GameState, action: GameAction): GameState => {
  if (state.winner) return state;

  let newState = { ...state, player1: { ...state.player1, field: [...state.player1.field], hand: [...state.player1.hand] }, player2: { ...state.player2, field: [...state.player2.field], hand: [...state.player2.hand] } };
  const p = newState[newState.currentPlayer];
  const oppKey = getOpponentId(newState.currentPlayer);
  const opp = newState[oppKey];

  switch (action.type) {
    case 'NEXT_PHASE': {
      if (newState.phase === 'ARCANA_PLACEMENT') {
        newState.phase = 'ACTION';
        newState.log.push(`${newState.currentPlayer} entered ACTION phase.`);
        return newState;
      }
      if (newState.phase === 'ACTION') {
        // End turn
        newState.currentPlayer = oppKey;
        newState.turnCount += 1;
        newState.hasPlacedArcanaThisTurn = false;
        
        const nextP = newState[newState.currentPlayer];
        nextP.field.forEach(u => { u.isRested = false; u.hasSummoningSickness = false; });
        nextP.currentArcana = nextP.maxArcana;
        
        // Draw card (skip on turn 1 player 1)
        if (newState.turnCount > 1) {
          if (nextP.deck.length > 0) {
            nextP.hand.push(nextP.deck.pop()!);
          } else {
             newState.winner = newState.currentPlayer === 'player1' ? 'player2' : 'player1';
             newState.log.push(`${newState.currentPlayer} decked out!`);
             return newState;
          }
        }
        newState.phase = 'ARCANA_PLACEMENT';
        newState.log.push(`--- Turn ${newState.turnCount} : ${newState.currentPlayer} ---`);
        return newState;
      }
      return state;
    }
    case 'PLACE_ARCANA': {
      if (newState.phase !== 'ARCANA_PLACEMENT' || newState.hasPlacedArcanaThisTurn) return state;
      const cardIdx = p.hand.findIndex(c => c.instanceId === action.instanceId);
      if (cardIdx === -1) return state;
      
      const [card] = p.hand.splice(cardIdx, 1);
      p.arcana.push(card);
      p.maxArcana += 1;
      p.currentArcana += 1;
      newState.hasPlacedArcanaThisTurn = true;
      newState.log.push(`${p.id} placed a card in Arcana.`);
      return newState;
    }
    case 'PLAY_CARD': {
      if (newState.phase !== 'ACTION') return state;
      const cardIdx = p.hand.findIndex(c => c.instanceId === action.instanceId);
      if (cardIdx === -1) return state;
      const card = p.hand[cardIdx];
      const template = getCard(card.cardId);

      if (p.currentArcana < template.cost) return state;
      const hasAffinity = template.system === 'Neutral' || p.arcana.some(a => getCard(a.cardId).system === template.system);
      if (!hasAffinity) return state;

      // Handle target validation
      if (template.type === 'Evolution' && !action.evolutionTargetId) return state;
      if (template.requiresTarget && !action.targetId && template.type !== 'Evolution') return state;

      p.currentArcana -= template.cost;
      p.hand.splice(cardIdx, 1);

      if (template.type === 'Unit') {
        if (p.field.length >= 6) return state;
        p.field.push({
          instanceId: card.instanceId,
          cards: [card],
          isRested: false,
          hasSummoningSickness: !template.keywords?.includes('Rush'),
          modifiers: { atk: 0, def: 0, brk: 0 }
        });
        newState.log.push(`${p.id} summoned ${template.name}.`);
        
        // Simple hardcoded effects for MVP
        if (template.id === 'BR-08' && action.targetId) {
          newState = destroyUnit(newState, action.targetId);
        } else if (template.id === 'BB-09' && action.targetId) {
           const targetData = findUnit(newState, action.targetId);
           if (targetData) {
             targetData.player.field = targetData.player.field.filter(u => u.instanceId !== action.targetId);
             targetData.player.hand.push(...targetData.unit.cards);
             newState.log.push(`${template.name} bounced a unit.`);
           }
        }
      } else if (template.type === 'Evolution') {
        const targetUnit = p.field.find(u => u.instanceId === action.evolutionTargetId);
        if (!targetUnit) return state;
        targetUnit.cards.unshift(card);
        targetUnit.instanceId = card.instanceId;
        targetUnit.hasSummoningSickness = false;
        newState.log.push(`${p.id} evolved into ${template.name}.`);
        
        if (template.id === 'BD-11' && action.targetId) {
          newState = destroyUnit(newState, action.targetId);
        }
      } else if (template.type === 'Spell') {
        newState.log.push(`${p.id} cast ${template.name}.`);
        if (template.id === 'BR-12' && action.targetId) {
           newState = destroyUnit(newState, action.targetId);
        }
        p.archive.push(card);
      } else if (template.type === 'Rune') {
        if (p.runes.length >= 2) return state; // Can't play if full
        p.runes.push(card);
        newState.log.push(`${p.id} set a Rune.`);
      } else if (template.type === 'Domain') {
        if (p.domain) p.archive.push(p.domain);
        p.domain = card;
        newState.log.push(`${p.id} placed Domain ${template.name}.`);
      }
      return newState;
    }
    case 'DECLARE_ATTACK': {
      if (newState.phase !== 'ACTION') return state;
      const attacker = p.field.find(u => u.instanceId === action.attackerId);
      if (!attacker || attacker.isRested || attacker.hasSummoningSickness) return state;
      
      attacker.isRested = true;
      const aTpl = getCard(attacker.cards[0].cardId);
      
      if (action.targetId) {
         return resolveCombat(newState, action.attackerId, action.targetId);
      } else {
         if (aTpl.keywords?.includes('CannotAttackPlayer')) return state;
         const canGuard = opp.field.some(u => !u.isRested && getCard(u.cards[0].cardId).keywords?.includes('Guard'));
         if (canGuard && !aTpl.keywords?.includes('CannotBeGuarded')) {
            newState.prompt = { type: 'GUARD', playerId: oppKey, attackerId: action.attackerId };
            newState.log.push(`${p.id} declares direct attack. Waiting for guard...`);
            return newState;
         } else {
            return checkWinCondition(newState, oppKey, (aTpl.brk || 0) + attacker.modifiers.brk);
         }
      }
    }
    case 'RESOLVE_GUARD': {
      if (newState.prompt?.type !== 'GUARD') return state;
      const attackerId = newState.prompt.attackerId!;
      newState.prompt = null;
      
      if (action.guarderId) {
        const guarder = opp.field.find(u => u.instanceId === action.guarderId);
        if (guarder) {
          guarder.isRested = true;
          newState.log.push(`${oppKey} guards!`);
          return resolveCombat(newState, attackerId, action.guarderId);
        }
      }
      
      // Direct attack goes through
      const attackerData = findUnit(newState, attackerId);
      if (!attackerData) return newState;
      const brk = (getCard(attackerData.unit.cards[0].cardId).brk || 0) + attackerData.unit.modifiers.brk;
      return checkWinCondition(newState, oppKey, brk);
    }
    case 'DEBUG_DRAW': {
      const pl = newState[action.playerId as 'player1'|'player2'];
      if(pl.deck.length > 0) pl.hand.push(pl.deck.pop()!);
      return newState;
    }
    default:
      return state;
  }
};
