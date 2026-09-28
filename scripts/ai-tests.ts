import { createInitialState, gameReducer } from '../src/engine/gameEngine';
import { GameAction, GameState, UnitState } from '../src/types';
import { STARTER_DECK_FIRE, STARTER_DECK_CONTROL } from '../src/components/DeckBuilder';
import {
  OpponentObserver,
  analyzeOpponent,
  buildAIView,
  decideAction,
  decidePromptResponse,
  generateActions,
  predictOpponentActions,
  runAITurn,
} from '../src/engine/ai';
import { HIDDEN_CARD_ID } from '../src/engine/ai/cardKnowledge';
import { promptOptions } from '../src/engine/ai/simulation';

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('【SCRIPTIA AI エンジン テスト】');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

let pass = 0;
let fail = 0;
function assert(cond: boolean, name: string, detail?: unknown) {
  if (cond) {
    console.log(`✅ [PASS] ${name}`);
    pass++;
  } else {
    console.error(`❌ [FAIL] ${name}`, detail ?? '');
    fail++;
  }
}

const unit = (id: string, cardId: string, opts: Partial<UnitState> = {}): UnitState => ({
  instanceId: id,
  cards: [{ instanceId: `c_${id}`, cardId }],
  isRested: false,
  hasSummoningSickness: false,
  modifiers: [],
  ...opts,
});
const cards = (prefix: string, ids: string[]) => ids.map((cardId, i) => ({ instanceId: `${prefix}${i}`, cardId }));

/** AIの手番（ACTIONフェーズ）の基本盤面 */
function aiTurnState(): GameState {
  const s = createInitialState();
  s.currentPlayer = 'player2';
  s.turnCount = 6;
  s.phase = 'ACTION';
  s.flags.hasPlacedArcanaThisTurn = true;
  s.player1.hand = cards('h1_', ['BR-01', 'BR-02', 'BR-12']);
  s.player1.arcana = cards('a1_', ['BR-01', 'BR-04', 'BR-06']);
  s.player1.maxArcana = 3;
  s.player1.currentArcana = 3;
  s.player2.hand = [];
  s.player2.arcana = cards('a2_', ['BB-02', 'BB-02', 'BB-06']);
  s.player2.maxArcana = 3;
  s.player2.currentArcana = 3;
  return s;
}

const profileFor = (s: GameState) => analyzeOpponent(buildAIView(s, 'player2'), 'player2');
const FAST = { timeBudgetMs: 2000 };

// ------------------------------------------------------------------
// 1. 非公開情報を参照しない（相手の手札・デッキ・ルーンの中身が違っても判断が同じ）
// ------------------------------------------------------------------
{
  const base = aiTurnState();
  base.player2.hand = cards('h2_', ['BB-06', 'BB-12']);
  base.player2.currentArcana = 4;
  base.player2.maxArcana = 4;
  base.player2.arcana.push({ instanceId: 'a2_x', cardId: 'BB-02' });
  base.player2.field = [unit('ai1', 'BB-07')];
  base.player1.field = [unit('p1', 'BR-04', { isRested: true }), unit('p2', 'BR-02')];

  const a: GameState = JSON.parse(JSON.stringify(base));
  const b: GameState = JSON.parse(JSON.stringify(base));
  b.player1.hand = cards('zz_', ['BR-08', 'BR-10', 'BR-13']);
  b.player1.deck = [...b.player1.deck].reverse().map((c, i) => ({ ...c, cardId: i % 2 ? 'BR-12' : 'BR-09' }));
  a.player1.runes = [{ instanceId: 'r1', cardId: 'BN-05' }];
  b.player1.runes = [{ instanceId: 'r9', cardId: 'BR-14' }];
  b.player2.deck = [...b.player2.deck].reverse();

  const da = decideAction(a, 'player2', { profile: profileFor(a), config: FAST });
  const db = decideAction(b, 'player2', { profile: profileFor(b), config: FAST });
  const view = buildAIView(b, 'player2');
  assert(
    JSON.stringify(da.line.map(s => s.label)) === JSON.stringify(db.line.map(s => s.label)) && da.expectedValue === db.expectedValue,
    'テストAI-1: 相手の非公開情報（手札・デッキ・伏せルーン）が違っても判断が変わらない',
    { a: da.line.map(s => s.label), b: db.line.map(s => s.label) },
  );
  assert(
    view.player1.hand.every(c => c.cardId === HIDDEN_CARD_ID) &&
      view.player1.deck.every(c => c.cardId === HIDDEN_CARD_ID) &&
      view.player1.runes.every(c => c.cardId === HIDDEN_CARD_ID) &&
      view.player2.deck.every(c => c.cardId === HIDDEN_CARD_ID) &&
      view.player2.hand.every(c => c.cardId !== HIDDEN_CARD_ID),
    'テストAI-2: AIビューは相手の手札・デッキ・ルーンと自分のデッキ順を伏せ、自分の手札は保持する',
  );
}

