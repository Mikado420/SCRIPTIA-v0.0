import React, { useEffect, useRef } from 'react';
import { GameState, GameAction, PlayerState, UnitState, CardInstance } from '../types';
import { getCard } from '../data/cards';
import { calculateUnitStats } from './engineUtils';

/**
 * Heuristic AI Action Evaluator
 * Evaluates the board state and returns the next best action for Player 2 (AI),
 * or returns NEXT_PHASE to advance/end turn.
 */
export function computeNextAIAction(state: GameState): GameAction | null {
  if (state.winner) return null;

  // 1. Handle Prompts targeting Player 2 (AI)
  if (state.prompt && state.prompt.playerId === 'player2') {
    if (state.prompt.type === 'GUARD') {
      const opp = state.player2;
      const guarders = opp.field.filter(
        u => !u.isRested && getCard(u.cards[0].cardId).keywords?.includes('Guard')
      );

      if (guarders.length === 0) {
        return { type: 'RESOLVE_GUARD' };
      }

      // Check attacker threat
      let attackerAtk = 30;
      let attackerBrk = 1;
      if (state.prompt.attackerId) {
        const aUnit = state.player1.field.find(u => u.instanceId === state.prompt!.attackerId);
        if (aUnit) {
          const stats = calculateUnitStats(state, 'player1', aUnit);
          attackerAtk = stats.atk;
          attackerBrk = stats.brk;
        }
      }

      // If lethal damage or barrier is 0/1, MUST guard to survive
      if (opp.barrier <= 1 || attackerBrk >= opp.barrier) {
        return { type: 'RESOLVE_GUARD', guarderId: guarders[0].instanceId };
      }

      // Check if any guarder can destroy or survive the attacker
      const winningGuarder = guarders.find(g => {
        const stats = calculateUnitStats(state, 'player2', g);
        return stats.def >= attackerAtk;
      });
      if (winningGuarder) {
        return { type: 'RESOLVE_GUARD', guarderId: winningGuarder.instanceId };
      }

      // Check if we have an expendable low-cost guarder
      const cheapGuarder = guarders.find(g => getCard(g.cards[0].cardId).cost <= 2);
      if (cheapGuarder && attackerAtk >= 40) {
        return { type: 'RESOLVE_GUARD', guarderId: cheapGuarder.instanceId };
      }

      // Otherwise, save guarders
      return { type: 'RESOLVE_GUARD' };
    }

    if (state.prompt.type === 'TRIGGER' || state.prompt.type === 'RUNE_TRIGGER') {
      // AI enthusiastically applies beneficial triggers
      return { type: 'RESOLVE_TRIGGER', apply: true };
    }

    return null;
  }

  // 2. Only act when it is Player 2's turn
  if (state.currentPlayer !== 'player2') return null;

  const ai = state.player2;
  const human = state.player1;

  // 3. Arcana Placement Phase
  if (state.phase === 'ARCANA_PLACEMENT') {
    if (!state.flags.hasPlacedArcanaThisTurn && ai.hand.length > 0) {
      // Pick best card to place into Arcana
      const currentAffinities = new Set(ai.arcana.map(a => getCard(a.cardId).system));

      // Prioritize unlocking a missing elemental affinity
      const missingAffinityCard = ai.hand.find(c => {
        const sys = getCard(c.cardId).system;
        return sys !== 'Neutral' && !currentAffinities.has(sys);
      });

      if (missingAffinityCard) {
        return { type: 'PLACE_ARCANA', instanceId: missingAffinityCard.instanceId };
      }

      // Otherwise pick duplicate or highest cost card that AI cannot play soon
      const sortedByCost = [...ai.hand].sort((a, b) => {
        const cardA = getCard(a.cardId);
        const cardB = getCard(b.cardId);
        // Duplicate check
        const aCount = ai.hand.filter(x => x.cardId === a.cardId).length;
        const bCount = ai.hand.filter(x => x.cardId === b.cardId).length;
        if (aCount !== bCount) return bCount - aCount;
        return cardB.cost - cardA.cost;
      });

      return { type: 'PLACE_ARCANA', instanceId: sortedByCost[0].instanceId };
    }

    // Advance to ACTION phase
    return { type: 'NEXT_PHASE' };
  }

  // 4. Action Phase
  if (state.phase === 'ACTION') {
    // 4A. Evaluate Playing Cards
    const playableCards = ai.hand.filter(c => {
      const template = getCard(c.cardId);
      if (ai.currentArcana < template.cost) return false;
      const hasAffinity =
        template.system === 'Neutral' ||
        ai.arcana.some(a => getCard(a.cardId).system === template.system);
      return hasAffinity;
    });

    for (const card of playableCards) {
      const template = getCard(card.cardId);

      // Evolution check
      if (template.type === 'Evolution') {
        const target = ai.field.find(
          u => getCard(u.cards[0].cardId).lineage === template.evolutionTarget
        );
        if (target) {
          // If evolution has targetReq
          let targetId: string | undefined;
          if (template.targetReq === 'opponent_unit' && human.field.length > 0) {
            // BD-11 target DEF <= 80
            const valid = human.field.filter(u => calculateUnitStats(state, 'player1', u).def <= 80);
            if (valid.length > 0) {
              targetId = valid[0].instanceId;
            }
          }
          return {
            type: 'PLAY_CARD',
            instanceId: card.instanceId,
            evolutionTargetId: target.instanceId,
            targetId,
          };
        }
      }

      // Standard Unit check
      if (template.type === 'Unit') {
        if (ai.field.length < 6) {
          // Check target requirements for on-summon
          if (template.targetReq === 'opponent_unit') {
            if (template.id === 'BR-08') {
              // Destroy DEF <= 40
              const target = human.field.find(
                u => calculateUnitStats(state, 'player1', u).def <= 40
              );
              if (target) {
                return { type: 'PLAY_CARD', instanceId: card.instanceId, targetId: target.instanceId };
              }
            } else if (template.id === 'BB-09') {
              // Bounce unit
              if (human.field.length > 0) {
                // Bounce highest ATK unit
                const sorted = [...human.field].sort(
                  (a, b) =>
                    calculateUnitStats(state, 'player1', b).atk -
                    calculateUnitStats(state, 'player1', a).atk
                );
                return { type: 'PLAY_CARD', instanceId: card.instanceId, targetId: sorted[0].instanceId };
              }
            } else if (template.id === 'BW-05') {
              // Rest active unit
              const active = human.field.find(u => !u.isRested);
              if (active) {
                return { type: 'PLAY_CARD', instanceId: card.instanceId, targetId: active.instanceId };
              }
            }
          } else {
            // Units with Archive recovery (BW-08, BD-10)
            if (template.id === 'BW-08') {
              const spellOrRune = ai.archive.find(c => {
                const t = getCard(c.cardId);
                return t.type === 'Spell' || t.type === 'Rune';
              });
              return {
                type: 'PLAY_CARD',
                instanceId: card.instanceId,
                targetId: spellOrRune?.instanceId,
              };
            }
            if (template.id === 'BD-10') {
              const darkCards = ai.archive.filter(c => getCard(c.cardId).system === 'Dark');
              const targetIds = darkCards.slice(0, 2).map(c => c.instanceId).join(',');
              return {
                type: 'PLAY_CARD',
                instanceId: card.instanceId,
                targetId: targetIds || undefined,
              };
            }

            // Normal unit summon
            return { type: 'PLAY_CARD', instanceId: card.instanceId };
          }
        }
      }

      // Spells
      if (template.type === 'Spell') {
        if (template.id === 'BR-12') {
          // DEF <= 20
          const target = human.field.find(
            u => calculateUnitStats(state, 'player1', u).def <= 20
          );
          if (target) {
            return { type: 'PLAY_CARD', instanceId: card.instanceId, targetId: target.instanceId };
          }
        } else if (template.id === 'BR-13') {
          // Buff all units
          if (ai.field.length >= 2) {
            return { type: 'PLAY_CARD', instanceId: card.instanceId };
          }
        } else if (template.id === 'BB-12') {
          // Bounce cost <= 5
          const target = human.field.find(u => getCard(u.cards[0].cardId).cost <= 5);
          if (target) {
            return { type: 'PLAY_CARD', instanceId: card.instanceId, targetId: target.instanceId };
          }
        } else if (template.id === 'BB-13') {
          // Draw 2
          return { type: 'PLAY_CARD', instanceId: card.instanceId };
        } else if (template.id === 'BG-12') {
          // Ramp arcana
          return { type: 'PLAY_CARD', instanceId: card.instanceId };
        } else if (template.id === 'BG-13') {
          // Place enemy unit in arcana (DEF <= 60)
          const target = human.field.find(
            u => calculateUnitStats(state, 'player1', u).def <= 60
          );
          if (target) {
            return { type: 'PLAY_CARD', instanceId: card.instanceId, targetId: target.instanceId };
          }
        } else if (template.id === 'BW-12') {
          // Rest unit
          const active = human.field.find(u => !u.isRested);
          if (active) {
            return { type: 'PLAY_CARD', instanceId: card.instanceId, targetId: active.instanceId };
          }
        } else if (template.id === 'BW-13') {
          // Retrieve spell/rune from archive
          const aTarget = ai.archive.find(c => {
            const t = getCard(c.cardId);
            return t.type === 'Spell' || t.type === 'Rune';
          });
          if (aTarget) {
            return { type: 'PLAY_CARD', instanceId: card.instanceId, targetId: aTarget.instanceId };
          }
        } else if (template.id === 'BD-12') {
          // Discard
          if (human.hand.length > 0) {
            return { type: 'PLAY_CARD', instanceId: card.instanceId };
          }
        } else if (template.id === 'BD-13') {
          // DEF -30
          if (human.field.length > 0) {
            return { type: 'PLAY_CARD', instanceId: card.instanceId, targetId: human.field[0].instanceId };
          }
        } else if (template.id === 'BN-03') {
          // Break domain
          if (human.domain) {
            return { type: 'PLAY_CARD', instanceId: card.instanceId };
          }
        } else if (template.id === 'BN-04') {
          // Dispel rune
          if (human.runes.length > 0) {
            return { type: 'PLAY_CARD', instanceId: card.instanceId, targetId: human.runes[0].instanceId };
          }
        }
      }

      // Runes
      if (template.type === 'Rune' && ai.runes.length < 2) {
        return { type: 'PLAY_CARD', instanceId: card.instanceId };
      }

      // Domain
      if (template.type === 'Domain' && !ai.domain) {
        return { type: 'PLAY_CARD', instanceId: card.instanceId };
      }
    }

    // 4B. Evaluate Unit Attacks
    const readyAttackers = ai.field.filter(
      u => !u.isRested && !u.hasSummoningSickness
    );

    if (readyAttackers.length > 0) {
      // Prioritize winning direct attack if barrier is 0
      if (human.barrier === 0) {
        const directAttacker = readyAttackers.find(
          u => !getCard(u.cards[0].cardId).keywords?.includes('CannotAttackPlayer')
        );
        if (directAttacker) {
          return { type: 'DECLARE_ATTACK', attackerId: directAttacker.instanceId };
        }
      }

      // Check favorable trades against rested enemy units
      for (const attacker of readyAttackers) {
        const aStats = calculateUnitStats(state, 'player2', attacker);
        const aTpl = getCard(attacker.cards[0].cardId);

        // Enemy units targetable: rested, or any if BR-09
        const targetableEnemies = human.field.filter(
          u => u.isRested || aTpl.id === 'BR-09'
        );

        for (const enemy of targetableEnemies) {
          const eStats = calculateUnitStats(state, 'player1', enemy);
          // Favorable trade: destroy enemy and survive
          if (aStats.atk >= eStats.def && aStats.def > eStats.atk) {
            return {
              type: 'DECLARE_ATTACK',
              attackerId: attacker.instanceId,
              targetId: enemy.instanceId,
            };
          }
        }
      }

      // Rune Caring: If human player has set Runes, attack with expendable/lowest ATK units first
      const hasRunes = human.runes.length > 0;
      const sortedAttackers = [...readyAttackers].sort((a, b) => {
        const statsA = calculateUnitStats(state, 'player2', a);
        const statsB = calculateUnitStats(state, 'player2', b);
        if (hasRunes) {
          // Probe with lower ATK/cost unit first
          return statsA.atk - statsB.atk;
        }
        // Attack with higher BRK/ATK unit first
        return statsB.brk - statsA.brk || statsB.atk - statsA.atk;
      });

      for (const attacker of sortedAttackers) {
        const aTpl = getCard(attacker.cards[0].cardId);
        if (aTpl.keywords?.includes('CannotAttackPlayer')) continue;

        // If human has runes and this is our only big boss (cost >= 6) and barrier is high, hold defense
        if (hasRunes && aTpl.cost >= 6 && readyAttackers.length === 1 && human.barrier >= 3) {
          continue;
        }

        return { type: 'DECLARE_ATTACK', attackerId: attacker.instanceId };
      }
    }

    // No further actions or favorable attacks: safely END TURN
    return { type: 'NEXT_PHASE' };
  }

  // Fallback end turn
  return { type: 'NEXT_PHASE' };
}

