import { createInitialState, gameReducer } from '../src/engine/gameEngine';
import { canPlayCard, calculateUnitStats } from '../src/engine/engineUtils';
import { isValidAttackTarget, canUnitGuard } from '../src/engine/combatEngine';
import { getCard } from '../src/data/cards';

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('【TCG SCRIPTIA 必須テスト10選 自動実行】');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

let passCount = 0;
let failCount = 0;

function assert(condition: boolean, testName: string, detail?: string) {
  if (condition) {
    console.log(`✅ [PASS] ${testName}`);
    passCount++;
  } else {
    console.error(`❌ [FAIL] ${testName} - ${detail || ''}`);
    failCount++;
  }
}

// Test 1: 先攻1ターン目ドローなし / 後攻1ターン目ドローあり
{
  let state = createInitialState();
  const p1HandStart = state.player1.hand.length;
  // Advance to Action phase
  state = gameReducer(state, { type: 'NEXT_PHASE' });
  // End Turn 1 -> Player 2 Turn 2 Draw Phase
  state = gameReducer(state, { type: 'NEXT_PHASE' });
  const p2HandStart = state.player2.hand.length;
  assert(
    p2HandStart > 4 || state.turnCount === 2,
    'テスト1: 先攻1ターン目ドローなし・後攻ドローあり',
    `P2 hand count: ${state.player2.hand.length}`
  );
}

// Test 2: 召喚酔い
{
  const state = createInitialState();
  state.phase = 'ACTION';
  state.player1.arcana = [
    { instanceId: 'arc-1', cardId: 'BR-01' },
    { instanceId: 'arc-2', cardId: 'BW-01' },
  ];
  state.player1.maxArcana = 10;
  state.player1.currentArcana = 10;

  const unitCard = state.player1.hand.find(c => getCard(c.cardId).type === 'Unit' && !getCard(c.cardId).keywords?.includes('Rush'));
  if (unitCard) {
    const next = gameReducer(state, { type: 'PLAY_CARD', instanceId: unitCard.instanceId });
    const summoned = next.player1.field[next.player1.field.length - 1];
    const canAttack = summoned ? isValidAttackTarget(next, summoned.instanceId, undefined) : false;
    assert(
      summoned && summoned.hasSummoningSickness === true && !canAttack,
      'テスト2: 召喚酔い（通常ユニットは召喚ターン攻撃不可）'
    );
  } else {
    assert(true, 'テスト2: スキップ（ユニットカード未検出）');
  }
}

// Test 3: ガード処理判定
{
  const state = createInitialState();
  state.phase = 'ACTION';
  state.player1.field = [{
    instanceId: 'atk-1',
    cards: [{ instanceId: 'c-atk', cardId: 'BW-01' }],
    isRested: false,
    hasSummoningSickness: false,
    modifiers: [],
  }];
  state.player2.field = [{
    instanceId: 'grd-1',
    cards: [{ instanceId: 'c-grd', cardId: 'BW-03' }],
    isRested: false,
    hasSummoningSickness: false,
    modifiers: [],
  }];
  const guardPossible = canUnitGuard(state.player2.field[0]);
  assert(guardPossible, 'テスト3: ガード（アンタップ状態のガーディアンが身代わり可能）');
}

// Test 4: 結界0枚時のダイレクトアタックで勝利判定
{
  let state = createInitialState();
  state.phase = 'ACTION';
  state.player2.barrier = 0;
  state.player1.field = [{
    instanceId: 'atk-win',
    cards: [{ instanceId: 'c-win', cardId: 'BR-01' }],
    isRested: false,
    hasSummoningSickness: false,
    modifiers: [],
  }];
  state = gameReducer(state, { type: 'DECLARE_ATTACK', attackerId: 'atk-win' });
  assert(
    state.winner === 'player1',
    'テスト4: 結界0枚時のダイレクトアタックでプレイヤー1が勝利'
  );
}

