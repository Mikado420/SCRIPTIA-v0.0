import { GameState, PlayerState, UnitState, CardInstance, System, CardTemplate } from '../types';
import { getCard } from '../data/cards';

// General utility for dynamic stats computation
export const calculateUnitStats = (state: GameState, playerId: string, unit: UnitState) => {
  const player = state[playerId as 'player1'|'player2'];
  const tpl = getCard(unit.cards[0].cardId);
  
  let atk = tpl.atk || 0;
  let def = tpl.def || 0;
  let brk = tpl.brk || 0;

  // Apply modifiers
  unit.modifiers.forEach(m => {
    atk += m.atk;
    def += m.def;
    brk += m.brk;
  });

  // Apply continuous/aura effects
  // BR-05 烈火兵 タルカス
  if (tpl.id === 'BR-05' && player.field.some(u => u.instanceId !== unit.instanceId && getCard(u.cards[0].cardId).system === 'Fire')) {
    atk += 20;
  }
  // BR-10 ボルカノ・ドラゴン
  if (tpl.id === 'BR-10') {
    atk += player.archive.filter(c => getCard(c.cardId).system === 'Fire' && getCard(c.cardId).type === 'Unit').length * 10;
  }
  // BR-11 超甲機神 グレンバーン (Aura)
  if (player.field.some(u => u.instanceId !== unit.instanceId && getCard(u.cards[0].cardId).id === 'BR-11') && tpl.lineage === 'Rampage') {
    atk += 10;
  }
  // BG-06 巨岩の大盾
  if (tpl.id === 'BG-06') {
    atk += player.barrier * 10;
  }
  // BG-10 日没の巨人
  if (tpl.id === 'BG-10' && player.arcana.length >= 9) {
    atk += 20;
    def += 20;
  }
  // BG-11 万虫覇王 アトラスロード (Aura)
  if (player.field.some(u => u.instanceId !== unit.instanceId && getCard(u.cards[0].cardId).id === 'BG-11') && tpl.lineage === 'Insect') {
    brk += 1;
  }
  // BD-07 グレイブ・ペスト
  if (tpl.id === 'BD-07' && player.archive.filter(c => getCard(c.cardId).system === 'Dark' && getCard(c.cardId).type === 'Unit').length >= 5) {
    atk += 30;
  }

  // Ensure ATK is not less than 0 natively in battle
  return { atk: Math.max(0, atk), def, brk: Math.max(0, brk) };
};

export const findUnitAndOwner = (state: GameState, instanceId: string) => {
  let u = state.player1.field.find(u => u.instanceId === instanceId);
  if (u) return { unit: u, player: state.player1, playerId: 'player1' };
  u = state.player2.field.find(u => u.instanceId === instanceId);
  if (u) return { unit: u, player: state.player2, playerId: 'player2' };
  return null;
};

export const destroyUnit = (state: GameState, instanceId: string): GameState => {
  const found = findUnitAndOwner(state, instanceId);
  if (!found) return state;
  const { unit, player, playerId } = found;
  const oppKey = playerId === 'player1' ? 'player2' : 'player1';
  const tpl = getCard(unit.cards[0].cardId);

  // Replacement effect (BB-05, BB-11) - Return to hand instead
  if (tpl.id === 'BB-05' || tpl.id === 'BB-11') {
    player.field = player.field.filter(u => u.instanceId !== instanceId);
    player.hand.push(...unit.cards);
    state.log.push(`【${tpl.name}】は破壊されるかわりに手札に戻った。`);
    // BB-15 知恵の回廊 (Domain trigger for bouncing)
    if (state[oppKey].domain?.cardId === 'BB-15' && !state.flags.domain15Used) {
      if (state[oppKey].deck.length > 0) {
        state[oppKey].hand.push(state[oppKey].deck.pop()!);
        state.log.push(`【知恵の回廊】の効果で ${oppKey} はカードを1枚引いた。`);
        state.flags.domain15Used = true;
      }
    }
    return state;
  }

  // Normal Destroy
  player.field = player.field.filter(u => u.instanceId !== instanceId);
  player.archive.push(...unit.cards);
  state.log.push(`【${tpl.name}】は破壊された。`);

  // BD-15 死霊の祭壇 (Domain trigger for own unit destroyed)
  if (player.domain?.cardId === 'BD-15' && !state.flags.domain15Used) {
     const oppField = state[oppKey].field;
     if (oppField.length > 0) {
        const target = oppField[Math.floor(Math.random() * oppField.length)];
        target.modifiers.push({ sourceId: 'BD-15', atk: 0, def: -20, brk: 0, duration: 'UNTIL_NEXT_TURN_END' });
        state.log.push(`【死霊の祭壇】の効果で 【${getCard(target.cards[0].cardId).name}】 のDEF-20（次のターン終了時まで）。`);
        state.flags.domain15Used = true;
        // Check if DEF <= 0 immediately
        if (calculateUnitStats(state, oppKey, target).def <= 0) {
           return destroyUnit(state, target.instanceId);
        }
     }
  }

  return state;
};

export const bounceUnit = (state: GameState, instanceId: string): GameState => {
  const found = findUnitAndOwner(state, instanceId);
  if (!found) return state;
  const { unit, player, playerId } = found;
  const oppKey = playerId === 'player1' ? 'player2' : 'player1';

  player.field = player.field.filter(u => u.instanceId !== instanceId);
  player.hand.push(...unit.cards); // Separate evolution stack
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
