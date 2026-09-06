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

// Export destroy system functions
export { destroyUnit, bounceUnit, sendUnitToArcana, registerOnUnitDestroyedListener } from './destroySystem';

export const canPlayCard = (
  card: CardTemplate,
  currentArcana: number,
  arcana: CardInstance[],
  fieldUnitCount: number
): boolean => {
  if (currentArcana < card.cost) return false;
  if ((card.type === 'Unit' || card.type === 'Evolution') && fieldUnitCount >= 6) return false;
  if (card.system === 'Neutral') return true;
  return arcana.some(a => getCard(a.cardId).system === card.system);
};
