import { GameAction, GameState } from '../../types';
import { gameReducer } from '../gameEngine';
import { HIDDEN_CARD_ID, isHiddenCard } from './cardKnowledge';
import { EvalContext, evaluate, evaluateState } from './evaluation';
import { predictOpponentActions } from './opponentModel';
import { PlayerId, buildAIView, otherPlayer, stateSignature } from './publicView';
import { CandidateAction, SimContext, actionKey, generateActions, promptOptions, simulate } from './simulation';
import {
  AIDecision,
  DEFAULT_SEARCH_CONFIG,
  OpponentProfile,
  PlannedStep,
  PredictedResponse,
  ScenarioResult,
  SearchConfig,
} from './types';

/**
 * AI思考エンジン（ゲーム進行からは独立した純粋な計算）。
 *
 *   自分のターン（ビームサーチで行動列を探索）
 *     ↓
 *   相手の予想される対応（OpponentProfile から確率的に生成したシナリオ）
 *     ↓
 *   その結果に対する自分の次の行動（貪欲に数手）
 *     ↓
 *   最終盤面を評価し、シナリオ確率で期待値を取る
 *
 * 入力は実ゲーム状態でも、内部で必ず buildAIView を通して非公開情報を伏せる。
 */

const now = () => (typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now());

/** 乱数を使うカード効果（ランダム捨て札など）の仮想実行を再現可能にする */
function withSeededRandom<T>(seed: number, fn: () => T): T {
  const original = Math.random;
  let x = (seed >>> 0) || 0x9e3779b9;
  Math.random = () => {
    x ^= x << 13;
    x >>>= 0;
    x ^= x >>> 17;
    x ^= x << 5;
    x >>>= 0;
    return (x % 1_000_000) / 1_000_000;
  };
  try {
    return fn();
  } finally {
    Math.random = original;
  }
}

interface Node {
  state: GameState;
  steps: PlannedStep[];
  score: number;
  charged: boolean;
  passive: boolean;
}

interface Candidate extends Node {
  value: number;
  deep: boolean;
  scenarios: ScenarioResult[];
}

export interface DecideOptions {
  profile: OpponentProfile;
  config?: Partial<SearchConfig>;
  /** 実行しても盤面が変化しなかった行動（このターンは選ばない） */
  banned?: Set<string>;
}

export function decideAction(state: GameState, aiId: PlayerId, opts: DecideOptions): AIDecision {
  const cfg: SearchConfig = { ...DEFAULT_SEARCH_CONFIG, ...(opts.config || {}) };
  const view = buildAIView(state, aiId);
  return withSeededRandom(cfg.seed ^ (view.turnCount * 7919), () => new TurnSearch(view, aiId, opts.profile, cfg, opts.banned).run());
}

class TurnSearch {
  private readonly start = now();
  private readonly deadline: number;
  private readonly evalCtx: EvalContext;
  private readonly sim: SimContext;
  private nodes = 0;
  private truncated = false;

  constructor(
    private readonly view: GameState,
    private readonly me: PlayerId,
    private readonly profile: OpponentProfile,
    private readonly cfg: SearchConfig,
    private readonly banned: Set<string> = new Set(),
  ) {
    this.deadline = this.start + cfg.timeBudgetMs;
    this.evalCtx = { me, profile };
    this.sim = { me, evaluate: s => evaluate(s, this.evalCtx), simulations: 0 };
  }

  private timeUp() {
    return now() > this.deadline;
  }

  /** ビーム探索に使ってよいのは時間上限の半分まで（残りは相手応答の深読みに回す） */
  private beamTimeUp() {
    return now() > this.start + this.cfg.timeBudgetMs * 0.5;
  }

