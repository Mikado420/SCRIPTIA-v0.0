import { GameState } from '../types';
import { getCard } from '../data/cards';
import { calculateUnitStats } from './engineUtils';
import { getValidSpellTargets } from './spellSystem';

type PlayerId = 'player1' | 'player2';

/**
 * 対象指定効果の共通仕様。
 * カード → 対象候補 → UI/AIでの選択 → action.targetId → 効果解決 の全段で同じものを使う。
 */
export interface TargetSpec {
  zone: 'unit' | 'rune' | 'domain' | 'archive';
  /** 選べる対象の instanceId */
  candidates: string[];
  /** 選ぶ枚数（候補が足りない時は候補数まで） */
  count: number;
  /** 「〜できる」効果。選ばない（0枚）ことも許される */
  optional: boolean;
  message: string;
}

export interface TargetPick {
  ok: boolean;
  /** ok の時だけ中身がある */
  ids: string[];
  reason?: 'none' | 'unselected' | 'declined';
}

const other = (id: PlayerId): PlayerId => (id === 'player1' ? 'player2' : 'player1');

const spec = (zone: TargetSpec['zone'], candidates: string[], want: number, optional: boolean, message: string): TargetSpec => ({
  zone,
  candidates,
  count: Math.min(want, candidates.length),
  optional,
  message,
});

const oppUnits = (state: GameState, me: PlayerId, maxDef = Infinity) => {
  const oppId = other(me);
  return state[oppId].field.filter(u => calculateUnitStats(state, oppId, u).def <= maxDef).map(u => u.instanceId);
};

const SPELL_ZONE: Record<string, TargetSpec['zone']> = { 'BN-03': 'domain', 'BN-04': 'rune', 'BW-13': 'archive' };

/** 手札からプレイするカード（スペル・ユニットの登場時・進化時）の対象仕様。対象を取らないカードは null。 */
export const getCardTargetSpec = (state: GameState, me: PlayerId, cardId: string, sourceInstanceId?: string): TargetSpec | null => {
  const tpl = getCard(cardId);
  if (tpl.type === 'Spell') {
    if (!tpl.targetReq) return null;
    const candidates = getValidSpellTargets(state, cardId, sourceInstanceId);
    return spec(SPELL_ZONE[cardId] ?? 'unit', candidates, 1, false, `【${tpl.name}】の対象を選択`);
  }
  const p = state[me];
  switch (cardId) {
    case 'BR-08':
      return spec('unit', oppUnits(state, me, 40), 1, false, '破壊する相手のDEF40以下のユニットを選択');
    case 'BB-09':
      return spec('unit', oppUnits(state, me), 1, false, '手札に戻す相手のユニットを選択');
    case 'BW-05':
      return spec('unit', oppUnits(state, me), 1, false, 'レストする相手のユニットを選択');
    case 'BD-11':
      return spec('unit', oppUnits(state, me, 80), 1, false, '破壊する相手のDEF80以下のユニットを選択');
    case 'BW-08':
      return spec(
        'archive',
        p.archive.filter(c => ['Spell', 'Rune'].includes(getCard(c.cardId).type)).map(c => c.instanceId),
        1,
        true,
        '手札に戻すスペルかルーンを選択',
      );
    case 'BD-10':
      return spec(
        'archive',
        p.archive.filter(c => getCard(c.cardId).system === 'Dark').map(c => c.instanceId),
        2,
        true,
        '手札に戻す闇のカードを選択',
      );
    default:
      return null;
  }
};

/** ルーン発動時（結界破壊時）の対象仕様。runeOwner はルーンの持ち主。 */
export const getRuneTargetSpec = (state: GameState, runeOwner: PlayerId, runeCardId: string): TargetSpec | null => {
  switch (runeCardId) {
    case 'BB-14':
      return spec('unit', oppUnits(state, runeOwner), 1, false, '手札に戻す相手のユニットを選択');
    case 'BG-14':
      return spec('unit', oppUnits(state, runeOwner), 1, false, 'アルカナに置く相手のユニットを選択');
    case 'BD-14':
      return spec('unit', oppUnits(state, runeOwner), 1, false, '破壊する相手のユニットを選択');
    case 'BW-14':
      return spec('unit', oppUnits(state, runeOwner), 2, false, 'レストする相手のユニットを選択');
    default:
      return null;
  }
};

/** プレイヤー／AIが選ばなくても結果が一つに決まる（候補数がちょうど必要数） */
export const isForcedChoice = (s: TargetSpec) => !s.optional && s.candidates.length === s.count;

/**
 * action.targetId（複数はカンマ区切り）を仕様に照らして確定する。
 * 不正な対象は採用しない。候補が複数あるのに未指定なら、先頭を勝手に選ばず「未選択」とする。
 */
export const pickTargets = (s: TargetSpec, targetId?: string): TargetPick => {
  if (s.candidates.length === 0) return { ok: false, ids: [], reason: 'none' };
  const ids = targetId ? [...new Set(targetId.split(',').filter(Boolean))] : [];
  if (ids.length === 0) {
    if (s.optional) return { ok: false, ids: [], reason: 'declined' };
    return isForcedChoice(s) ? { ok: true, ids: [...s.candidates] } : { ok: false, ids: [], reason: 'unselected' };
  }
  if (ids.length !== s.count || ids.some(id => !s.candidates.includes(id))) return { ok: false, ids: [], reason: 'unselected' };
  return { ok: true, ids };
};

export const pickFailureLog = (name: string, pick: TargetPick): string | null => {
  if (pick.ok) return null;
  if (pick.reason === 'none') return `【${name}】の効果：対象が存在しないため不発。`;
  if (pick.reason === 'declined') return null;
  return `【${name}】の効果：対象が選択されなかったため不発。`;
};

/** 仕様から選べる組み合わせをすべて列挙する（AIの合法手生成用）。 */
export const targetCombinations = (s: TargetSpec): string[] => {
  if (s.count <= 0) return [];
  const out: string[] = [];
  const walk = (start: number, acc: string[]) => {
    if (acc.length === s.count) {
      out.push(acc.join(','));
      return;
    }
    for (let i = start; i < s.candidates.length; i++) walk(i + 1, [...acc, s.candidates[i]]);
  };
  walk(0, []);
  return out;
};