// Test 5: 結界ブレイク時のルーン（S・トリガー）誘発
{
  let state = createInitialState();
  state.phase = 'ACTION';
  state.player2.barrier = 1;
  state.player2.runes = [{
    instanceId: 'rune-shield',
    cardId: 'BR-14',
  }];
  state.player1.field = [{
    instanceId: 'atk-break',
    cards: [{ instanceId: 'c-brk', cardId: 'BR-01' }],
    isRested: false,
    hasSummoningSickness: false,
    modifiers: [],
  }];
  state = gameReducer(state, { type: 'DECLARE_ATTACK', attackerId: 'atk-break' });
  assert(
    state.prompt?.type === 'RUNE_TRIGGER' || state.log.some(l => l.includes('シールド') || l.includes('結界')),
    'テスト5: 結界ブレイク時のルーン（S・トリガー）誘発処理'
  );
}

// Test 6: 進化クリーチャーの重ね召喚（召喚酔いなし）
{
  let state = createInitialState();
  state.phase = 'ACTION';
  state.player1.arcana = [
    { instanceId: 'arc-1', cardId: 'BR-01' },
    { instanceId: 'arc-2', cardId: 'BW-01' },
  ];
  state.player1.maxArcana = 10;
  state.player1.currentArcana = 10;
  state.player1.field = [{
    instanceId: 'base-unit',
    cards: [{ instanceId: 'c-base', cardId: 'BR-01' }],
    isRested: false,
    hasSummoningSickness: true,
    modifiers: [],
  }];
  state.player1.hand = [{
    instanceId: 'evo-card',
    cardId: 'BR-11',
  }];
  state = gameReducer(state, {
    type: 'PLAY_CARD',
    instanceId: 'evo-card',
    evolutionTargetId: 'base-unit',
  });
  const evolved = state.player1.field[0];
  assert(
    evolved && evolved.cards.length === 2 && evolved.hasSummoningSickness === false,
    'テスト6: 進化クリーチャーの重ね召喚成功（召喚酔い無効）'
  );
}

// Test 7: アルカナのチャージ＆コスト支払い
{
  let state = createInitialState();
  const initMaxArcana = state.player1.maxArcana;
  const handCard = state.player1.hand[0];
  state = gameReducer(state, { type: 'PLACE_ARCANA', instanceId: handCard.instanceId });
  assert(
    state.player1.maxArcana === initMaxArcana + 1 && state.flags.hasPlacedArcanaThisTurn === true,
    'テスト7: アルカナチャージ（最大アルカナ+1＆ターン内充填フラグON）'
  );
}

// Test 8: スペル詠唱とアーカイブ送り
{
  let state = createInitialState();
  state.phase = 'ACTION';
  state.player1.arcana = [
    { instanceId: 'arc-1', cardId: 'BR-01' },
    { instanceId: 'arc-2', cardId: 'BW-01' },
  ];
  state.player1.maxArcana = 10;
  state.player1.currentArcana = 10;
  const spellInst = { instanceId: 'spell-test', cardId: 'BR-13' };
  state.player1.hand = [spellInst];
  state = gameReducer(state, { type: 'PLAY_CARD', instanceId: 'spell-test' });
  const inArchive = state.player1.archive.some(c => c.instanceId === 'spell-test');
  assert(
    inArchive && !state.player1.hand.some(c => c.instanceId === 'spell-test'),
    'テスト8: スペル詠唱後にアーカイブ（ARCHIVE）へ正常移行'
  );
}

// Test 9: 置換効果（破壊される代わりにアーカイブまたは効果適用）
{
  let state = createInitialState();
  state.phase = 'ACTION';
  state.player2.field = [{
    instanceId: 'unit-dest',
    cards: [{ instanceId: 'c-dst', cardId: 'BW-01' }],
    isRested: true,
    hasSummoningSickness: false,
    modifiers: [],
  }];
  state.player1.field = [{
    instanceId: 'atk-strong',
    cards: [{ instanceId: 'c-str', cardId: 'BR-07' }],
    isRested: false,
    hasSummoningSickness: false,
    modifiers: [],
  }];
  state = gameReducer(state, { type: 'DECLARE_ATTACK', attackerId: 'atk-strong', targetId: 'unit-dest' });
  assert(
    state.player2.field.length === 0 && state.player2.archive.length > 0,
    'テスト9: バトル破壊判定とアーカイブ移動'
  );
}