/**
 * React Hook that reliably drives AI turns without ever freezing the game.
 * Features:
 * - 650ms step pacing for human readability
 * - Strict 3.5s timeout watchdog ensuring NEXT_PHASE is always called
 * - Try/finally safety wrapper
 */
export function useAIEngine(state: GameState, dispatch: React.Dispatch<GameAction>) {
  const stepCountRef = useRef(0);
  const turnTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const isAITurn = state.currentPlayer === 'player2';
  const isAIPrompt = state.prompt?.playerId === 'player2';

  // Reset step counter when turn changes
  useEffect(() => {
    if (state.currentPlayer === 'player1') {
      stepCountRef.current = 0;
      if (turnTimeoutRef.current) {
        clearTimeout(turnTimeoutRef.current);
        turnTimeoutRef.current = null;
      }
    }
  }, [state.currentPlayer, state.turnCount]);

  useEffect(() => {
    if (state.winner) return;

    // Set a safety timeout fallback for the AI turn (3.5 seconds max)
    if (isAITurn && !turnTimeoutRef.current) {
      turnTimeoutRef.current = setTimeout(() => {
        try {
          console.warn('[AI Watchdog] AI turn timed out; forcing NEXT_PHASE.');
          dispatch({ type: 'NEXT_PHASE' });
        } catch (e) {
          console.error('[AI Watchdog Error]', e);
        } finally {
          turnTimeoutRef.current = null;
        }
      }, 3800);
    }

    if (!isAITurn && !isAIPrompt) return;

    // Step pacing delay (650ms)
    const timer = setTimeout(() => {
      try {
        // Step limiter check: prevent infinite step loops
        stepCountRef.current += 1;
        if (stepCountRef.current > 8 && isAITurn) {
          console.warn('[AI Engine] Max step limit reached; ending AI turn.');
          dispatch({ type: 'NEXT_PHASE' });
          return;
        }

        const action = computeNextAIAction(state);
        if (action) {
          dispatch(action);
        }
      } catch (err) {
        console.error('[AI Engine Execution Error]', err);
        // Guaranteed safety fallback to yield turn back to human player
        if (isAITurn) {
          dispatch({ type: 'NEXT_PHASE' });
        }
      }
    }, 650);

    return () => clearTimeout(timer);
  }, [state, isAITurn, isAIPrompt, dispatch]);

  return {
    isAIThinking: isAITurn || isAIPrompt,
  };
}
