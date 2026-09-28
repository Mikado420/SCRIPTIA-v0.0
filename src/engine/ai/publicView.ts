import { GameAction, GameState } from '../../types';
import { HIDDEN_CARD_ID } from './cardKnowledge';

export type PlayerId = 'player1' | 'player2';

export const otherPlayer = (p: PlayerId): PlayerId => (p === 'player1' ? 'player2' : 'player1');

const HIDDEN_RUNE_PREFIX = 'hidden_rune_';

/**
 * AIが「ゲーム上知ることのできる情報」だけを残したゲーム状態を作る。
 *
 * - 相手の手札・デッキ: 枚数のみ（中身は HIDDEN カード）
 * - 相手のセット済みルーン: 枚数のみ（裏向き）
 * - 自分のデッキ: 枚数のみ（並び順は自分にも分からない）
 * - ログは探索に不要なので捨てる（クローンの高速化も兼ねる）
 *
 * AIの思考・相手分析はすべてこのビューに対して行うため、
 * 構造的に非公開情報を参照できない。
 */
export function buildAIView(state: GameState, viewer: PlayerId): GameState {
  const { player: _p, opponent: _o, log: _log, ...rest } = state;
  const view: GameState = JSON.parse(JSON.stringify({ ...rest, log: [] }));
  const oppId = otherPlayer(viewer);
  const opp = view[oppId];
  const me = view[viewer];

  opp.hand = opp.hand.map((_, i) => ({ instanceId: `hidden_${oppId}_hand_${i}`, cardId: HIDDEN_CARD_ID }));
  opp.deck = opp.deck.map((_, i) => ({ instanceId: `hidden_${oppId}_deck_${i}`, cardId: HIDDEN_CARD_ID }));
  opp.runes = opp.runes.map((_, i) => ({ instanceId: `${HIDDEN_RUNE_PREFIX}${i}`, cardId: HIDDEN_CARD_ID }));
  if (opp.pendingCard) opp.pendingCard = { instanceId: opp.pendingCard.instanceId, cardId: HIDDEN_CARD_ID };
  me.deck = me.deck.map((_, i) => ({ instanceId: `hidden_${viewer}_deck_${i}`, cardId: HIDDEN_CARD_ID }));

  // 相手のプロンプトに含まれる非公開情報（手札からの召喚候補など）は伏せる
  if (view.prompt && view.prompt.playerId === oppId && view.prompt.type === 'TRIGGER') {
    view.prompt = { ...view.prompt, sourceId: undefined, message: undefined, text: undefined };
  }
  return view;
}

/**
 * ビュー上のIDを実ゲームのIDへ変換する。
 * 伏せられたルーンは「i番目のルーン」としてしか指定できないため、実IDへ引き直す。
 */
export function resolveViewAction(action: GameAction, real: GameState, viewer: PlayerId): GameAction {
  if (!('targetId' in action) || !action.targetId) return action;
  if (!action.targetId.startsWith(HIDDEN_RUNE_PREFIX)) return action;
  const idx = Number(action.targetId.slice(HIDDEN_RUNE_PREFIX.length));
  const rune = real[otherPlayer(viewer)].runes[idx];
  return { ...action, targetId: rune ? rune.instanceId : undefined } as GameAction;
}

/**
 * 盤面の「公開情報としての」同一性を判定するシグネチャ。
 * ビュー同士で比較する（ログや伏せカードのIDは含めない）。
 * viewer を指定すると、相手の手札は枚数だけで比較する
 * （バウンスで手札に戻ったカードなど、仮想盤面でだけ中身が見えているケースを同一視するため）。
 */
export function stateSignature(s: GameState, viewer?: PlayerId): string {
  const zone = (pid: PlayerId) => {
    const p = s[pid];
    const hand = viewer && pid !== viewer ? `#${p.hand.length}` : p.hand.map(c => c.cardId).sort().join(',');
    const field = p.field
      .map(u =>
        u.cards.map(c => c.cardId).join('+') +
        (u.isRested ? 'R' : 'A') +
        (u.hasSummoningSickness ? 'S' : '') +
        u.modifiers.map(m => `${m.sourceId}:${m.atk}/${m.def}/${m.brk}`).join(','),
      )
      .sort()
      .join('|');
    return [
      hand,
      field,
      p.arcana.length,
      p.currentArcana,
      p.barrier,
      p.runes.length,
      p.domain ? p.domain.cardId : '-',
      p.archive.length,
      p.deck.length,
    ].join(';');
  };
  return [
    s.currentPlayer,
    s.phase,
    s.turnCount,
    s.winner ?? '',
    s.flags.hasPlacedArcanaThisTurn ? 1 : 0,
    s.prompt ? `${s.prompt.type}@${s.prompt.playerId}` : '',
    zone('player1'),
    zone('player2'),
  ].join('#');
}
