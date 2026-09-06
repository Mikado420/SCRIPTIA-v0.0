import { createInitialState, gameReducer } from '../engine/gameEngine';
import {
  canUnitGuard,
  isValidAttackTarget,
  executeGuard,
  resolveCombat,
} from '../engine/combatEngine';
import {
  destroyUnit,
  bounceUnit,
  registerOnUnitDestroyedListener,
  clearOnUnitDestroyedListeners,
} from '../engine/destroySystem';
import {
  startSpellCast,
  getValidSpellTargets,
  resolveSpellCast,
} from '../engine/spellSystem';
import { calculateUnitStats } from '../engine/engineUtils';
import { GameState, UnitState, CardInstance } from '../types';
import { getCard } from '../data/cards';

// Helper to assert with clear messages
function assert(condition: boolean, testName: string, detail?: string) {
  if (!condition) {
    throw new Error(`FAIL [${testName}]: ${detail || 'Assertion failed'}`);
  }
  console.log(`PASS [${testName}]`);
}

export function runAllTests() {
  console.log('========================================');
  console.log('SCRIPTIA v0.07 Phase 1 & 2 Test Suite');
  console.log('========================================\n');

  // Test 1: [守護即時レスト]
  {
    const state = createInitialState();
    state.phase = 'ACTION';
    state.currentPlayer = 'player1';

    // Player 2 has a guarder: BB-07 (Guard, ATK 30, DEF 30)
    const guarder: UnitState = {
      instanceId: 'guarder_1',
      cards: [{ instanceId: 'guarder_c1', cardId: 'BB-07' }],
      isRested: false,
      hasSummoningSickness: false,
      modifiers: [],
    };
    state.player2.field.push(guarder);

    // Attacker: BR-01 (ATK 20, DEF 20)
    const attacker: UnitState = {
      instanceId: 'attacker_1',
      cards: [{ instanceId: 'attacker_c1', cardId: 'BR-01' }],
      isRested: false,
      hasSummoningSickness: false,
      modifiers: [],
    };
    state.player1.field.push(attacker);

    // Set GUARD prompt
    state.prompt = {
      type: 'GUARD',
      playerId: 'player2',
      attackerId: 'attacker_1',
    };

    assert(canUnitGuard(guarder) === true, '1.1: Guarder can initially guard');

    // Defending player executes guard
    const afterGuard = executeGuard(state, 'attacker_1', 'guarder_1');
    const updatedGuarder = afterGuard.player2.field.find(u => u.instanceId === 'guarder_1');

    assert(updatedGuarder !== undefined, '1.2: Guarder survived combat (ATK 20 vs DEF 30)');
    assert(updatedGuarder!.isRested === true, '1.3: Guarder is immediately rested');
    assert(canUnitGuard(updatedGuarder!) === false, '1.4: Rested guarder CANNOT guard again in same turn');
  }

  // Test 2: [アクティブ攻撃遮断]
  {
    const state = createInitialState();
    state.phase = 'ACTION';
    state.currentPlayer = 'player1';

    // Normal attacker: BR-01
    const attacker: UnitState = {
      instanceId: 'attacker_2',
      cards: [{ instanceId: 'attacker_c2', cardId: 'BR-01' }],
      isRested: false,
      hasSummoningSickness: false,
      modifiers: [],
    };
    state.player1.field.push(attacker);

    // Active opponent unit
    const activeTarget: UnitState = {
      instanceId: 'target_active',
      cards: [{ instanceId: 'target_c2', cardId: 'BB-02' }],
      isRested: false,
      hasSummoningSickness: false,
      modifiers: [],
    };
    state.player2.field.push(activeTarget);

    const canAttack = isValidAttackTarget(state, 'attacker_2', 'target_active');
    assert(canAttack === false, '2.1: Normal unit cannot attack active opponent unit');
  }

  // Test 3: [クロウ例外]
  {
    const state = createInitialState();
    state.phase = 'ACTION';
    state.currentPlayer = 'player1';

    // Crow attacker: BR-09 (孤高の狩人 クロウ)
    const crow: UnitState = {
      instanceId: 'attacker_crow',
      cards: [{ instanceId: 'crow_c1', cardId: 'BR-09' }],
      isRested: false,
      hasSummoningSickness: false,
      modifiers: [],
    };
    state.player1.field.push(crow);

    // Active opponent unit
    const activeTarget: UnitState = {
      instanceId: 'target_active_3',
      cards: [{ instanceId: 'target_c3', cardId: 'BB-02' }],
      isRested: false,
      hasSummoningSickness: false,
      modifiers: [],
    };
    state.player2.field.push(activeTarget);

    const canAttackCrow = isValidAttackTarget(state, 'attacker_crow', 'target_active_3');
    assert(canAttackCrow === true, '3.1: BR-09 (Crow) CAN attack active opponent unit');
  }

  // Test 4: [攻撃不可ユニット]
  {
    const state = createInitialState();
    state.phase = 'ACTION';
    state.currentPlayer = 'player1';

    // BB-01 (CannotAttackPlayer)
    const bb01: UnitState = {
      instanceId: 'attacker_bb01',
      cards: [{ instanceId: 'bb01_c1', cardId: 'BB-01' }],
      isRested: false,
      hasSummoningSickness: false,
      modifiers: [],
    };
    state.player1.field.push(bb01);

    // Rested opponent unit
    const restedTarget: UnitState = {
      instanceId: 'target_rested_4',
      cards: [{ instanceId: 'target_c4', cardId: 'BR-01' }],
      isRested: true,
      hasSummoningSickness: false,
      modifiers: [],
    };
    state.player2.field.push(restedTarget);

    const canAttackPlayer = isValidAttackTarget(state, 'attacker_bb01', undefined);
    assert(canAttackPlayer === false, '4.1: BB-01 cannot attack opponent player directly');

    const canAttackRestedUnit = isValidAttackTarget(state, 'attacker_bb01', 'target_rested_4');
    assert(canAttackRestedUnit === true, '4.2: BB-01 CAN attack rested opponent unit');
  }

  // Test 5: [自爆判定]
  {
    const state = createInitialState();
    state.phase = 'ACTION';
    state.currentPlayer = 'player1';

    // Attacker: ATK 30 (BR-02: ATK 30, DEF 20)
    const attacker: UnitState = {
      instanceId: 'attacker_5',
      cards: [{ instanceId: 'a_c5', cardId: 'BR-02' }],
      isRested: false,
      hasSummoningSickness: false,
      modifiers: [],
    };
    state.player1.field.push(attacker);

    // Defender: DEF 40 (BG-05: ATK 40, DEF 40)
    const defender: UnitState = {
      instanceId: 'defender_5',
      cards: [{ instanceId: 'd_c5', cardId: 'BG-05' }],
      isRested: true,
      hasSummoningSickness: false,
      modifiers: [],
    };
    state.player2.field.push(defender);

    const afterCombat = resolveCombat(state, 'attacker_5', 'defender_5');

    // Attacker must be destroyed (自爆)
    const attackerAlive = afterCombat.player1.field.some(u => u.instanceId === 'attacker_5');
    assert(!attackerAlive, '5.1: Attacker (ATK 30) is destroyed by higher DEF (40)');

    // Defender must NOT be destroyed
    const defenderAlive = afterCombat.player2.field.find(u => u.instanceId === 'defender_5');
    assert(defenderAlive !== undefined, '5.2: Defender (DEF 40) survives combat');

    // Defender DEF must be untouched (no damage accumulation)
    const defenderStats = calculateUnitStats(afterCombat, 'player2', defenderAlive!);
    assert(defenderStats.def === 40, '5.3: Defender DEF remains 40 (no damage accumulation)');
  }

  // Test 6: [マリー自壊]
  {
    // 6A: Mary survives combat and then self-destructs
    {
      const state = createInitialState();
      state.phase = 'ACTION';
      state.currentPlayer = 'player1';

      // Attacker: ATK 20
      const attacker: UnitState = {
        instanceId: 'attacker_6a',
        cards: [{ instanceId: 'a_c6a', cardId: 'BR-01' }],
        isRested: false,
        hasSummoningSickness: false,
        modifiers: [],
      };
      state.player1.field.push(attacker);

      // Mary: BD-02 (Guard, ATK 10, DEF 40)
      const mary: UnitState = {
        instanceId: 'mary_6a',
        cards: [{ instanceId: 'm_c6a', cardId: 'BD-02' }],
        isRested: false,
        hasSummoningSickness: false,
        modifiers: [],
      };
      state.player2.field.push(mary);

      state.prompt = {
        type: 'GUARD',
        playerId: 'player2',
        attackerId: 'attacker_6a',
      };

      const afterGuard = executeGuard(state, 'attacker_6a', 'mary_6a');
      const maryAlive = afterGuard.player2.field.some(u => u.instanceId === 'mary_6a');
      assert(!maryAlive, '6.1: Mary (BD-02) self-destructs after surviving guard combat');
      assert(afterGuard.player2.archive.some(c => c.cardId === 'BD-02'), '6.2: Mary is in archive');
    }

    // 6B: Mary is destroyed in combat (no double destruction error)
    {
      const state = createInitialState();
      state.phase = 'ACTION';
      state.currentPlayer = 'player1';

      // Attacker: ATK 50
      const attacker: UnitState = {
        instanceId: 'attacker_6b',
        cards: [{ instanceId: 'a_c6b', cardId: 'BR-07' }],
        isRested: false,
        hasSummoningSickness: false,
        modifiers: [],
      };
      state.player1.field.push(attacker);

      // Mary: BD-02 (DEF 40)
      const mary: UnitState = {
        instanceId: 'mary_6b',
        cards: [{ instanceId: 'm_c6b', cardId: 'BD-02' }],
        isRested: false,
        hasSummoningSickness: false,
        modifiers: [],
      };
      state.player2.field.push(mary);

      state.prompt = {
        type: 'GUARD',
        playerId: 'player2',
        attackerId: 'attacker_6b',
      };

      const initialArchiveCount = state.player2.archive.length;
      const afterGuard = executeGuard(state, 'attacker_6b', 'mary_6b');
      const maryInArchive = afterGuard.player2.archive.filter(c => c.cardId === 'BD-02').length;
      assert(maryInArchive === initialArchiveCount + 1, '6.3: Mary destroyed in combat was not destroyed twice');
    }
  }

  // Test 7: [守護消失安全終了]
  {
    const state = createInitialState();
    state.phase = 'ACTION';
    state.currentPlayer = 'player1';

    const attacker: UnitState = {
      instanceId: 'attacker_7',
      cards: [{ instanceId: 'a_c7', cardId: 'BR-01' }],
      isRested: false,
      hasSummoningSickness: false,
      modifiers: [],
    };
    state.player1.field.push(attacker);

    state.prompt = {
      type: 'GUARD',
      playerId: 'player2',
      attackerId: 'attacker_7',
    };

    const initialBarrier = state.player2.barrier;

    // Defending player declared a guarder that left field before combat resolution
    const afterGuard = executeGuard(state, 'attacker_7', 'vanished_guarder_id');

    assert(afterGuard.player2.barrier === initialBarrier, '7.1: Barrier unchanged when guarder left field');
    assert(afterGuard.winner === null, '7.2: Attack safely ended without falling back to direct attack');
  }

  // Test 8: [置換効果と破壊イベント]
  {
    clearOnUnitDestroyedListeners();
    let listenerCallCount = 0;
    registerOnUnitDestroyedListener(() => {
      listenerCallCount++;
    });

    const state = createInitialState();
    // BB-05 (アクア・ミラージュ)
    const bb05: UnitState = {
      instanceId: 'bb05_u',
      cards: [{ instanceId: 'bb05_c', cardId: 'BB-05' }],
      isRested: false,
      hasSummoningSickness: false,
      modifiers: [],
    };
    state.player1.field.push(bb05);

    const afterDestroy = destroyUnit(state, 'bb05_u');

    // BB-05 must be back in hand, NOT in archive
    assert(afterDestroy.player1.hand.some(c => c.instanceId === 'bb05_c'), '8.1: BB-05 returned to hand');
    assert(!afterDestroy.player1.archive.some(c => c.instanceId === 'bb05_c'), '8.2: BB-05 not in archive');
    assert(listenerCallCount === 0, '8.3: ON_UNIT_DESTROYED event was NOT fired for replacement');

    clearOnUnitDestroyedListeners();
  }

  // Test 9: [進化カード分離]
  {
    const state = createInitialState();
    // 2-card evolution stack: top is BB-11, base is BB-01
    const evoUnit: UnitState = {
      instanceId: 'evo_u9',
      cards: [
        { instanceId: 'evo_top', cardId: 'BR-11' },
        { instanceId: 'evo_base', cardId: 'BR-01' },
      ],
      isRested: false,
      hasSummoningSickness: false,
      modifiers: [],
    };
    state.player1.field.push(evoUnit);

    const initialArchiveCount = state.player1.archive.length;
    const afterDestroy = destroyUnit(state, 'evo_u9');

    assert(afterDestroy.player1.archive.length === initialArchiveCount + 2, '9.1: 2 cards added to archive');
    assert(afterDestroy.player1.archive.some(c => c.instanceId === 'evo_top'), '9.2: Top card in archive');
    assert(afterDestroy.player1.archive.some(c => c.instanceId === 'evo_base'), '9.3: Base card in archive');

    // Test bounce separation as well
    const evoUnit2: UnitState = {
      instanceId: 'evo_u9b',
      cards: [
        { instanceId: 'evo2_top', cardId: 'BR-11' },
        { instanceId: 'evo2_base', cardId: 'BR-01' },
      ],
      isRested: false,
      hasSummoningSickness: false,
      modifiers: [],
    };
    state.player1.field.push(evoUnit2);

    const initialHandCount = state.player1.hand.length;
    const afterBounce = bounceUnit(state, 'evo_u9b');
    assert(afterBounce.player1.hand.length === initialHandCount + 2, '9.4: 2 cards separated into hand on bounce');
  }

  // Test 10: [BW-13同名回収不可]
  {
    const state = createInitialState();
    state.phase = 'ACTION';
    state.currentPlayer = 'player1';
    state.player1.currentArcana = 10;
    state.player1.arcana = [{ instanceId: 'arc_light', cardId: 'BW-01' }];

    // Hand: BW-13 being cast
    const castingBW13: CardInstance = { instanceId: 'bw13_active', cardId: 'BW-13' };
    state.player1.hand = [castingBW13];

    // Archive: another BW-13, a Spell BR-12, and a Unit BR-01
    const archiveBW13: CardInstance = { instanceId: 'bw13_archived', cardId: 'BW-13' };
    const archiveSpell: CardInstance = { instanceId: 'spell_archived', cardId: 'BR-12' };
    const archiveUnit: CardInstance = { instanceId: 'unit_archived', cardId: 'BR-01' };
    state.player1.archive = [archiveBW13, archiveSpell, archiveUnit];

    // Initiate casting
    const stateAfterCast = startSpellCast(state, 'bw13_active');

    // Pending card should be castingBW13
    assert(stateAfterCast.player1.pendingCard?.instanceId === 'bw13_active', '10.1: BW-13 is in pending card');

    const validTargets = getValidSpellTargets(stateAfterCast, 'BW-13', 'bw13_active');

    assert(validTargets.includes('spell_archived'), '10.2: Valid spell in archive is targetable');
    assert(!validTargets.includes('bw13_active'), '10.3: Active pending BW-13 is NOT targetable');
    assert(!validTargets.includes('bw13_archived'), '10.4: Other BW-13 in archive is NOT targetable');
    assert(!validTargets.includes('unit_archived'), '10.5: Unit in archive is NOT targetable (spells/runes only)');
  }

  console.log('\n========================================');
  console.log('ALL 10 REQUIRED TESTS PASSED 100% SUCCESS!');
  console.log('========================================');
}

// Auto-run if executed via tsx
runAllTests();
