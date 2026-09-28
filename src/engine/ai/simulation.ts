import { GameAction, GameState, PlayerState, UnitState } from '../../types';
import { getRuneTargetSpec, isForcedChoice, targetCombinations } from '../targeting';
import { gameReducer } from '../gameEngine';
import { calculateUnitStats, checkAffinity } from '../engineUtils';
import { canUnitGuard, isValidAttackTarget } from '../combatEngine';
import { getValidSpellTargets } from '../spellSystem';
import { hasKeyword, isHiddenCard, tpl } from './cardKnowledge';
import { PlayerId, otherPlayer } from './publicView';

/**
 * 仮想盤面シミュレーション。
 * ゲームルールは既存の gameReducer をそのまま使う（ルールの二重実装をしない）。
 * AIが扱うのは buildAIView で作った「公開情報だけの盤面」であり、実ゲームの state ではない。
 */

export interface SimContext {
  /** 評価の視点となるプレイヤー（AI） */
  me: PlayerId;
  /** me 視点の評価値（大きいほど me に有利） */
  evaluate: (s: GameState) => number;
  simulations: number;
}

export interface CandidateAction {
  action: GameAction;
  label: string;
  /** 重複排除用キー（同名カードは同じ結果になる） */
  key: string;
  kind: 'charge' | 'skipCharge' | 'play' | 'attack' | 'end';
}

const MAX_PROMPT_LOOP = 8;

/** 行動を適用し、発生したプロンプト（守護・誘発）も各プレイヤーの方針で解決する */
export function simulate(s: GameState, action: GameAction, ctx: SimContext): GameState {
  ctx.simulations++;
  let next = gameReducer(s, action);
  return resolvePrompts(next, ctx);
}

export function resolvePrompts(s: GameState, ctx: SimContext): GameState {
  let cur = s;
  for (let i = 0; i < MAX_PROMPT_LOOP && cur.prompt && !cur.winner; i++) {
    const options = promptOptions(cur);
    if (options.length === 0) break;
    const decider = cur.prompt.playerId as PlayerId;
    let best: GameState | null = null;
    let bestScore = 0;
    for (const opt of options) {
      ctx.simulations++;
      const child = gameReducer(cur, opt);
      const score = ctx.evaluate(child);
      // 自分の選択は最大化、相手の選択は（最悪ケースとして）最小化
      const better = best === null || (decider === ctx.me ? score > bestScore : score < bestScore);
      if (better) {
        best = child;
        bestScore = score;
      }
    }
    if (!best || best === cur) break;
    cur = best;
  }
  return cur;
}

/** プロンプトに対して取りうる応答の一覧（ルール上合法なもののみ） */
export function promptOptions(s: GameState): GameAction[] {
  const p = s.prompt;
  if (!p) return [];
  const owner = s[p.playerId as PlayerId];
  switch (p.type) {
    case 'GUARD': {
      const guarders = owner.field.filter(u => canUnitGuard(u)).map(u => u.instanceId);
      return [{ type: 'RESOLVE_GUARD' }, ...guarders.map(id => ({ type: 'RESOLVE_GUARD', guarderId: id }) as GameAction)];
    }
    case 'RUNE_TRIGGER': {
      // 対象を取るルーンは、合法な対象の組み合わせを応答として列挙する（選択は既存の評価に任せる）
      const rune = owner.runes.find(r => r.instanceId === p.sourceId);
      const spec = rune ? getRuneTargetSpec(s, p.playerId as PlayerId, rune.cardId) : null;
      const combos = spec && !isForcedChoice(spec) ? targetCombinations(spec) : [];
      const applies: GameAction[] = combos.length > 0
        ? combos.map(targetId => ({ type: 'RESOLVE_TRIGGER', apply: true, targetId }) as GameAction)
        : [{ type: 'RESOLVE_TRIGGER', apply: true }];
      return [...applies, { type: 'RESOLVE_TRIGGER', apply: false }];
    }
    case 'TRIGGER':
      return [
        { type: 'RESOLVE_TRIGGER', apply: true },
        { type: 'RESOLVE_TRIGGER', apply: false },
      ];
    case 'TARGET_SELECTION': {
      const targets = p.validTargets || [];
      if (targets.length === 0) return [{ type: 'CANCEL_SPELL_CAST' }];
      return targets.map(t => ({ type: 'RESOLVE_SPELL_TARGET', targetId: t }) as GameAction);
    }
    default:
      return [];
  }
}

