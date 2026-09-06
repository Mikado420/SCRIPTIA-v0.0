import { GameState, UnitState, PlayerState } from '../types';
import { calculateUnitStats, findUnitAndOwner } from './engineUtils';
import { destroyUnit, bounceUnit, sendUnitToArcana } from './destroySystem';
import { getCard } from '../data/cards';

/**
 * Checks if a unit can declare Guard.
 * Strict rule: Unit must NOT be rested, and must possess the 'Guard' keyword.
 */
export const canUnitGuard = (unit: UnitState): boolean => {
  if (unit.isRested) return false;
  const tpl = getCard(unit.cards[0].cardId);
  return !!tpl.keywords?.includes('Guard');
};

/**
 * Validates whether the given attacker can target the specified target.
 * targetId undefined: Direct attack on opponent player.
 * targetId defined: Attack on opponent unit.
 */
export const isValidAttackTarget = (
  state: GameState,
  attackerId: string,
  targetId?: string
): boolean => {
  const aFound = findUnitAndOwner(state, attackerId);
  if (!aFound) return false;
  const { unit: attacker, playerId: aPid } = aFound;

  // Attacker must be controlled by current player, active, and not summoning sick
  if (aPid !== state.currentPlayer) return false;
  if (attacker.isRested) return false;
  if (attacker.hasSummoningSickness) return false;

  const aTpl = getCard(attacker.cards[0].cardId);
  const oppKey = aPid === 'player1' ? 'player2' : 'player1';
  const opp = state[oppKey];

  // Case A: Attacking opponent player directly
  if (!targetId) {
    // Units with CannotAttackPlayer keyword (BB-01, BG-09, BW-01, BW-03, BD-02, BN-01) cannot attack player
    if (aTpl.keywords?.includes('CannotAttackPlayer')) {
      return false;
    }
    return true;
  }

  // Case B: Attacking an opponent unit
  // Note: Units with CannotAttackPlayer CAN still attack opponent units!
  const targetUnit = opp.field.find(u => u.instanceId === targetId);
  if (!targetUnit) return false;

  // Rule: Only rested units can be attacked, unless attacker is BR-09 (クロウ) or has CanAttackActive keyword
  const canAttackActive = aTpl.id === 'BR-09' || aTpl.keywords?.includes('CanAttackActive');
  if (!targetUnit.isRested && !canAttackActive) {
    return false;
  }

  return true;
};

/**
 * Executes a Guard action safely adhering to Rule Chapter 18 Step 10:
 * 1. Guarder is instantly rested (isRested = true).
 * 2. If guarder vanished/left field before combat resolution, safely abort combat WITHOUT falling back to player direct attack.
 * 3. BD-02 self-destructs after combat ONLY if still alive (no double destruction).
 */
export const executeGuard = (
  state: GameState,
  attackerId: string,
  guarderId?: string
): GameState => {
  if (!state.prompt || state.prompt.type !== 'GUARD') return state;

  const defPlayerKey = state.prompt.playerId as 'player1' | 'player2';
  const defPlayer = state[defPlayerKey];
  state.prompt = null;

  // 1. Defending player chose to guard
  if (guarderId) {
    const guarder = defPlayer.field.find(u => u.instanceId === guarderId);

    // Rule Chapter 18 Step 10: Guarder vanished or left field before combat resolution
    if (!guarder) {
      state.log.push(`守護ユニットが不在となったため、戦闘は行われず安全に終了した。`);
      return state;
    }

    // Guard eligibility check: must not be rested and must have Guard
    if (guarder.isRested || !canUnitGuard(guarder)) {
      state.log.push(`指定されたユニットは守護を行うことができない。`);
      return state;
    }

    // Immediately rest the guarder
    guarder.isRested = true;
    const gTpl = getCard(guarder.cards[0].cardId);
    state.log.push(`【${gTpl.name}】が守護を発動！攻撃を引き付けた。（レスト状態）`);

    // BW-15 加護の聖域 (Domain: draw 1 on guard once per turn)
    if (defPlayer.domain?.cardId === 'BW-15' && !state.flags.domain15Used) {
      if (defPlayer.deck.length > 0) {
        defPlayer.hand.push(defPlayer.deck.pop()!);
        state.log.push(`【加護の聖域】の効果でカードを1枚引いた。`);
        state.flags.domain15Used = true;
      }
    }

    // Resolve unit vs unit combat
    state = resolveCombat(state, attackerId, guarderId);

    // BD-02 "未練の霊 マリー" post-guard self-destruct
    // Only destroy if Mary survived combat (not already destroyed from self-destruct / tie)
    if (gTpl.id === 'BD-02') {
      const stillMary = defPlayer.field.find(u => u.instanceId === guarderId);
      if (stillMary) {
        state.log.push(`【未練の霊 マリー】は守護を行ったため破壊された。`);
        state = destroyUnit(state, guarderId);
      }
    }

    return state;
  }

  // 2. Guard was declined or no guarder was chosen: fallback to direct player attack
  const aFound = findUnitAndOwner(state, attackerId);
  if (!aFound) return state;
  const stats = calculateUnitStats(state, aFound.playerId, aFound.unit);
  return checkWinCondition(state, defPlayerKey, stats.brk, attackerId);
};

/**
 * Resolves Unit vs Unit Combat adhering to SCRIPTIA v0.07:
 * - Defender's ATK is NEVER used in combat calculations.
 * - aATK > dDEF: Defender destroyed.
 * - aATK == dDEF: Both destroyed (相打ち).
 * - aATK < dDEF: Attacker destroyed (自爆). Defender's DEF is NEVER reduced (no damage accumulation).
 * - Deadly / Lethal (BD-03): Opponent unconditionally marked destroyed.
 */