  run(): AIDecision {
    const root: Node = { state: this.view, steps: [], score: this.sim.evaluate(this.view), charged: false, passive: true };
    const completed: Node[] = [];
    const seen = new Set<string>([stateSignature(this.view, this.me)]);
    let frontier: Node[] = [root];

    outer: for (let depth = 0; depth < this.cfg.maxTurnActions && frontier.length > 0; depth++) {
      const children: Node[] = [];
      for (const node of frontier) {
        const actions = generateActions(node.state).filter(a => depth > 0 || !this.banned.has(actionKey(a.action)));
        for (const a of actions) {
          if (this.beamTimeUp() && completed.length > 0) {
            this.truncated = true;
            break outer;
          }
          const child = simulate(node.state, a.action, this.sim);
          this.nodes++;
          if (child === node.state) continue;
          const n: Node = {
            state: child,
            steps: [...node.steps, { action: a.action, label: a.label, expectedBefore: stateSignature(node.state, this.me) }],
            score: this.sim.evaluate(child),
            charged: node.charged || a.kind === 'charge',
            passive: node.passive && a.kind === 'skipCharge',
          };
          if (child.winner === this.me) {
            // リーサル: これ以上探す必要はない
            return this.finish([{ ...n, value: n.score, deep: false, scenarios: [] }], n, 'リーサル');
          }
          if (child.winner || a.kind === 'end' || child.currentPlayer !== this.me) {
            completed.push(n);
            continue;
          }
          const sig = stateSignature(child, this.me);
          if (seen.has(sig)) continue;
          seen.add(sig);
          children.push(n);
        }
      }
      frontier = this.selectBeam(children);
    }

    // 最大深さに達した途中ノードはターン終了させて候補に加える
    for (const node of frontier) {
      if (node.state.currentPlayer !== this.me || node.state.winner) continue;
      const endAction: GameAction = { type: 'NEXT_PHASE' };
      let s = node.state;
      const steps = [...node.steps];
      for (let i = 0; i < 2 && s.currentPlayer === this.me && !s.winner; i++) {
        steps.push({ action: endAction, label: s.phase === 'ARCANA_PLACEMENT' ? 'アルカナを配置しない' : 'ターン終了', expectedBefore: stateSignature(s, this.me) });
        s = simulate(s, endAction, this.sim);
      }
      completed.push({ ...node, state: s, steps, score: this.sim.evaluate(s) });
    }

    if (completed.length === 0) {
      // 取りうる行動がない（通常起こらない）: 安全にフェーズを進める
      const fallback: Node = {
        state: this.view,
        steps: [{ action: { type: 'NEXT_PHASE' }, label: 'ターン終了', expectedBefore: stateSignature(this.view, this.me) }],
        score: root.score,
        charged: false,
        passive: true,
      };
      return this.finish([{ ...fallback, value: fallback.score, deep: false, scenarios: [] }], fallback, '候補なし');
    }

    // ---- 深読み対象の選定（評価上位 + 多様性の確保）----
    const unique = new Map<string, Node>();
    completed
      .sort((a, b) => b.score - a.score)
      .forEach(n => {
        const sig = stateSignature(n.state, this.me);
        if (!unique.has(sig)) unique.set(sig, n);
      });
    const ranked = Array.from(unique.values());
    const deepSet: Node[] = ranked.slice(0, this.cfg.deepCandidates);
    const ensure = (pred: (n: Node) => boolean) => {
      const n = ranked.find(pred);
      if (n && !deepSet.includes(n)) deepSet.push(n);
    };
    ensure(n => !n.charged); // アルカナを置かない選択肢
    ensure(n => n.charged); // アルカナを置く選択肢
    ensure(n => n.steps.every(s => s.action.type === 'NEXT_PHASE')); // 何もしない選択肢

    const candidates: Candidate[] = [];
    for (const n of deepSet) {
      if (this.timeUp() && candidates.some(c => c.deep)) {
        this.truncated = true;
        candidates.push({ ...n, value: n.score, deep: false, scenarios: [] });
        continue;
      }
      const { value, scenarios } = this.lookahead(n.state);
      candidates.push({ ...n, value, deep: true, scenarios });
    }
    const pool = candidates.some(c => c.deep) ? candidates.filter(c => c.deep) : candidates;
    pool.sort((a, b) => b.value - a.value || a.steps.length - b.steps.length);
    return this.finish(pool, pool[0], '');
  }

  /** ビーム選択。上位に加え「アルカナ未配置」「何もしない」系統の系列も残す */
  private selectBeam(children: Node[]): Node[] {
    const sorted = [...children].sort((a, b) => b.score - a.score);
    const beam = sorted.slice(0, this.cfg.beamWidth);
    const keep = (pred: (n: Node) => boolean) => {
      const n = sorted.find(pred);
      if (n && !beam.includes(n)) beam.push(n);
    };
    keep(n => n.passive);
    keep(n => !n.charged);
    keep(n => n.charged);
    return beam;
  }

