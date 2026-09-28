import { GameAction } from '../../types';

export type DeckType = 'Aggro' | 'Midrange' | 'Control' | 'Ramp' | 'Tempo' | 'Unknown';

export interface CardEstimate {
  cardId: string;
  name: string;
  /** デッキに採用されている確率の推定 */
  deckProbability: number;
  /** 現在の相手手札に1枚以上ある確率の推定 */
  handProbability: number;
  /** 既に公開された枚数 */
  seenCopies: number;
  /** カード単体の脅威度（0〜1） */
  threatLevel: number;
  /** 次の相手ターンに使用可能か（コスト・系統から推定） */
  castableNextTurn: boolean;
}

export interface OpponentTendencies {
  /** 攻撃可能だった機会のうちプレイヤー（結界）を攻撃した割合 */
  aggression: number;
  /** 1ターンあたりの除去・干渉カード使用率 */
  removalRate: number;
  /** 1ターンあたりのユニット展開率 */
  developmentRate: number;
  /** 守護可能な直接攻撃に対して守護した割合 */
  guardRate: number;
  /** アルカナ配置率 */
  chargeRate: number;
  /** 平均手札枚数（温存傾向） */
  avgHandSize: number;
  /** 観測したターン数 */
  sampleTurns: number;
}

/**
 * 相手デッキ分析の結果。公開情報のみから推定される。
 */
export interface OpponentProfile {
  /** 分析したターン（AIターンの turnCount） */
  turn: number;
  /** 分析に使った状態が「AIドロー前」のものか */
  analyzedBeforeDraw: boolean;
  deckType: DeckType;
  deckTypeLabel: string;
  /** 推定デッキタイプの確信度（0〜1） */
  deckTypeConfidence: number;
  deckTypeScores: { type: DeckType; probability: number }[];
  /** 観測された系統（重み付き） */
  elements: { element: string; weight: number }[];
  /** 公開済みカード（重複なし） */
  observedCards: string[];
  /** 公開済みカードの枚数 */
  revealedCounts: Record<string, number>;
  /** 手札にあることが公開情報から分かっているカード（バウンスで戻ったカードなど） */
  knownHandCards: string[];
  /** 採用候補カード（採用確率順） */
  candidateCards: CardEstimate[];
  /** 脅威カード（脅威度 × 手札確率 順） */
  threats: CardEstimate[];
  tendencies: OpponentTendencies;
  resources: {
    hand: number;
    deck: number;
    maxArcana: number;
    runes: number;
    barrier: number;
    field: number;
    hasDomain: boolean;
  };
}

export type OpponentResponseKind = 'removal' | 'interaction' | 'finisher' | 'develop' | 'attackOnly';

export interface PredictedResponse {
  id: string;
  kind: OpponentResponseKind;
  label: string;
  probability: number;
  /** 仮定する相手のカード（develop / removal 等） */
  cardId?: string;
}

export interface EvaluationResult {
  total: number;
  breakdown: Record<string, number>;
}

export interface PlannedStep {
  action: GameAction;
  label: string;
  /** この行動を実行する直前に想定している盤面シグネチャ */
  expectedBefore: string;
}

export interface ScenarioResult {
  id: string;
  label: string;
  probability: number;
  value: number;
  /** その後の自分の次ターンの主な行動 */
  followUp: string[];
}

export interface AIDecision {
  action: GameAction;
  label: string;
  reason: string;
  line: PlannedStep[];
  expectedValue: number;
  evaluation: EvaluationResult;
  expectedResponses: ScenarioResult[];
  alternatives: { labels: string[]; value: number }[];
  stats: {
    nodes: number;
    simulations: number;
    deepEvaluated: number;
    elapsedMs: number;
    truncated: boolean;
  };
}

export interface SearchConfig {
  /** ビーム幅（各深さで残す候補数） */
  beamWidth: number;
  /** 1ターン内の最大行動数 */
  maxTurnActions: number;
  /** 相手応答まで深く読む手順数 */
  deepCandidates: number;
  /** 相手応答シナリオの最大数 */
  maxScenarios: number;
  /** 次の自分のターンで貪欲に行う最大行動数 */
  followUpSteps: number;
  /** 思考時間の上限 (ms)。超えたら探索を打ち切り、それまでの最善を返す */
  timeBudgetMs: number;
  /** 乱数を使うカード効果の仮想実行を再現可能にするためのシード */
  seed: number;
}

export const DEFAULT_SEARCH_CONFIG: SearchConfig = {
  beamWidth: 8,
  maxTurnActions: 14,
  deepCandidates: 6,
  maxScenarios: 4,
  followUpSteps: 5,
  timeBudgetMs: 1200,
  seed: 20240607,
};
