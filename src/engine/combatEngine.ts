import { GameState, GameAction, PromptState, PlayerState, UnitState } from '../types';
import { calculateUnitStats, findUnitAndOwner, destroyUnit } from './engineUtils';
import { getCard } from '../data/cards';

export const resolveCombat = (state: GameState, attackerId: string, defenderId: string): GameState => {
  const aFound = findUnitAndOwner(state, attackerId);
  const dFound = findUnitAndOwner(state, defenderId);
  if (!aFound || !dFound) return state;

  const { unit: attacker, playerId: aPid } = aFound;
  const { unit: defender, playerId: dPid } = dFound;
  
  const aTpl = getCard(attacker.cards[0].cardId);
  const dTpl = getCard(defender.cards[0].cardId);
  const aStats = calculateUnitStats(state, aPid, attacker);
  const dStats = calculateUnitStats(state, dPid, defender);

  state.log.push(`◆ 戦闘：【${aTpl.name}】(ATK ${aStats.atk}) vs 【${dTpl.name}】(DEF ${dStats.def})`);

  let aDestroyed = false;
  let dDestroyed = false;

  if (aStats.atk > dStats.def) dDestroyed = true;
  else if (aStats.atk === dStats.def) { aDestroyed = true; dDestroyed = true; }
  else { aDestroyed = true; }

  if (aTpl.keywords?.includes('Lethal')) dDestroyed = true;
  if (dTpl.keywords?.includes('Lethal')) aDestroyed = true;

  if (dDestroyed) {
    state = destroyUnit(state, defenderId);
    // BG-15 Domain check
    if (state[aPid].domain?.cardId === 'BG-15' && !state.flags.domain15Used) {
      if (state[aPid].deck.length > 0) {
        state[aPid].hand.push(state[aPid].deck.pop()!);
        state.log.push(`【獣王の狩場】の効果でカードを1枚引いた。`);
        state.flags.domain15Used = true;
      }
    }
  }
  
  if (aDestroyed) {
    state = destroyUnit(state, attackerId);
  }

  // BD-02 Mary self-destruct after guarding
  if (dTpl.id === 'BD-02' && !dDestroyed) {
    state.log.push(`【未練の霊 マリー】は守護を行ったため破壊される。`);
    state = destroyUnit(state, defenderId);
  }

  return state;
};

export const checkWinCondition = (state: GameState, oppKey: 'player1'|'player2', brk: number): GameState => {
  const oldBarrier = state[oppKey].barrier;
  state[oppKey].barrier = Math.max(0, oldBarrier - brk);
  state.log.push(`直接攻撃成功！結界が ${brk} つ破壊された。（残り: ${state[oppKey].barrier}）`);

  if (oldBarrier === 0 && brk > 0) {
    state.winner = state.currentPlayer;
    state.log.push(`${state.currentPlayer} は直接攻撃で勝利した！`);
  }

  // Handle Barrier break triggers (Runes & Hand traps)
  if (oldBarrier > 0 && state[oppKey].barrier < oldBarrier && !state.winner) {
    const opp = state[oppKey];
    const brkRunes = opp.runes.filter(r => {
      const t = getCard(r.cardId);
      return ['BR-14', 'BB-14', 'BG-14', 'BW-14', 'BD-14'].includes(t.id);
    });

    if (brkRunes.length > 0) {
       // Just trigger the first one found for MVP, in real game we'd prompt
       state.prompt = {
         type: 'RUNE_TRIGGER',
         playerId: oppKey,
         sourceId: brkRunes[0].instanceId,
         message: `結界が破壊されました。ルーン【${getCard(brkRunes[0].cardId).name}】を発動しますか？`
       };
    } else {
       // Check for hand summons (BR-03, BG-08, BW-06, BD-05)
       const summoners = opp.hand.filter(c => ['BR-03', 'BG-08', 'BW-06', 'BD-05'].includes(c.cardId));
       if (summoners.length > 0 && opp.field.length < 6) {
          state.prompt = {
             type: 'TRIGGER',
             playerId: oppKey,
             sourceId: summoners[0].instanceId,
             message: `結界破壊時：【${getCard(summoners[0].cardId).name}】を手札から召喚しますか？`
          };
       }
    }
    
    // Check BR-15 domain for attacker
    if (state[state.currentPlayer].domain?.cardId === 'BR-15' && !state.flags.domain15Used) {
      if (state[state.currentPlayer].deck.length > 0) {
         state[state.currentPlayer].hand.push(state[state.currentPlayer].deck.pop()!);
         state.log.push(`【突撃前線】の効果でカードを1枚引いた。`);
         state.flags.domain15Used = true;
      }
    }
  }

  return state;
};
