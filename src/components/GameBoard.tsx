import React, { useState, useEffect, useRef } from 'react';
import { GameState, GameAction, CardInstance, CardTemplate, UnitState } from '../types';
import { CardView } from './CardView';
import { HandTray } from './HandTray';
import { ArcanaGauge } from './ArcanaGauge';
import { BarrierPlates } from './BarrierPlates';
import { ActionControls } from './ActionControls';
import { PlaymatSelector, PlaymatThemeId, PLAYMAT_THEMES } from './PlaymatSelector';
import { ZoneViewerModal, ZoneSelectionConfig } from './ZoneViewerModal';
import { QuickInspectPanel } from './QuickInspectPanel';
import { AttackArrowOverlay } from './AttackArrowOverlay';
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

  // Canvas Ref for accurate coordinate scaling
  const canvasRef = useRef<HTMLDivElement>(null);

  // Animation States
  const [isScreenShaking, setIsScreenShaking] = useState(false);
  const [activeAttackerId, setActiveAttackerId] = useState<string | null>(null);
  const [summonRippleSlot, setSummonRippleSlot] = useState<{ isOpponent: boolean; slotIdx: number } | null>(null);
  const [cutinCard, setCutinCard] = useState<{ card: CardTemplate; title: string } | null>(null);

  // Shield Break & Shatter Animations
  const [shatteringOppShieldIdx, setShatteringOppShieldIdx] = useState<number | null>(null);
  const [shatteringPlayerShieldIdx, setShatteringPlayerShieldIdx] = useState<number | null>(null);

  // Hand Drag & Drop States (Play & Arcana Charge)
  const [draggingCard, setDraggingCard] = useState<CardInstance | null>(null);
  const [dragCanvasPos, setDragCanvasPos] = useState<{ x: number; y: number } | null>(null);
  const [dragHoverZone, setDragHoverZone] = useState<'arcana' | 'field' | null>(null);

  // Neon Attack Arrow Drag State
  const [attackDrag, setAttackDrag] = useState<{
    attackerId: string;
    startX: number;
    startY: number;
    currentX: number;
    currentY: number;
    lockedTarget: {
      type: 'unit' | 'player';
      id?: string;
      name: string;
      snapX: number;
      snapY: number;
    } | null;
  } | null>(null);

  // Quick feedback toast
  const [feedbackToast, setFeedbackToast] = useState<{ text: string; type: 'info' | 'warn' | 'success' } | null>(null);
  const showToast = (text: string, type: 'info' | 'warn' | 'success' = 'info') => {
    setFeedbackToast({ text, type });
    setTimeout(() => setFeedbackToast(null), 1400);
  };

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

  // Track shield breaks to trigger glass shatter animations
  const prevOppBarrier = useRef(opp.barrier);
  useEffect(() => {
    if (opp.barrier < prevOppBarrier.current) {
      const brokenIdx = opp.barrier;
      setShatteringOppShieldIdx(brokenIdx);
      setIsScreenShaking(true);
      setTimeout(() => setIsScreenShaking(false), 420);
      setTimeout(() => setShatteringOppShieldIdx(null), 850);
    }
    prevOppBarrier.current = opp.barrier;
  }, [opp.barrier]);

  const prevPlayerBarrier = useRef(me.barrier);
  useEffect(() => {
    if (me.barrier < prevPlayerBarrier.current) {
      const brokenIdx = me.barrier;
      setShatteringPlayerShieldIdx(brokenIdx);
      setIsScreenShaking(true);
      setTimeout(() => setIsScreenShaking(false), 420);
      setTimeout(() => setShatteringPlayerShieldIdx(null), 850);
    }
    prevPlayerBarrier.current = me.barrier;
  }, [me.barrier]);

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

  // Convert client coordinates to 844x390 virtual arena canvas coordinates
  const getCanvasCoords = (clientX: number, clientY: number) => {
    if (!canvasRef.current) return { x: clientX, y: clientY };
    const rect = canvasRef.current.getBoundingClientRect();
    return {
      x: (clientX - rect.left) / scale,
      y: (clientY - rect.top) / scale,
    };
  };

  // Hand Card Drag Handlers (Play & Arcana Charge)
  const handleCardDragStart = (card: CardInstance, clientX: number, clientY: number) => {
    const coords = getCanvasCoords(clientX, clientY);
    setDraggingCard(card);
    setDragCanvasPos(coords);
  };

  const handleCardDragMove = (clientX: number, clientY: number) => {
    const coords = getCanvasCoords(clientX, clientY);
    setDragCanvasPos(coords);

    // 1. Check Arcana Gauge drop zone in bottom-left (approx x: 45, y: 350, r: 65)
    const arcanaDist = Math.hypot(coords.x - 45, coords.y - 350);
    if (arcanaDist < 65) {
      setDragHoverZone('arcana');
      return;
    }

    // 2. Check Field Arena drop zone (Y < 275 and Y > 40 and X > 70 and X < 770)
    if (coords.y < 275 && coords.y > 40 && coords.x > 70 && coords.x < 770) {
      setDragHoverZone('field');
      return;
    }

    setDragHoverZone(null);
  };

  const handleCardDragEnd = (card: CardInstance, clientX: number, clientY: number) => {
    const coords = getCanvasCoords(clientX, clientY);
    const arcanaDist = Math.hypot(coords.x - 45, coords.y - 350);

    if (arcanaDist < 65) {
      // Dropped onto Arcana Gauge
      if (!state.flags.hasPlacedArcanaThisTurn && isMyTurn) {
        dispatch({ type: 'PLACE_ARCANA', instanceId: card.instanceId });
        showToast('⚡ アルカナ充填！ (+1 ARCANA)', 'success');
        setSelectedCardId(null);
      } else {
        showToast('今ターンはすでにアルカナを充填済みです', 'warn');
      }
    } else if (coords.y < 275 && coords.y > 40 && coords.x > 70 && coords.x < 770) {
      // Dropped onto Field Arena
      const tpl = getCard(card.cardId);
      const playable = isMyTurn && state.phase === 'ACTION' && canPlayCard(tpl, me.currentArcana, me.arcana, me.field.length);
      if (playable) {
        handlePlayHandCard(card.instanceId);
      } else {
        showToast('アルカナまたは条件が足りません', 'warn');
      }
    }

    setDraggingCard(null);
    setDragCanvasPos(null);
    setDragHoverZone(null);
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

  // Derive inspected card data for Duel Masters top-left popup window
  const inspectedCardData = selectedCardId
    ? (me.hand.find(c => c.instanceId === selectedCardId)
      ? getCard(me.hand.find(c => c.instanceId === selectedCardId)!.cardId)
      : (me.field.find(u => u.instanceId === selectedCardId)
        ? getCard(me.field.find(u => u.instanceId === selectedCardId)!.cards[0].cardId)
        : (opp.field.find(u => u.instanceId === selectedCardId)
          ? getCard(opp.field.find(u => u.instanceId === selectedCardId)!.cards[0].cardId)
          : null)))
    : null;

  const inspectedUnitStats = selectedCardId
    ? (me.field.find(u => u.instanceId === selectedCardId)
      ? calculateUnitStats(state, 'player1', me.field.find(u => u.instanceId === selectedCardId)!)
      : (opp.field.find(u => u.instanceId === selectedCardId)
        ? calculateUnitStats(state, 'player2', opp.field.find(u => u.instanceId === selectedCardId)!)
        : undefined))
    : undefined;

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

  // Unit Attack Pointer Drag Handlers
  const handleUnitAttackPointerDown = (unit: UnitState, slotIdx: number, e: React.PointerEvent) => {
    if (!isMyTurn || state.phase !== 'ACTION' || unit.isRested || unit.hasSummoningSickness) return;
    e.stopPropagation();

    // Calculate slot center in canvas coordinates
    let startX = 232 + slotIdx * 76;
    let startY = 240;
    const slotEl = document.getElementById(`me-slot-${slotIdx}`);
    if (slotEl && canvasRef.current) {
      const slotRect = slotEl.getBoundingClientRect();
      const canvasRect = canvasRef.current.getBoundingClientRect();
      startX = (slotRect.left + slotRect.width / 2 - canvasRect.left) / scale;
      startY = (slotRect.top + slotRect.height / 2 - canvasRect.top) / scale;
    }

    const currentCoords = getCanvasCoords(e.clientX, e.clientY);
    setAttackDrag({
      attackerId: unit.instanceId,
      startX,
      startY,
      currentX: currentCoords.x,
      currentY: currentCoords.y,
      lockedTarget: null,
    });
    setSelectedCardId(unit.instanceId);
  };

  const handleGlobalPointerMove = (e: React.PointerEvent) => {
    if (draggingCard) {
      handleCardDragMove(e.clientX, e.clientY);
      return;
    }

    if (!attackDrag) return;
    const coords = getCanvasCoords(e.clientX, e.clientY);

    // Find closest valid target for lock-on
    let locked: {
      type: 'unit' | 'player';
      id?: string;
      name: string;
      snapX: number;
      snapY: number;
    } | null = null;

    let minTargetDist = 52; // lock-on threshold distance

    // 1. Check opponent units
    opp.field.forEach((oppUnit, idx) => {
      const slotEl = document.getElementById(`opp-slot-${idx}`);
      let ux = 232 + idx * 76;
      let uy = 135;
      if (slotEl && canvasRef.current) {
        const slotRect = slotEl.getBoundingClientRect();
        const canvasRect = canvasRef.current.getBoundingClientRect();
        ux = (slotRect.left + slotRect.width / 2 - canvasRect.left) / scale;
        uy = (slotRect.top + slotRect.height / 2 - canvasRect.top) / scale;
      }

      const dist = Math.hypot(coords.x - ux, coords.y - uy);
      if (dist < minTargetDist && isValidAttackTarget(state, attackDrag.attackerId, oppUnit.instanceId)) {
        minTargetDist = dist;
        locked = {
          type: 'unit',
          id: oppUnit.instanceId,
          name: getCard(oppUnit.cards[0].cardId).name,
          snapX: ux,
          snapY: uy,
        };
      }
    });

    // 2. Check opponent avatar / floor shields for direct attack
    if (!locked && isValidAttackTarget(state, attackDrag.attackerId, undefined)) {
      const oppCenter = { x: 422, y: 55 };
      const distToOpp = Math.hypot(coords.x - oppCenter.x, coords.y - oppCenter.y);
      if (distToOpp < 65 || coords.y < 80) {
        locked = {
          type: 'player',
          name: 'DIRECT ATTACK',
          snapX: oppCenter.x,
          snapY: oppCenter.y,
        };
      }
    }

    setAttackDrag(prev => prev ? {
      ...prev,
      currentX: locked ? locked.snapX : coords.x,
      currentY: locked ? locked.snapY : coords.y,
      lockedTarget: locked,
    } : null);
  };

  const handleGlobalPointerUp = (e: React.PointerEvent) => {
    if (draggingCard) {
      handleCardDragEnd(draggingCard, e.clientX, e.clientY);
      return;
    }

    if (!attackDrag) return;
    if (attackDrag.lockedTarget) {
      performAttackAnimation(
        attackDrag.attackerId,
        attackDrag.lockedTarget.type === 'unit' ? attackDrag.lockedTarget.id : undefined
      );
      showToast(
        attackDrag.lockedTarget.type === 'player'
          ? '⚔️ ダイレクトアタック！'
          : `⚔️ 【${attackDrag.lockedTarget.name}】へ攻撃！`,
        'success'
      );
      setSelectedCardId(null);
    }
    setAttackDrag(null);
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
        ref={canvasRef}
        onPointerMove={handleGlobalPointerMove}
        onPointerUp={handleGlobalPointerUp}
        onPointerCancel={handleGlobalPointerUp}
        style={{
          width: '844px',
          height: '390px',
          transform: `scale(${scale})`,
          transformOrigin: 'center center',
          touchAction: 'none',
          ...currentTheme.bgStyle,
        }}
        className={`relative shrink-0 overflow-hidden flex flex-col justify-between text-slate-100 font-sans shadow-2xl transition-colors duration-500 select-none ${
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
        {/* 1. TOP FLOATING CONTROLS: Left Menu, Opponent Hand, Avatar & Top-Right    */}
        {/* ========================================================================= */}

        {/* Top-Left: Hamburger Menu Button & Turn Counter (NO SCRIPTIA Logo) */}
        <div className="absolute top-2 left-2.5 z-40 flex items-center space-x-1.5 pointer-events-auto select-none">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setShowMenu(!showMenu);
            }}
            className="w-7 h-7 rounded-lg bg-black/70 hover:bg-black/90 border border-white/20 hover:border-cyan-400 flex items-center justify-center text-slate-200 hover:text-white transition-all shadow-md active:scale-95 cursor-pointer backdrop-blur-sm"
            title="メニューを開く"
          >
            <Menu size={15} />
          </button>
          <span className="px-1.5 py-0.5 rounded bg-black/60 border border-white/10 text-[9px] font-mono font-bold text-cyan-400 shadow">
            T{state.turnCount}
          </span>
        </div>

        {/* Top-Left: Opponent Hand Cards Fan (Duel Masters IMG_9587 style) */}
        <div className="absolute top-0 left-16 z-30 flex items-start pointer-events-none select-none">
          {opp.hand.map((c, idx) => {
            const total = opp.hand.length;
            const rot = -6 + (idx * 3.5);
            const translateY = Math.sin((idx / Math.max(total - 1, 1)) * Math.PI) * 4;
            return (
              <div
                key={c.instanceId}
                style={{
                  transform: `rotate(${rot}deg) translateY(${translateY}px)`,
                  marginLeft: idx === 0 ? 0 : '-14px',
                }}
                className="w-[32px] h-[46px] rounded bg-gradient-to-b from-indigo-950 via-slate-950 to-blue-950 border border-amber-400/70 shadow-lg flex items-center justify-center relative overflow-hidden shrink-0 transition-transform"
              >
                <div className="absolute inset-0.5 rounded-sm border border-cyan-400/40 bg-gradient-to-br from-indigo-900/60 to-black flex items-center justify-center">
                  <div className="w-3.5 h-5 rounded-full border border-amber-300/40 flex items-center justify-center">
                    <div className="w-1.5 h-1.5 rounded-full bg-amber-400/80 shadow-[0_0_6px_rgba(251,191,36,1)]" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Top-Center: Opponent Avatar (Direct Attack targetable or lock-on target) */}
        <div className="absolute top-1.5 left-1/2 -translate-x-1/2 z-30 pointer-events-auto select-none">
          {(() => {
            const isLocked = attackDrag?.lockedTarget?.type === 'player';
            const isClickable = canDirectAttack || isLocked;
            return (
              <button
                type="button"
                disabled={!isClickable}
                onClick={handleOpponentDirectAttack}
                className={`flex items-center space-x-1.5 px-3 py-1 rounded-full border backdrop-blur-md shadow-xl transition-all ${
                  isLocked
                    ? 'bg-gradient-to-r from-red-500 via-yellow-400 to-amber-500 border-yellow-200 text-slate-950 ring-4 ring-yellow-400 shadow-[0_0_30px_rgba(250,204,21,1)] scale-110'
                    : canDirectAttack
                      ? 'bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-600 border-yellow-200 text-slate-950 ring-2 ring-yellow-300 animate-bounce cursor-pointer shadow-[0_0_20px_rgba(250,204,21,1)]'
                      : 'bg-slate-950/80 border-red-500/40 text-slate-200'
                }`}
                title={isClickable ? '相手プレイヤーにダイレクトアタック！' : '相手プレイヤー'}
              >
                <div className="w-5 h-5 rounded-full bg-gradient-to-br from-red-700 to-indigo-900 border border-amber-300 flex items-center justify-center shadow">
                  <User size={11} className={isClickable ? 'text-slate-950' : 'text-yellow-200'} />
                </div>
                <span className="text-[9.5px] font-black tracking-tight uppercase">
                  {isLocked ? 'TARGET LOCKED!' : canDirectAttack ? 'DIRECT ATTACK!' : 'OPPONENT'}
                </span>
              </button>
            );
          })()}
        </div>

        {/* Top-Right: Opponent CARD COUNT & Circular Mana Zone (Duel Masters Symmetrical Layout) */}
        <div className="absolute top-2 right-2.5 z-40 flex items-center space-x-2 pointer-events-auto select-none">
          {/* Opponent CARD COUNT Panel (Trapezoid Cyber Banner: IMG_9587) */}
          <div className="flex flex-col items-end mr-0.5 select-none">
            <span className="text-[6.5px] font-black tracking-widest text-purple-300/80 uppercase mb-0.5">
              CARD COUNT
            </span>
            <div className="flex items-center space-x-1 bg-slate-950/85 backdrop-blur-md px-2 py-0.5 rounded-full border border-purple-500/40 shadow-xl text-[8.5px] font-mono text-slate-200">
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
              {/* Archive (Clickable) */}
              <button
                type="button"
                onClick={() =>
                  setZoneModal({
                    isOpen: true,
                    title: '相手のアーカイブ',
                    zoneType: 'archive',
                    cards: opp.archive,
                    isOpponent: true,
                  })
                }
                className="flex items-center space-x-0.5 bg-purple-950/70 hover:bg-purple-900 px-1.5 py-0.5 rounded border border-purple-500/40 text-purple-200 cursor-pointer active:scale-95 transition-all"
                title="相手のアーカイブを確認"
              >
                <span className="text-purple-300 font-bold">ARCHIVE</span>
                <span>{opp.archive.length}</span>
              </button>
            </div>
          </div>

          {/* Opponent 3D Circular Arcana Orb (diameter ~64px) */}
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

        {/* ========================================================================= */}
        {/* 2. LEFT CYBER SLOTS: Domain & Runes (Shifted Inwards / Right-Offset)       */}
        {/* ========================================================================= */}

        {/* Top-Left: Opponent Domain & Runes (Shifted Inwards to left-6) */}
        <div className="absolute top-12 left-6 z-20 flex flex-col space-y-1.5 pointer-events-auto select-none">
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

        {/* Bottom-Left: Player Runes & Domain (Shifted Inwards to left-6) */}
        <div className="absolute bottom-22 left-6 z-20 flex flex-col space-y-1.5 pointer-events-auto select-none">
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
          className="absolute inset-x-16 top-9 bottom-4 flex flex-col justify-between items-center px-2 z-10 pointer-events-auto"
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

          {/* OPPONENT FLOOR SHIELDS: 5 Horizontal Cyan Shield Cards (Duel Masters style: IMG_9585) */}
          <div className="w-full flex items-center justify-center space-x-2 py-0.5 pointer-events-auto">
            {Array.from({ length: 5 }).map((_, idx) => {
              const active = idx < opp.barrier;
              const isShattering = shatteringOppShieldIdx === idx;
              return (
                <div key={`opp-floor-shield-wrap-${idx}`} className="relative">
                  <button
                    type="button"
                    disabled={!canDirectAttack}
                    onClick={handleOpponentDirectAttack}
                    className={`w-6 h-8 rounded-sm border transition-all duration-300 flex items-center justify-center select-none ${
                      active
                        ? canDirectAttack
                          ? 'bg-gradient-to-b from-amber-400 via-yellow-400 to-amber-600 border-yellow-200 shadow-[0_0_12px_rgba(250,204,21,1)] cursor-pointer animate-pulse scale-105'
                          : 'bg-gradient-to-b from-cyan-400 via-sky-500 to-blue-700 border-cyan-200 shadow-[0_0_8px_rgba(34,211,238,0.7)]'
                        : 'bg-slate-900/40 border-slate-700/20 opacity-20'
                    }`}
                    title={canDirectAttack ? '相手シールドへ直接攻撃！' : `相手シールド ${idx + 1}/5`}
                  >
                    {active && (
                      <div className="w-3.5 h-5 rounded-xs border border-white/40 bg-white/20 shadow-inner flex items-center justify-center">
                        <Shield size={8} className={canDirectAttack ? 'text-slate-950 fill-current' : 'text-cyan-100 fill-cyan-100'} />
                      </div>
                    )}
                  </button>

                  {/* Shield Break Glass Shatter Effect */}
                  {isShattering && (
                    <div className="absolute inset-0 pointer-events-none z-50 flex items-center justify-center">
                      <div className="w-full h-full bg-cyan-300 rounded animate-shield-break shadow-[0_0_20px_rgba(34,211,238,1)]" />
                      <div className="absolute w-2 h-2 bg-cyan-100 rounded-xs animate-shatter-shard" style={{ '--tw-shatter-x': '-28px', '--tw-shatter-y': '-22px', '--tw-shatter-r': '-80deg' } as any} />
                      <div className="absolute w-2.5 h-1.5 bg-yellow-200 rounded-xs animate-shatter-shard" style={{ '--tw-shatter-x': '26px', '--tw-shatter-y': '-26px', '--tw-shatter-r': '90deg' } as any} />
                      <div className="absolute w-1.5 h-2.5 bg-white rounded-xs animate-shatter-shard" style={{ '--tw-shatter-x': '-20px', '--tw-shatter-y': '24px', '--tw-shatter-r': '45deg' } as any} />
                      <div className="absolute w-2 h-2 bg-sky-300 rounded-xs animate-shatter-shard" style={{ '--tw-shatter-x': '24px', '--tw-shatter-y': '20px', '--tw-shatter-r': '-60deg' } as any} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* UPPER ROW: Opponent Field (6 Slots: w-[68px] h-[90px]) */}
          <div id="opponent-field-row" className="w-full flex items-center justify-center space-x-2">
            {Array.from({ length: 6 }).map((_, slotIdx) => {
              const unit = opp.field[slotIdx];
              const stats = unit ? calculateUnitStats(state, 'player2', unit) : null;
              const isTarget = unit ? isTargetValidForSelected('unit', unit) : false;
              const isLockedTarget = unit && attackDrag?.lockedTarget?.id === unit.instanceId;
              const isAttacking = unit && activeAttackerId === unit.instanceId;
              const hasRipple = summonRippleSlot?.isOpponent && summonRippleSlot.slotIdx === slotIdx;

              return (
                <div
                  key={unit ? unit.instanceId : `opp-slot-${slotIdx}`}
                  id={`opp-slot-${slotIdx}`}
                  className={`relative w-[68px] h-[90px] rounded-lg flex items-center justify-center shrink-0 transition-all ${
                    unit
                      ? 'overflow-visible'
                      : 'border border-cyan-500/15 bg-cyan-950/10 shadow-inner'
                  } ${
                    isLockedTarget
                      ? 'ring-4 ring-yellow-400 shadow-[0_0_25px_rgba(250,204,21,1)] scale-105 cursor-pointer z-40'
                      : isTarget
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
          <div className="w-full max-w-md flex items-center justify-center h-[10px] opacity-80 my-0.5">
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
              const isDraggingThisAttacker = unit && attackDrag?.attackerId === unit.instanceId;
              const isAttacking = unit && activeAttackerId === unit.instanceId;
              const hasRipple = !summonRippleSlot?.isOpponent && summonRippleSlot?.slotIdx === slotIdx;

              return (
                <div
                  key={unit ? unit.instanceId : `me-slot-${slotIdx}`}
                  id={`me-slot-${slotIdx}`}
                  onPointerDown={(e) => {
                    if (unit) {
                      handleUnitAttackPointerDown(unit, slotIdx, e);
                    }
                  }}
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
                        : 'border border-cyan-500/15 bg-cyan-950/10 shadow-inner'
                  } ${
                    isDraggingThisAttacker
                      ? 'ring-4 ring-amber-400 scale-105 shadow-[0_0_25px_rgba(245,158,11,1)] z-40'
                      : ''
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

          {/* PLAYER FLOOR SHIELDS: 5 Horizontal Cyan Shield Cards (Duel Masters style: IMG_9585) */}
          <div className="w-full flex items-center justify-center space-x-2 py-0.5 pointer-events-none">
            {Array.from({ length: 5 }).map((_, idx) => {
              const active = idx < me.barrier;
              const isShattering = shatteringPlayerShieldIdx === idx;
              return (
                <div key={`me-floor-shield-wrap-${idx}`} className="relative">
                  <div
                    className={`w-6 h-8 rounded-sm border transition-all duration-300 flex items-center justify-center ${
                      active
                        ? 'bg-gradient-to-b from-cyan-400 via-sky-500 to-blue-700 border-cyan-200 shadow-[0_0_8px_rgba(34,211,238,0.7)]'
                        : 'bg-slate-900/40 border-slate-700/20 opacity-20'
                    }`}
                  >
                    {active && (
                      <div className="w-3.5 h-5 rounded-xs border border-white/40 bg-white/20 shadow-inner flex items-center justify-center">
                        <Shield size={8} className="text-cyan-100 fill-cyan-100" />
                      </div>
                    )}
                  </div>

                  {/* Player Shield Break Glass Shatter Effect */}
                  {isShattering && (
                    <div className="absolute inset-0 pointer-events-none z-50 flex items-center justify-center">
                      <div className="w-full h-full bg-red-400 rounded animate-shield-break shadow-[0_0_20px_rgba(239,68,68,1)]" />
                      <div className="absolute w-2 h-2 bg-red-200 rounded-xs animate-shatter-shard" style={{ '--tw-shatter-x': '-28px', '--tw-shatter-y': '-22px', '--tw-shatter-r': '-80deg' } as any} />
                      <div className="absolute w-2.5 h-1.5 bg-yellow-200 rounded-xs animate-shatter-shard" style={{ '--tw-shatter-x': '26px', '--tw-shatter-y': '-26px', '--tw-shatter-r': '90deg' } as any} />
                      <div className="absolute w-1.5 h-2.5 bg-white rounded-xs animate-shatter-shard" style={{ '--tw-shatter-x': '-20px', '--tw-shatter-y': '24px', '--tw-shatter-r': '45deg' } as any} />
                      <div className="absolute w-2 h-2 bg-amber-300 rounded-xs animate-shatter-shard" style={{ '--tw-shatter-x': '24px', '--tw-shatter-y': '20px', '--tw-shatter-r': '-60deg' } as any} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* ========================================================================= */}
        {/* 4. BOTTOM-LEFT: Circular Mana Zone, DECK & ARCHIVE Panel, Player Avatar   */}
        {/* ========================================================================= */}
        <div className="absolute bottom-1.5 left-2.5 z-40 flex items-center space-x-2 pointer-events-auto select-none">
          {/* 3D Circular Arcana Orb with Drop Zone Attraction Effect */}
          <div className={`relative transition-all duration-200 ${
            dragHoverZone === 'arcana'
              ? 'scale-115 ring-4 ring-amber-400 shadow-[0_0_35px_rgba(245,158,11,1)] rounded-full animate-pulse'
              : ''
          }`}>
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
              isOpponent={false}
            />
          </div>

          {/* Player DECK & ARCHIVE Panel (Duel Masters Metallic Cyan CARD COUNT: IMG_9587) */}
          <div className="flex flex-col items-start select-none">
            <span className="text-[6.5px] font-black tracking-widest text-cyan-300/80 uppercase mb-0.5">
              CARD COUNT
            </span>
            <div className="flex items-center space-x-1 bg-slate-950/85 backdrop-blur-md px-2 py-0.5 rounded-full border border-cyan-500/40 shadow-xl text-[8.5px] font-mono text-slate-200">
              {/* Deck */}
              <div className="flex items-center space-x-0.5 bg-black/40 px-1.5 py-0.5 rounded border border-white/10" title="自分の山札">
                <span className="text-amber-400 font-bold">山</span>
                <span>{me.deck.length}</span>
              </div>
              {/* Hand */}
              <div className="flex items-center space-x-0.5 bg-black/40 px-1.5 py-0.5 rounded border border-white/10" title="自分の手札">
                <span className="text-cyan-400 font-bold">手</span>
                <span>{me.hand.length}</span>
              </div>
              {/* Archive (Clickable) */}
              <button
                type="button"
                onClick={() =>
                  setZoneModal({
                    isOpen: true,
                    title: '自分のアーカイブ',
                    zoneType: 'archive',
                    cards: me.archive,
                    isOpponent: false,
                  })
                }
                className="flex items-center space-x-0.5 bg-purple-950/70 hover:bg-purple-900 px-1.5 py-0.5 rounded border border-purple-500/40 text-purple-200 cursor-pointer active:scale-95 transition-all"
                title="自分のアーカイブを確認"
              >
                <span className="text-purple-300 font-bold">ARCHIVE</span>
                <span>{me.archive.length}</span>
              </button>
            </div>
          </div>

          {/* Player Avatar (Duel Masters Cyber Portrait) */}
          <div className="flex items-center space-x-1.5 bg-slate-950/85 backdrop-blur-md px-2 py-1 rounded-full border border-cyan-400/60 shadow-lg">
            <div className="w-5 h-5 rounded-full bg-gradient-to-br from-cyan-600 to-blue-900 border border-cyan-300 flex items-center justify-center shadow">
              <User size={11} className="text-cyan-200" />
            </div>
            <span className="text-[9px] font-black text-slate-200 tracking-tight">PLAYER</span>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* TOP-LEFT DUEL MASTERS GIANT CARD DETAIL POPUP (IMG_9589)                  */}
        {/* ========================================================================= */}
        {inspectedCardData && (
          <QuickInspectPanel
            card={inspectedCardData}
            computedStats={inspectedUnitStats}
            onClose={() => setSelectedCardId(null)}
          />
        )}

        {/* ========================================================================= */}
        {/* 5. RIGHT CONTROLS: 3D Turn End Button (Middle)                            */}
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
            onNextPhase={() => {
              dispatch({ type: 'NEXT_PHASE' });
              setArcanaMode(false);
              setSelectedCardId(null);
            }}
            onArcanaCharge={handleArcanaChargeBtn}
          />
        </div>

        {/* ========================================================================= */}
        {/* 6. BOTTOM-RIGHT: Hand Tray (Right-Aligned Fan Overlap with Drag & Drop)    */}
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
            onCardDragStart={handleCardDragStart}
            onCardDragMove={handleCardDragMove}
            onCardDragEnd={handleCardDragEnd}
            draggingCardId={draggingCard?.instanceId}
          />
        </div>

        {/* ========================================================================= */}
        {/* NEON SVG ATTACK ARROW OVERLAY                                             */}
        {/* ========================================================================= */}
        {attackDrag && (
          <AttackArrowOverlay
            startX={attackDrag.startX}
            startY={attackDrag.startY}
            currentX={attackDrag.currentX}
            currentY={attackDrag.currentY}
            lockedTarget={attackDrag.lockedTarget}
          />
        )}

        {/* ========================================================================= */}
        {/* FLOATING DRAGGED HAND CARD PREVIEW                                        */}
        {/* ========================================================================= */}
        {draggingCard && dragCanvasPos && (
          <div
            className="absolute pointer-events-none z-50 flex flex-col items-center"
            style={{
              left: `${dragCanvasPos.x}px`,
              top: `${dragCanvasPos.y}px`,
              transform: 'translate(-50%, -70%) scale(1.08)',
            }}
          >
            {/* Gesture Action Indicator Badge */}
            {dragHoverZone === 'arcana' ? (
              <div className="mb-1 px-2.5 py-0.5 rounded-full bg-amber-500 text-slate-950 font-black text-[9px] shadow-[0_0_15px_rgba(245,158,11,1)] flex items-center space-x-1 animate-bounce">
                <Zap size={10} className="fill-current" />
                <span>アルカナ充填 (+1 ARCANA)</span>
              </div>
            ) : dragHoverZone === 'field' ? (
              <div className={`mb-1 px-2.5 py-0.5 rounded-full text-white font-black text-[9px] shadow-lg flex items-center space-x-1 animate-pulse ${
                canPlayCard(getCard(draggingCard.cardId), me.currentArcana, me.arcana, me.field.length)
                  ? 'bg-emerald-600 shadow-emerald-500/80'
                  : 'bg-red-600 shadow-red-500/80'
              }`}>
                <span>
                  {canPlayCard(getCard(draggingCard.cardId), me.currentArcana, me.arcana, me.field.length)
                    ? '⇧ プレイ (召喚/発動)'
                    : '✕ アルカナ不足'}
                </span>
              </div>
            ) : null}

            {/* Glowing Card Miniature */}
            <div className="w-[68px] h-[92px] rounded-lg shadow-[0_10px_25px_rgba(0,0,0,0.85)] ring-2 ring-cyan-300">
              <CardView
                instance={draggingCard}
                size="field"
                isDragging
              />
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* RUNE TRIGGER DARKENING CUT-IN OVERLAY                                     */}
        {/* ========================================================================= */}
        {state.prompt?.type === 'RUNE_TRIGGER' && (
          <div className="absolute inset-0 pointer-events-none z-40 bg-black/75 animate-rune-darken flex flex-col items-center justify-center">
            <div className="px-4 py-1.5 rounded-full bg-gradient-to-r from-red-600 via-amber-500 to-yellow-400 text-slate-950 font-black text-xs tracking-widest uppercase shadow-[0_0_30px_rgba(245,158,11,1)] animate-bounce mb-2">
              ⚡ RUNE TRIGGER! 最優先割り込み ⚡
            </div>
            <p className="text-[10px] text-amber-200 font-bold">結界より秘術が解き放たれました！</p>
          </div>
        )}

        {/* ========================================================================= */}
        {/* QUICK FEEDBACK TOAST                                                      */}
        {/* ========================================================================= */}
        {feedbackToast && (
          <div className="absolute top-10 left-1/2 -translate-x-1/2 z-50 pointer-events-none animate-in fade-in zoom-in-95 duration-150">
            <div className={`px-3 py-1 rounded-full font-black text-[10px] shadow-2xl border flex items-center space-x-1.5 ${
              feedbackToast.type === 'success'
                ? 'bg-emerald-950/90 border-emerald-400 text-emerald-200 shadow-[0_0_20px_rgba(16,185,129,0.7)]'
                : feedbackToast.type === 'warn'
                  ? 'bg-amber-950/90 border-amber-400 text-amber-200 shadow-[0_0_20px_rgba(245,158,11,0.7)]'
                  : 'bg-slate-900/90 border-cyan-400 text-cyan-200 shadow-[0_0_20px_rgba(6,182,212,0.7)]'
            }`}>
              <span>{feedbackToast.text}</span>
            </div>
          </div>
        )}

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