// ------------------------------------------------------------------
// 3. リーサル: 結界0の相手に攻撃できるなら直接攻撃する
// ------------------------------------------------------------------
{
  const s = aiTurnState();
  s.player1.barrier = 0;
  s.player2.field = [unit('ai_fin', 'BB-02')];
  s.player2.hand = cards('h2_', ['BB-06']);
  s.player2.currentArcana = 4;
  const d = decideAction(s, 'player2', { profile: profileFor(s), config: FAST });
  const atk = d.line.find(st => st.action.type === 'DECLARE_ATTACK');
  assert(
    !!atk && atk.action.type === 'DECLARE_ATTACK' && !atk.action.targetId && d.expectedValue >= 900000,
    'テストAI-3: リーサル（結界0の相手へ直接攻撃して勝利）を最優先',
    d.line.map(x => x.label),
  );
}

// ------------------------------------------------------------------
// 4. リーサル阻止: 次の相手ターンに負ける盤面なら、除去で打点を減らす
// ------------------------------------------------------------------
{
  const s = aiTurnState();
  s.player2.barrier = 1;
  s.player2.arcana = cards('a2_', ['BR-01', 'BR-01', 'BR-04']);
  s.player2.hand = cards('h2_', ['BR-12', 'BR-01']);
  s.player1.field = [unit('p_a', 'BR-01', { isRested: true }), unit('p_b', 'BB-02', { isRested: true })];
  const d = decideAction(s, 'player2', { profile: profileFor(s), config: FAST });
  const labels = d.line.map(x => x.label);
  const removes = d.line.some(x => x.action.type === 'PLAY_CARD' && x.label.includes('フレイム・ダーツ'));
  const trades = d.line.some(x => x.action.type === 'DECLARE_ATTACK' && !!x.action.targetId);
  assert(removes || trades, 'テストAI-4: リーサル阻止（次ターンの被リーサルを除去で回避）', labels);
}

// ------------------------------------------------------------------
// 5. 「何もしない」も正当に選べる: 効果のないカードを無理に使わない
// ------------------------------------------------------------------
{
  const s = aiTurnState();
  s.player2.arcana = cards('a2_', ['BD-01', 'BD-01', 'BD-01']);
  s.player2.hand = cards('h2_', ['BD-12']); // 相手の手札を捨てさせる
  s.player1.hand = []; // 相手の手札が0枚なので効果なし
  const d = decideAction(s, 'player2', { profile: profileFor(s), config: FAST });
  assert(
    d.line.every(x => x.action.type === 'NEXT_PHASE'),
    'テストAI-5: 効果のないカードは使わず「何もしない」を選べる',
    d.line.map(x => x.label),
  );
}

