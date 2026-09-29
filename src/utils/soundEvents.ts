import { GameState } from '../types';
import type { SoundId } from './soundManager';

/**
 * 盤面の変化（前の state → 次の state）から、鳴らすべきSEを判定する。
 * ゲーム状態に由来するSEはここだけで判定し、操作ハンドラやAI演出からは鳴らさない（二重再生防止）。
 * ゲームエンジンは変更せず、state とログの差分だけを使う。
 */
export interface SoundCue {
  id: SoundId;
  /** 原因 → 結果の順に聞こえるよう、結果側を少し遅らせる（ms） */
  delay: number;
}

type Zone = 'hand' | 'deck' | 'arcana' | 'archive' | 'field' | 'runes' | 'domain' | 'pending';

const PLAYERS = ['player1', 'player2'] as const;

const zoneOf = (s: GameState, instanceId: string): Zone | null => {
  for (const pid of PLAYERS) {
    const p = s[pid];
    if (p.hand.some(c => c.instanceId === instanceId)) return 'hand';
    if (p.field.some(u => u.cards.some(c => c.instanceId === instanceId))) return 'field';
    if (p.archive.some(c => c.instanceId === instanceId)) return 'archive';
    if (p.arcana.some(c => c.instanceId === instanceId)) return 'arcana';
    if (p.runes.some(c => c.instanceId === instanceId)) return 'runes';
    if (p.domain?.instanceId === instanceId) return 'domain';
    if (p.pendingCard?.instanceId === instanceId) return 'pending';
    if (p.deck.some(c => c.instanceId === instanceId)) return 'deck';
  }
  return null;
};

export const detectSoundEvents = (prev: GameState, cur: GameState): SoundCue[] => {
  if (prev === cur) return [];
  // 新しい対戦が始まった（ログが短くなった / ターンが戻った）時は何も鳴らさない
  if (cur.log.length < prev.log.length || cur.turnCount < prev.turnCount) return [];

  const logs = cur.log.slice(prev.log.length);
  const has = (re: RegExp) => logs.some(l => re.test(l));
  const causes = new Set<SoundId>();
  const results = new Set<SoundId>();

  // ---- ログから分かる原因
  if (has(/はスペル 【.*】 を発動/)) causes.add('spellCast');
  if (has(/^【[^】]*】発動！$/)) causes.add('runeResolve');
  if (has(/守護を発動/)) causes.add('guard');
  if (has(/^◆ 戦闘：/)) causes.add('attackHit');
  if (has(/直接攻撃成功/)) causes.add('barrierHit');
  if (has(/はルーンをセットした|はドメイン 【.*】 を配置した/)) causes.add('runeSet');
  if (has(/はアルカナを配置した/)) causes.add('manaCharge');
  if (has(/相手のルーンが手札に戻された/)) results.add('bounce');
  if (has(/ドメインが破壊され/)) results.add('archiveSend');

  // ---- フィールドの出入り
  const prevFieldCards = new Set(PLAYERS.flatMap(pid => prev[pid].field.flatMap(u => u.cards.map(c => c.instanceId))));
  for (const pid of PLAYERS) {
    for (const u of prev[pid].field) {
      const top = u.cards[0].instanceId;
      const now = zoneOf(cur, top);
      if (now === 'field') continue;
      // 破壊（アーカイブへ）・手札に戻す・アルカナに置く を区別する
      if (now === 'hand') results.add('bounce');
      else if (now === 'arcana') results.add('archiveSend');
      else results.add('cardDestroy');
    }
    for (const u of cur[pid].field) {
      if (prevFieldCards.has(u.cards[0].instanceId)) continue;
      if (u.cards.length > 1 && prevFieldCards.has(u.cards[1].instanceId)) causes.add('evolve');
      else causes.add('summonUnit');
    }
  }

  // ---- カードの移動（フィールド以外）
  for (const pid of PLAYERS) {
    // アーカイブから手札へ回収
    if (cur[pid].hand.some(c => zoneOf(prev, c.instanceId) === 'archive')) results.add('archiveReturn');
    // 手札を捨てさせる効果（プレイ中の本人以外の手札がアーカイブへ）
    if (pid !== cur.currentPlayer && prev[pid].hand.some(c => zoneOf(cur, c.instanceId) === 'archive')) results.add('archiveSend');
    // 山札からアルカナへ置く効果
    if (cur[pid].arcana.some(c => zoneOf(prev, c.instanceId) === 'deck')) causes.add('manaCharge');
  }

  // ---- 結界
  const barrierDown = PLAYERS.some(pid => cur[pid].barrier < prev[pid].barrier);
  if (barrierDown) results.add('barrierBreak');

  // ---- 並べる：原因 → 結果 → 割り込み → 決着
  const cues: SoundCue[] = [];
  const order: SoundId[] = ['spellCast', 'runeResolve', 'manaCharge', 'runeSet', 'summonUnit', 'evolve', 'guard', 'attackHit', 'barrierHit'];
  let t = 0;
  for (const id of order) {
    if (!causes.has(id)) continue;
    // 守護 → 戦闘 のように原因が続く時は少しずらす
    cues.push({ id, delay: t });
    if (id === 'guard') t += 120;
  }
  const resultDelay = causes.size > 0 ? t + 150 : 0;
  (['cardDestroy', 'bounce', 'archiveSend', 'archiveReturn', 'barrierBreak'] as SoundId[]).forEach(id => {
    if (!results.has(id)) return;
    // 結界Hit の直後に割れる
    const d = id === 'barrierBreak' && causes.has('barrierHit') ? t + 90 : resultDelay;
    cues.push({ id, delay: d });
  });

  const promptChanged =
    !!cur.prompt && (!prev.prompt || prev.prompt.type !== cur.prompt.type || prev.prompt.sourceId !== cur.prompt.sourceId);
  if (promptChanged && cur.prompt!.type === 'RUNE_TRIGGER') {
    cues.push({ id: 'runeTrigger', delay: barrierDown ? 260 : 0 });
  }

  if (!prev.winner && cur.winner) {
    cues.push({ id: cur.winner === 'player1' ? 'victory' : 'defeat', delay: 380 });
  }
  return cues;
};
