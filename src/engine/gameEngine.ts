import { GameState, GameAction, PlayerState, CardInstance, UnitState, System } from '../types';
import { CARDS, getCard } from '../data/cards';
import { calculateUnitStats, findUnitAndOwner, checkAffinity } from './engineUtils';
import { destroyUnit, bounceUnit, sendUnitToArcana } from './destroySystem';
import {
  resolveCombat,
  executeGuard,
  isValidAttackTarget,
  canUnitGuard,
  checkWinCondition,
} from './combatEngine';
import {
  startSpellCast,
  cancelSpellCast,
  resolveSpellCast,
} from './spellSystem';

let instanceCounter = 0;
export const createInstance = (cardId: string): CardInstance => ({
  instanceId: `inst_${instanceCounter++}`,
  cardId,
});

const generateDeck = (system: System): CardInstance[] => {
  const cardsOfSystem = CARDS.filter(c => c.system === system || c.system === 'Neutral');
  const deck: CardInstance[] = [];
  while (deck.length < 40) {
    for (const card of cardsOfSystem) {
      if (deck.length < 40) deck.push(createInstance(card.id));
    }
  }
  return deck.sort(() => Math.random() - 0.5);
};

export const createInitialState = (): GameState => {
  const p1Deck = generateDeck('Fire');
  const p2Deck = generateDeck('Water');

  return {
    player1: {
      id: 'player1',
      deck: p1Deck.slice(4),
      hand: p1Deck.slice(0, 4),
      arcana: [],
      maxArcana: 0,
      currentArcana: 0,
      barrier: 5,
      field: [],
      runes: [],
      domain: null,
      archive: [],
      pendingCard: null,
    },
    player2: {
      id: 'player2',
      deck: p2Deck.slice(4),
      hand: p2Deck.slice(0, 4),
      arcana: [],
      maxArcana: 0,
      currentArcana: 0,
      barrier: 5,
      field: [],
      runes: [],
      domain: null,
      archive: [],
      pendingCard: null,
    },
    currentPlayer: 'player1',
    turnCount: 1,
    phase: 'ARCANA_PLACEMENT',
    log: ['ゲーム開始。Player 1の先攻。フェーズ：アルカナチャージ'],
    prompt: null,
    winner: null,
    flags: { hasPlacedArcanaThisTurn: false, domain15Used: false },
  };
};