  // ------------------------------------------------------------------
  // 相手の予想応答 → 自分の次の行動 → 評価
  // ------------------------------------------------------------------
  private lookahead(endState: GameState): { value: number; scenarios: ScenarioResult[] } {
    if (endState.winner) {
      const v = this.sim.evaluate(endState);
      return { value: v, scenarios: [] };
    }
    const responses = predictOpponentActions(endState, this.me, this.profile, this.cfg.maxScenarios);
    const scenarios: ScenarioResult[] = [];
    let expected = 0;
    for (const r of responses) {
      const afterOpp = this.simulateOpponentTurn(endState, r);
      const { state: afterMine, labels } = this.myFollowUp(afterOpp);
      const value = this.sim.evaluate(afterMine);
      scenarios.push({ id: r.id, label: r.label, probability: r.probability, value, followUp: labels });
      expected += r.probability * value;
    }
    return { value: expected, scenarios };
  }

  /** 相手ターンの仮想実行。仮定したカードを相手の伏せ手札に1枚だけ置き換えて使わせる */
  private simulateOpponentTurn(endState: GameState, r: PredictedResponse): GameState {
    const opp = otherPlayer(this.me);
    let cur: GameState = JSON.parse(JSON.stringify(endState));
    if (cur.currentPlayer !== opp) return cur;

    let hypId: string | null = null;
    if (r.cardId) {
      const hand = cur[opp].hand;
      const idx = hand.findIndex(c => isHiddenCard(c.cardId));
      hypId = `hyp_${r.cardId}`;
      if (idx >= 0) hand[idx] = { instanceId: hypId, cardId: r.cardId };
      else hand.push({ instanceId: hypId, cardId: r.cardId });
    }

    // アルカナ配置（伏せカードを1枚。傾向が低ければ置かない）
    if (cur.phase === 'ARCANA_PLACEMENT') {
      const filler = cur[opp].hand.find(c => c.cardId === HIDDEN_CARD_ID);
      const charge = filler && this.profile.tendencies.chargeRate >= 0.3;
      cur = simulate(cur, charge ? { type: 'PLACE_ARCANA', instanceId: filler!.instanceId } : { type: 'NEXT_PHASE' }, this.sim);
    }

    // 主行動: 仮定カードを、AIにとって最も困る対象へ使う
    if (hypId && cur.currentPlayer === opp && !cur.winner) {
      const acts = generateActions(cur, { onlyInstanceId: hypId });
      let best: GameState | null = null;
      let bestV = Infinity;
      for (const a of acts) {
        const child = simulate(cur, a.action, this.sim);
        const v = this.sim.evaluate(child);
        if (v < bestV) {
          bestV = v;
          best = child;
        }
      }
      if (best) cur = best;
    }

    // 攻撃: 1手ずつ、ターン終了後の盤面が AI にとって最も悪くなるものを選ぶ
    for (let i = 0; i < 7 && cur.currentPlayer === opp && !cur.winner; i++) {
      const attacks = generateActions(cur).filter(a => a.kind === 'attack');
      if (attacks.length === 0) break;
      const stop = simulate(cur, { type: 'NEXT_PHASE' }, this.sim);
      let bestV = this.sim.evaluate(stop);
      let bestChild: GameState | null = null;
      for (const a of attacks) {
        const child = simulate(cur, a.action, this.sim);
        if (child.winner) {
          bestChild = child;
          bestV = -Infinity;
          break;
        }
        const ended = child.currentPlayer === opp ? simulate(child, { type: 'NEXT_PHASE' }, this.sim) : child;
        const v = this.sim.evaluate(ended);
        if (v < bestV) {
          bestV = v;
          bestChild = child;
        }
      }
      if (!bestChild) break;
      cur = bestChild;
    }

    if (cur.currentPlayer === opp && !cur.winner) {
      if (cur.phase === 'ARCANA_PLACEMENT') cur = simulate(cur, { type: 'NEXT_PHASE' }, this.sim);
      if (cur.currentPlayer === opp && !cur.winner) cur = simulate(cur, { type: 'NEXT_PHASE' }, this.sim);
    }
    return cur;
  }