const unitDef = (s: GameState, pid: PlayerId, u: UnitState) => calculateUnitStats(s, pid, u).def;

const canPayAndAffinity = (p: PlayerState, cardId: string) => {
  const t = tpl(cardId);
  return p.currentArcana >= t.cost && checkAffinity(t.system, p.arcana);
};

/**
 * 現在の手番プレイヤーが取れる行動を列挙する。
 * 既存ルール（コスト・系統・場の上限・対象条件）を満たすものだけを返す。
 * reducer 側で検査されない条件（スペルのコスト・場の上限など）もカードテキストどおりに守る。
 */
export function generateActions(s: GameState, opts: { onlyInstanceId?: string } = {}): CandidateAction[] {
  if (s.winner || s.prompt) return [];
  const pid = s.currentPlayer as PlayerId;
  const oppId = otherPlayer(pid);
  const p = s[pid];
  const opp = s[oppId];
  const out: CandidateAction[] = [];
  const seen = new Set<string>();
  const push = (c: CandidateAction) => {
    if (seen.has(c.key)) return;
    seen.add(c.key);
    out.push(c);
  };

  if (s.phase === 'ARCANA_PLACEMENT') {
    if (!s.flags.hasPlacedArcanaThisTurn && !opts.onlyInstanceId) {
      for (const c of p.hand) {
        const name = isHiddenCard(c.cardId) ? '(不明なカード)' : tpl(c.cardId).name;
        push({
          action: { type: 'PLACE_ARCANA', instanceId: c.instanceId },
          label: `アルカナ配置: ${name}`,
          key: `charge:${c.cardId}`,
          kind: 'charge',
        });
      }
    }
    if (!opts.onlyInstanceId) {
      push({ action: { type: 'NEXT_PHASE' }, label: 'アルカナを配置しない', key: 'skipCharge', kind: 'skipCharge' });
    }
    return out;
  }

  if (s.phase !== 'ACTION') return out;

  const oppUnitName = (u: UnitState) => tpl(u.cards[0].cardId).name;

  // ---- カードのプレイ ----
  for (const c of p.hand) {
    if (isHiddenCard(c.cardId)) continue;
    if (opts.onlyInstanceId && c.instanceId !== opts.onlyInstanceId) continue;
    const t = tpl(c.cardId);
    if (!canPayAndAffinity(p, c.cardId)) continue;
    const base = `play:${c.cardId}`;

    if (t.type === 'Unit') {
      if (p.field.length >= 6) continue;
      const targets: { id?: string; label: string }[] = [];
      if (t.id === 'BR-08') {
        opp.field.filter(u => unitDef(s, oppId, u) <= 40).forEach(u => targets.push({ id: u.instanceId, label: oppUnitName(u) }));
      } else if (t.id === 'BB-09' || t.id === 'BW-05') {
        opp.field.forEach(u => targets.push({ id: u.instanceId, label: oppUnitName(u) }));
      } else if (t.id === 'BW-08') {
        const picked = new Set<string>();
        p.archive.forEach(a => {
          const at = tpl(a.cardId);
          if ((at.type === 'Spell' || at.type === 'Rune') && !picked.has(a.cardId)) {
            picked.add(a.cardId);
            targets.push({ id: a.instanceId, label: at.name });
          }
        });
      } else if (t.id === 'BD-10') {
        const darks = p.archive
          .filter(a => tpl(a.cardId).system === 'Dark')
          .sort((a, b) => tpl(b.cardId).cost - tpl(a.cardId).cost)
          .slice(0, 2);
        if (darks.length > 0) targets.push({ id: darks.map(d => d.instanceId).join(','), label: darks.map(d => tpl(d.cardId).name).join('・') });
      }
      if (targets.length === 0) targets.push({ label: '' });
      for (const tg of targets) {
        push({
          action: { type: 'PLAY_CARD', instanceId: c.instanceId, targetId: tg.id },
          label: `召喚: ${t.name}${tg.label ? ` → ${tg.label}` : ''}`,
          key: `${base}>${tg.id ?? ''}`,
          kind: 'play',
        });
      }
      continue;
    }

    if (t.type === 'Evolution') {
      const bases = p.field.filter(u => tpl(u.cards[0].cardId).lineage === t.evolutionTarget);
      for (const b of bases) {
        const extraTargets: { id?: string; label: string }[] = [];
        if (t.id === 'BD-11') {
          opp.field.filter(u => unitDef(s, oppId, u) <= 80).forEach(u => extraTargets.push({ id: u.instanceId, label: oppUnitName(u) }));
        }
        if (extraTargets.length === 0) extraTargets.push({ label: '' });
        for (const et of extraTargets) {
          push({
            action: { type: 'PLAY_CARD', instanceId: c.instanceId, evolutionTargetId: b.instanceId, targetId: et.id },
            label: `進化: ${tpl(b.cards[0].cardId).name} → ${t.name}${et.label ? ` (対象: ${et.label})` : ''}`,
            key: `${base}@${b.instanceId}>${et.id ?? ''}`,
            kind: 'play',
          });
        }
      }
      continue;
    }

    if (t.type === 'Rune') {
      if (p.runes.length >= 2) continue;
      push({ action: { type: 'PLAY_CARD', instanceId: c.instanceId }, label: `ルーン設置: ${t.name}`, key: base, kind: 'play' });
      continue;
    }

    if (t.type === 'Domain') {
      if (p.domain && p.domain.cardId === c.cardId) continue;
      push({ action: { type: 'PLAY_CARD', instanceId: c.instanceId }, label: `ドメイン配置: ${t.name}`, key: base, kind: 'play' });
      continue;
    }

    if (t.type === 'Spell') {
      if (t.targetReq) {
        const targets = getValidSpellTargets(s, t.id, c.instanceId);
        for (const tid of targets) {
          const u = opp.field.find(x => x.instanceId === tid);
          const a = p.archive.find(x => x.instanceId === tid);
          const lbl = u ? oppUnitName(u) : a ? tpl(a.cardId).name : tid.startsWith('hidden_rune_') ? '伏せルーン' : 'ドメイン';
          push({
            action: { type: 'PLAY_CARD', instanceId: c.instanceId, targetId: tid },
            label: `スペル: ${t.name} → ${lbl}`,
            key: `${base}>${u ? u.instanceId : a ? a.cardId : tid}`,
            kind: 'play',
          });
        }
      } else {
        push({ action: { type: 'PLAY_CARD', instanceId: c.instanceId }, label: `スペル: ${t.name}`, key: base, kind: 'play' });
      }
    }
  }

  if (opts.onlyInstanceId) return out;

  // ---- 攻撃 ----
  for (const u of p.field) {
    if (u.isRested || u.hasSummoningSickness) continue;
    const at = tpl(u.cards[0].cardId);
    const aStats = calculateUnitStats(s, pid, u);
    const lethal = hasKeyword(at, 'Lethal') || at.id === 'BD-03';
    if (isValidAttackTarget(s, u.instanceId, undefined)) {
      push({
        action: { type: 'DECLARE_ATTACK', attackerId: u.instanceId },
        label: `攻撃: ${at.name} → プレイヤー`,
        key: `atk:${u.instanceId}>P`,
        kind: 'attack',
      });
    }
    for (const d of opp.field) {
      if (!isValidAttackTarget(s, u.instanceId, d.instanceId)) continue;
      const dDef = unitDef(s, oppId, d);
      // 一方的な自爆は（攻撃時効果を除き）得にならないので除外
      if (aStats.atk < dDef && !lethal && at.id !== 'BB-03' && at.id !== 'BD-04') continue;
      push({
        action: { type: 'DECLARE_ATTACK', attackerId: u.instanceId, targetId: d.instanceId },
        label: `攻撃: ${at.name} → ${oppUnitName(d)}`,
        key: `atk:${u.instanceId}>${d.instanceId}`,
        kind: 'attack',
      });
    }
  }

  push({ action: { type: 'NEXT_PHASE' }, label: 'ターン終了', key: 'end', kind: 'end' });
  return out;
}

export const actionKey = (a: GameAction) => JSON.stringify(a);
