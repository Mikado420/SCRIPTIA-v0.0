import { CARDS, getCard } from '../../data/cards';
import { CardTemplate, System } from '../../types';

/**
 * AIが「ゲームの知識」として持つカード情報。
 * カードプール（全カードの効果）は公開情報なので、AIが参照してよい。
 * ここでは既存のカードデータを読むだけで、変更は一切しない。
 */

/** AIビュー上で「中身の分からないカード」を表す ID */
export const HIDDEN_CARD_ID = '__HIDDEN__';

const templateCache = new Map<string, CardTemplate>();

/** getCard のメモ化版（探索中に大量に呼ばれるため） */
export const tpl = (cardId: string): CardTemplate => {
  let t = templateCache.get(cardId);
  if (!t) {
    t = getCard(cardId);
    templateCache.set(cardId, t);
  }
  return t;
};

export const isHiddenCard = (cardId: string) => cardId === HIDDEN_CARD_ID;

export const hasKeyword = (t: CardTemplate, kw: string) => !!t.keywords?.includes(kw as any);

export const normalizeSystem = (s?: string): System => {
  switch (s) {
    case '火': case 'Fire': return 'Fire';
    case '水': case 'Water': return 'Water';
    case '地': case 'Earth': return 'Earth';
    case '光': case 'Light': return 'Light';
    case '闇': case 'Dark': return 'Dark';
    default: return 'Neutral';
  }
};

export type CardRole =
  | 'removal'      // 破壊・アルカナ送り
  | 'bounce'       // 手札に戻す
  | 'tap'          // レストさせる
  | 'debuff'       // DEF減少
  | 'etb'          // 登場時に相手へ干渉するユニット
  | 'finisher'     // BRK2以上・守護されない等の決定力
  | 'rush'
  | 'guard'
  | 'draw'
  | 'ramp'
  | 'discard'
  | 'buff'
  | 'recursion'
  | 'trap'         // ルーン
  | 'handTrap'     // 結界破壊時に手札から召喚
  | 'domain'
  | 'utility'
  | 'beater';

const EXPLICIT_ROLES: Record<string, CardRole[]> = {
  'BR-03': ['handTrap'],
  'BR-08': ['etb', 'removal'],
  'BR-12': ['removal'],
  'BR-13': ['buff'],
  'BR-14': ['trap', 'removal'],
  'BB-03': ['draw'],
  'BB-04': ['draw'],
  'BB-05': ['utility'],
  'BB-09': ['etb', 'bounce'],
  'BB-12': ['bounce'],
  'BB-13': ['draw'],
  'BB-14': ['trap', 'bounce'],
  'BG-04': ['ramp'],
  'BG-08': ['handTrap'],
  'BG-12': ['ramp'],
  'BG-13': ['removal'],
  'BG-14': ['trap', 'removal'],
  'BW-05': ['etb', 'tap'],
  'BW-06': ['handTrap'],
  'BW-07': ['draw'],
  'BW-08': ['recursion'],
  'BW-12': ['tap'],
  'BW-13': ['recursion'],
  'BW-14': ['trap', 'tap'],
  'BD-04': ['discard'],
  'BD-05': ['handTrap'],
  'BD-06': ['etb', 'discard'],
  'BD-10': ['recursion'],
  'BD-11': ['etb', 'removal'],
  'BD-12': ['discard'],
  'BD-13': ['debuff', 'removal'],
  'BD-14': ['trap', 'removal'],
  'BN-03': ['utility'],
  'BN-04': ['utility'],
  'BN-05': ['trap', 'tap'],
};

const roleCache = new Map<string, CardRole[]>();

export const cardRoles = (cardId: string): CardRole[] => {
  const cached = roleCache.get(cardId);
  if (cached) return cached;
  const t = tpl(cardId);
  const roles = new Set<CardRole>(EXPLICIT_ROLES[cardId] || []);
  if (t.type === 'Rune') roles.add('trap');
  if (t.type === 'Domain') roles.add('domain');
  if (hasKeyword(t, 'Guard')) roles.add('guard');
  if (hasKeyword(t, 'Rush')) roles.add('rush');
  if ((t.brk ?? 0) >= 2 || hasKeyword(t, 'CannotBeGuarded')) roles.add('finisher');
  if ((t.type === 'Unit' || t.type === 'Evolution') && roles.size === 0) roles.add('beater');
  const list = Array.from(roles);
  roleCache.set(cardId, list);
  return list;
};

export const isInteractionCard = (cardId: string) =>
  cardRoles(cardId).some(r => r === 'removal' || r === 'bounce' || r === 'tap' || r === 'debuff');

/**
 * 相手が使った場合に、自分のユニット（DEF・コストで表現）へ届くかどうか。
 * 戻り値は「そのユニットを盤面から失う/無力化される度合い」(0〜1)。
 * 効果の条件はカードテキスト（=既存実装）どおり。
 */
export const removalReach = (cardId: string, target: { def: number; cost: number }): number => {
  switch (cardId) {
    case 'BR-12': return target.def <= 20 ? 1 : 0;
    case 'BG-13': return target.def <= 60 ? 1 : 0;
    case 'BB-12': return target.cost <= 5 ? 0.8 : 0; // 手札に戻る（カードは失わない）
    case 'BD-13': return target.def <= 30 ? 1 : 0;
    case 'BR-08': return target.def <= 40 ? 1 : 0;
    case 'BB-09': return 0.8;
    case 'BD-11': return target.def <= 80 ? 1 : 0;
    case 'BW-12': return 0.3; // レストのみ
    case 'BW-05': return 0.3;
    default: return 0;
  }
};

export const ALL_CARD_IDS = CARDS.map(c => c.id);

/** デッキ構築上限（DeckBuilderの同名4枚ルール） */
export const MAX_COPIES = 4;
export const DECK_SIZE = 40;