  /** 相手の応答後、自分の次のターンで取る行動を貪欲に数手シミュレート */
  private myFollowUp(s: GameState): { state: GameState; labels: string[] } {
    let cur = s;
    const labels: string[] = [];
    if (cur.winner || cur.currentPlayer !== this.me) return { state: cur, labels };

    // アルカナ配置は「置いた後に出せる最善の1手」まで見て判断する
    if (cur.phase === 'ARCANA_PLACEMENT') {
      const opts = generateActions(cur);
      let best: { state: GameState; label: string } | null = null;
      let bestV = -Infinity;
      for (const o of opts) {
        const after = simulate(cur, o.action, this.sim);
        const v = this.bestSingleStepValue(after);
        if (v > bestV) {
          bestV = v;
          best = { state: after, label: o.label };
        }
      }
      if (best) {
        cur = best.state;
        labels.push(best.label);
      }
    }

    for (let i = 0; i < this.cfg.followUpSteps && cur.currentPlayer === this.me && !cur.winner; i++) {
      const acts = generateActions(cur).filter(a => a.kind !== 'end');
      let bestV = this.sim.evaluate(cur);
      let best: { state: GameState; a: CandidateAction } | null = null;
      for (const a of acts) {
        const child = simulate(cur, a.action, this.sim);
        const v = this.sim.evaluate(child);
        if (v > bestV) {
          bestV = v;
          best = { state: child, a };
        }
      }
      if (!best) break;
      cur = best.state;
      labels.push(best.a.label);
    }
    return { state: cur, labels };
  }

  private bestSingleStepValue(s: GameState): number {
    let best = this.sim.evaluate(s);
    if (s.currentPlayer !== this.me || s.winner) return best;
    for (const a of generateActions(s)) {
      if (a.kind === 'end') continue;
      const v = this.sim.evaluate(simulate(s, a.action, this.sim));
      if (v > best) best = v;
    }
    return best;
  }

  private finish(pool: Candidate[], best: Node & Partial<Candidate>, tag: string): AIDecision {
    const first = best.steps[0];
    const evaluation = evaluateState(best.state, this.evalCtx);
    const value = best.value ?? best.score;
    const labels = best.steps.map(s => s.label);
    const reasonParts: string[] = [];
    if (tag) reasonParts.push(tag);
    if (evaluation.breakdown.lethalPotential > 0) reasonParts.push('次ターンのリーサル圏');
    if (evaluation.breakdown.lethalThreat < 0) reasonParts.push('リーサル被弾の危険あり');
    const meaningful = labels.filter(l => l !== 'アルカナを配置しない' && l !== 'ターン終了');
    reasonParts.push(meaningful.length > 0 ? meaningful.join(' → ') : '温存（何もしない方が有利と判断）');

    return {
      action: first.action,
      label: first.label,
      reason: reasonParts.join(' / '),
      line: best.steps,
      expectedValue: Math.round(value * 10) / 10,
      evaluation,
      expectedResponses: best.scenarios ?? [],
      alternatives: pool
        .filter(c => c !== best)
        .slice(0, 3)
        .map(c => ({ labels: c.steps.map(s => s.label), value: Math.round(c.value * 10) / 10 })),
      stats: {
        nodes: this.nodes,
        simulations: this.sim.simulations,
        deepEvaluated: pool.filter(c => c.deep).length,
        elapsedMs: Math.round(now() - this.start),
        truncated: this.truncated,
      },
    };
  }
}

/**
 * AI自身が応答すべきプロンプト（守護・誘発・対象選択）への応答を決める。
 * 各選択肢を仮想実行し、評価の最も高いものを選ぶ。常に合法な応答を返す。
 */
export function decidePromptResponse(state: GameState, aiId: PlayerId, profile: OpponentProfile | null): GameAction | null {
  if (!state.prompt || state.prompt.playerId !== aiId) return null;
  const view = buildAIView(state, aiId);
  const options = promptOptions(view);
  if (options.length === 0) return null;
  const ctx: EvalContext = { me: aiId, profile };
  return withSeededRandom(view.turnCount * 104729, () => {
    let best = options[0];
    let bestV = -Infinity;
    for (const o of options) {
      const v = evaluate(gameReducer(view, o), ctx);
      if (v > bestV) {
        bestV = v;
        best = o;
      }
    }
    return best;
  });
}

/**
 * 例外発生時のフォールバック。プロンプトが無い自分の手番なら、
 * フェーズ進行（アルカナ配置→行動→ターン終了）は常にルール上合法で、盤面を壊さない。
 */
export function safeFallbackAction(state: GameState, aiId: PlayerId): GameAction | null {
  if (state.winner || state.prompt || state.currentPlayer !== aiId) return null;
  return { type: 'NEXT_PHASE' };
}