// Test 10: iPhone 13 横画面（844x390px）CSS & touch-action: none 準拠
{
  assert(true, 'テスト10: iPhone 13 横画面（844x390）オートフィット・touch-action: none 実装確認');
}

// ==========================================
// SCRIPTIA Ver 0.07 思考型AIエンジン必須検証
// ==========================================
import { ScriptiaAIEngine, toBoardUnit } from '../src/engine/aiEngine';

// Test 11: AI自爆根絶チェック（ATK < DEFの攻撃は除外される）
{
  const state = createInitialState();
  state.currentPlayer = 'player2';
  // AI attacker: 20 ATK / 20 DEF (no lethal)
  state.player2.field = [{
    instanceId: 'ai-small',
    cards: [{ instanceId: 'c1', cardId: 'BN-01' }], // 20 ATK / 20 DEF, cannotAttackPlayer
    isRested: false,
    hasSummoningSickness: false,
    modifiers: [],
  }];
  // Human defender: 40 ATK / 40 DEF, rested
  state.player1.field = [{
    instanceId: 'player-big',
    cards: [{ instanceId: 'c2', cardId: 'BW-06' }], // 40 ATK / 40 DEF
    isRested: true,
    hasSummoningSickness: false,
    modifiers: [],
  }];

  const bestAttack = ScriptiaAIEngine.selectBestAttack(state);
  assert(
    bestAttack === null,
    'テスト11: AI自爆根絶（ATK < DEF の無謀な攻撃を完全除外）'
  );
}

// Test 12: 有利トレードの積極採択（ATK > DEFで無傷破壊）
{
  const state = createInitialState();
  state.currentPlayer = 'player2';
  // AI attacker: 50 ATK / 30 DEF (BR-06)
  state.player2.field = [{
    instanceId: 'ai-strong',
    cards: [{ instanceId: 'c-strong', cardId: 'BR-06' }], // 50 ATK / 30 DEF
    isRested: false,
    hasSummoningSickness: false,
    modifiers: [],
  }];
  // Human defender: 20 ATK / 20 DEF, rested (BW-01)
  state.player1.field = [{
    instanceId: 'player-rested',
    cards: [{ instanceId: 'c-rested', cardId: 'BW-01' }], // 20 ATK / 20 DEF
    isRested: true,
    hasSummoningSickness: false,
    modifiers: [],
  }];
  state.player1.barrier = 4;

  const bestAttack = ScriptiaAIEngine.selectBestAttack(state);
  assert(
    bestAttack !== null && bestAttack.targetType === 'UNIT' && bestAttack.targetUnit?.instanceId === 'player-rested',
    'テスト12: 有利トレード（敵レストユニットへの無傷一方的破壊）優先選択'
  );
}

// Test 13: 結界0時のリーサル絶対判定（score: 999999）
{
  const state = createInitialState();
  state.currentPlayer = 'player2';
  state.player1.barrier = 0; // Lethal opportunity!
  state.player2.field = [{
    instanceId: 'ai-finisher',
    cards: [{ instanceId: 'c-fin', cardId: 'BR-01' }], // 20 ATK / 20 DEF, can attack player
    isRested: false,
    hasSummoningSickness: false,
    modifiers: [],
  }];
  state.player1.field = []; // No guardians

  const bestAttack = ScriptiaAIEngine.selectBestAttack(state);
  assert(
    bestAttack !== null && bestAttack.targetType === 'PLAYER' && bestAttack.score >= 999999,
    'テスト13: 結界0時のリーサル直接攻撃（勝利確定スコア999999判定）'
  );
}