export const gameReducer = (state: GameState, action: GameAction): GameState => {
  if (action.type === 'START_GAME') {
    return createInitialState();
  }

  if (state.winner) return state;

  // Deep clone for immutability
  let newState: GameState = JSON.parse(JSON.stringify(state));
  const p = newState[newState.currentPlayer];
  const oppKey = newState.currentPlayer === 'player1' ? 'player2' : 'player1';
  const opp = newState[oppKey];

  switch (action.type) {
    case 'NEXT_PHASE': {
      if (newState.phase === 'ARCANA_PLACEMENT') {
        newState.phase = 'ACTION';
        newState.log.push(`${newState.currentPlayer} は行動フェーズに入った。`);
        return newState;
      }
      if (newState.phase === 'ACTION') {
        // END TURN EFFECTS (Duration removal, BW-09)
        p.field.forEach(u => {
          u.modifiers = u.modifiers.filter(m => m.duration !== 'UNTIL_TURN_END');
          if (getCard(u.cards[0].cardId).id === 'BW-09') {
            u.isRested = false;
            newState.log.push(`【光翼の使徒 ミカエル】の効果でアクティブになった。`);
          }
        });
        opp.field.forEach(u => {
          u.modifiers = u.modifiers.filter(m => {
            if (m.duration === 'UNTIL_NEXT_TURN_END') return false;
            return true;
          });
          if (u.modifiers.some(m => m.cannotUntapUntilNextOpponentTurnEnd)) {
            u.modifiers = u.modifiers.filter(m => !m.cannotUntapUntilNextOpponentTurnEnd);
          } else {
            u.isRested = false;
          }
          u.hasSummoningSickness = false;
        });

        // Switch Turn
        newState.currentPlayer = oppKey;
        newState.turnCount += 1;
        newState.flags.hasPlacedArcanaThisTurn = false;
        newState.flags.domain15Used = false;

        const nextP = newState[newState.currentPlayer];
        nextP.currentArcana = nextP.maxArcana;

        if (newState.turnCount > 1) {
          if (nextP.deck.length > 0) {
            nextP.hand.push(nextP.deck.pop()!);
          } else {
            newState.winner = oppKey; // previous player wins
            newState.log.push(`${newState.currentPlayer} はデッキ切れで敗北した！`);
            return newState;
          }
        }
        newState.phase = 'ARCANA_PLACEMENT';
        newState.log.push(`--- ターン ${newState.turnCount} : ${newState.currentPlayer} ---`);
        return newState;
      }
      return newState;
    }

    case 'PLACE_ARCANA': {
      if (newState.phase !== 'ARCANA_PLACEMENT' || newState.flags.hasPlacedArcanaThisTurn) return newState;
      const cardIdx = p.hand.findIndex(c => c.instanceId === action.instanceId);
      if (cardIdx === -1) return newState;

      const [card] = p.hand.splice(cardIdx, 1);
      p.arcana.push(card);
      p.maxArcana += 1;
      p.currentArcana += 1;
      newState.flags.hasPlacedArcanaThisTurn = true;
      newState.log.push(`${p.id} はアルカナを配置した。`);
      // アルカナチャージ完了時に自動で行動フェーズ（ACTION PHASE）へ移行
      newState.phase = 'ACTION';
      newState.log.push(`${p.id} は行動フェーズに入った。`);
      return newState;
    }

    case 'START_SPELL_CAST': {
      if (newState.phase !== 'ACTION') return newState;
      return startSpellCast(newState, action.instanceId);
    }

    case 'CANCEL_SPELL_CAST': {
      return cancelSpellCast(newState);
    }

    case 'RESOLVE_SPELL_TARGET': {
      const pendingId = p.pendingCard?.instanceId;
      if (!pendingId) return newState;
      return resolveSpellCast(newState, pendingId, action.targetId);
    }

    case 'PLAY_CARD': {
      if (newState.phase !== 'ACTION') return newState;
      const cardIdx = p.hand.findIndex(c => c.instanceId === action.instanceId);
      if (cardIdx === -1) return newState;
      const card = p.hand[cardIdx];
      const template = getCard(card.cardId);

      // Handle Spells via spellSystem
      if (template.type === 'Spell') {
        if (!action.targetId && template.targetReq) {
          // If no target provided but target needed, transition to pending/target selection
          return startSpellCast(newState, action.instanceId);
        }
        // If targetId is provided or spell has no target requirement, resolve directly
        return resolveSpellCast(newState, action.instanceId, action.targetId);
      }

      // Check Arcana cost & Affinity for non-spells
      if (p.currentArcana < template.cost) return newState;
      const hasAffinity = checkAffinity(template.system, p.arcana);
      if (!hasAffinity) return newState;

      if (template.type === 'Evolution') {
        let targetUnit = action.evolutionTargetId
          ? p.field.find(u => u.instanceId === action.evolutionTargetId)
          : undefined;
        if (!targetUnit) {
          if (template.evolutionTarget) {
            targetUnit = p.field.find(u => getCard(u.cards[0].cardId).lineage === template.evolutionTarget);
          } else if (p.field.length > 0) {
            targetUnit = p.field[0];
          }
        }
        if (!targetUnit) return newState;
      }

      p.currentArcana -= template.cost;
      p.hand.splice(cardIdx, 1);

      if (template.type === 'Unit') {
        if (p.field.length >= 6) return newState;
        p.field.push({
          instanceId: card.instanceId,
          cards: [card],
          isRested: false,
          hasSummoningSickness: !template.keywords?.includes('Rush'),
          modifiers: [],
        });
        newState.log.push(`${p.id} は 【${template.name}】 を召喚した。`);

        // Check BN-05 rune on opponent
        const bn05 = opp.runes.findIndex(r => r.cardId === 'BN-05');
        if (bn05 !== -1) {
          newState.prompt = {
            type: 'RUNE_TRIGGER',
            playerId: oppKey,
            sourceId: opp.runes[bn05].instanceId,
            targetId: card.instanceId,
            message: `相手がユニットを召喚しました。ルーン【停滞の刻印】を発動しますか？`,
          };
          return newState;
        }

        // On Summon Triggers (Safe resolution without freezing if no targets)
        if (template.id === 'BR-08') {
          const validTargets = opp.field.filter(u => calculateUnitStats(newState, oppKey, u).def <= 40);
          if (validTargets.length > 0) {
            const targetToDestroy = (action.targetId && validTargets.some(u => u.instanceId === action.targetId))
              ? action.targetId
              : validTargets[0].instanceId;
            newState = destroyUnit(newState, targetToDestroy);
            newState.log.push(`【クリムゾン・ドラゴン】の登場時効果！DEF40以下の相手ユニットを破壊した。`);
          } else {
            newState.log.push(`【クリムゾン・ドラゴン】の登場時効果：対象となるDEF40以下の相手ユニットが存在しないため不発。`);
          }
        }
        if (template.id === 'BB-09') {
          if (action.targetId && opp.field.some(u => u.instanceId === action.targetId)) {
            newState = bounceUnit(newState, action.targetId);
          } else if (opp.field.length > 0) {
            newState = bounceUnit(newState, opp.field[0].instanceId);
          }
        }
        if (['BB-04', 'BW-07'].includes(template.id) && p.deck.length > 0) p.hand.push(p.deck.pop()!);
        if (template.id === 'BG-04' && p.deck.length > 0) {
          p.arcana.push(p.deck.pop()!);
          p.maxArcana++;
          p.currentArcana++;
        }
        if (template.id === 'BW-05') {
          if (action.targetId) {
            const t = findUnitAndOwner(newState, action.targetId);
            if (t) t.unit.isRested = true;
          } else if (opp.field.length > 0) {
            opp.field[0].isRested = true;
          }
        }
        if (template.id === 'BD-06' && opp.hand.length > 0) {
          const randIdx = Math.floor(Math.random() * opp.hand.length);
          opp.archive.push(opp.hand.splice(randIdx, 1)[0]);
        }
        if (template.id === 'BW-08' && action.targetId) {
          const aIdx = p.archive.findIndex(c => c.instanceId === action.targetId);
          if (aIdx !== -1) {
            const [retrieved] = p.archive.splice(aIdx, 1);
            p.hand.push(retrieved);
            newState.log.push(`【予言者 アナスタシア】の効果でアーカイブから 【${getCard(retrieved.cardId).name}】 を手札に戻した。`);
          }
        }
        if (template.id === 'BD-10' && action.targetId) {
          const targetIds = action.targetId.split(',');
          targetIds.forEach(tId => {
            const aIdx = p.archive.findIndex(c => c.instanceId === tId);
            if (aIdx !== -1) {
              const [retrieved] = p.archive.splice(aIdx, 1);
              p.hand.push(retrieved);
              newState.log.push(`【常闇の悪魔 バグラザード】の効果でアーカイブから 【${getCard(retrieved.cardId).name}】 を手札に戻した。`);
            }
          });
        }
      } else if (template.type === 'Evolution') {
        let targetUnit = action.evolutionTargetId
          ? p.field.find(u => u.instanceId === action.evolutionTargetId)
          : undefined;
        if (!targetUnit) {
          if (template.evolutionTarget) {
            targetUnit = p.field.find(u => getCard(u.cards[0].cardId).lineage === template.evolutionTarget);
          } else if (p.field.length > 0) {
            targetUnit = p.field[0];
          }
        }
        if (!targetUnit) return newState;
        // Invariant Principle 4: Stack evolution on top of base unit
        targetUnit.cards.unshift(card);
        targetUnit.instanceId = card.instanceId;
        targetUnit.hasSummoningSickness = false;
        newState.log.push(`${p.id} は 【${template.name}】 に進化した。`);

        if (template.id === 'BD-11' && action.targetId) newState = destroyUnit(newState, action.targetId);
      } else if (template.type === 'Rune') {
        if (p.runes.length >= 2) return newState;
        p.runes.push(card);
        newState.log.push(`${p.id} はルーンをセットした。`);
      } else if (template.type === 'Domain') {
        if (p.domain) p.archive.push(p.domain);
        p.domain = card;
        newState.log.push(`${p.id} はドメイン 【${template.name}】 を配置した。`);
      }
      return newState;
    }

    case 'DECLARE_ATTACK': {
      if (newState.phase !== 'ACTION') return newState;

      // Validate attack target using strict v0.07 rules
      const isValid = isValidAttackTarget(newState, action.attackerId, action.targetId);
      if (!isValid) {
        newState.log.push(`指定された攻撃対象は無効です。`);
        return newState;
      }

      const attacker = p.field.find(u => u.instanceId === action.attackerId);
      if (!attacker) return newState;
      const aTpl = getCard(attacker.cards[0].cardId);

      // On Attack Triggers
      if (aTpl.id === 'BB-03' && p.deck.length > 0) p.hand.push(p.deck.pop()!);
      if (aTpl.id === 'BD-04' && opp.hand.length > 0) {
        const randIdx = Math.floor(Math.random() * opp.hand.length);
        opp.archive.push(opp.hand.splice(randIdx, 1)[0]);
      }

      attacker.isRested = true;

      // Case A: Attacking opponent unit
      if (action.targetId) {
        return resolveCombat(newState, action.attackerId, action.targetId);
      }

      // Case B: Attacking opponent player directly
      // Check if opponent has any active units that can Guard
      const guarders = opp.field.filter(u => canUnitGuard(u));
      const canBeGuarded = !aTpl.keywords?.includes('CannotBeGuarded');

      if (guarders.length > 0 && canBeGuarded) {
        // If defending player is AI (player2), automatically evaluate and resolve guard without showing dialog to human
        if (oppKey === 'player2') {
          const stats = calculateUnitStats(newState, p.id, attacker);
          const attackerAtk = stats.atk;
          const attackerBrk = stats.brk;

          let chosenGuarder: UnitState | undefined;
          if (opp.barrier <= 1 || attackerBrk >= opp.barrier) {
            chosenGuarder = guarders[0];
          } else {
            const winningGuarder = guarders.find(g => calculateUnitStats(newState, 'player2', g).def >= attackerAtk);
            if (winningGuarder) {
              chosenGuarder = winningGuarder;
            } else {
              const cheapGuarder = guarders.find(g => getCard(g.cards[0].cardId).cost <= 2);
              if (cheapGuarder && attackerAtk >= 40) {
                chosenGuarder = cheapGuarder;
              }
            }
          }

          if (chosenGuarder) {
            chosenGuarder.isRested = true;
            newState.log.push(`相手の【${getCard(chosenGuarder.cards[0].cardId).name}】が守護を発動し迎撃！（レスト状態）`);
            return resolveCombat(newState, action.attackerId, chosenGuarder.instanceId);
          } else {
            newState.log.push(`相手は守護を行わなかった。直接攻撃成功！`);
            return checkWinCondition(newState, oppKey, stats.brk, action.attackerId);
          }
        }

        // Defending player is human (player1): show prompt only to human player
        newState.prompt = {
          type: 'GUARD',
          playerId: 'player1',
          attackerId: action.attackerId,
          validTargets: guarders.map(u => u.instanceId),
          text: `相手が直接攻撃を宣言！守護を発動しますか？`,
        };
        newState.log.push(`相手が直接攻撃を宣言！守護の選択を待機中...`);
        return newState;
      }

      // No guard possible: execute direct attack
      const stats = calculateUnitStats(newState, newState.currentPlayer, attacker);
      return checkWinCondition(newState, oppKey, stats.brk, action.attackerId);
    }

    case 'RESOLVE_GUARD': {
      if (newState.prompt?.type !== 'GUARD') return newState;
      const attackerId = newState.prompt.attackerId!;
      return executeGuard(newState, attackerId, action.guarderId);
    }

    case 'RESOLVE_TRIGGER': {
      if (!newState.prompt) return newState;
      const pt = newState.prompt;
      newState.prompt = null;
      const player = newState[pt.playerId as 'player1' | 'player2'];
      const opP = pt.playerId === 'player1' ? newState.player2 : newState.player1;

      if (pt.type === 'RUNE_TRIGGER' && action.apply) {
        const rIdx = player.runes.findIndex(r => r.instanceId === pt.sourceId);
        if (rIdx !== -1) {
          const rune = player.runes.splice(rIdx, 1)[0];
          player.archive.push(rune);
          const tpl = getCard(rune.cardId);
          newState.log.push(`【${tpl.name}】発動！`);

          if (tpl.id === 'BN-05' && pt.targetId) {
            const u = findUnitAndOwner(newState, pt.targetId);
            if (u) {
              u.unit.isRested = true;
              u.unit.modifiers.push({
                sourceId: 'BN-05',
                atk: 0,
                def: 0,
                brk: 0,
                duration: 'PERMANENT',
                cannotUntapUntilNextOpponentTurnEnd: true,
              });
            }
          }
          if (tpl.id === 'BR-14') {
            opP.field.forEach(u => {
              if (calculateUnitStats(newState, opP.id, u).def <= 20) {
                newState = destroyUnit(newState, u.instanceId);
              }
            });
          }
          if (tpl.id === 'BB-14') {
            if (opP.field.length > 0) newState = bounceUnit(newState, opP.field[0].instanceId);
          }
          if (tpl.id === 'BG-14') {
            if (opP.field.length > 0) {
              newState = sendUnitToArcana(newState, opP.field[0].instanceId, pt.playerId as 'player1' | 'player2');
            }
          }
          if (tpl.id === 'BW-14') {
            if (opP.field.length > 0) opP.field[0].isRested = true;
            if (opP.field.length > 1) opP.field[1].isRested = true;
          }
          if (tpl.id === 'BD-14') {
            if (opP.field.length > 0) newState = destroyUnit(newState, opP.field[0].instanceId);
          }
        }
      }

      if (pt.type === 'TRIGGER' && action.apply) {
        const hIdx = player.hand.findIndex(c => c.instanceId === pt.sourceId);
        if (hIdx !== -1 && player.field.length < 6) {
          const card = player.hand.splice(hIdx, 1)[0];
          player.field.push({
            instanceId: card.instanceId,
            cards: [card],
            isRested: false,
            hasSummoningSickness: true,
            modifiers: [],
          });
          newState.log.push(`${player.id} は結界破壊時効果で 【${getCard(card.cardId).name}】 を召喚した。`);
        }
      }
      return newState;
    }

    case 'RETRIEVE_FROM_ARCHIVE': {
      const p = newState[newState.currentPlayer];
      const aIdx = p.archive.findIndex(c => c.instanceId === action.instanceId);
      if (aIdx !== -1) {
        const [retrieved] = p.archive.splice(aIdx, 1);
        p.hand.push(retrieved);
        newState.log.push(`${p.id} はアーカイブから 【${getCard(retrieved.cardId).name}】 を手札に戻した。`);
      }
      return newState;
    }

    default:
      return newState;
  }
};