export const resolveCombat = (
  state: GameState,
  attackerId: string,
  defenderId: string
): GameState => {
  const aFound = findUnitAndOwner(state, attackerId);
  const dFound = findUnitAndOwner(state, defenderId);
  if (!aFound || !dFound) return state;

  const { unit: attacker, playerId: aPid } = aFound;
  const { unit: defender, playerId: dPid } = dFound;

  const aTpl = getCard(attacker.cards[0].cardId);
  const dTpl = getCard(defender.cards[0].cardId);
  const aStats = calculateUnitStats(state, aPid, attacker);
  const dStats = calculateUnitStats(state, dPid, defender);

  state.log.push(`◆ 戦闘：【${aTpl.name}】(ATK ${aStats.atk}) vs 【${dTpl.name}】(DEF ${dStats.def})`);

  let aDestroyed = false;
  let dDestroyed = false;

  // Damage accumulation is denied; defender ATK is NOT used
  if (aStats.atk > dStats.def) {
    dDestroyed = true;
    state.log.push(`◆ 戦闘結果：【${aTpl.name}】が【${dTpl.name}】を撃破！`);
  } else if (aStats.atk === dStats.def) {
    aDestroyed = true;
    dDestroyed = true;
    state.log.push(`◆ 相打ち！【${aTpl.name}】と【${dTpl.name}】の双方が破壊された。`);
  } else {
    // aStats.atk < dStats.def: Attacker destroyed (自爆), defender DEF remains intact
    aDestroyed = true;
    state.log.push(`◆ 自爆！【${dTpl.name}】のDEFが高く、【${aTpl.name}】は自爆・破壊された。`);
  }

  // Lethal / Deadly keyword check
  if ((aTpl.keywords?.includes('Lethal') || aTpl.id === 'BD-03') && !dDestroyed) {
    dDestroyed = true;
    state.log.push(`【${aTpl.name}】の【必殺】が発動！【${dTpl.name}】を無条件破壊！`);
  }
  if ((dTpl.keywords?.includes('Lethal') || dTpl.id === 'BD-03') && !aDestroyed) {
    aDestroyed = true;
    state.log.push(`【${dTpl.name}】の【必殺】が発動！【${aTpl.name}】を無条件破壊！`);
  }

  // Execute Defender destruction
  if (dDestroyed) {
    state = destroyUnit(state, defenderId);
    // BG-15 獣王の狩場 Domain trigger
    if (state[aPid].domain?.cardId === 'BG-15' && !state.flags.domain15Used) {
      if (state[aPid].deck.length > 0) {
        state[aPid].hand.push(state[aPid].deck.pop()!);
        state.log.push(`【獣王の狩場】の効果でカードを1枚引いた。`);
        state.flags.domain15Used = true;
      }
    }
  }

  // Execute Attacker destruction
  if (aDestroyed) {
    state = destroyUnit(state, attackerId);
  }

  // BD-02 Mary self-destruct check if Mary was the defender and was NOT destroyed in combat
  if (dTpl.id === 'BD-02') {
    const stillMary = state[dPid].field.find(u => u.instanceId === defenderId);
    if (stillMary) {
      state.log.push(`【未練の霊 マリー】は守護を行ったため破壊される。`);
      state = destroyUnit(state, defenderId);
    }
  }

  return state;
};

/**
 * Direct attack check and rune interrupt handling
 */
export const checkWinCondition = (
  state: GameState,
  oppKey: 'player1' | 'player2',
  brk: number,
  attackerId?: string
): GameState => {
  const oldBarrier = state[oppKey].barrier;
  state[oppKey].barrier = Math.max(0, oldBarrier - brk);
  state.log.push(`直接攻撃成功！結界が ${brk} つ破壊された。（残り: ${state[oppKey].barrier}）`);

  if (oldBarrier === 0 && brk > 0) {
    state.winner = state.currentPlayer;
    state.log.push(`${state.currentPlayer} は直接攻撃で勝利した！`);
    return state;
  }

  // Barrier break triggers (Runes & Hand traps)
  if (oldBarrier > 0 && state[oppKey].barrier < oldBarrier && !state.winner) {
    const opp = state[oppKey];
    const brkRunes = opp.runes.filter(r => {
      const t = getCard(r.cardId);
      return ['BR-14', 'BB-14', 'BG-14', 'BW-14', 'BD-14'].includes(t.id);
    });

    if (brkRunes.length > 0) {
      state.prompt = {
        type: 'RUNE_TRIGGER',
        playerId: oppKey,
        sourceId: brkRunes[0].instanceId,
        attackerId,
        message: `結界が破壊されました。ルーン【${getCard(brkRunes[0].cardId).name}】を発動しますか？`,
      };
    } else {
      const summoners = opp.hand.filter(c =>
        ['BR-03', 'BG-08', 'BW-06', 'BD-05'].includes(c.cardId)
      );
      if (summoners.length > 0 && opp.field.length < 6) {
        state.prompt = {
          type: 'TRIGGER',
          playerId: oppKey,
          sourceId: summoners[0].instanceId,
          attackerId,
          message: `結界破壊時：【${getCard(summoners[0].cardId).name}】を手札から召喚しますか？`,
        };
      }
    }

    // Attacker's BR-15 domain check
    const curP = state[state.currentPlayer];
    if (curP.domain?.cardId === 'BR-15' && !state.flags.domain15Used) {
      if (curP.deck.length > 0) {
        curP.hand.push(curP.deck.pop()!);
        state.log.push(`【突撃前線】の効果でカードを1枚引いた。`);
        state.flags.domain15Used = true;
      }
    }
  }

  return state;
};
