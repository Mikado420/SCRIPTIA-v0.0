import { AIDecision, OpponentProfile } from './types';

/**
 * AIの判断理由を確認するための開発用ログ。UIには何も表示しない。
 *
 * 有効になる条件:
 *   - Vite の開発モード (import.meta.env.DEV)
 *   - もしくは localStorage.setItem('scriptia_ai_debug', '1')
 *   - Node 実行時は環境変数 SCRIPTIA_AI_DEBUG=1
 * 開発モードで止めたい場合は localStorage.setItem('scriptia_ai_debug', '0')
 */
export function isAIDebugEnabled(): boolean {
  try {
    if (typeof localStorage !== 'undefined') {
      const flag = localStorage.getItem('scriptia_ai_debug');
      if (flag === '1') return true;
      if (flag === '0') return false;
    }
  } catch {
    // localStorage が使えない環境
  }
  try {
    if ((import.meta as any).env?.DEV) return true;
  } catch {
    // import.meta.env が無い環境
  }
  const proc = (globalThis as any).process;
  return !!proc?.env && proc.env.SCRIPTIA_AI_DEBUG === '1';
}

const pct = (x: number) => `${Math.round(x * 100)}%`;
const r1 = (x: number) => Math.round(x * 10) / 10 || 0;

interface DebugStore {
  lastProfile: OpponentProfile | null;
  decisions: AIDecision[];
}

const store = (): DebugStore | null => {
  if (!isAIDebugEnabled()) return null;
  const g = globalThis as any;
  if (!g.__SCRIPTIA_AI__) g.__SCRIPTIA_AI__ = { lastProfile: null, decisions: [] } as DebugStore;
  return g.__SCRIPTIA_AI__ as DebugStore;
};

export const aiDebug = {
  turnStart(turn: number, phase: string) {
    if (!isAIDebugEnabled()) return;
    console.log(`%c[AI] ===== AI TURN START ===== turn ${turn} (${phase})`, 'color:#f59e0b;font-weight:bold');
    const st = store();
    if (st) st.decisions = [];
  },

  profile(p: OpponentProfile) {
    if (!isAIDebugEnabled()) return;
    const st = store();
    if (st) st.lastProfile = p;
    console.groupCollapsed(`[AI] Opponent Profile: ${p.deckTypeLabel} (確信度 ${pct(p.deckTypeConfidence)})${p.analyzedBeforeDraw ? ' ※AIドロー前に分析' : ''}`);
    console.log('デッキタイプ:', p.deckTypeScores.map(d => `${d.type} ${pct(d.probability)}`).join(' / '));
    console.log('系統:', p.elements.map(e => `${e.element} ${pct(e.weight)}`).join(' / ') || '不明');
    console.log('公開済みカード:', Object.entries(p.revealedCounts).map(([id, n]) => `${id}×${n}`).join(', ') || 'なし');
    if (p.knownHandCards.length > 0) console.log('手札に戻ったと分かっているカード:', p.knownHandCards.join(', '));
    console.log('リソース:', p.resources);
    console.log('戦術傾向:', {
      攻撃性: pct(p.tendencies.aggression),
      除去使用率: pct(p.tendencies.removalRate),
      展開率: pct(p.tendencies.developmentRate),
      守護率: pct(p.tendencies.guardRate),
      平均手札: r1(p.tendencies.avgHandSize),
      観測ターン: p.tendencies.sampleTurns,
    });
    console.table(
      p.threats.slice(0, 6).map(c => ({
        card: `${c.name} (${c.cardId})`,
        採用確率: pct(c.deckProbability),
        手札確率: pct(c.handProbability),
        脅威度: c.threatLevel,
        次ターン使用可: c.castableNextTurn,
      })),
    );
    console.groupEnd();
  },

  decision(d: AIDecision) {
    if (!isAIDebugEnabled()) return;
    const st = store();
    if (st) st.decisions.push(d);
    console.groupCollapsed(`[AI] Selected Action: ${d.label}  (期待値 ${d.expectedValue})`);
    console.log('理由:', d.reason);
    console.log('予定手順:', d.line.map(s => s.label).join(' → '));
    if (d.expectedResponses.length > 0) {
      console.log('Expected Opponent Response:');
      d.expectedResponses.forEach(r =>
        console.log(`  ${r.label}: ${pct(r.probability)}  → 評価 ${r1(r.value)}  | 次の自分: ${r.followUp.join(' → ') || '(なし)'}`),
      );
    }
    console.log('Evaluation (ターン終了時点の内訳):');
    console.table(Object.fromEntries(Object.entries(d.evaluation.breakdown).map(([k, v]) => [k, r1(v)])));
    if (d.alternatives.length > 0) {
      console.log('次点:', d.alternatives.map(a => `${a.labels.join(' → ')} (${a.value})`));
    }
    console.log('探索:', d.stats);
    console.groupEnd();
  },

  prompt(label: string) {
    if (!isAIDebugEnabled()) return;
    console.log(`[AI] Prompt response: ${label}`);
  },

  warn(message: string, data?: unknown) {
    // 異常系は開発モードでなくても残す（ゲーム進行には影響しない）
    if (data !== undefined) console.warn(`[AI] ${message}`, data);
    else console.warn(`[AI] ${message}`);
  },

  turnEnd(summary: { steps: number; replans: number; elapsedMs: number; reason: string }) {
    if (!isAIDebugEnabled()) return;
    console.log(
      `%c[AI] ===== AI TURN END ===== ${summary.reason} (行動 ${summary.steps} / 再計画 ${summary.replans} / ${summary.elapsedMs}ms)`,
      'color:#f59e0b;font-weight:bold',
    );
  },
};