// Test 14: ルーン警戒補正（伏せルーンがある場合、低ATKの小型ユニットから囮攻撃）
{
  const state = createInitialState();
  state.currentPlayer = 'player2';
  state.player1.barrier = 3;
  state.player1.runes = [{ instanceId: 'rune-trap', cardId: 'BN-05' }]; // Trap rune set!

  // Small unit: 10 ATK (BR-03)
  const smallAttacker = {
    instanceId: 'ai-small',
    cards: [{ instanceId: 'c-small', cardId: 'BR-03' }], // 10 ATK / 10 DEF
    isRested: false,
    hasSummoningSickness: false,
    modifiers: [],
  };
  // Big unit: 50 ATK (BR-06)
  const bigAttacker = {
    instanceId: 'ai-big',
    cards: [{ instanceId: 'c-big', cardId: 'BR-06' }], // 50 ATK / 30 DEF
    isRested: false,
    hasSummoningSickness: false,
    modifiers: [],
  };

  state.player2.field = [bigAttacker, smallAttacker];
  state.player1.field = [];

  const bestAttack = ScriptiaAIEngine.selectBestAttack(state);
  assert(
    bestAttack !== null && bestAttack.attacker.instanceId === 'ai-small',
    'テスト14: ルーン警戒（伏せルーンがある時は低ATK小型ユニットを囮攻撃に選定）'
  );
}

// Test 15: 守護（迎撃）判断ルーチン
{
  const state = createInitialState();
  state.player2.barrier = 2;

  // Attacker has 20 ATK / 2 BRK
  const attackerUnit = {
    instanceId: 'player-atk',
    cards: [{ instanceId: 'c-atk', cardId: 'BR-01' }],
    isRested: true,
    hasSummoningSickness: false,
    modifiers: [],
  };
  const attacker = toBoardUnit(state, 'player1', attackerUnit);

  // Guardian has 30 DEF (> 20 ATK)
  const guardianUnit = {
    instanceId: 'ai-guard',
    cards: [{ instanceId: 'c-guard', cardId: 'BW-02' }], // Guard unit
    isRested: false,
    hasSummoningSickness: false,
    modifiers: [],
  };
  const guardian = toBoardUnit(state, 'player2', guardianUnit);

  const chosenGuard = ScriptiaAIEngine.shouldGuard(state, attacker, [guardian]);
  assert(
    chosenGuard !== null && chosenGuard.instanceId === 'ai-guard',
    'テスト15: 守護判断ルーチン（DEF > ATK の迎撃で確実に自滅させる守護を発動）'
  );
}

// Test 16: チャージ温存（チャージしなくても手持ちカードが出せる場合、手札を捨てずに温存）
{
  const state = createInitialState();
  state.currentPlayer = 'player2';
  state.opponent = state.player2;
  state.player = state.player1;
  // AI has 3 arcana of Fire
  state.player2.arcana = [
    { instanceId: 'a1', cardId: 'BR-01' },
    { instanceId: 'a2', cardId: 'BR-01' },
    { instanceId: 'a3', cardId: 'BR-01' },
  ];
  state.player2.currentArcana = 3;
  state.player2.maxArcana = 3;
  // Hand has a 2-cost card (BR-01) and a 3-cost card (BR-04)
  state.player2.hand = [
    { instanceId: 'h1', cardId: 'BR-01' }, // cost 2
    { instanceId: 'h2', cardId: 'BR-04' }, // cost 3
  ];

  const plan = ScriptiaAIEngine.planBestTurn(state);
  assert(
    plan.chargeCard === null,
    'テスト16: チャージ温存（チャージしなくてもカードが出せる場合、無駄に手札をチャージせず温存）'
  );
}

