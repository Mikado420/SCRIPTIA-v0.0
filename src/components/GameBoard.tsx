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
import { History, X, Shield, Sparkles, Sword, Zap, Palette, User, Menu, BookOpen } from 'lucide-react';

interface Props {
  state: GameState;
  dispatch: React.Dispatch<GameAction>;
  onInspect: (card: any) => void;
}

export const GameBoard: React.FC<Props> = ({ state, dispatch, onInspect }) => {
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [arcanaMode, setArcanaMode] = useState(false);
  const [showLog, setShowLog] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

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

  // Auto-fit scaler for iPhone 13 Landscape: 844px x 390px
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const updateScale = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      const nextScale = Math.min(w / 844, h / 390);
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
      {/* Auto-Fit Scaled Canvas: strictly 844px x 390px (iPhone 13 Landscape viewport) */}
      <div
        id="gameboard-canvas"
        style={{
          width: '844px',
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
        {/* 1. TOP FLOATING CONTROLS: Left Menu & Center Opponent Info / Shield Badge */}
        {/* ========================================================================= */}

        {/* Top-Left: Hamburger Menu Button & SCRIPTIA Logo */}
        <div className="absolute top-2 left-2.5 z-40 flex items-center space-x-2 pointer-events-auto">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setShowMenu(!showMenu);
            }}
            className="w-7 h-7 rounded-lg bg-black/60 hover:bg-black/90 border border-white/20 hover:border-cyan-400 flex items-center justify-center text-slate-200 hover:text-white transition-all shadow-md active:scale-95 cursor-pointer backdrop-blur-sm"
            title="メニューを開く"
          >
            <Menu size={15} />
          </button>
          <div className="flex items-baseline space-x-1 select-none">
            <span className="font-black text-[12px] tracking-wider bg-gradient-to-r from-amber-300 via-yellow-200 to-cyan-300 bg-clip-text text-transparent drop-shadow">
              SCRIPTIA
            </span>
            <span className="text-[8px] font-mono text-cyan-400/80 font-bold">
              T{state.turnCount}
            </span>
          </div>
        </div>

        {/* Top-Center: Floating Opponent Status Panel & Opponent Shield Badge */}
        <div className="absolute top-1.5 left-1/2 -translate-x-1/2 z-40 pointer-events-auto select-none">
          <div className="flex items-center space-x-2 bg-slate-950/80 backdrop-blur-md px-2.5 py-1 rounded-full border border-red-500/40 shadow-xl">
            {/* Opponent Avatar & Label */}
            <div className="flex items-center space-x-1.5 pr-1 border-r border-white/10">
              <div className="w-5 h-5 rounded-full bg-gradient-to-br from-red-700 to-indigo-900 border border-amber-300 flex items-center justify-center shadow">
                <User size={11} className="text-yellow-200" />
              </div>
              <span className="text-[9px] font-black tracking-tight text-slate-200">OPPONENT</span>
            </div>

            {/* Quick Counters: Deck, Hand, Graveyard */}
            <div className="flex items-center space-x-1.5 text-[8.5px] font-mono text-slate-300">
              {/* Deck */}
              <div className="flex items-center space-x-0.5 bg-black/40 px-1.5 py-0.5 rounded border border-white/10" title="相手山札">
                <span className="text-amber-400 font-bold">山</span>
                <span>{opp.deck.length}</span>
              </div>
              {/* Hand */}
              <div className="flex items-center space-x-0.5 bg-black/40 px-1.5 py-0.5 rounded border border-white/10" title="相手手札">
                <span className="text-cyan-400 font-bold">手</span>
                <span>{opp.hand.length}</span>
              </div>
              {/* Graveyard (Clickable) */}
              <button
                type="button"
                onClick={() =>
                  setZoneModal({
                    isOpen: true,
                    title: '相手のアーカイブ(墓地)',
                    zoneType: 'archive',
                    cards: opp.archive,
                    isOpponent: true,
                  })
                }
                className="flex items-center space-x-0.5 bg-purple-950/60 hover:bg-purple-900/80 px-1.5 py-0.5 rounded border border-purple-500/40 text-purple-200 cursor-pointer active:scale-95"
                title="相手のアーカイブ(墓地)を確認"
              >
                <span className="text-purple-400 font-bold">墓</span>
                <span>{opp.archive.length}</span>
              </button>
            </div>

            {/* Opponent Mana / Arcana Quick Pill */}
            <div className="pl-1 border-l border-white/10">
              <ArcanaGauge
                current={opp.currentArcana}
                max={opp.maxArcana}
                arcanaCards={opp.arcana}
                onOpenArcana={() =>
                  setZoneModal({
                    isOpen: true,
                    title: '相手のアルカナゾーン',
                    zoneType: 'arcana',
                    cards: opp.arcana,
                    isOpponent: true,
                  })
                }
                isOpponent
              />
            </div>

            {/* OPPONENT SHIELD (BARRIER) BADGE - Duel Masters Style */}
            <button
              type="button"
              onClick={handleOpponentDirectAttack}
              className={`flex items-center space-x-1 px-2 py-0.5 rounded-full border transition-all select-none shadow-md ${
                canDirectAttack
                  ? 'bg-gradient-to-r from-amber-400 to-yellow-300 text-slate-950 border-yellow-100 ring-2 ring-yellow-400 animate-pulse shadow-[0_0_16px_rgba(250,204,21,1)] cursor-pointer active:scale-95'
                  : 'bg-gradient-to-r from-red-950 to-slate-900 border-red-500/40 text-red-200'
              }`}
              title={canDirectAttack ? '相手の結界を直接攻撃！' : `相手結界シールド: ${opp.barrier}/5`}
            >
              <Shield size={12} className={canDirectAttack ? 'fill-current text-slate-950 stroke-[2]' : 'fill-red-500/40 text-red-400'} />
              <span className="font-mono font-black text-[10.5px] leading-none">
                {opp.barrier}
              </span>
              {canDirectAttack && (
                <span className="text-[7.5px] font-black tracking-tighter uppercase px-1 py-0.2 bg-slate-950 text-yellow-300 rounded">
                  ATTACK!
                </span>
              )}
            </button>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* 2. LEFT CYBER SLOTS: Domain & Runes (Transparent Floating Hex-Frames)     */}
        {/* ========================================================================= */}

        {/* Top-Left: Opponent Domain & Runes */}
        <div className="absolute top-11 left-2 z-20 flex flex-col space-y-1.5 pointer-events-auto select-none">
          {/* Opponent Domain */}
          <div className="flex flex-col items-center">
            <span className="text-[6px] font-black text-amber-400/80 uppercase tracking-tighter mb-0.5">DOMAIN</span>
            {opp.domain ? (
              <div className="w-[38px] h-[28px] rounded border border-amber-400/60 overflow-hidden shadow">
                <CardView instance={opp.domain} size="compact" onInspect={() => onInspect(getCard(opp.domain!.cardId))} />
              </div>
            ) : (
              <div className="w-[38px] h-[28px] rounded-lg border border-dashed border-amber-400/20 bg-amber-950/10 flex items-center justify-center text-[7px] text-amber-400/30">
                無
              </div>
            )}
          </div>

          {/* Opponent Runes (2 Sockets) */}
          <div className="flex flex-col items-center space-y-0.5">
            <span className="text-[6px] font-black text-slate-400/70 uppercase tracking-tighter">RUNES</span>
            <div className="flex space-x-1">
              {opp.runes[0] ? (
                <div className="w-[22px] h-[26px]">
                  <CardView isFaceDown size="compact" onClick={(e) => handleCardClick(opp.runes[0].instanceId, e)} />
                </div>
              ) : (
                <div className="w-[22px] h-[26px] rounded border border-dashed border-white/20 bg-black/20 flex items-center justify-center text-[6px] text-white/30">1</div>
              )}
              {opp.runes[1] ? (
                <div className="w-[22px] h-[26px]">
                  <CardView isFaceDown size="compact" onClick={(e) => handleCardClick(opp.runes[1].instanceId, e)} />
                </div>
              ) : (
                <div className="w-[22px] h-[26px] rounded border border-dashed border-white/20 bg-black/20 flex items-center justify-center text-[6px] text-white/30">2</div>
              )}
            </div>
          </div>
        </div>

        {/* Bottom-Left: Player Runes & Domain (Right above Mana Orb) */}
        <div className="absolute bottom-22 left-2 z-20 flex flex-col space-y-1.5 pointer-events-auto select-none">
          {/* Player Runes (2 Sockets) */}
          <div className="flex flex-col items-center space-y-0.5">
            <span className="text-[6px] font-black text-cyan-400/80 uppercase tracking-tighter">YOU RUNES</span>
            <div className="flex space-x-1">
              {me.runes[0] ? (
                <div className="w-[22px] h-[26px]">
                  <CardView isFaceDown size="compact" onClick={(e) => handleCardClick(me.runes[0].instanceId, e)} />
                </div>
              ) : (
                <div className="w-[22px] h-[26px] rounded border border-dashed border-cyan-500/30 bg-cyan-950/20 flex items-center justify-center text-[6px] text-cyan-300/30">1</div>
              )}
              {me.runes[1] ? (
                <div className="w-[22px] h-[26px]">
                  <CardView isFaceDown size="compact" onClick={(e) => handleCardClick(me.runes[1].instanceId, e)} />
                </div>
              ) : (
                <div className="w-[22px] h-[26px] rounded border border-dashed border-cyan-500/30 bg-cyan-950/20 flex items-center justify-center text-[6px] text-cyan-300/30">2</div>
              )}
            </div>
          </div>

          {/* Player Domain */}
          <div className="flex flex-col items-center">
            <span className="text-[6px] font-black text-cyan-400 uppercase tracking-tighter mb-0.5">YOU DOMAIN</span>
            {me.domain ? (
              <div className="w-[38px] h-[28px] rounded border border-cyan-400/60 overflow-hidden shadow">
                <CardView instance={me.domain} size="compact" onInspect={() => onInspect(getCard(me.domain!.cardId))} />
              </div>
            ) : (
              <div className="w-[38px] h-[28px] rounded-lg border border-dashed border-cyan-500/20 bg-cyan-950/10 flex items-center justify-center text-[7px] text-cyan-300/30">
                無
              </div>
            )}
          </div>
        </div>

        {/* ========================================================================= */}
        {/* 3. CENTER BATTLEFIELD ARENA: Full-Width 6 vs 6 Unit Slots                 */}
        {/* ========================================================================= */}
        <div
          id="center-arena"
          className="absolute inset-x-12 top-9 bottom-4 flex flex-col justify-between items-center px-2 z-10 pointer-events-auto"
        >
          {/* Guide Banner for Targeted Spells or Combat Attack Target */}
          {selectedCardId && me.hand.some(c => c.instanceId === selectedCardId && getCard(c.cardId).type === 'Spell' && getCard(c.cardId).targetReq) && (
            <div className="absolute top-1 z-50 bg-indigo-950/95 border border-cyan-400 px-3 py-0.5 rounded-full shadow-xl text-[9px] font-bold text-cyan-200 flex items-center space-x-1 animate-pulse">
              <Zap size={10} className="text-yellow-300" />
              <span>対象のユニットを選択してください</span>
            </div>
          )}
          {selectedCardId && me.field.some(u => u.instanceId === selectedCardId) && (
            <div className="absolute top-1 z-50 bg-red-950/95 border border-yellow-400 px-3 py-0.5 rounded-full shadow-xl text-[9px] font-bold text-yellow-200 flex items-center space-x-1 animate-pulse">
              <Sword size={10} className="text-yellow-300" />
              <span>攻撃対象（相手のレストユニット または 上部結界シールド）を選択</span>
            </div>
          )}

          {/* UPPER ROW: Opponent Field (6 Slots: w-[68px] h-[90px]) */}
          <div id="opponent-field-row" className="w-full flex items-center justify-center space-x-2 pt-1">
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
                  className={`relative w-[68px] h-[90px] rounded-lg flex items-center justify-center shrink-0 transition-all ${
                    unit
                      ? 'overflow-visible'
                      : 'border border-cyan-500/20 bg-cyan-950/20 shadow-inner'
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
                    <div className="w-1.5 h-1.5 rounded-full bg-cyan-400/20" />
                  )}
                </div>
              );
            })}
          </div>

          {/* Center Arena Battle Divider Line (Glowing Cyber Line) */}
          <div className="w-full max-w-md flex items-center justify-center h-[12px] opacity-80 my-0.5">
            <div className="flex-1 h-px bg-gradient-to-r from-transparent via-amber-400/60 to-transparent" />
            <div className="mx-2 px-2 py-0.2 rounded-full border border-amber-400/40 bg-black/80 flex items-center space-x-1 shadow">
              <Sword size={8} className="text-amber-400" />
              <span className="text-[7px] font-black tracking-widest text-amber-300 uppercase">
                BATTLE ARENA
              </span>
            </div>
            <div className="flex-1 h-px bg-gradient-to-l from-transparent via-amber-400/60 to-transparent" />
          </div>

          {/* LOWER ROW: Player Field (6 Slots: w-[68px] h-[90px]) */}
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
                  className={`relative w-[68px] h-[90px] rounded-lg flex items-center justify-center shrink-0 transition-all ${
                    unit
                      ? 'overflow-visible'
                      : isSelectedHandPlayable
                        ? 'border-2 border-emerald-400 bg-emerald-950/40 cursor-pointer shadow-lg shadow-emerald-500/40 animate-pulse'
                        : 'border border-cyan-500/20 bg-cyan-950/20 shadow-inner'
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
                    <div className="flex flex-col items-center justify-center pointer-events-none">
                      {isSelectedHandPlayable ? (
                        <span className="text-[9px] font-black text-emerald-300 animate-pulse">召喚</span>
                      ) : (
                        <div className="w-1.5 h-1.5 rounded-full bg-cyan-400/20" />
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Subtle Horizontal Shield Plates on Ground in front of Player (5 Plates, Duel Masters style) */}
          <div className="w-full flex items-center justify-center space-x-1.5 mt-0.5 opacity-80 pointer-events-none">
            {Array.from({ length: 5 }).map((_, idx) => {
              const active = idx < me.barrier;
              return (
                <div
                  key={idx}
                  className={`h-1 rounded-full transition-all ${
                    active
                      ? 'w-6 bg-cyan-400 shadow-[0_0_6px_rgba(34,211,238,0.9)]'
                      : 'w-4 bg-slate-800 opacity-30'
                  }`}
                />
              );
            })}
          </div>
        </div>

        {/* ========================================================================= */}
        {/* 4. BOTTOM-LEFT: Circular Mana Zone (Arcana Orb) & Player Shield Badge     */}
        {/* ========================================================================= */}
        <div className="absolute bottom-2 left-2 z-40 flex items-center space-x-2 pointer-events-auto">
          {/* 72px 3D Arcana Orb */}
          <ArcanaGauge
            current={me.currentArcana}
            max={me.maxArcana}
            arcanaCards={me.arcana}
            onOpenArcana={() =>
              setZoneModal({
                isOpen: true,
                title: '自分のアルカナゾーン',
                zoneType: 'arcana',
                cards: me.arcana,
                isOpponent: false,
              })
            }
          />

          {/* Player Shield Badge (Duel Masters Blue Shield Plate) */}
          <div
            className="flex items-center space-x-1.5 bg-slate-950/85 backdrop-blur-md px-2.5 py-1.5 rounded-2xl border-2 border-cyan-400/70 shadow-[0_0_15px_rgba(6,182,212,0.4)] select-none"
            title={`自軍結界シールド: ${me.barrier}/5`}
          >
            <div className="w-5 h-5 rounded-full bg-gradient-to-br from-blue-600 to-indigo-900 border border-cyan-300 flex items-center justify-center shadow">
              <Shield size={11} className="fill-cyan-400 text-cyan-200" />
            </div>
            <div className="flex flex-col items-start leading-none">
              <span className="text-[6.5px] font-black text-cyan-300 tracking-wider uppercase">
                SHIELD
              </span>
              <span className="font-mono font-black text-sm text-white drop-shadow-[0_0_6px_rgba(56,189,248,0.9)]">
                {me.barrier}
              </span>
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* 5. RIGHT CONTROLS: 3D Turn End Button, Layered Deck & Graveyard (Middle)  */}
        {/* ========================================================================= */}
        <div className="absolute bottom-[96px] right-2 z-40 pointer-events-auto">
          <ActionControls
            phase={state.phase}
            turnCount={state.turnCount}
            isMyTurn={isMyTurn}
            hasPlacedArcanaThisTurn={state.flags.hasPlacedArcanaThisTurn}
            hasPrompt={!!state.prompt}
            selectedCardId={selectedCardId}
            isHandSelected={!!selectedCardId && me.hand.some(c => c.instanceId === selectedCardId)}
            deckCount={me.deck.length}
            archiveCount={me.archive.length}
            onNextPhase={() => {
              dispatch({ type: 'NEXT_PHASE' });
              setArcanaMode(false);
              setSelectedCardId(null);
            }}
            onArcanaCharge={handleArcanaChargeBtn}
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

        {/* ========================================================================= */}
        {/* 6. BOTTOM-RIGHT: Hand Tray (Right-Aligned Fan Overlap)                    */}
        {/* ========================================================================= */}
        <div className="absolute bottom-1 right-2 z-30 pointer-events-auto">
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

        {/* ========================================================================= */}
        {/* 7. HAMBURGER MENU DRAWER / MODAL                                          */}
        {/* ========================================================================= */}
        {showMenu && (
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center animate-in fade-in duration-150"
            onClick={() => setShowMenu(false)}
          >
            <div
              className="w-72 bg-slate-950/95 border-2 border-cyan-500/60 rounded-2xl p-4 shadow-2xl space-y-3 pointer-events-auto"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Menu Title */}
              <div className="flex items-center justify-between border-b border-white/10 pb-2">
                <div className="flex items-center space-x-2">
                  <Menu size={16} className="text-cyan-400" />
                  <span className="font-black text-sm text-white tracking-wider">GAME MENU</span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowMenu(false)}
                  className="p-1 text-slate-400 hover:text-white rounded-full hover:bg-slate-800 cursor-pointer"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Turn & Status Summary */}
              <div className="bg-slate-900/80 p-2.5 rounded-xl border border-white/10 text-xs flex justify-between items-center">
                <span className="text-slate-400 font-bold">現在のターン</span>
                <span className="font-mono font-black text-amber-300">
                  TURN {state.turnCount} ({isMyTurn ? '自軍ターン' : '相手ターン'})
                </span>
              </div>

              {/* Action 1: Battle Log */}
              <button
                type="button"
                onClick={() => {
                  setShowMenu(false);
                  setShowLog(true);
                }}
                className="w-full py-2 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 flex items-center justify-between text-xs font-bold text-slate-200 hover:text-white transition-colors cursor-pointer"
              >
                <div className="flex items-center space-x-2">
                  <History size={14} className="text-amber-400" />
                  <span>戦闘ログ (Battle Log)</span>
                </div>
                <span className="text-[10px] text-slate-400">{state.log.length}件</span>
              </button>

              {/* Action 2: Playmat Theme Selector */}
              <button
                type="button"
                onClick={() => {
                  setShowMenu(false);
                  setShowPlaymatSelector(true);
                }}
                className="w-full py-2 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 flex items-center justify-between text-xs font-bold text-slate-200 hover:text-white transition-colors cursor-pointer"
              >
                <div className="flex items-center space-x-2">
                  <Palette size={14} className="text-cyan-400" />
                  <span>プレイマット変更</span>
                </div>
                <span className="text-[10px] text-cyan-300 font-bold">{currentTheme.name}</span>
              </button>

              {/* Close Button */}
              <button
                type="button"
                onClick={() => setShowMenu(false)}
                className="w-full py-2 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-black text-xs shadow cursor-pointer active:scale-95"
              >
                アリーナへ戻る
              </button>
            </div>
          </div>
        )}

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
