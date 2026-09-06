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
import { History, X, Shield, Sparkles, Sword, Zap, Palette } from 'lucide-react';

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
  const [cutinCard, setCutinCard] = useState<{ card: CardTemplate; title: string; badgeColor?: string } | null>(null);

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

  // Auto-fit scaler state for 1000px x 500px virtual canvas (iPhone 13 Landscape & all viewports)
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const updateScale = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      const nextScale = Math.min(w / 1000, h / 500);
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

  // Track logs to trigger animations for AI or reactive actions
  const prevLogLength = useRef(state.log.length);
  useEffect(() => {
    if (state.log.length > prevLogLength.current) {
      const newestLog = state.log[state.log.length - 1];
      // Check if it's an attack or combat
      if (newestLog.includes('攻撃') || newestLog.includes('戦闘') || newestLog.includes('破壊')) {
        setIsScreenShaking(true);
        const timer = setTimeout(() => setIsScreenShaking(false), 400);
        return () => clearTimeout(timer);
      }
      // Check if spell or special trigger occurred
      if (newestLog.includes('スペル') || newestLog.includes('効果で') || newestLog.includes('発動！')) {
        const match = newestLog.match(/【(.*?)】/);
        if (match) {
          const cardName = match[1];
          const sampleCard = [...me.hand, ...opp.hand, ...me.field.map(u=>u.cards[0]), ...opp.field.map(u=>u.cards[0]), ...me.archive, ...opp.archive]
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
                triggerCutin(tpl, '呪文詠唱！');
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
                triggerCutin(tpl, '登場時効果発動！');
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
        // If an evolution card is currently selected in hand, evolve it onto this unit!
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
          const spellTpl = getCard(selHand.cardId);
          // Spell target validation
          if (isTargetValidForSelected('unit', inOppField)) {
            if (spellTpl.type === 'Spell') triggerCutin(spellTpl, '呪文詠唱！');
            dispatch({ type: 'PLAY_CARD', instanceId: selectedCardId, targetId: id });
            setSelectedCardId(null);
          }
          return;
        } else {
          // Friendly unit attacking opponent unit
          const attacker = me.field.find(u => u.instanceId === selectedCardId);
          if (attacker && !attacker.isRested && !attacker.hasSummoningSickness) {
            const aTpl = getCard(attacker.cards[0].cardId);
            const canAttackActive = aTpl.id === 'BR-09' || aTpl.keywords?.includes('CanAttackActive');
            if (inOppField.isRested || canAttackActive) {
              performAttackAnimation(selectedCardId, id);
              setSelectedCardId(null);
            }
            return;
          }
        }
        return;
      }

      // Opponent Domain or Rune target
      const oppRune = opp.runes.find(c => c.instanceId === id);
      if (oppRune && selectedCardId) {
        const selHand = me.hand.find(c => c.instanceId === selectedCardId);
        if (selHand && getCard(selHand.cardId).id === 'BN-04') {
          dispatch({ type: 'PLAY_CARD', instanceId: selectedCardId, targetId: id });
          setSelectedCardId(null);
        }
        return;
      }

      if (opp.domain?.instanceId === id && selectedCardId) {
        const selHand = me.hand.find(c => c.instanceId === selectedCardId);
        if (selHand && getCard(selHand.cardId).id === 'BN-03') {
          dispatch({ type: 'PLAY_CARD', instanceId: selectedCardId, targetId: id });
          setSelectedCardId(null);
        }
        return;
      }
    }
  };

  // Perform smooth attack animation sequence
  const performAttackAnimation = (attackerId: string, targetId?: string) => {
    setActiveAttackerId(attackerId);

    // Impact timing
    setTimeout(() => {
      setIsScreenShaking(true);
      setTimeout(() => setIsScreenShaking(false), 380);
      setActiveAttackerId(null);

      // Dispatch battle
      dispatch({ type: 'DECLARE_ATTACK', attackerId, targetId });
    }, 220);
  };

  // Direct attack to opponent player
  const handleOpponentDirectAttack = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (isMyTurn && state.phase === 'ACTION' && selectedCardId) {
      const attacker = me.field.find(u => u.instanceId === selectedCardId);
      if (attacker && !attacker.isRested && !attacker.hasSummoningSickness) {
        const aTpl = getCard(attacker.cards[0].cardId);
        if (!aTpl.keywords?.includes('CannotAttackPlayer')) {
          performAttackAnimation(selectedCardId);
          setSelectedCardId(null);
        }
      }
    }
  };

  // Fast summon from hand button
  const handlePlayHandCard = (instanceId: string) => {
    const cardInst = me.hand.find(c => c.instanceId === instanceId);
    if (cardInst) {
      const tpl = getCard(cardInst.cardId);
      if (tpl.type === 'Spell') {
        // Targeted spells require user to tap target
        if (tpl.targetReq) {
          if (tpl.id === 'BW-13') {
            // Sacred prayer (Archive target)
            setZoneModal({
              isOpen: true,
              title: 'アーカイブから回収するユニットを選択',
              zoneType: 'archive',
              cards: me.archive,
              isOpponent: false,
              selectionMode: {
                promptText: '手札に加えるユニットを選択',
                canSelect: (cTpl) => cTpl.type === 'Unit',
                onSelect: (chosenId) => {
                  triggerCutin(tpl, '呪文詠唱！');
                  dispatch({ type: 'PLAY_CARD', instanceId, targetId: chosenId });
                  setSelectedCardId(null);
                },
              },
            });
            return;
          }
          // Unit/Domain/Rune targeted spells: set selection for target picking
          setSelectedCardId(instanceId);
          return;
        } else {
          // Instant non-targeted spells (BR-13, BB-13, BG-12, BD-12)
          triggerCutin(tpl, '呪文詠唱！');
          dispatch({ type: 'PLAY_CARD', instanceId });
          setSelectedCardId(null);
          return;
        }
      } else if (tpl.type === 'Evolution') {
        // Evolution requires selecting base unit
        setSelectedCardId(instanceId);
        return;
      } else if (tpl.type === 'Unit') {
        // Trigger summon ripple in the new slot
        setSummonRippleSlot({ isOpponent: false, slotIdx: me.field.length });
        setTimeout(() => setSummonRippleSlot(null), 850);
        if (tpl.effectText && (tpl.keywords?.includes('Rush') || tpl.effectText.includes('登場時'))) {
          triggerCutin(tpl, '登場時効果発動！');
        }
      }
    }
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

  // Helper to test if a target is valid for currently selected card
  const isTargetValidForSelected = (targetType: 'unit' | 'domain' | 'rune', targetUnit?: UnitState): boolean => {
    if (!selectedCardId) return false;
    const selHand = me.hand.find(c => c.instanceId === selectedCardId);
    if (selHand) {
      const tpl = getCard(selHand.cardId);
      if (targetType === 'unit' && targetUnit) {
        const stats = calculateUnitStats(state, 'player2', targetUnit);
        if (tpl.id === 'BR-12') return stats.def <= 20;
        if (tpl.id === 'BB-12') return getCard(targetUnit.cards[0].cardId).cost <= 5;
        if (tpl.id === 'BG-13') return stats.def <= 60;
        if (tpl.id === 'BW-12' || tpl.id === 'BD-13') return true;
        if (tpl.id === 'BR-08') return stats.def <= 40;
        if (tpl.id === 'BD-11') return stats.def <= 80;
        if (tpl.id === 'BB-09' || tpl.id === 'BW-05') return true;
      }
      if (targetType === 'domain' && tpl.id === 'BN-03') return true;
      if (targetType === 'rune' && tpl.id === 'BN-04') return true;
    } else {
      // Attacker selected
      const attacker = me.field.find(u => u.instanceId === selectedCardId);
      if (attacker && targetType === 'unit' && targetUnit) {
        const aTpl = getCard(attacker.cards[0].cardId);
        const canAttackActive = aTpl.id === 'BR-09' || aTpl.keywords?.includes('CanAttackActive');
        return targetUnit.isRested || canAttackActive;
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
      if (u.isRested || u.hasSummoningSickness) return false;
      const tpl = getCard(u.cards[0].cardId);
      return !tpl.keywords?.includes('CannotAttackPlayer');
    });

  // Check if a summonable unit is selected in hand (to highlight empty field slots)
  const selectedHandCard = selectedCardId ? me.hand.find(c => c.instanceId === selectedCardId) : null;
  const isSelectedHandPlayable =
    selectedHandCard &&
    isMyTurn &&
    state.phase === 'ACTION' &&
    canPlayCard(getCard(selectedHandCard.cardId), me.currentArcana, me.arcana, me.field.length);

  return (
    <div
      className="fixed inset-0 w-screen h-screen overflow-hidden bg-slate-950 flex items-center justify-center select-none"
      onClick={handleBoardClick}
    >
      {/* Auto-Fit Master Scaled Canvas: strictly 1000px x 500px (2:1 aspect ratio) */}
      <div
        style={{
          width: '1000px',
          height: '500px',
          transform: `scale(${scale})`,
          transformOrigin: 'center center',
          ...currentTheme.bgStyle,
        }}
        className={`relative shrink-0 overflow-hidden flex flex-col justify-between text-slate-100 font-sans shadow-2xl transition-colors duration-500 ${
          isScreenShaking ? 'animate-screen-shake' : ''
        }`}
      >
        {/* Center Mystic Sigil Background */}
        <div
          className="absolute inset-0 pointer-events-none flex items-center justify-center opacity-25"
          style={{ boxShadow: `inset 0 0 140px ${currentTheme.ambientGlow}` }}
        >
          <div className="w-[440px] h-[440px] rounded-full border border-white/5 flex items-center justify-center">
            <div className="w-[320px] h-[320px] rounded-full border border-dashed border-white/10" />
          </div>
        </div>

        {/* ========================================================================= */}
        {/* 1. TOP TIER: Opponent Area (Height 80px)                                  */}
        {/* ========================================================================= */}
        <div className="h-[80px] w-full px-4 flex items-center justify-between z-30 pointer-events-none shrink-0 relative border-b border-white/5 bg-black/20">
          {/* Top-Left: Opponent Arcana & Deck/Archive Gauge */}
          <div className="pointer-events-auto shrink-0">
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

          {/* Top-Center: Docked Opponent Hand + Status Bar (Avatar + Yellow Barriers + Runes/Domain) */}
          <div className="flex flex-col items-center pointer-events-auto space-y-1">
            {/* Opponent Hand (Compact face-down cards) */}
            <div className="flex items-center justify-center -space-x-2">
              {opp.hand.map(c => (
                <CardView key={c.instanceId} size="opponent-hand" isFaceDown />
              ))}
            </div>

            {/* Integrated Opponent Bar */}
            <div className="flex items-center space-x-2 bg-black/70 backdrop-blur-md px-3 py-1 rounded-2xl border border-white/10 shadow-lg">
              {/* Avatar Crest */}
              <div
                onClick={handleOpponentDirectAttack}
                className={`flex items-center space-x-1 px-1.5 py-0.5 rounded-full border transition-all cursor-pointer ${
                  canDirectAttack
                    ? 'border-red-500 bg-red-950/90 shadow-lg shadow-red-500/60 scale-105 ring-2 ring-red-400 animate-pulse'
                    : 'border-white/10 bg-slate-900/80'
                }`}
                title={canDirectAttack ? '相手を直接攻撃！' : '相手プレイヤー'}
              >
                <div className="w-5 h-5 rounded-full bg-gradient-to-br from-red-700 to-slate-900 border border-red-400 flex items-center justify-center shadow">
                  <span className="text-[7.5px] font-black text-red-200">OPP</span>
                </div>
              </div>

              {/* 5 Yellow Barrier Plates */}
              <BarrierPlates
                count={opp.barrier}
                max={5}
                isOpponent
                isTargetable={canDirectAttack}
                onClick={handleOpponentDirectAttack}
              />

              <div className="h-4 w-px bg-white/15 mx-0.5" />

              {/* Opponent Runes (2 Sockets) */}
              <div className="flex items-center space-x-1">
                <span className="text-[7px] font-black text-slate-400 uppercase tracking-tight">RUNE</span>
                {opp.runes[0] ? (
                  <CardView isFaceDown size="compact" onClick={(e) => handleCardClick(opp.runes[0].instanceId, e)} />
                ) : (
                  <div className="w-[34px] h-[26px] border border-dashed border-white/15 rounded flex items-center justify-center text-[7px] text-white/20">空</div>
                )}
                {opp.runes[1] ? (
                  <CardView isFaceDown size="compact" onClick={(e) => handleCardClick(opp.runes[1].instanceId, e)} />
                ) : (
                  <div className="w-[34px] h-[26px] border border-dashed border-white/15 rounded flex items-center justify-center text-[7px] text-white/20">空</div>
                )}
              </div>

              <div className="h-4 w-px bg-white/15 mx-0.5" />

              {/* Opponent Domain */}
              <div className="flex items-center space-x-1">
                <span className="text-[7px] font-black text-slate-400 uppercase tracking-tight">DOM</span>
                {opp.domain ? (
                  <CardView instance={opp.domain} size="compact" onInspect={() => onInspect(getCard(opp.domain!.cardId))} />
                ) : (
                  <div className="w-[34px] h-[26px] border border-dashed border-white/15 rounded flex items-center justify-center text-[7px] text-white/20">無</div>
                )}
              </div>
            </div>
          </div>

          {/* Top-Right: Quick Theme & Battle Log Drawer Trigger */}
          <div className="pointer-events-auto flex items-center space-x-1.5">
            <button
              onClick={() => setShowPlaymatSelector(true)}
              className="p-1.5 rounded-xl bg-slate-950/80 hover:bg-slate-900 border border-slate-700/80 text-slate-300 hover:text-white shadow transition-all"
              title="プレイマット変更"
            >
              <Palette size={14} />
            </button>
            <button
              onClick={() => setShowLog(!showLog)}
              className="flex items-center space-x-1 px-2 py-1 rounded-xl bg-slate-950/80 hover:bg-slate-900 border border-slate-700/80 text-slate-300 hover:text-white shadow text-[10px] font-bold transition-all"
              title="戦闘ログを表示"
            >
              <History size={13} className="text-amber-400" />
              <span>LOG</span>
            </button>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* 2. CENTER BATTLE ZONE: Dual 6-Slot Arena Grid (Height 240px)              */}
        {/* ========================================================================= */}
        <div className="h-[240px] w-full px-4 flex flex-col justify-around items-center z-10 pointer-events-auto shrink-0 relative">
          {/* Floating Targeting Guide Banner */}
          {selectedCardId && me.hand.some(c => c.instanceId === selectedCardId && getCard(c.cardId).type === 'Spell' && getCard(c.cardId).targetReq) && (
            <div className="absolute top-1 z-30 bg-indigo-950/95 border border-cyan-400 px-3 py-0.5 rounded-full shadow-xl text-[10.5px] font-bold text-cyan-200 flex items-center space-x-1.5 animate-pulse">
              <Zap size={11} className="text-yellow-300" />
              <span>【{getCard(me.hand.find(c => c.instanceId === selectedCardId)!.cardId).name}】の対象を選択してください</span>
            </div>
          )}
          {selectedCardId && me.field.some(u => u.instanceId === selectedCardId) && (
            <div className="absolute top-1 z-30 bg-red-950/95 border border-red-400 px-3 py-0.5 rounded-full shadow-xl text-[10.5px] font-bold text-red-200 flex items-center space-x-1.5 animate-pulse">
              <Sword size={11} className="text-yellow-300" />
              <span>攻撃対象（レスト状態の相手ユニット または 相手プレイヤー）を選択</span>
            </div>
          )}

          {/* Opponent Field (6 Creature Slots, w-[72px] h-[96px]) */}
          <div className="w-full flex items-center justify-center space-x-3">
            {Array.from({ length: 6 }).map((_, slotIdx) => {
              const unit = opp.field[slotIdx];
              const stats = unit ? calculateUnitStats(state, 'player2', unit) : null;
              const isTarget = unit ? isTargetValidForSelected('unit', unit) : false;
              const isAttacking = unit && activeAttackerId === unit.instanceId;
              const hasRipple = summonRippleSlot?.isOpponent && summonRippleSlot.slotIdx === slotIdx;

              return (
                <div
                  key={unit ? unit.instanceId : `opp-slot-${slotIdx}`}
                  className={`relative w-[72px] h-[96px] rounded-lg flex items-center justify-center transition-all shrink-0 overflow-hidden ${
                    unit
                      ? ''
                      : 'border-2 border-dashed border-white/15 bg-black/25'
                  } ${
                    isTarget
                      ? 'ring-2 ring-red-400 shadow-lg shadow-red-500/70 cursor-pointer animate-pulse scale-[1.02]'
                      : ''
                  } ${isAttacking ? 'animate-attack-dash z-40' : ''}`}
                  onClick={(e) => unit && handleCardClick(unit.instanceId, e)}
                >
                  {/* Summon Wave Ripple Effect */}
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
                    <span className="text-[10px] font-black text-white/15 select-none">{slotIdx + 1}</span>
                  )}
                </div>
              );
            })}
          </div>

          {/* Arena Dividing Line */}
          <div className="w-full max-w-2xl flex items-center justify-center h-[20px] opacity-75">
            <div className="flex-1 h-px bg-gradient-to-r from-transparent via-amber-400/50 to-transparent" />
            <div className="mx-3 px-3 py-0.5 rounded-full border border-amber-400/50 bg-black/70 flex items-center space-x-1.5 shadow-lg">
              <Sword size={11} className="text-amber-400" />
              <span className="text-[8.5px] font-black tracking-widest text-amber-300 uppercase">
                BATTLE ARENA
              </span>
            </div>
            <div className="flex-1 h-px bg-gradient-to-l from-transparent via-amber-400/50 to-transparent" />
          </div>

          {/* Player Field (6 Creature Slots, w-[72px] h-[96px]) */}
          <div className="w-full flex items-center justify-center space-x-3">
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
                  onClick={(e) => {
                    if (unit) {
                      handleCardClick(unit.instanceId, e);
                    } else if (isSelectedHandPlayable && selectedHandCard) {
                      handlePlayHandCard(selectedHandCard.instanceId);
                    }
                  }}
                  className={`relative w-[72px] h-[96px] rounded-lg flex items-center justify-center transition-all shrink-0 overflow-hidden ${
                    unit
                      ? ''
                      : isSelectedHandPlayable
                        ? 'border-2 border-dashed border-emerald-400/90 bg-emerald-950/40 cursor-pointer shadow-lg shadow-emerald-500/40 animate-pulse hover:bg-emerald-900/50'
                        : 'border-2 border-dashed border-white/15 bg-black/25'
                  } ${isAttacking ? 'animate-attack-dash z-40' : ''}`}
                >
                  {/* Summon Wave Ripple Effect */}
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
                    <span className={`text-[10px] font-black select-none ${
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

        {/* ========================================================================= */}
        {/* 3. BOTTOM TIER: Player Area (Height 180px)                                */}
        {/* ========================================================================= */}
        <div className="h-[180px] w-full px-4 flex items-center justify-between z-30 pointer-events-none shrink-0 relative border-t border-white/5 bg-black/25">
          {/* Bottom-Left: Circular Arcana Gauge + Deck & Archive */}
          <div className="pointer-events-auto shrink-0">
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

          {/* Bottom-Center: Player Barrier Bar (Upper) & Hand Tray (Lower) */}
          <div className="flex-1 max-w-2xl mx-3 flex flex-col items-center justify-between h-full py-2 pointer-events-auto">
            {/* Player Barrier Plates + RUNE 2 Sockets + DOM 1 Socket */}
            <div className="flex items-center space-x-2 bg-black/75 backdrop-blur-md px-3 py-1 rounded-2xl border border-white/10 shadow-lg shrink-0">
              {/* 5 Cyan Barrier Plates */}
              <BarrierPlates count={me.barrier} max={5} isOpponent={false} />

              <div className="h-4 w-px bg-white/15 mx-0.5" />

              {/* Player Runes (2 Sockets) */}
              <div className="flex items-center space-x-1">
                <span className="text-[7px] font-black text-slate-400 uppercase tracking-tight">RUNE</span>
                {me.runes[0] ? (
                  <CardView isFaceDown size="compact" onClick={(e) => handleCardClick(me.runes[0].instanceId, e)} />
                ) : (
                  <div className="w-[34px] h-[26px] border border-dashed border-white/15 rounded flex items-center justify-center text-[7px] text-white/20">空</div>
                )}
                {me.runes[1] ? (
                  <CardView isFaceDown size="compact" onClick={(e) => handleCardClick(me.runes[1].instanceId, e)} />
                ) : (
                  <div className="w-[34px] h-[26px] border border-dashed border-white/15 rounded flex items-center justify-center text-[7px] text-white/20">空</div>
                )}
              </div>

              <div className="h-4 w-px bg-white/15 mx-0.5" />

              {/* Player Domain */}
              <div className="flex items-center space-x-1">
                <span className="text-[7px] font-black text-slate-400 uppercase tracking-tight">DOM</span>
                {me.domain ? (
                  <CardView instance={me.domain} size="compact" onInspect={() => onInspect(getCard(me.domain!.cardId))} />
                ) : (
                  <div className="w-[34px] h-[26px] border border-dashed border-white/15 rounded flex items-center justify-center text-[7px] text-white/20">無</div>
                )}
              </div>
            </div>

            {/* Player Hand Tray */}
            <div className="w-full flex justify-center items-end min-h-0">
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

          {/* Bottom-Right: 3D Turn End Button & Controls */}
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
      {/* 5. EFFECT ACTIVATION POPUP CUT-IN                                         */}
      {/* ========================================================================= */}
      {cutinCard && (
        <div className="absolute inset-0 pointer-events-none z-50 flex items-center justify-center animate-cutin-pop">
          <div className="flex flex-col items-center bg-slate-950/90 border-2 border-yellow-400 p-3 rounded-2xl shadow-[0_0_50px_rgba(250,204,21,0.8)] backdrop-blur-md">
            {/* Title Banner */}
            <div className="flex items-center space-x-1.5 bg-gradient-to-r from-amber-500 to-yellow-400 text-slate-950 px-3 py-0.5 rounded-full font-black text-xs shadow mb-2">
              <Sparkles size={12} />
              <span>{cutinCard.title}</span>
            </div>
            {/* Card Preview */}
            <CardView
              instance={{ instanceId: 'cutin', cardId: cutinCard.card.id }}
              size="hand"
              className="scale-110 pointer-events-none"
            />
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 6. TRIGGER & GUARD PROMPT / RUNE TRIGGER CONFIRMATION MODAL               */}
      {/* ========================================================================= */}
      {state.prompt && (
        <div className="absolute inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className={`border-2 rounded-2xl p-5 max-w-sm w-full text-center shadow-2xl animate-in zoom-in-95 ${
            state.prompt.type === 'RUNE_TRIGGER'
              ? 'bg-gradient-to-b from-indigo-950 via-slate-900 to-black border-purple-400 shadow-[0_0_35px_rgba(168,85,247,0.7)]'
              : 'bg-slate-900 border-yellow-500/80'
          }`}>
            <h3 className="text-base font-black mb-2 flex items-center justify-center space-x-1">
              {state.prompt.type === 'RUNE_TRIGGER' ? (
                <span className="text-purple-300 flex items-center space-x-1">
                  <Zap size={16} className="text-yellow-400 fill-yellow-400 animate-bounce" />
                  <span>⚡ RUNE TRIGGER! ⚡</span>
                </span>
              ) : state.prompt.type === 'GUARD' ? (
                <span className="text-yellow-400">【ガード宣言】</span>
              ) : (
                <span className="text-yellow-400">【効果発動の確認】</span>
              )}
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
                  className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:brightness-110 text-white text-xs font-bold py-2 px-5 rounded-full shadow ring-1 ring-purple-300"
                >
                  発動する
                </button>
                <button
                  onClick={() => handlePrompt(false)}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold py-2 px-5 rounded-full"
                >
                  キャンセル
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 7. GAME OVER SCREEN                                                       */}
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
      </div>

      {/* ========================================================================= */}
      {/* 8. MODALS: ZONE VIEWER & PLAYMAT SELECTOR                                 */}
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
