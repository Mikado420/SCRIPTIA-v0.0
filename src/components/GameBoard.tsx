import React, { useState } from 'react';
import { GameState, GameAction, CardInstance } from '../types';
import { CardView } from './CardView';
import { HandTray } from './HandTray';
import { ArcanaGauge } from './ArcanaGauge';
import { BarrierPlates } from './BarrierPlates';
import { ActionControls } from './ActionControls';
import { PlaymatSelector, PlaymatThemeId, PLAYMAT_THEMES } from './PlaymatSelector';
import { ZoneViewerModal, ZoneSelectionConfig } from './ZoneViewerModal';
import { getCard } from '../data/cards';
import { calculateUnitStats, canPlayCard } from '../engine/engineUtils';
import { History, X, Shield, Sparkles, Sword } from 'lucide-react';

interface Props {
  state: GameState;
  dispatch: React.Dispatch<GameAction>;
  onInspect: (card: any) => void;
}

export const GameBoard: React.FC<Props> = ({ state, dispatch, onInspect }) => {
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [arcanaMode, setArcanaMode] = useState(false);
  const [showLog, setShowLog] = useState(false);

  // Playmat Theme State (persisted in localStorage)
  const [playmatTheme, setPlaymatTheme] = useState<PlaymatThemeId>(() => {
    try {
      const saved = localStorage.getItem('scriptia_playmat');
      if (saved && PLAYMAT_THEMES.some(t => t.id === saved)) {
        return saved as PlaymatThemeId;
      }
    } catch (e) {
      // ignore localStorage errors
    }
    return 'library';
  });
  const [showPlaymatSelector, setShowPlaymatSelector] = useState(false);

  // Zone Viewer Modal State
  const [zoneModal, setZoneModal] = useState<{
    isOpen: boolean;
    title: string;
    zoneType: 'arcana' | 'archive';
    cards: CardInstance[];
    isOpponent?: boolean;
    selectionMode?: ZoneSelectionConfig | null;
  }>({
    isOpen: false,
    title: '',
    zoneType: 'arcana',
    cards: [],
  });

  const me = state.player1;
  const opp = state.player2;
  const isMyTurn = state.currentPlayer === 'player1';
  const currentTheme = PLAYMAT_THEMES.find(t => t.id === playmatTheme) || PLAYMAT_THEMES[0];

  // Deselect on empty board click
  const handleBoardClick = () => {
    setSelectedCardId(null);
    setArcanaMode(false);
  };

  // Card click router
  const handleCardClick = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isMyTurn) return;

    // Arcana Placement Phase
    if (state.phase === 'ARCANA_PLACEMENT') {
      const inHand = me.hand.find(c => c.instanceId === id);
      if (inHand) {
        if (arcanaMode || selectedCardId === id) {
          dispatch({ type: 'PLACE_ARCANA', instanceId: id });
          setArcanaMode(false);
          setSelectedCardId(null);
        } else {
          setSelectedCardId(id);
        }
      }
      return;
    }

    // Action Phase
    if (state.phase === 'ACTION') {
      const inHand = me.hand.find(c => c.instanceId === id);
      if (inHand) {
        const tpl = getCard(inHand.cardId);

        // Recovery Effect Hook for BW-13 (聖者の祈り)
        if (tpl.id === 'BW-13' && me.archive.some(c => ['Spell', 'Rune'].includes(getCard(c.cardId).type))) {
          setZoneModal({
            isOpen: true,
            title: '【聖者の祈り】回収するスペルまたはルーンを選択',
            zoneType: 'archive',
            cards: me.archive,
            isOpponent: false,
            selectionMode: {
              promptText: '手札に戻すカードを選んでください',
              canSelect: (cTpl) => cTpl.type === 'Spell' || cTpl.type === 'Rune',
              onSelect: (chosenId) => {
                dispatch({ type: 'PLAY_CARD', instanceId: inHand.instanceId, targetId: chosenId });
                setSelectedCardId(null);
              },
            },
          });
          return;
        }

        // Recovery Effect Hook for BW-08 (予言者 アナスタシア)
        if (tpl.id === 'BW-08' && me.archive.some(c => ['Spell', 'Rune'].includes(getCard(c.cardId).type))) {
          setZoneModal({
            isOpen: true,
            title: '【予言者 アナスタシア】登場時効果：回収カードを選択',
            zoneType: 'archive',
            cards: me.archive,
            isOpponent: false,
            selectionMode: {
              promptText: '召喚と同時に手札に戻すスペルまたはルーンを選択',
              canSelect: (cTpl) => cTpl.type === 'Spell' || cTpl.type === 'Rune',
              onSelect: (chosenId) => {
                dispatch({ type: 'PLAY_CARD', instanceId: inHand.instanceId, targetId: chosenId });
                setSelectedCardId(null);
              },
            },
          });
          return;
        }

        // Recovery Effect Hook for BD-10 (常闇の悪魔 バグラザード)
        if (tpl.id === 'BD-10' && me.archive.some(c => getCard(c.cardId).system === 'Dark')) {
          setZoneModal({
            isOpen: true,
            title: '【常闇の悪魔 バグラザード】登場時効果：闇カード回収',
            zoneType: 'archive',
            cards: me.archive,
            isOpponent: false,
            selectionMode: {
              promptText: '手札に戻す闇のカードを選択',
              canSelect: (cTpl) => cTpl.system === 'Dark',
              onSelect: (chosenId) => {
                dispatch({ type: 'PLAY_CARD', instanceId: inHand.instanceId, targetId: chosenId });
                setSelectedCardId(null);
              },
            },
          });
          return;
        }

        setSelectedCardId(id === selectedCardId ? null : id);
        return;
      }

      // Friendly Unit clicked
      const inField = me.field.find(c => c.instanceId === id);
      if (inField) {
        // If an evolution card is currently selected in hand, evolve it onto this unit!
        if (selectedCardId) {
          const selHand = me.hand.find(c => c.instanceId === selectedCardId);
          if (selHand && getCard(selHand.cardId).type === 'Evolution') {
            dispatch({ type: 'PLAY_CARD', instanceId: selectedCardId, evolutionTargetId: id });
            setSelectedCardId(null);
            return;
          }
        }

        // Select friendly unit as attacker (if active)
        if (!inField.isRested && !inField.hasSummoningSickness) {
          setSelectedCardId(id === selectedCardId ? null : id);
          return;
        }
      }

      // Opponent Unit clicked
      const inOppField = opp.field.find(c => c.instanceId === id);
      if (inOppField && selectedCardId) {
        const selHand = me.hand.find(c => c.instanceId === selectedCardId);
        if (selHand) {
          dispatch({ type: 'PLAY_CARD', instanceId: selectedCardId, targetId: id });
        } else {
          // Friendly unit attacking opponent unit
          dispatch({ type: 'DECLARE_ATTACK', attackerId: selectedCardId, targetId: id });
        }
        setSelectedCardId(null);
        return;
      }

      // Opponent Domain or Rune target
      const oppRune = opp.runes.find(c => c.instanceId === id);
      if (oppRune && selectedCardId) {
        dispatch({ type: 'PLAY_CARD', instanceId: selectedCardId, targetId: id });
        setSelectedCardId(null);
        return;
      }

      if (opp.domain?.instanceId === id && selectedCardId) {
        dispatch({ type: 'PLAY_CARD', instanceId: selectedCardId, targetId: id });
        setSelectedCardId(null);
        return;
      }
    }
  };

  // Direct attack to opponent player
  const handleOpponentDirectAttack = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (isMyTurn && state.phase === 'ACTION' && selectedCardId) {
      const selHand = me.hand.find(c => c.instanceId === selectedCardId);
      if (!selHand) {
        dispatch({ type: 'DECLARE_ATTACK', attackerId: selectedCardId });
        setSelectedCardId(null);
      }
    }
  };

  // Fast summon from hand button
  const handlePlayHandCard = (instanceId: string) => {
    dispatch({ type: 'PLAY_CARD', instanceId });
    setSelectedCardId(null);
  };

  // Fast arcana charge from hand button
  const handlePlaceHandArcana = (instanceId: string) => {
    dispatch({ type: 'PLACE_ARCANA', instanceId });
    setSelectedCardId(null);
    setArcanaMode(false);
  };

  // Charge Arcana Button Handler
  const handleArcanaChargeBtn = () => {
    if (!isMyTurn || state.flags.hasPlacedArcanaThisTurn) return;

    if (state.phase === 'ARCANA_PLACEMENT') {
      if (selectedCardId && me.hand.some(c => c.instanceId === selectedCardId)) {
        dispatch({ type: 'PLACE_ARCANA', instanceId: selectedCardId });
        setSelectedCardId(null);
        setArcanaMode(false);
      } else {
        setArcanaMode(!arcanaMode);
      }
    }
  };

  const handlePrompt = (apply: boolean, targetId?: string) => {
    dispatch({ type: 'RESOLVE_TRIGGER', apply, targetId });
  };

  // Check if player has selected an active attacker ready for direct attack
  const canDirectAttack =
    isMyTurn &&
    state.phase === 'ACTION' &&
    !!selectedCardId &&
    me.field.some(u => u.instanceId === selectedCardId && !u.isRested && !u.hasSummoningSickness);

  // Check if a summonable unit is selected in hand (to highlight empty field slots)
  const selectedHandCard = selectedCardId ? me.hand.find(c => c.instanceId === selectedCardId) : null;
  const isSelectedHandPlayable =
    selectedHandCard &&
    isMyTurn &&
    state.phase === 'ACTION' &&
    canPlayCard(getCard(selectedHandCard.cardId), me.currentArcana, me.arcana, me.field.length);

  return (
    <div
      className="fixed inset-0 w-full h-full text-slate-100 font-sans select-none overflow-hidden flex flex-col justify-between transition-colors duration-500 min-h-0 min-w-0"
      style={{
        ...currentTheme.bgStyle,
        paddingTop: 'max(8px, env(safe-area-inset-top, 0px))',
        paddingBottom: 'max(8px, env(safe-area-inset-bottom, 0px))',
        paddingLeft: 'max(12px, env(safe-area-inset-left, 0px))',
        paddingRight: 'max(12px, env(safe-area-inset-right, 0px))',
      }}
      onClick={handleBoardClick}
    >
      {/* Center Mystic Sigil Glow */}
      <div
        className="absolute inset-0 pointer-events-none flex items-center justify-center opacity-30"
        style={{ boxShadow: `inset 0 0 120px ${currentTheme.ambientGlow}` }}
      >
        <div className="w-[420px] h-[420px] rounded-full border border-white/5 flex items-center justify-center">
          <div className="w-[300px] h-[300px] rounded-full border border-dashed border-white/10" />
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 1. TOP TIER: Opponent HUD, Barrier & Hand (Duel Masters Plays Style)       */}
      {/* ========================================================================= */}
      <div className="relative w-full flex items-start justify-between z-30 pointer-events-none shrink-0 min-h-0">
        {/* Top-Left: Opponent Arcana & Deck/Archive Gauge */}
        <div className="pointer-events-auto">
          <ArcanaGauge
            isOpponent
            current={opp.currentArcana}
            max={opp.maxArcana}
            arcanaCards={opp.arcana}
            deckCount={opp.deck.length}
            archiveCount={opp.archive.length}
            onOpenArcana={() =>
              setZoneModal({
                isOpen: true,
                title: '相手のアルカナゾーン',
                zoneType: 'arcana',
                cards: opp.arcana,
                isOpponent: true,
              })
            }
            onOpenArchive={() =>
              setZoneModal({
                isOpen: true,
                title: '相手のアーカイブ(墓地)',
                zoneType: 'archive',
                cards: opp.archive,
                isOpponent: true,
              })
            }
          />
        </div>

        {/* Top-Center: Opponent Avatar, Hand & Floating Barrier Array */}
        <div className="flex flex-col items-center pointer-events-auto">
          {/* Opponent Hand: docked directly to top edge */}
          <div className="flex items-start justify-center -space-x-2 pb-0.5">
            {opp.hand.map(c => (
              <CardView key={c.instanceId} size="opponent-hand" isFaceDown />
            ))}
          </div>

          {/* Opponent Avatar & Floating Barrier Plates */}
          <div className="flex items-center space-x-1.5 sm:space-x-2">
            {/* Opponent Avatar Crest */}
            <div
              onClick={handleOpponentDirectAttack}
              className={`flex items-center space-x-1 sm:space-x-1.5 px-2 py-0.5 sm:py-1 rounded-full border transition-all cursor-pointer ${
                canDirectAttack
                  ? 'border-red-500 bg-red-950/80 shadow-lg shadow-red-500/50 scale-105 ring-2 ring-red-400 animate-pulse'
                  : 'border-white/10 bg-black/60'
              }`}
              title={canDirectAttack ? '相手を直接攻撃！' : '相手プレイヤー'}
            >
              <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full bg-gradient-to-br from-red-700 to-slate-900 border border-red-400 flex items-center justify-center shadow">
                <span className="text-[8px] sm:text-[9px] font-black text-red-200">OPP</span>
              </div>
              <span className="text-[9px] sm:text-[10px] font-black text-slate-300">OPPONENT</span>
            </div>

            {/* Floating Barrier Hexagonal Plates */}
            <BarrierPlates
              count={opp.barrier}
              max={5}
              isOpponent
              isTargetable={canDirectAttack}
              onClick={handleOpponentDirectAttack}
            />
          </div>
        </div>

        {/* Top-Right: Opponent Runes & Domain Pedestals */}
        <div className="flex items-center space-x-1 sm:space-x-1.5 pointer-events-auto bg-black/40 backdrop-blur-sm p-1 rounded-xl border border-white/10">
          <div className="text-[7px] sm:text-[7.5px] font-black text-slate-400 px-0.5 sm:px-1 uppercase tracking-tight">RUNE</div>
          {opp.runes[0] ? (
            <CardView isFaceDown size="compact" onClick={(e) => handleCardClick(opp.runes[0].instanceId, e)} />
          ) : (
            <div className="w-[38px] h-[28px] sm:w-[44px] sm:h-[34px] border border-dashed border-white/10 rounded flex items-center justify-center text-[7.5px] text-white/20">空</div>
          )}
          {opp.runes[1] ? (
            <CardView isFaceDown size="compact" onClick={(e) => handleCardClick(opp.runes[1].instanceId, e)} />
          ) : (
            <div className="w-[38px] h-[28px] sm:w-[44px] sm:h-[34px] border border-dashed border-white/10 rounded flex items-center justify-center text-[7.5px] text-white/20">空</div>
          )}

          <div className="h-5 sm:h-6 w-px bg-white/10 mx-0.5" />

          <div className="text-[7px] sm:text-[7.5px] font-black text-slate-400 px-0.5 sm:px-1 uppercase tracking-tight">DOM</div>
          {opp.domain ? (
            <CardView instance={opp.domain} size="compact" onInspect={() => onInspect(getCard(opp.domain!.cardId))} />
          ) : (
            <div className="w-[38px] h-[28px] sm:w-[44px] sm:h-[34px] border border-dashed border-white/10 rounded flex items-center justify-center text-[7.5px] text-white/20">無</div>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. CENTER BATTLE ZONE: Expansive Dual 6-Slot Arena Grid                   */}
      {/* ========================================================================= */}
      <div className="relative flex-1 w-full max-w-5xl mx-auto flex flex-col justify-center items-center px-1 sm:px-2 py-0.5 sm:py-1 z-10 pointer-events-auto min-h-0 min-w-0">
        {/* Opponent Field (6 Creature Slots) */}
        <div className="w-full flex items-center justify-center space-x-1.5 sm:space-x-2.5 md:space-x-3 my-0.5 sm:my-1 min-h-0">
          {Array.from({ length: 6 }).map((_, slotIdx) => {
            const unit = opp.field[slotIdx];
            const stats = unit ? calculateUnitStats(state, 'player2', unit) : null;
            const isTarget = unit && selectedCardId && !me.hand.some(c => c.instanceId === selectedCardId);

            return (
              <div
                key={slotIdx}
                className={`relative w-[54px] h-[74px] sm:w-[62px] sm:h-[84px] md:w-[68px] md:h-[92px] rounded-md sm:rounded-lg flex items-center justify-center transition-all min-h-0 shrink-0 ${
                  unit
                    ? ''
                    : 'border-2 border-dashed border-white/10 bg-black/20'
                } ${
                  isTarget
                    ? 'ring-2 ring-red-500 shadow-lg shadow-red-500/50 cursor-pointer animate-pulse'
                    : ''
                }`}
                onClick={(e) => unit && handleCardClick(unit.instanceId, e)}
              >
                {unit ? (
                  <CardView
                    instance={unit.cards[0]}
                    size="field"
                    computedStats={stats!}
                    isRested={unit.isRested}
                    hasSummoningSickness={unit.hasSummoningSickness}
                    evoCount={unit.cards.length}
                    onInspect={() => onInspect(getCard(unit.cards[0].cardId))}
                  />
                ) : (
                  <span className="text-[8px] sm:text-[9px] font-black text-white/15 select-none">
                    {slotIdx + 1}
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {/* Arena Dividing Crest Line */}
        <div className="w-full max-w-3xl flex items-center justify-center my-0.5 opacity-60">
          <div className="flex-1 h-px bg-gradient-to-r from-transparent via-amber-400/40 to-transparent" />
          <div className="mx-2 sm:mx-3 px-2 py-0.5 rounded-full border border-amber-400/40 bg-black/60 flex items-center space-x-1 shadow">
            <Sword size={9} className="text-amber-400" />
            <span className="text-[7.5px] sm:text-[8px] font-black tracking-widest text-amber-300 uppercase">
              BATTLE ARENA
            </span>
          </div>
          <div className="flex-1 h-px bg-gradient-to-r from-transparent via-amber-400/40 to-transparent" />
        </div>

        {/* Player Field (6 Creature Slots) */}
        <div className="w-full flex items-center justify-center space-x-1.5 sm:space-x-2.5 md:space-x-3 my-0.5 sm:my-1 min-h-0">
          {Array.from({ length: 6 }).map((_, slotIdx) => {
            const unit = me.field[slotIdx];
            const stats = unit ? calculateUnitStats(state, 'player1', unit) : null;
            const isSelected = unit && unit.instanceId === selectedCardId;
            const isAttackerReady = unit && isMyTurn && state.phase === 'ACTION' && !unit.isRested && !unit.hasSummoningSickness;

            return (
              <div
                key={slotIdx}
                onClick={(e) => {
                  if (unit) {
                    handleCardClick(unit.instanceId, e);
                  } else if (isSelectedHandPlayable && selectedHandCard) {
                    // Click empty slot to summon selected card
                    e.stopPropagation();
                    handlePlayHandCard(selectedHandCard.instanceId);
                  }
                }}
                className={`relative w-[54px] h-[74px] sm:w-[62px] sm:h-[84px] md:w-[68px] md:h-[92px] rounded-md sm:rounded-lg flex items-center justify-center transition-all min-h-0 shrink-0 ${
                  unit
                    ? ''
                    : isSelectedHandPlayable
                      ? 'border-2 border-dashed border-emerald-400/80 bg-emerald-950/30 cursor-pointer shadow-lg shadow-emerald-500/30 animate-pulse hover:bg-emerald-900/40'
                      : 'border-2 border-dashed border-white/10 bg-black/20'
                }`}
              >
                {unit ? (
                  <CardView
                    instance={unit.cards[0]}
                    size="field"
                    computedStats={stats!}
                    isRested={unit.isRested}
                    hasSummoningSickness={unit.hasSummoningSickness}
                    evoCount={unit.cards.length}
                    selected={isSelected}
                    playable={isAttackerReady}
                    onInspect={() => onInspect(getCard(unit.cards[0].cardId))}
                  />
                ) : (
                  <span className={`text-[8px] sm:text-[9px] font-black select-none ${
                    isSelectedHandPlayable ? 'text-emerald-300 font-bold' : 'text-white/15'
                  }`}>
                    {isSelectedHandPlayable ? '召喚' : slotIdx + 1}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 3. BOTTOM TIER: Player HUD, Hand Tray, Arcana Gauge & 3D Controls         */}
      {/* ========================================================================= */}
      <div className="relative w-full flex items-end justify-between z-30 pointer-events-none shrink-0 min-h-0">
        {/* Bottom-Left: Duel Masters Plays Circular Arcana Gauge */}
        <div className="pointer-events-auto pb-0.5">
          <ArcanaGauge
            current={me.currentArcana}
            max={me.maxArcana}
            arcanaCards={me.arcana}
            deckCount={me.deck.length}
            archiveCount={me.archive.length}
            onOpenArcana={() =>
              setZoneModal({
                isOpen: true,
                title: '自分のアルカナゾーン',
                zoneType: 'arcana',
                cards: me.arcana,
                isOpponent: false,
              })
            }
            onOpenArchive={() =>
              setZoneModal({
                isOpen: true,
                title: '自分のアーカイブ(墓地)',
                zoneType: 'archive',
                cards: me.archive,
                isOpponent: false,
              })
            }
          />
        </div>

        {/* Bottom-Center: Floating Barrier Plates, Runes/Domain & Player Hand */}
        <div className="flex-1 flex flex-col items-center pointer-events-none max-w-2xl px-2">
          {/* Floating Barrier Plates & Runes/Domain Bar (above hand) */}
          <div className="flex items-center space-x-2 pointer-events-auto mb-1">
            {/* Player Barrier Plates */}
            <BarrierPlates count={me.barrier} max={5} isOpponent={false} />

            {/* Runes & Domain Sockets */}
            <div className="flex items-center space-x-1.5 bg-black/50 backdrop-blur-sm px-2 py-1 rounded-xl border border-white/10">
              <div className="text-[7.5px] font-black text-slate-400 px-1 uppercase tracking-tight">RUNE</div>
              {me.runes[0] ? (
                <CardView isFaceDown size="compact" onClick={(e) => handleCardClick(me.runes[0].instanceId, e)} />
              ) : (
                <div className="w-[44px] h-[34px] border border-dashed border-white/10 rounded flex items-center justify-center text-[7.5px] text-white/20">空</div>
              )}
              {me.runes[1] ? (
                <CardView isFaceDown size="compact" onClick={(e) => handleCardClick(me.runes[1].instanceId, e)} />
              ) : (
                <div className="w-[44px] h-[34px] border border-dashed border-white/10 rounded flex items-center justify-center text-[7.5px] text-white/20">空</div>
              )}

              <div className="h-5 w-px bg-white/10 mx-0.5" />

              <div className="text-[7.5px] font-black text-slate-400 px-1 uppercase tracking-tight">DOM</div>
              {me.domain ? (
                <CardView instance={me.domain} size="compact" onInspect={() => onInspect(getCard(me.domain!.cardId))} />
              ) : (
                <div className="w-[44px] h-[34px] border border-dashed border-white/10 rounded flex items-center justify-center text-[7.5px] text-white/20">無</div>
              )}
            </div>
          </div>

          {/* Interactive Player Hand Tray */}
          <div className="w-full pointer-events-auto">
            <HandTray
              hand={me.hand}
              state={state}
              dispatch={dispatch}
              selectedCard={selectedCardId}
              onSelect={(id) => setSelectedCardId(id || null)}
              onInspect={onInspect}
              onPlayCard={handlePlayHandCard}
              onArcanaPlace={handlePlaceHandArcana}
            />
          </div>
        </div>

        {/* Bottom-Right: 3D Turn End Button & Arcana Charge */}
        <div className="pointer-events-auto pb-0.5">
          <ActionControls
            phase={state.phase}
            turnCount={state.turnCount}
            isMyTurn={isMyTurn}
            hasPlacedArcanaThisTurn={state.flags.hasPlacedArcanaThisTurn}
            hasPrompt={!!state.prompt}
            selectedCardId={selectedCardId}
            isHandSelected={!!selectedCardId && me.hand.some(c => c.instanceId === selectedCardId)}
            onNextPhase={() => {
              dispatch({ type: 'NEXT_PHASE' });
              setArcanaMode(false);
              setSelectedCardId(null);
            }}
            onArcanaCharge={handleArcanaChargeBtn}
            onToggleLog={() => setShowLog(!showLog)}
            onOpenPlaymat={() => setShowPlaymatSelector(true)}
          />
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 4. COMBAT LOG SLIDE-IN DRAWER (RIGHT)                                     */}
      {/* ========================================================================= */}
      {showLog && (
        <div className="absolute top-0 right-0 bottom-0 w-80 max-w-[85vw] bg-slate-950/95 border-l border-slate-700/80 backdrop-blur-md shadow-2xl z-50 flex flex-col animate-in slide-in-from-right duration-200">
          <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 bg-slate-900/60">
            <div className="flex items-center space-x-2">
              <History size={15} className="text-amber-400" />
              <span className="font-black text-xs text-white tracking-wider">BATTLE LOG</span>
            </div>
            <button
              onClick={() => setShowLog(false)}
              className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800"
            >
              <X size={16} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-1.5 font-mono text-[11px]">
            {state.log.length === 0 ? (
              <div className="text-slate-500 text-center py-8">まだ記録がありません</div>
            ) : (
              state.log.map((entry, idx) => (
                <div
                  key={idx}
                  className="p-1.5 rounded bg-slate-900/60 border border-slate-800/80 text-slate-300 leading-snug"
                >
                  {entry}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 5. TRIGGER & GUARD PROMPT CONFIRMATION MODAL                              */}
      {/* ========================================================================= */}
      {state.prompt && (
        <div className="absolute inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border-2 border-yellow-500/80 rounded-2xl p-5 max-w-sm w-full text-center shadow-2xl animate-in zoom-in-95">
            <h3 className="text-base font-black text-yellow-400 mb-2">
              {state.prompt.type === 'GUARD' ? '【ガード宣言】' : '【効果発動の確認】'}
            </h3>
            <p className="text-xs text-slate-200 mb-4">{state.prompt.text}</p>

            {state.prompt.type === 'GUARD' ? (
              <div className="flex flex-col space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  {me.field
                    .filter(u => !u.isRested && getCard(u.cards[0].cardId).keywords?.includes('Guard'))
                    .map(u => (
                      <button
                        key={u.instanceId}
                        onClick={() => handlePrompt(true, u.instanceId)}
                        className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold py-2 px-2 rounded shadow flex items-center justify-center space-x-1"
                      >
                        <Shield size={12} />
                        <span className="truncate">{getCard(u.cards[0].cardId).name}</span>
                      </button>
                    ))}
                </div>
                <button
                  onClick={() => handlePrompt(false)}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold py-2 px-4 rounded"
                >
                  ガードしない
                </button>
              </div>
            ) : (
              <div className="flex justify-center space-x-3">
                <button
                  onClick={() => handlePrompt(true)}
                  className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold py-2 px-5 rounded shadow"
                >
                  発動する
                </button>
                <button
                  onClick={() => handlePrompt(false)}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold py-2 px-5 rounded"
                >
                  キャンセル
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 6. GAME OVER SCREEN                                                       */}
      {/* ========================================================================= */}
      {state.winner && (
        <div className="absolute inset-0 bg-black/90 z-[100] flex flex-col items-center justify-center p-4">
          <h1 className="text-4xl sm:text-6xl font-black text-transparent bg-clip-text bg-gradient-to-b from-yellow-300 to-yellow-600 mb-6 drop-shadow-[0_0_30px_rgba(250,204,21,0.5)]">
            {state.winner === 'player1' ? 'VICTORY' : 'DEFEAT'}
          </h1>
          <button
            onClick={() => dispatch({ type: 'START_GAME' })}
            className="bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 font-black py-2.5 px-8 rounded-full shadow-xl text-sm"
          >
            もう一度プレイする
          </button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 7. MODALS: ZONE VIEWER & PLAYMAT SELECTOR                                 */}
      {/* ========================================================================= */}
      <ZoneViewerModal
        isOpen={zoneModal.isOpen}
        onClose={() => setZoneModal(prev => ({ ...prev, isOpen: false, selectionMode: null }))}
        title={zoneModal.title}
        zoneType={zoneModal.zoneType}
        cards={zoneModal.cards}
        isOpponent={zoneModal.isOpponent}
        selectionMode={zoneModal.selectionMode}
        onInspect={onInspect}
      />

      <PlaymatSelector
        isOpen={showPlaymatSelector}
        onClose={() => setShowPlaymatSelector(false)}
        currentTheme={playmatTheme}
        onSelectTheme={(themeId) => setPlaymatTheme(themeId)}
      />
    </div>
  );
};