// ------------------------------------------------------------------
// 6. アルカナ評価: 置いても何も改善しない終盤は手札を温存する
// ------------------------------------------------------------------
{
  const s = aiTurnState();
  s.phase = 'ARCANA_PLACEMENT';
  s.flags.hasPlacedArcanaThisTurn = false;
  s.player2.arcana = cards('a2_', Array(9).fill('BR-01'));
  s.player2.maxArcana = 9;
  s.player2.currentArcana = 9;
  s.player2.hand = cards('h2_', ['BR-06', 'BR-04']);
  const d = decideAction(s, 'player2', { profile: profileFor(s), config: FAST });
  assert(
    !d.line.some(x => x.action.type === 'PLACE_ARCANA') && d.line.some(x => x.action.type === 'PLAY_CARD'),
    'テストAI-6: アルカナ9枚で手札が全て出せるならアルカナを置かずに展開する',
    d.line.map(x => x.label),
  );
}

// ------------------------------------------------------------------
// 7. 相手行動予測: 確率の合計が1で、除去カードを予測に含む
// ------------------------------------------------------------------
{
  const s = aiTurnState();
  s.player1.archive = cards('ar1_', ['BR-12', 'BR-12']);
  s.player2.field = [unit('ai_small', 'BB-01')];
  const view = buildAIView(s, 'player2');
  const profile = analyzeOpponent(view, 'player2');
  // AIのターン終了後（相手の手番開始時）の盤面で予測する
  const end = gameReducer(view, { type: 'NEXT_PHASE' });
  const preds = predictOpponentActions(end, 'player2', profile, 4);
  const total = preds.reduce((a, p) => a + p.probability, 0);
  assert(
    Math.abs(total - 1) < 0.03 && preds.some(p => p.cardId === 'BR-12'),
    'テストAI-7: 相手行動予測（確率分布の合計1・既出の除去カードを予測）',
    preds,
  );
  assert(
    profile.deckType !== 'Unknown' && profile.elements[0]?.element === 'Fire' && profile.threats.some(t => t.cardId === 'BR-12'),
    'テストAI-8: 相手デッキ分析（系統=火・脅威カードに既出の除去を含む）',
    { type: profile.deckType, elements: profile.elements, threats: profile.threats.map(t => t.cardId) },
  );
}

// ------------------------------------------------------------------
// 9. 相手デッキ分析はAIターン開始時・AIドロー前の状態で1回だけ行う
// ------------------------------------------------------------------
{
  let s = createInitialState();
  const observer = new OpponentObserver('player2');
  const step = (a: GameAction) => {
    const next = gameReducer(s, a);
    observer.observe(s, next);
    s = next;
  };
  step({ type: 'PLACE_ARCANA', instanceId: s.player1.hand[0].instanceId });
  const aiHandBefore = s.player2.hand.length;
  const prevState = s;
  const next = gameReducer(s, { type: 'NEXT_PHASE' });
  const profile = observer.observe(prevState, next);
  s = next;
  const again = observer.getProfileForTurn(s);
  assert(
    !!profile && profile.analyzedBeforeDraw && profile.turn === s.turnCount && again === profile && s.player2.hand.length === aiHandBefore + 1,
    'テストAI-9: 相手デッキ分析はAIターン開始時（AIドロー前の盤面）に1回だけ実行される',
    { profile: !!profile, turn: profile?.turn, stateTurn: s.turnCount },
  );
}

// ------------------------------------------------------------------
// ヘッドレス対戦ドライバ
// ------------------------------------------------------------------
function makeRng(seed: number) {
  let x = seed >>> 0 || 1;
  return () => {
    x ^= x << 13;
    x >>>= 0;
    x ^= x >>> 17;
    x ^= x << 5;
    x >>>= 0;
    return x / 4294967296;
  };
}

const expand = (deck: { cards: { cardId: string; count: number }[] }) => deck.cards.flatMap(c => Array(c.count).fill(c.cardId));

interface GameStats {
  winner: string | null;
  turns: number;
  aiTurns: number;
  maxDecisionMs: number;
  endReasons: Record<string, number>;
  errors: number;
}