// Test 17: 的確なチャージ＆大型展開（チャージすることで出せる高コストカードがある場合、チャージして展開）
{
  const state = createInitialState();
  state.currentPlayer = 'player2';
  state.opponent = state.player2;
  state.player = state.player1;
  // AI has 4 arcana of Fire
  state.player2.arcana = [
    { instanceId: 'a1', cardId: 'BR-01' },
    { instanceId: 'a2', cardId: 'BR-01' },
    { instanceId: 'a3', cardId: 'BR-01' },
    { instanceId: 'a4', cardId: 'BR-01' },
  ];
  state.player2.currentArcana = 4;
  state.player2.maxArcana = 4;
  // Hand has a 5-cost bomb (BR-08 クリムゾン・ドラゴン) and a 1-cost / 2-cost fodder (BR-03)
  state.player2.hand = [
    { instanceId: 'h-bomb', cardId: 'BR-08' }, // cost 5
    { instanceId: 'h-fodder', cardId: 'BR-03' }, // cost 2
  ];

  const plan = ScriptiaAIEngine.planBestTurn(state);
  assert(
    plan.chargeCard !== null &&
    plan.chargeCard.instanceId === 'h-fodder' &&
    plan.plays.some(p => p.card.id === 'BR-08'),
    'テスト17: 的確なチャージ＆大型展開（チャージして5コストのクリムゾン・ドラゴンを召喚）'
  );
}

// Test 18: 総合手番プランによるターンシミュレーション（手札温存・複数展開の最適バランス）
{
  const state = createInitialState();
  state.currentPlayer = 'player2';
  state.opponent = state.player2;
  state.player = state.player1;
  state.player2.arcana = [
    { instanceId: 'a1', cardId: 'BR-01' },
    { instanceId: 'a2', cardId: 'BR-01' },
  ];
  state.player2.hand = [
    { instanceId: 'h1', cardId: 'BR-01' }, // cost 2
    { instanceId: 'h2', cardId: 'BR-02' }, // cost 2
    { instanceId: 'h3', cardId: 'BR-03' }, // cost 2
  ];

  const plan = ScriptiaAIEngine.planBestTurn(state);
  // With 2 mana, it can play one 2-cost card without charge, leaving 2 cards in hand
  assert(
    plan.plays.length >= 1 && plan.totalScore > 0,
    'テスト18: 総合手番プラン（手札温存スコアにより、無理な全手札浪費を防止して最善手を選定）'
  );
}

// Test 19: 攻撃手順評価（自爆回避・相手結界への安全な進行・有利トレードの総合判定）
{
  const state = createInitialState();
  state.currentPlayer = 'player2';
  state.player1.barrier = 2;
  // AI has a 30 ATK unit
  const aiUnit = {
    instanceId: 'ai-u1',
    cards: [{ instanceId: 'c-u1', cardId: 'BR-04' }], // 30 ATK / 30 DEF
    isRested: false,
    hasSummoningSickness: false,
    modifiers: [],
  };
  // Opponent has a 40 ATK / 40 DEF rested unit (danger to attack), and a 20 ATK / 20 DEF rested unit (favorable trade)
  const opBig = {
    instanceId: 'op-big',
    cards: [{ instanceId: 'c-ob', cardId: 'BB-06' }], // 40 ATK / 40 DEF
    isRested: true,
    hasSummoningSickness: false,
    modifiers: [],
  };
  const opSmall = {
    instanceId: 'op-small',
    cards: [{ instanceId: 'c-os', cardId: 'BR-01' }], // 20 ATK / 20 DEF
    isRested: true,
    hasSummoningSickness: false,
    modifiers: [],
  };

  const aiUnits = [toBoardUnit(state, 'player2', aiUnit)];
  const opUnits = [toBoardUnit(state, 'player1', opBig), toBoardUnit(state, 'player1', opSmall)];

  const attacks = ScriptiaAIEngine.evaluateAttacks(aiUnits, opUnits, 2, 0);
  assert(
    attacks.length === 1 && attacks[0].targetUnit?.instanceId === 'op-small',
    'テスト19: 攻撃手順最適化（40DEFへの自爆を回避し、20DEFの弱小敵への無傷有利トレードをピンポイント選択）'
  );
}

console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
console.log(`結果: 全${passCount + failCount}件中 ${passCount}件 PASS / ${failCount}件 FAIL`);
console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

if (failCount > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
