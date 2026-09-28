import { GameAction, GameState } from '../../types';
import { aiDebug } from './debug';
import { analyzeOpponent } from './opponentModel';
import { PlayerId, buildAIView, resolveViewAction, stateSignature } from './publicView';
import { decideAction, decidePromptResponse, safeFallbackAction } from './search';
import { actionKey } from './simulation';
import { AIDecision, OpponentProfile, PlannedStep, SearchConfig } from './types';

/**
 * AIターンの実行役（React非依存）。
 *
 *   AI Engine (decideAction) が最善Actionを決定
 *     ↓
 *   このランナーが Game Engine (dispatch → gameReducer) に渡して実行
 *
 * 停止しないための設計:
 *   - 1行動ごとに「現在の実際の盤面」を見て次の行動を決める（古いプランを盲目的に実行しない）
 *   - 想定どおりの盤面ならプランの続きを使い、ずれたら再計画する
 *   - 実行しても盤面が変わらなかった行動は、そのターン中は禁止して再計画する
 *   - 思考中の例外は「フェーズを進める」という合法な行動で回復する（プロンプト中は何もしない）
 *   - 人間側のプロンプト（守護選択など）は、人間の判断を待つだけで強制解決しない
 *   - 行動数の上限に達したら、合法な NEXT_PHASE でターンを終える
 */

export interface AITurnHooks {
  onStatus?: (text: string | null) => void;
  onDecision?: (decision: AIDecision) => void;
  onBeforeAction?: (action: GameAction, label: string, state: GameState) => void | Promise<void>;
  onAfterAction?: (action: GameAction, label: string, state: GameState) => void | Promise<void>;
}

export interface AITurnRunnerOptions {
  aiId: PlayerId;
  getState: () => GameState;
  dispatch: (action: GameAction) => void;
  /** このAIターンの相手プロファイル（ターン開始時に1回だけ作られたもの） */
  getProfile?: (state: GameState) => OpponentProfile;
  isCancelled?: () => boolean;
  delay?: (ms: number) => Promise<void>;
  pacing?: { beforeAction?: number; afterAction?: number; pollInterval?: number; dispatchTimeout?: number };
  config?: Partial<SearchConfig>;
  maxSteps?: number;
  hooks?: AITurnHooks;
  /** テスト用: 思考エンジンの差し替え */
  decide?: typeof decideAction;
}

export type AITurnEndReason = 'turnEnded' | 'gameOver' | 'cancelled' | 'stepLimit';

export interface AITurnResult {
  endReason: AITurnEndReason;
  steps: number;
  replans: number;
  errors: number;
  elapsedMs: number;
}

const defaultDelay = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));
const MAX_ERRORS_BEFORE_FALLBACK = 3;