async function playHeadlessGame(seed: number, maxTurns = 80): Promise<GameStats> {
  const rng = makeRng(seed);
  const origRandom = Math.random;
  Math.random = rng;
  let state = createInitialState(expand(STARTER_DECK_FIRE), expand(STARTER_DECK_CONTROL));
  Math.random = origRandom;
  const observer = new OpponentObserver('player2');
  const dispatch = (a: GameAction) => {
    const next = gameReducer(state, a);
    observer.observe(state, next);
    state = next;
  };
  const stats: GameStats = { winner: null, turns: 0, aiTurns: 0, maxDecisionMs: 0, endReasons: {}, errors: 0 };

  // プレイヤー側のプロンプト応答（AIターン中の守護選択などは、AIの待機中に人間が行う）
  const humanRespond = () => {
    if (!state.prompt || state.prompt.playerId !== 'player1' || state.winner) return;
    const opts = promptOptions(state);
    dispatch(opts[Math.floor(rng() * opts.length)] ?? { type: 'RESOLVE_TRIGGER', apply: false });
  };

  let guard = 0;
  while (!state.winner && state.turnCount <= maxTurns && guard++ < 5000) {
    if (state.currentPlayer === 'player2' && !(state.prompt && state.prompt.playerId === 'player1')) {
      stats.aiTurns++;
      const r = await runAITurn({
        aiId: 'player2',
        getState: () => state,
        dispatch,
        getProfile: s => observer.getProfileForTurn(s),
        delay: async () => humanRespond(),
        config: { timeBudgetMs: 300 },
        hooks: { onDecision: d => (stats.maxDecisionMs = Math.max(stats.maxDecisionMs, d.stats.elapsedMs)) },
      });
      stats.endReasons[r.endReason] = (stats.endReasons[r.endReason] || 0) + 1;
      stats.errors += r.errors;
      continue;
    }
    // プレイヤー側（ランダムに合法手を選ぶ）
    if (state.prompt) {
      if (state.prompt.playerId === 'player2') {
        dispatch(decidePromptResponse(state, 'player2', null) ?? { type: 'RESOLVE_TRIGGER', apply: true });
      } else {
        humanRespond();
      }
      continue;
    }
    const acts = generateActions(state);
    const end = acts.find(a => a.kind === 'end' || a.kind === 'skipCharge');
    const pick = rng() < 0.25 && end ? end : acts[Math.floor(rng() * acts.length)];
    dispatch(pick ? pick.action : { type: 'NEXT_PHASE' });
  }
  stats.winner = state.winner;
  stats.turns = state.turnCount;
  return stats;
}

