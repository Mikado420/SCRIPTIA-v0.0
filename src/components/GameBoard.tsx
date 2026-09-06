import React, { useState, useEffect, useRef } from 'react';
import { GameState, GameAction, CardInstance, CardTemplate, UnitState } from '../types';
import { CardView } from './CardView';
import { HandTray } from './HandTray';
import { ArcanaGauge } from './ArcanaGauge';
import { BarrierPlates } from './BarrierPlates';
import { ActionControls } from './ActionControls';
import { PlaymatSelector, PlaymatThemeId, PLAYMAT_THEMES } from './PlaymatSelector';
import { ZoneViewerModal, ZoneSelectionConfig } from './ZoneViewerModal';
import { getCard } from '../data/cards';
import { calculateUnitStats, canPlayCard } from '../engine/engineUtils';
import { canUnitGuard, isValidAttackTarget } from '../engine/combatEngine';
import { getValidSpellTargets } from '../engine/spellSystem';
import { History, X, Shield, Sparkles, Sword, Zap, Palette, User } from 'lucide-react';

interface Props {
  state: GameState;
  dispatch: React.Dispatch<GameAction>;
  onInspect: (card: any) => void;
}

export const GameBoard: React.FC<Props> = ({ state, dispatch, onInspect }) => {
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [arcanaMode, setArcanaMode] = useState(false);
  const [showLog, setShowLog] = useState(false);

  // Animation States
  const [isScreenShaking, setIsScreenShaking] = useState(false);
  const [activeAttackerId, setActiveAttackerId] = useState<string | null>(null);
  const [summonRippleSlot, setSummonRippleSlot] = useState<{ isOpponent: boolean; slotIdx: number } | null>(null);
  const [cutinCard, setCutinCard] = useState<{ card: CardTemplate; title: string } | null>(null);

  // Playmat Theme State
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

  // Auto-fit scaler for iPhone 13 Landscape: 880px x 390px
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const updateScale = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      const nextScale = Math.min(w / 880, h / 390);
      setScale(nextScale);
    };
    updateScale();
    window.addEventListener('resize', updateScale);
    window.addEventListener('orientationchange', updateScale);
    return () => {
      window.removeEventListener('resize', updateScale);
      window.removeEventListener('orientationchange', updateScale);
    };
  }, []);

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

  // Animation triggers from state.log
  const prevLogLength = useRef(state.log.length);
  useEffect(() => {
    if (state.log.length > prevLogLength.current) {
      const newestLog = state.log[state.log.length - 1];
      if (newestLog.includes('攻撃') || newestLog.includes('戦闘') || newestLog.includes('破壊')) {
        setIsScreenShaking(true);
        const timer = setTimeout(() => setIsScreenShaking(false), 380);
        return () => clearTimeout(timer);
      }
      if (newestLog.includes('スペル') || newestLog.includes('効果で') || newestLog.includes('発動！')) {
        const match = newestLog.match(/【(.*?)】/);
        if (match) {
          const cardName = match[1];
          const sampleCard = [...me.hand, ...opp.hand, ...me.field.map(u => u.cards[0]), ...opp.field.map(u => u.cards[0]), ...me.archive, ...opp.archive]
            .map(c => getCard(c.cardId))
            .find(t => t.name === cardName);
          if (sampleCard && !cutinCard) {
            triggerCutin(sampleCard, newestLog.includes('スペル') ? '呪文詠唱！' : '能力発動！');
          }
        }
      }
    }
    prevLogLength.current = state.log.length;
  }, [state.log.length]);

  const triggerCutin = (card: CardTemplate, title: string) => {
    setCutinCard({ card, title });
    setTimeout(() => {
      setCutinCard(null);
    }, 1400);
  };

  const handleBoardClick = () => {
    setSelectedCardId(null);
    setArcanaMode(false);
  };

  // Helper to test if a target is valid for currently selected card or spell
  const isTargetValidForSelected = (targetType: 'unit' | 'domain' | 'rune', targetUnit?: UnitState): boolean => {
    if (!selectedCardId) return false;

    // Check if target is valid for pending spell
    const pendingCard = me.pendingCard;
    if (pendingCard) {
      const validTargets = getValidSpellTargets(state, pendingCard.cardId, pendingCard.instanceId);
      if (targetUnit) {
        return validTargets.includes(targetUnit.instanceId);
      }
    }

    const selHand = me.hand.find(c => c.instanceId === selectedCardId);
    if (selHand) {
      const tpl = getCard(selHand.cardId);
      if (tpl.type === 'Spell') {
        const validTargets = getValidSpellTargets(state, tpl.id, selHand.instanceId);
        if (targetUnit) return validTargets.includes(targetUnit.instanceId);
      }
      if (targetType === 'domain' && tpl.id === 'BN-03') return true;
      if (targetType === 'rune' && tpl.id === 'BN-04') return true;
    } else {
      // Attacker selected in field
      const attacker = me.field.find(u => u.instanceId === selectedCardId);
      if (attacker && targetType === 'unit' && targetUnit) {
        return isValidAttackTarget(state, attacker.instanceId, targetUnit.instanceId);
      }
    }
    return false;
  };

  // Check if player has selected an active attacker ready for direct attack
  const canDirectAttack =
    isMyTurn &&
    state.phase === 'ACTION' &&
    !!selectedCardId &&
    me.field.some(u => {
      if (u.instanceId !== selectedCardId) return false;
      return isValidAttackTarget(state, u.instanceId, undefined);
    });

  const selectedHandCard = selectedCardId ? me.hand.find(c => c.instanceId === selectedCardId) : null;
  const isSelectedHandPlayable =
    selectedHandCard &&
    isMyTurn &&
    state.phase === 'ACTION' &&
    canPlayCard(getCard(selectedHandCard.cardId), me.currentArcana, me.arcana, me.field.length);

  // Attack animation execution
  const performAttackAnimation = (attackerId: string, targetId?: string) => {
    setActiveAttackerId(attackerId);
    setTimeout(() => {
      setIsScreenShaking(true);
      setTimeout(() => setIsScreenShaking(false), 380);
      setActiveAttackerId(null);
      dispatch({ type: 'DECLARE_ATTACK', attackerId, targetId });
    }, 200);
  };

  const handleOpponentDirectAttack = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (canDirectAttack && selectedCardId) {
      performAttackAnimation(selectedCardId);
      setSelectedCardId(null);
    }
  };

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

        // Targeted spell initiation
        if (tpl.type === 'Spell' && tpl.targetReq) {
          if (tpl.id === 'BW-13') {
            // Sacred prayer: archive spell/rune recovery
            const validArchiveTargets = getValidSpellTargets(state, 'BW-13', inHand.instanceId);
            setZoneModal({
              isOpen: true,
              title: '【聖者の祈り】回収するスペルまたはルーンを選択',
              zoneType: 'archive',
              cards: me.archive.filter(c => validArchiveTargets.includes(c.instanceId)),
              isOpponent: false,
              selectionMode: {
                promptText: '手札に戻すカードを選んでください',
                canSelect: (cTpl) => (cTpl.type === 'Spell' || cTpl.type === 'Rune') && cTpl.id !== 'BW-13',
                onSelect: (chosenId) => {
                  triggerCutin(tpl, '呪文詠唱！');
                  dispatch({ type: 'PLAY_CARD', instanceId: inHand.instanceId, targetId: chosenId });
                  setSelectedCardId(null);
                },
              },
            });
            return;
          }
          // Board-targeted spells (opponent unit target)
          setSelectedCardId(id === selectedCardId ? null : id);
          return;
        }

        // Recovery Unit effects (BW-08)
        if (tpl.id === 'BW-08' && me.archive.some(c => ['Spell', 'Rune'].includes(getCard(c.cardId).type))) {
          setZoneModal({
            isOpen: true,
            title: '【予言者 アナスタシア】登場時効果：回収カードを選択',
            zoneType: 'archive',
            cards: me.archive.filter(c => ['Spell', 'Rune'].includes(getCard(c.cardId).type)),
            isOpponent: false,
            selectionMode: {
              promptText: '召喚と同時に手札に戻すスペルまたはルーンを選択',
              canSelect: (cTpl) => cTpl.type === 'Spell' || cTpl.type === 'Rune',
              onSelect: (chosenId) => {
                triggerCutin(tpl, '登場時効果発動！');
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
        // Evolution check
        if (selectedCardId) {
          const selHand = me.hand.find(c => c.instanceId === selectedCardId);
          if (selHand) {
            const evoTpl = getCard(selHand.cardId);
            if (evoTpl.type === 'Evolution') {
              triggerCutin(evoTpl, '進化召喚！');
              dispatch({ type: 'PLAY_CARD', instanceId: selectedCardId, evolutionTargetId: id });
              setSelectedCardId(null);
              return;
            }
          }
        }

        // Select friendly unit as attacker
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
          const spellTpl = getCard(selHand.cardId);
          if (isTargetValidForSelected('unit', inOppField)) {
            if (spellTpl.type === 'Spell') triggerCutin(spellTpl, '呪文詠唱！');
            dispatch({ type: 'PLAY_CARD', instanceId: selectedCardId, targetId: id });
            setSelectedCardId(null);
          }
          return;
        } else {
          // Attacker attacking opponent unit
          const attacker = me.field.find(u => u.instanceId === selectedCardId);
          if (attacker && isValidAttackTarget(state, attacker.instanceId, id)) {
            performAttackAnimation(selectedCardId, id);
            setSelectedCardId(null);
            return;
          }
        }
        return;
      }
    }
  };

  const handlePlayHandCard = (instanceId: string) => {
    const cardInst = me.hand.find(c => c.instanceId === instanceId);
    if (cardInst) {
      const tpl = getCard(cardInst.cardId);
      if (tpl.type === 'Spell' && tpl.targetReq) {
        handleCardClick(instanceId, { stopPropagation: () => {} } as any);
        return;
      }
      if (tpl.type === 'Evolution') {
        setSelectedCardId(instanceId);
        return;
      }
      if (tpl.type === 'Unit') {
        setSummonRippleSlot({ isOpponent: false, slotIdx: me.field.length });
        setTimeout(() => setSummonRippleSlot(null), 800);
        if (tpl.effectText && (tpl.keywords?.includes('Rush') || tpl.effectText.includes('登場時'))) {
          triggerCutin(tpl, '登場時効果発動！');
        }
      } else if (tpl.type === 'Spell') {
        triggerCutin(tpl, '呪文詠唱！');
      }
    }
    dispatch({ type: 'PLAY_CARD', instanceId });
    setSelectedCardId(null);
  };

  const handlePlaceHandArcana = (instanceId: string) => {
    dispatch({ type: 'PLACE_ARCANA', instanceId });
    setSelectedCardId(null);
    setArcanaMode(false);
  };

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
    if (state.prompt?.type === 'GUARD') {
      dispatch({ type: 'RESOLVE_GUARD', guarderId: apply ? targetId : undefined });
    } else {
      dispatch({ type: 'RESOLVE_TRIGGER', apply, targetId });
    }
  };

  return (
    <div
      id="gameboard-root"
      className="fixed inset-0 w-screen h-screen overflow-hidden bg-slate-950 flex items-center justify-center select-none"
      onClick={handleBoardClick}
    >
      {/* Auto-Fit Scaled Canvas: strictly 880px x 390px (iPhone 13 Landscape viewport) */}
      <div
        id="gameboard-canvas"
        style={{
          width: '880px',
          height: '390px',
          transform: `scale(${scale})`,
          transformOrigin: 'center center',
          ...currentTheme.bgStyle,
        }}
        className={`relative shrink-0 overflow-hidden flex flex-col justify-between text-slate-100 font-sans shadow-2xl transition-colors duration-500 ${
          isScreenShaking ? 'animate-screen-shake' : ''
        }`}
      >
        {/* Ambient Glow */}
        <div
          className="absolute inset-0 pointer-events-none flex items-center justify-center opacity-25"
          style={{ boxShadow: `inset 0 0 120px ${currentTheme.ambientGlow}` }}
        >
          <div className="w-[420px] h-[300px] rounded-full border border-white/5" />
        </div>

        {/* ========================================================================= */}
        {/* HEADER BAR (Height ~28px): Turn info & Drawer toggles                    */}
        {/* ========================================================================= */}
        <div className="h-[28px] w-full px-3 flex items-center justify-between z-30 pointer-events-auto bg-black/40 border-b border-white/10 shrink-0">
          <div className="flex items-center space-x-2">
            <span className="font-black text-[11px] tracking-wider text-amber-300">
              SCRIPTIA <span className="text-[9px] text-slate-400 font-normal">v0.07</span>
            </span>
            <div className="h-3 w-px bg-white/20" />
            <span className="text-[10px] font-bold text-slate-300">
              TURN {state.turnCount} : {isMyTurn ? 'あなたのターン' : '相手のターン'}
            </span>
            <span className={`text-[9px] font-black px-1.5 py-0.2 rounded-full ${
              state.phase === 'ARCANA_PLACEMENT' ? 'bg-cyan-950 text-cyan-300 border border-cyan-500/50' : 'bg-amber-950 text-amber-300 border border-amber-500/50'
            }`}>
              {state.phase === 'ARCANA_PLACEMENT' ? 'アルカナ配置' : 'メイン行動'}
            </span>
          </div>

          {/* Opponent Hand Mini Preview */}
          <div className="flex items-center -space-x-1.5">
            {opp.hand.map(c => (
              <div key={c.instanceId} className="w-5 h-6 rounded bg-slate-800 border border-white/20 shadow-sm" />
            ))}
            <span className="text-[9px] font-mono font-bold text-slate-400 ml-2">手札 {opp.hand.length}枚</span>
          </div>

          {/* Header Controls */}
          <div className="flex items-center space-x-1.5">
            <button
              id="theme-toggle-btn"
              onClick={() => setShowPlaymatSelector(true)}
              className="p-1 rounded bg-slate-900/80 hover:bg-slate-800 border border-slate-700 text-slate-300 hover:text-white transition-all text-[10px]"
              title="プレイマット変更"
            >
              <Palette size={12} />
            </button>
            <button
              id="log-toggle-btn"
              onClick={() => setShowLog(!showLog)}
              className="flex items-center space-x-1 px-1.5 py-0.5 rounded bg-slate-900/80 hover:bg-slate-800 border border-slate-700 text-slate-300 hover:text-white text-[10px] font-bold transition-all"
              title="戦闘ログを表示"
            >
              <History size={11} className="text-amber-400" />
              <span>LOG</span>
            </button>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* MAIN 3-PARTITION ARENA (Height ~252px)                                    */}
        {/* ========================================================================= */}
        <div className="flex-1 w-full px-2 flex items-center justify-between z-10 pointer-events-auto relative">
          
          {/* ----------------------------------------------------------------------- */}
          {/* PARTITION 1 (LEFT): Player Side (Vertical Barrier, Domain, 2 Runes)     */}
          {/* ----------------------------------------------------------------------- */}
          <div
            id="left-player-side"
            className="w-[84px] h-[240px] flex flex-col items-center justify-between p-1 bg-black/40 backdrop-blur-sm rounded-xl border border-cyan-500/30 shrink-0 shadow-lg"
          >
            {/* Player Label */}
            <div className="flex items-center space-x-1">
              <div className="w-4 h-4 rounded-full bg-cyan-700 border border-cyan-300 flex items-center justify-center">
                <span className="text-[7.5px] font-black text-cyan-100">YOU</span>
              </div>
              <span className="text-[8.5px] font-black text-cyan-300">結界</span>
            </div>

            {/* Vertical Barrier Plates (Player 1) */}
            <BarrierPlates
              count={me.barrier}
              max={5}
              orientation="vertical"
              isOpponent={false}
            />

            {/* Socket Divider */}
            <div className="w-full h-px bg-cyan-500/20 my-0.5" />

            {/* Player Domain (1 Slot) */}
            <div className="flex flex-col items-center">
              <span className="text-[6.5px] font-black text-slate-400 uppercase tracking-tighter mb-0.5">DOMAIN</span>
              {me.domain ? (
                <div className="w-[36px] h-[26px]">
                  <CardView instance={me.domain} size="compact" onInspect={() => onInspect(getCard(me.domain!.cardId))} />
                </div>
              ) : (
                <div className="w-[36px] h-[26px] border border-dashed border-cyan-500/30 rounded flex items-center justify-center text-[7px] text-cyan-300/40">空</div>
              )}
            </div>

            {/* Player Runes (2 Sockets) */}
            <div className="flex flex-col items-center space-y-1">
              <span className="text-[6.5px] font-black text-slate-400 uppercase tracking-tighter">RUNES</span>
              <div className="flex space-x-1">
                {me.runes[0] ? (
                  <div className="w-[32px] h-[24px]">
                    <CardView isFaceDown size="compact" onClick={(e) => handleCardClick(me.runes[0].instanceId, e)} />
                  </div>
                ) : (
                  <div className="w-[32px] h-[24px] border border-dashed border-white/20 rounded flex items-center justify-center text-[6.5px] text-white/30">1</div>
                )}
                {me.runes[1] ? (
                  <div className="w-[32px] h-[24px]">
                    <CardView isFaceDown size="compact" onClick={(e) => handleCardClick(me.runes[1].instanceId, e)} />
                  </div>
                ) : (
                  <div className="w-[32px] h-[24px] border border-dashed border-white/20 rounded flex items-center justify-center text-[6.5px] text-white/30">2</div>
                )}
              </div>
            </div>
          </div>

          {/* ----------------------------------------------------------------------- */}
          {/* PARTITION 2 (CENTER): Field Arena (Opponent 6 Slots + Player 6 Slots)   */}
          {/* ----------------------------------------------------------------------- */}
          <div
            id="center-arena"
            className="flex-1 h-[246px] flex flex-col justify-between items-center px-1 shrink-0 relative"
          >
            {/* Guide Banner */}
            {selectedCardId && me.hand.some(c => c.instanceId === selectedCardId && getCard(c.cardId).type === 'Spell' && getCard(c.cardId).targetReq) && (
              <div className="absolute top-0.5 z-40 bg-indigo-950/95 border border-cyan-400 px-3 py-0.5 rounded-full shadow-xl text-[9.5px] font-bold text-cyan-200 flex items-center space-x-1 animate-pulse">
                <Zap size={10} className="text-yellow-300" />
                <span>対象のユニットを選択してください</span>
              </div>
            )}
            {selectedCardId && me.field.some(u => u.instanceId === selectedCardId) && (
              <div className="absolute top-0.5 z-40 bg-red-950/95 border border-red-400 px-3 py-0.5 rounded-full shadow-xl text-[9.5px] font-bold text-red-200 flex items-center space-x-1 animate-pulse">
                <Sword size={10} className="text-yellow-300" />
                <span>攻撃対象（相手のレストユニット または 右側結界ゲージ）を選択</span>
              </div>
            )}

            {/* UPPER ROW: Opponent Field (6 Slots: w-[72px] h-[96px]) */}
            <div id="opponent-field-row" className="w-full flex items-center justify-center space-x-2">
              {Array.from({ length: 6 }).map((_, slotIdx) => {
                const unit = opp.field[slotIdx];
                const stats = unit ? calculateUnitStats(state, 'player2', unit) : null;
                const isTarget = unit ? isTargetValidForSelected('unit', unit) : false;
                const isAttacking = unit && activeAttackerId === unit.instanceId;
                const hasRipple = summonRippleSlot?.isOpponent && summonRippleSlot.slotIdx === slotIdx;

                return (
                  <div
                    key={unit ? unit.instanceId : `opp-slot-${slotIdx}`}
                    id={`opp-slot-${slotIdx}`}
                    className={`relative w-[72px] h-[96px] rounded-lg flex items-center justify-center shrink-0 transition-all ${
                      unit
                        ? 'overflow-visible'
                        : 'border border-dashed border-white/20 bg-black/30'
                    } ${
                      isTarget
                        ? 'ring-2 ring-yellow-400 shadow-lg shadow-yellow-400/60 cursor-pointer animate-pulse z-30'
                        : ''
                    } ${isAttacking ? 'animate-attack-dash z-40' : ''}`}
                    onClick={(e) => unit && handleCardClick(unit.instanceId, e)}
                  >
                    {hasRipple && (
                      <div className="absolute inset-0 rounded-lg border-2 border-red-400 animate-summon-ripple pointer-events-none z-30" />
                    )}

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
                      <span className="text-[9px] font-black text-white/15 select-none">{slotIdx + 1}</span>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Sleek Battle Arena Divider */}
            <div className="w-full max-w-lg flex items-center justify-center h-[14px] opacity-70">
              <div className="flex-1 h-px bg-gradient-to-r from-transparent via-amber-400/50 to-transparent" />
              <div className="mx-2 px-2 py-0.2 rounded-full border border-amber-400/40 bg-black/80 flex items-center space-x-1 shadow">
                <Sword size={9} className="text-amber-400" />
                <span className="text-[7.5px] font-black tracking-widest text-amber-300 uppercase">
                  ARENA
                </span>
              </div>
              <div className="flex-1 h-px bg-gradient-to-l from-transparent via-amber-400/50 to-transparent" />
            </div>

            {/* LOWER ROW: Player Field (6 Slots: w-[72px] h-[96px]) */}
            <div id="player-field-row" className="w-full flex items-center justify-center space-x-2">
              {Array.from({ length: 6 }).map((_, slotIdx) => {
                const unit = me.field[slotIdx];
                const stats = unit ? calculateUnitStats(state, 'player1', unit) : null;
                const isSelected = unit && selectedCardId === unit.instanceId;
                const isAttackerReady = unit && isMyTurn && state.phase === 'ACTION' && !unit.isRested && !unit.hasSummoningSickness;
                const isAttacking = unit && activeAttackerId === unit.instanceId;
                const hasRipple = !summonRippleSlot?.isOpponent && summonRippleSlot?.slotIdx === slotIdx;

                return (
                  <div
                    key={unit ? unit.instanceId : `me-slot-${slotIdx}`}
                    id={`me-slot-${slotIdx}`}
                    onClick={(e) => {
                      if (unit) {
                        handleCardClick(unit.instanceId, e);
                      } else if (isSelectedHandPlayable && selectedHandCard) {
                        handlePlayHandCard(selectedHandCard.instanceId);
                      }
                    }}
                    className={`relative w-[72px] h-[96px] rounded-lg flex items-center justify-center shrink-0 transition-all ${
                      unit
                        ? 'overflow-visible'
                        : isSelectedHandPlayable
                          ? 'border-2 border-dashed border-emerald-400/90 bg-emerald-950/40 cursor-pointer shadow-lg shadow-emerald-500/40 animate-pulse'
                          : 'border border-dashed border-white/20 bg-black/30'
                    } ${isAttacking ? 'animate-attack-dash z-40' : ''}`}
                  >
                    {hasRipple && (
                      <div className="absolute inset-0 rounded-lg border-2 border-cyan-300 animate-summon-ripple pointer-events-none z-30" />
                    )}

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
                      <span className={`text-[9px] font-black select-none ${
                        isSelectedHandPlayable ? 'text-emerald-300 font-bold animate-pulse' : 'text-white/15'
                      }`}>
                        {isSelectedHandPlayable ? '召喚' : slotIdx + 1}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* ----------------------------------------------------------------------- */}
          {/* PARTITION 3 (RIGHT): Opponent Side (Vertical Barrier, Domain, 2 Runes)  */}
          {/* ----------------------------------------------------------------------- */}
          <div
            id="right-opponent-side"
            className={`w-[84px] h-[240px] flex flex-col items-center justify-between p-1 bg-black/40 backdrop-blur-sm rounded-xl border transition-all shrink-0 shadow-lg ${
              canDirectAttack
                ? 'border-yellow-400 ring-2 ring-yellow-400 animate-pulse cursor-pointer shadow-yellow-400/50'
                : 'border-yellow-500/30'
            }`}
            onClick={handleOpponentDirectAttack}
            title={canDirectAttack ? '相手の結界を直接攻撃！' : '相手結界エリア'}
          >
            {/* Opponent Label / Direct Attack Trigger */}
            <div className="flex items-center space-x-1 cursor-pointer">
              <div className="w-4 h-4 rounded-full bg-red-700 border border-yellow-300 flex items-center justify-center">
                <span className="text-[7.5px] font-black text-yellow-100">OPP</span>
              </div>
              <span className={`text-[8.5px] font-black ${canDirectAttack ? 'text-yellow-300 font-black animate-pulse' : 'text-yellow-400/80'}`}>
                {canDirectAttack ? '直接攻撃' : '結界'}
              </span>
            </div>

            {/* Vertical Barrier Plates (Opponent) */}
            <BarrierPlates
              count={opp.barrier}
              max={5}
              orientation="vertical"
              isOpponent
              isTargetable={canDirectAttack}
              onClick={handleOpponentDirectAttack}
            />

            {/* Socket Divider */}
            <div className="w-full h-px bg-yellow-500/20 my-0.5" />

            {/* Opponent Domain (1 Slot) */}
            <div className="flex flex-col items-center">
              <span className="text-[6.5px] font-black text-slate-400 uppercase tracking-tighter mb-0.5">DOMAIN</span>
              {opp.domain ? (
                <div className="w-[36px] h-[26px]">
                  <CardView instance={opp.domain} size="compact" onInspect={() => onInspect(getCard(opp.domain!.cardId))} />
                </div>
              ) : (
                <div className="w-[36px] h-[26px] border border-dashed border-yellow-500/30 rounded flex items-center justify-center text-[7px] text-yellow-300/40">無</div>
              )}
            </div>

            {/* Opponent Runes (2 Sockets) */}
            <div className="flex flex-col items-center space-y-1">
              <span className="text-[6.5px] font-black text-slate-400 uppercase tracking-tighter">RUNES</span>
              <div className="flex space-x-1">
                {opp.runes[0] ? (
                  <div className="w-[32px] h-[24px]">
                    <CardView isFaceDown size="compact" onClick={(e) => handleCardClick(opp.runes[0].instanceId, e)} />
                  </div>
                ) : (
                  <div className="w-[32px] h-[24px] border border-dashed border-white/20 rounded flex items-center justify-center text-[6.5px] text-white/30">1</div>
                )}
                {opp.runes[1] ? (
                  <div className="w-[32px] h-[24px]">
                    <CardView isFaceDown size="compact" onClick={(e) => handleCardClick(opp.runes[1].instanceId, e)} />
                  </div>
                ) : (
                  <div className="w-[32px] h-[24px] border border-dashed border-white/20 rounded flex items-center justify-center text-[6.5px] text-white/30">2</div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* BOTTOM DOCK (Height ~106px): Arcana Gauge, Hand Tray, Turn Controls       */}
        {/* ========================================================================= */}
        <div
          id="bottom-dock"
          className="h-[106px] w-full px-2 flex items-center justify-between z-30 pointer-events-none shrink-0 relative bg-black/40 border-t border-white/10"
        >
          {/* Bottom-Left: Arcana Gauge & Deck/Archive Buttons */}
          <div className="pointer-events-auto shrink-0 flex items-center space-x-2">
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

            {/* Quick Opponent Zone Checker */}
            <div className="flex flex-col space-y-1">
              <button
                id="opp-arcana-btn"
                onClick={() =>
                  setZoneModal({
                    isOpen: true,
                    title: '相手のアルカナゾーン',
                    zoneType: 'arcana',
                    cards: opp.arcana,
                    isOpponent: true,
                  })
                }
                className="px-1.5 py-0.5 rounded bg-slate-900/80 hover:bg-slate-800 border border-slate-700 text-[8.5px] font-bold text-slate-300"
              >
                敵アルカナ({opp.arcana.length})
              </button>
              <button
                id="opp-archive-btn"
                onClick={() =>
                  setZoneModal({
                    isOpen: true,
                    title: '相手のアーカイブ(墓地)',
                    zoneType: 'archive',
                    cards: opp.archive,
                    isOpponent: true,
                  })
                }
                className="px-1.5 py-0.5 rounded bg-slate-900/80 hover:bg-slate-800 border border-slate-700 text-[8.5px] font-bold text-slate-300"
              >
                敵アーカイブ({opp.archive.length})
              </button>
            </div>
          </div>

          {/* Bottom-Center: Hand Tray */}
          <div className="flex-1 max-w-xl mx-2 flex justify-center items-end h-full pointer-events-auto">
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

          {/* Bottom-Right: Turn End Button & Phase Action Controls */}
          <div className="pointer-events-auto shrink-0">
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

        {/* ======================================================================= */}
        {/* COMBAT LOG SLIDE-IN DRAWER (RIGHT)                                     */}
        {/* ======================================================================= */}
        {showLog && (
          <div
            id="battle-log-drawer"
            className="absolute top-0 right-0 bottom-0 w-72 max-w-[80vw] bg-slate-950/95 border-l border-slate-700/80 backdrop-blur-md shadow-2xl z-50 flex flex-col animate-in slide-in-from-right duration-200"
          >
            <div className="flex items-center justify-between px-3 py-2 border-b border-slate-800 bg-slate-900/60">
              <div className="flex items-center space-x-1.5">
                <History size={13} className="text-amber-400" />
                <span className="font-black text-[11px] text-white tracking-wider">BATTLE LOG</span>
              </div>
              <button
                onClick={() => setShowLog(false)}
                className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800"
              >
                <X size={14} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-1 font-mono text-[10px]">
              {state.log.length === 0 ? (
                <div className="text-slate-500 text-center py-6">まだ記録がありません</div>
              ) : (
                state.log.map((entry, idx) => (
                  <div
                    key={idx}
                    className="p-1 rounded bg-slate-900/60 border border-slate-800/80 text-slate-300 leading-tight"
                  >
                    {entry}
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* ======================================================================= */}
        {/* EFFECT ACTIVATION POPUP CUT-IN                                         */}
        {/* ======================================================================= */}
        {cutinCard && (
          <div className="absolute inset-0 pointer-events-none z-50 flex items-center justify-center animate-cutin-pop">
            <div className="flex flex-col items-center bg-slate-950/90 border-2 border-yellow-400 p-2.5 rounded-2xl shadow-[0_0_40px_rgba(250,204,21,0.8)] backdrop-blur-md">
              <div className="flex items-center space-x-1 bg-gradient-to-r from-amber-500 to-yellow-400 text-slate-950 px-2.5 py-0.5 rounded-full font-black text-[10px] shadow mb-1.5">
                <Sparkles size={11} />
                <span>{cutinCard.title}</span>
              </div>
              <CardView
                instance={{ instanceId: 'cutin', cardId: cutinCard.card.id }}
                size="hand"
                className="scale-100 pointer-events-none"
              />
            </div>
          </div>
        )}

        {/* ======================================================================= */}
        {/* TRIGGER & GUARD PROMPT / RUNE TRIGGER CONFIRMATION MODAL               */}
        {/* ======================================================================= */}
        {state.prompt && (
          <div className="absolute inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div
              className={`border-2 rounded-2xl p-4 max-w-xs w-full text-center shadow-2xl animate-in zoom-in-95 ${
                state.prompt.type === 'RUNE_TRIGGER'
                  ? 'bg-gradient-to-b from-indigo-950 via-slate-900 to-black border-purple-400 shadow-[0_0_35px_rgba(168,85,247,0.7)]'
                  : 'bg-slate-900 border-yellow-500/80'
              }`}
            >
              <h3 className="text-sm font-black mb-1.5 flex items-center justify-center space-x-1">
                {state.prompt.type === 'RUNE_TRIGGER' ? (
                  <span className="text-purple-300 flex items-center space-x-1">
                    <Zap size={14} className="text-yellow-400 fill-yellow-400 animate-bounce" />
                    <span>⚡ RUNE TRIGGER! ⚡</span>
                  </span>
                ) : state.prompt.type === 'GUARD' ? (
                  <span className="text-yellow-400">【ガード宣言】</span>
                ) : (
                  <span className="text-yellow-400">【効果発動の確認】</span>
                )}
              </h3>

              <p className="text-[11px] text-slate-200 mb-3">{state.prompt.text || state.prompt.message}</p>

              {state.prompt.type === 'GUARD' ? (
                <div className="flex flex-col space-y-2">
                  <div className="grid grid-cols-2 gap-1.5">
                    {me.field
                      .filter(u => canUnitGuard(u))
                      .map(u => (
                        <button
                          key={u.instanceId}
                          onClick={() => handlePrompt(true, u.instanceId)}
                          className="bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-bold py-1.5 px-2 rounded shadow flex items-center justify-center space-x-1"
                        >
                          <Shield size={11} />
                          <span className="truncate">{getCard(u.cards[0].cardId).name}</span>
                        </button>
                      ))}
                  </div>
                  <button
                    onClick={() => handlePrompt(false)}
                    className="bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-bold py-1.5 px-3 rounded"
                  >
                    ガードしない
                  </button>
                </div>
              ) : (
                <div className="flex justify-center space-x-2">
                  <button
                    onClick={() => handlePrompt(true)}
                    className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:brightness-110 text-white text-[11px] font-bold py-1.5 px-4 rounded-full shadow ring-1 ring-purple-300"
                  >
                    発動する
                  </button>
                  <button
                    onClick={() => handlePrompt(false)}
                    className="bg-slate-800 hover:bg-slate-700 text-slate-300 text-[11px] font-bold py-1.5 px-4 rounded-full"
                  >
                    キャンセル
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ======================================================================= */}
        {/* GAME OVER SCREEN                                                       */}
        {/* ======================================================================= */}
        {state.winner && (
          <div className="absolute inset-0 bg-black/90 z-[100] flex flex-col items-center justify-center p-4">
            <h1 className="text-4xl sm:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-b from-yellow-300 to-yellow-600 mb-4 drop-shadow-[0_0_30px_rgba(250,204,21,0.5)]">
              {state.winner === 'player1' ? 'VICTORY' : 'DEFEAT'}
            </h1>
            <button
              onClick={() => dispatch({ type: 'START_GAME' })}
              className="bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 font-black py-2 px-6 rounded-full shadow-xl text-xs"
            >
              もう一度プレイする
            </button>
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* MODALS: ZONE VIEWER & PLAYMAT SELECTOR                                     */}
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