export async function runAITurn(opts: AITurnRunnerOptions): Promise<AITurnResult> {
  const { aiId, getState, dispatch } = opts;
  const delay = opts.delay ?? defaultDelay;
  const isCancelled = opts.isCancelled ?? (() => false);
  const pacing = { beforeAction: 0, afterAction: 0, pollInterval: 50, dispatchTimeout: 3000, ...(opts.pacing || {}) };
  const maxSteps = opts.maxSteps ?? 40;
  const decide = opts.decide ?? decideAction;
  const hooks = opts.hooks ?? {};
  const started = Date.now();

  const startState = getState();
  const startTurn = startState.turnCount;
  let steps = 0;
  let replans = 0;
  let errors = 0;
  let consecutiveErrors = 0;
  let plan: PlannedStep[] = [];
  let planIdx = 0;
  const banned = new Set<string>();

  const isAITurn = (s: GameState) => s.currentPlayer === aiId && !s.winner && s.turnCount === startTurn;
  const viewSig = (s: GameState) => stateSignature(buildAIView(s, aiId), aiId);

  const finish = (endReason: AITurnEndReason): AITurnResult => {
    const result = { endReason, steps, replans, errors, elapsedMs: Date.now() - started };
    hooks.onStatus?.(null);
    aiDebug.turnEnd({ steps, replans, elapsedMs: result.elapsedMs, reason: endReason });
    return result;
  };

  /** dispatch 後、状態が更新されるのを待つ（React の再描画を挟むため） */
  const waitForChange = async (before: GameState): Promise<GameState | null> => {
    const limit = Date.now() + pacing.dispatchTimeout;
    while (Date.now() < limit) {
      const cur = getState();
      if (cur !== before) return cur;
      if (isCancelled()) return null;
      await delay(pacing.pollInterval);
    }
    return getState() !== before ? getState() : null;
  };

  const execute = async (action: GameAction, label: string): Promise<'changed' | 'noop' | 'aborted'> => {
    const before = getState();
    const sigBefore = viewSig(before);
    try {
      await hooks.onBeforeAction?.(action, label, before);
    } catch (e) {
      aiDebug.warn('onBeforeAction hook でエラー（無視して続行）', e);
    }
    if (pacing.beforeAction > 0) await delay(pacing.beforeAction);
    // 待機中に状況が変わっていたら実行しない（再判断させる）
    const now = getState();
    if (isCancelled() || !isAITurn(now) || viewSig(now) !== sigBefore) return 'aborted';

    dispatch(action);
    steps++;
    const after = await waitForChange(now);
    if (!after) {
      aiDebug.warn(`行動後に状態が更新されませんでした: ${label}`);
      return 'noop';
    }
    try {
      await hooks.onAfterAction?.(action, label, after);
    } catch (e) {
      aiDebug.warn('onAfterAction hook でエラー（無視して続行）', e);
    }
    // ターンが終わった直後は待たずに抜ける（次のAIターンの起動をロックで妨げないため）
    if (pacing.afterAction > 0 && isAITurn(getState())) await delay(pacing.afterAction);
    return viewSig(after) === sigBefore ? 'noop' : 'changed';
  };

  let profile: OpponentProfile;
  try {
    profile = opts.getProfile ? opts.getProfile(startState) : analyzeOpponent(buildAIView(startState, aiId), aiId);
  } catch (e) {
    aiDebug.warn('相手分析で例外。公開盤面のみで再分析します', e);
    profile = analyzeOpponent(buildAIView(startState, aiId), aiId);
  }
  aiDebug.turnStart(startTurn, startState.phase);
  aiDebug.profile(profile);
  // 思考（同期計算）に入る前に一度制御を返し、UI が「思考中」表示を描画できるようにする
  await delay(pacing.pollInterval);

  while (true) {
    if (isCancelled()) return finish('cancelled');
    const s = getState();
    if (s.winner) return finish('gameOver');
    if (!isAITurn(s)) return finish('turnEnded');

    try {
      // ---------- プロンプト処理 ----------
      if (s.prompt) {
        if (s.prompt.playerId === aiId) {
          const response = decidePromptResponse(s, aiId, profile) ?? (s.prompt.type === 'TARGET_SELECTION' ? { type: 'CANCEL_SPELL_CAST' } as GameAction : null);
          if (response) {
            aiDebug.prompt(`${s.prompt.type} → ${JSON.stringify(response)}`);
            await execute(response, 'プロンプト応答');
          } else {
            await delay(pacing.pollInterval);
          }
        } else {
          // 相手（人間）の判断待ち。強制的に解決はしない。
          hooks.onStatus?.('相手の応答を待っています...');
          await delay(Math.max(pacing.pollInterval, 100));
        }
        plan = [];
        continue;
      }

      // ---------- 行動上限（安全弁）----------
      if (steps >= maxSteps) {
        if (steps >= maxSteps + 4) return finish('stepLimit');
        aiDebug.warn(`行動数が上限(${maxSteps})に達したためターンを終了します`);
        await execute({ type: 'NEXT_PHASE' }, '上限によるフェーズ進行');
        continue;
      }

      // ---------- 行動決定 ----------
      const sig = viewSig(s);
      let step: PlannedStep | null = null;
      const planned = plan[planIdx];
      if (planned && planned.expectedBefore === sig && !banned.has(actionKey(planned.action))) {
        step = planned;
        planIdx++;
      } else {
        const decision = decide(s, aiId, { profile, config: opts.config, banned });
        replans++;
        aiDebug.decision(decision);
        hooks.onDecision?.(decision);
        hooks.onStatus?.(decision.reason);
        plan = decision.line;
        planIdx = 1;
        step = plan[0] ?? null;
      }

      if (!step) {
        const fb = safeFallbackAction(s, aiId);
        if (!fb) {
          await delay(pacing.pollInterval);
          continue;
        }
        step = { action: fb, label: 'フェーズ進行', expectedBefore: sig };
      }

      const realAction = resolveViewAction(step.action, s, aiId);
      const outcome = await execute(realAction, step.label);
      if (outcome === 'noop') {
        // 盤面が変わらない行動（不正・不発）は、このターンは選ばない
        banned.add(actionKey(step.action));
        plan = [];
        aiDebug.warn(`盤面が変化しない行動を除外して再計画します: ${step.label}`);
      } else if (outcome === 'aborted') {
        plan = [];
      }
      consecutiveErrors = 0;
    } catch (e) {
      errors++;
      consecutiveErrors++;
      plan = [];
      aiDebug.warn('AIターン処理中に例外が発生しました', e);
      const cur = getState();
      if (consecutiveErrors >= MAX_ERRORS_BEFORE_FALLBACK || errors > 10) {
        // 思考に失敗し続ける場合でも、合法な行動（フェーズ進行）でゲームを進める
        const fb = safeFallbackAction(cur, aiId);
        if (fb) {
          try {
            dispatch(fb);
            steps++;
            await waitForChange(cur);
          } catch (e2) {
            aiDebug.warn('フォールバックの実行にも失敗しました', e2);
          }
        }
        consecutiveErrors = 0;
      }
      await delay(pacing.pollInterval);
    }
  }
}