async function asyncTests() {
  // ------------------------------------------------------------------
  // 10. 通しの対戦で AI ターンが一度も停止しない
  // ------------------------------------------------------------------
  const games: GameStats[] = [];
  const t0 = Date.now();
  for (let seed = 1; seed <= 8; seed++) games.push(await playHeadlessGame(seed * 7919));
  const elapsed = Date.now() - t0;
  const allEnded = games.every(g => Object.keys(g.endReasons).every(k => k === 'turnEnded' || k === 'gameOver'));
  const finished = games.filter(g => g.winner).length;
  const aiWins = games.filter(g => g.winner === 'player2').length;
  console.log(
    `   対戦結果: ${games.length}戦 / 決着 ${finished} / AI勝利 ${aiWins} / 最大思考 ${Math.max(...games.map(g => g.maxDecisionMs))}ms / 合計 ${elapsed}ms`,
  );
  assert(allEnded && games.every(g => g.errors === 0), 'テストAI-10: 通し対戦8戦でAIターンが毎回正常終了（停止・例外なし）', games);
  assert(finished === games.length, 'テストAI-11: 全対戦が勝敗まで進行する', games.map(g => ({ w: g.winner, t: g.turns })));
  assert(aiWins >= 6, 'テストAI-12: ランダムな合法手を打つ相手に対してAIが大きく勝ち越す', aiWins);

  // ------------------------------------------------------------------
  // 12b. AI同士の対戦（両陣営をランナーで駆動）でも停止しない
  // ------------------------------------------------------------------
  {
    const results: { winner: string | null; turns: number; reasons: Record<string, number> }[] = [];
    for (let seed = 1; seed <= 3; seed++) {
      const rng = makeRng(seed * 104729);
      const orig = Math.random;
      Math.random = rng;
      let state = createInitialState(expand(STARTER_DECK_FIRE), expand(STARTER_DECK_CONTROL));
      Math.random = orig;
      const observers = { player1: new OpponentObserver('player1'), player2: new OpponentObserver('player2') };
      const dispatch = (a: GameAction) => {
        const next = gameReducer(state, a);
        observers.player1.observe(state, next);
        observers.player2.observe(state, next);
        state = next;
      };
      const respondOther = () => {
        if (!state.prompt || state.winner) return;
        const pid = state.prompt.playerId as 'player1' | 'player2';
        if (pid === state.currentPlayer) return;
        dispatch(decidePromptResponse(state, pid, null) ?? { type: 'RESOLVE_TRIGGER', apply: false });
      };
      const reasons: Record<string, number> = {};
      let guard = 0;
      while (!state.winner && state.turnCount <= 90 && guard++ < 400) {
        if (state.prompt && state.prompt.playerId !== state.currentPlayer) {
          respondOther();
          continue;
        }
        const pid = state.currentPlayer;
        const r = await runAITurn({
          aiId: pid,
          getState: () => state,
          dispatch,
          getProfile: s => observers[pid].getProfileForTurn(s),
          delay: async () => respondOther(),
          config: { timeBudgetMs: 200 },
        });
        reasons[r.endReason] = (reasons[r.endReason] || 0) + 1;
      }
      results.push({ winner: state.winner, turns: state.turnCount, reasons });
    }
    console.log(`   AI同士: ${results.map(r => `${r.winner ?? '未決着'}(T${r.turns})`).join(', ')}`);
    assert(
      results.every(r => r.winner && Object.keys(r.reasons).every(k => k === 'turnEnded' || k === 'gameOver')),
      'テストAI-12b: AI同士の対戦（先攻・後攻どちらの席でも）が停止せず決着する',
      results,
    );
  }

  // ------------------------------------------------------------------
  // 13. 思考エンジンが例外を投げ続けても、合法なフェーズ進行でターンを終える
  // ------------------------------------------------------------------
  {
    let s = aiTurnState();
    s.phase = 'ARCANA_PLACEMENT';
    s.flags.hasPlacedArcanaThisTurn = false;
    const r = await runAITurn({
      aiId: 'player2',
      getState: () => s,
      dispatch: a => (s = gameReducer(s, a)),
      delay: async () => {},
      decide: () => {
        throw new Error('boom');
      },
    });
    assert(r.endReason === 'turnEnded' && s.currentPlayer === 'player1' && !s.prompt, 'テストAI-13: 思考中の例外から安全に復帰してターンを終える', r);
  }

  // ------------------------------------------------------------------
  // 14. 盤面を変えない（不正な）行動が返され続けても永久停止しない
  // ------------------------------------------------------------------
  {
    let s = aiTurnState();
    const r = await runAITurn({
      aiId: 'player2',
      getState: () => s,
      dispatch: a => (s = gameReducer(s, a)),
      delay: async () => {},
      maxSteps: 10,
      decide: (st, aiId, o) => {
        const d = decideAction(st, aiId, o);
        const bad = { type: 'DECLARE_ATTACK', attackerId: 'does-not-exist' } as GameAction;
        return { ...d, action: bad, line: [{ action: bad, label: '不正な攻撃', expectedBefore: d.line[0].expectedBefore }] };
      },
    });
    assert(r.endReason === 'turnEnded' && s.currentPlayer === 'player1', 'テストAI-14: 不正な行動を除外・上限で打ち切り、ターンが必ず終わる', r);
  }

  // ------------------------------------------------------------------
  // 15. 人間側のプロンプト（守護選択）中は AI が勝手に進めない
  // ------------------------------------------------------------------
  {
    let s = aiTurnState();
    s.player2.field = [unit('ai_att', 'BB-06')];
    s.player1.field = [unit('p_guard', 'BB-07')];
    s.player1.barrier = 5;
    let dispatchesDuringPrompt = 0;
    let polls = 0;
    const r = await runAITurn({
      aiId: 'player2',
      getState: () => s,
      dispatch: a => {
        if (s.prompt && s.prompt.playerId === 'player1') dispatchesDuringPrompt++;
        s = gameReducer(s, a);
      },
      delay: async () => {
        // 人間が少し考えてから守護しない選択をする
        if (s.prompt?.type === 'GUARD' && s.prompt.playerId === 'player1' && ++polls > 5) {
          s = gameReducer(s, { type: 'RESOLVE_GUARD' });
        }
      },
      config: FAST,
    });
    assert(
      r.endReason === 'turnEnded' && dispatchesDuringPrompt === 0,
      'テストAI-15: 相手（人間）のプロンプト中はAIが強制解決せず待機し、解決後に続行する',
      { r, dispatchesDuringPrompt, polls },
    );
  }

  // ------------------------------------------------------------------
  // 16. AI自身の対象選択プロンプトが残っていても解決して進行する
  // ------------------------------------------------------------------
  {
    let s = aiTurnState();
    s.player2.arcana = cards('a2_', ['BR-01', 'BR-01', 'BR-01']);
    s.player2.hand = cards('h2_', ['BR-12']);
    s.player1.field = [unit('p_small', 'BR-01')];
    s = gameReducer(s, { type: 'START_SPELL_CAST', instanceId: 'h2_0' });
    const hadPrompt = s.prompt?.type === 'TARGET_SELECTION' && s.prompt.playerId === 'player2';
    const r = await runAITurn({
      aiId: 'player2',
      getState: () => s,
      dispatch: a => (s = gameReducer(s, a)),
      delay: async () => {},
      config: FAST,
    });
    assert(hadPrompt && r.endReason === 'turnEnded' && s.player1.field.length === 0, 'テストAI-16: AIの対象選択プロンプトを解決して続行する', r);
  }

  // ------------------------------------------------------------------
  // 17. パフォーマンス: 盤面が混んでいても時間上限付近で結論を出す
  // ------------------------------------------------------------------
  {
    const s = aiTurnState();
    s.phase = 'ARCANA_PLACEMENT';
    s.flags.hasPlacedArcanaThisTurn = false;
    s.player2.arcana = cards('a2_', ['BB-02', 'BB-02', 'BB-06', 'BN-02', 'BB-02', 'BB-07']);
    s.player2.maxArcana = 6;
    s.player2.currentArcana = 6;
    s.player2.hand = cards('h2_', ['BB-12', 'BB-09', 'BB-01', 'BB-02', 'BB-04', 'BB-13', 'BN-02']);
    s.player2.field = [unit('q1', 'BB-06'), unit('q2', 'BB-07'), unit('q3', 'BB-02'), unit('q4', 'BB-03')];
    s.player1.field = [
      unit('w1', 'BR-04', { isRested: true }),
      unit('w2', 'BR-06'),
      unit('w3', 'BR-02', { isRested: true }),
      unit('w4', 'BR-05'),
      unit('w5', 'BR-01', { isRested: true }),
    ];
    const t = Date.now();
    const d = decideAction(s, 'player2', { profile: profileFor(s), config: { timeBudgetMs: 800 } });
    const ms = Date.now() - t;
    console.log(`   混雑盤面の思考: ${ms}ms / nodes ${d.stats.nodes} / sims ${d.stats.simulations} / truncated ${d.stats.truncated}`);
    assert(ms < 2500 && d.line.length > 0, 'テストAI-17: 混雑盤面でも時間上限内に最善手を返す', d.stats);
  }

  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`AIテスト結果: 全${pass + fail}件中 ${pass}件 PASS / ${fail}件 FAIL`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
  process.exit(fail > 0 ? 1 : 0);
}

asyncTests().catch(e => {
  console.error(e);
  process.exit(1);
});
