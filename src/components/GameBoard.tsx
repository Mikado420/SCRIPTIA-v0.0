import React, { useState, useEffect, useRef } from 'react';
import { GameState, GameAction, CardInstance, CardTemplate, UnitState } from '../types';
import { CardView } from './CardView';
import { HandTray } from './HandTray';
import { ArcanaGauge } from './ArcanaGauge';
import { BarrierPlates } from './BarrierPlates';
import { ActionControls } from './ActionControls';
import { PlaymatSelector, PlaymatThemeId, PLAYMAT_THEMES } from './PlaymatSelector';
import { ZoneViewerModal, ZoneSelectionConfig } from './ZoneViewerModal';
import { FloatingCardPreview } from './FloatingCardPreview';
import { AttackArrowOverlay } from './AttackArrowOverlay';
import { getCard } from '../data/cards';
import { calculateUnitStats, canPlayCard } from '../engine/engineUtils';
import { canUnitGuard, isValidAttackTarget } from '../engine/combatEngine';
import { getValidSpellTargets } from '../engine/spellSystem';
import { ScriptiaAIEngine, toBoardUnit, getAIPlayableCards, getAIPlayAction } from '../engine/aiEngine';
import { History, X, Shield, Sparkles, Sword, Zap, Palette, User, Menu, BookOpen, Volume2, VolumeX, Layers } from 'lucide-react';
import { soundManager } from '../utils/soundManager';

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

interface Props {
  state: GameState;
  dispatch: React.Dispatch<GameAction>;
  onInspect: (card: any) => void;
  onOpenDeckBuilder?: () => void;
}

export const GameBoard: React.FC<Props> = ({ state, dispatch, onInspect, onOpenDeckBuilder }) => {
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [arcanaMode, setArcanaMode] = useState(false);
  const [showLog, setShowLog] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [isMuted, setIsMuted] = useState(() => soundManager.getMuted());

  // Canvas Ref for accurate coordinate scaling
  const canvasRef = useRef<HTMLDivElement>(null);

  // Animation States
  const [isScreenShaking, setIsScreenShaking] = useState(false);
  const [activeAttackerId, setActiveAttackerId] = useState<string | null>(null);
  const [summonRippleSlot, setSummonRippleSlot] = useState<{ isOpponent: boolean; slotIdx: number } | null>(null);
  const [cutinCard, setCutinCard] = useState<{ card: CardTemplate; title: string } | null>(null);
  const [showYourTurnBanner, setShowYourTurnBanner] = useState(false);
  const [clashSparkPos, setClashSparkPos] = useState<{ x: number; y: number } | null>(null);

  // Smart Floating HUD Card Preview State (Top-Left, No Darkening Overlay)
  const [previewCard, setPreviewCard] = useState<CardTemplate | null>(null);
  const [previewStats, setPreviewStats] = useState<{ atk: number; def: number; brk: number } | undefined>(undefined);
  const touchStartPosRef = useRef<{ x: number; y: number } | null>(null);
  const isDraggingRef = useRef<boolean>(false);

  // Shield Break & Shatter Animations
  const [shatteringOppShieldIdx, setShatteringOppShieldIdx] = useState<number | null>(null);
  const [shatteringPlayerShieldIdx, setShatteringPlayerShieldIdx] = useState<number | null>(null);

  // Spell Target Selection State (v0.07 Fix)
  const [pendingSpell, setPendingSpell] = useState<{
    cardInstance: CardInstance;
    template: CardTemplate;
    validTargets: string[];
    targetTypes: ('unit' | 'domain' | 'rune' | 'archive')[];
    message: string;
  } | null>(null);

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
  const prevLockedTargetId = useRef<string | null>(null);

  // 0.7s Long-Press Tracking Refs for Field Units & Slots
  const playerUnitPointerDownPos = useRef<{
    unit: UnitState;
    slotIdx: number;
    clientX: number;
    clientY: number;
    canvasStartX: number;
    canvasStartY: number;
    time: number;
  } | null>(null);
  const playerUnitLongPressTimer = useRef<NodeJS.Timeout | number | null>(null);
  const hasPlayerUnitLongPressed = useRef(false);

  const oppUnitPointerDownPos = useRef<{
    unit: UnitState;
    slotIdx: number;
    clientX: number;
    clientY: number;
  } | null>(null);
  const oppUnitLongPressTimer = useRef<NodeJS.Timeout | number | null>(null);
  const hasOppUnitLongPressed = useRef(false);

  const slotPointerDownPos = useRef<{
    clientX: number;
    clientY: number;
    card: CardTemplate;
    instanceId: string;
  } | null>(null);
  const slotLongPressTimer = useRef<NodeJS.Timeout | number | null>(null);
  const hasSlotLongPressed = useRef(false);

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

  // Turn Start Banner & SE trigger
  const prevPlayer = useRef(state.currentPlayer);
  const prevTurnCount = useRef(state.turnCount);
  useEffect(() => {
    if (state.currentPlayer === 'player1' && (prevPlayer.current !== 'player1' || prevTurnCount.current !== state.turnCount)) {
      setShowYourTurnBanner(true);
      soundManager.playTurnStart();
      const t = setTimeout(() => setShowYourTurnBanner(false), 1400);
      return () => clearTimeout(t);
    }
    prevPlayer.current = state.currentPlayer;
    prevTurnCount.current = state.turnCount;
  }, [state.currentPlayer, state.turnCount]);

  // Rune Trigger Sound Effect
  useEffect(() => {
    if (state.prompt?.type === 'RUNE_TRIGGER' || state.prompt?.type === 'TRIGGER') {
      soundManager.playRuneTrigger();
    }
  }, [state.prompt?.type]);

  // Track field unit destructions to trigger card destroy SE
  const prevP1FieldLength = useRef(me.field.length);
  const prevP2FieldLength = useRef(opp.field.length);
  useEffect(() => {
    if (me.field.length < prevP1FieldLength.current || opp.field.length < prevP2FieldLength.current) {
      soundManager.playCardDestroy();
    }
    prevP1FieldLength.current = me.field.length;
    prevP2FieldLength.current = opp.field.length;
  }, [me.field.length, opp.field.length]);

  // Track shield breaks to trigger crystal glass shatter sound and animations
  const prevOppBarrier = useRef(opp.barrier);
  useEffect(() => {
    if (opp.barrier < prevOppBarrier.current) {
      const brokenIdx = opp.barrier;
      soundManager.playShieldBreak();
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
      soundManager.playShieldBreak();
      setShatteringPlayerShieldIdx(brokenIdx);
      setIsScreenShaking(true);
      setTimeout(() => setIsScreenShaking(false), 420);
      setTimeout(() => setShatteringPlayerShieldIdx(null), 850);
    }
    prevPlayerBarrier.current = me.barrier;
  }, [me.barrier]);

  // AI Thinking & Autonomous Turn State
  const [aiThinkingText, setAiThinkingText] = useState<string | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;
  const isRunningAITurnRef = useRef(false);

  // Automated AI Reaction to Prompts (Guard / Trigger)
  useEffect(() => {
    if (state.winner) return;

    if (state.prompt && state.prompt.playerId === 'player2') {
      const timer = setTimeout(() => {
        if (!stateRef.current.prompt || stateRef.current.prompt.playerId !== 'player2') return;

        if (stateRef.current.prompt.type === 'GUARD') {
          const oppState = stateRef.current.player2;
          const guarders = oppState.field
            .map(u => toBoardUnit(stateRef.current, 'player2', u))
            .filter(u => !u.isRested && canUnitGuard(u));

          if (guarders.length === 0) {
            dispatch({ type: 'RESOLVE_GUARD' });
            return;
          }

          let attacker = toBoardUnit(stateRef.current, 'player1', stateRef.current.player1.field[0]);
          if (stateRef.current.prompt.attackerId) {
            const aFound = stateRef.current.player1.field.find(u => u.instanceId === stateRef.current.prompt!.attackerId);
            if (aFound) attacker = toBoardUnit(stateRef.current, 'player1', aFound);
          }

          const chosen = ScriptiaAIEngine.shouldGuard(stateRef.current, attacker, guarders);
          if (chosen) {
            showToast(`相手が【${chosen.card.name}】で守護を発動！`, 'info');
            soundManager.playShieldBreak();
            dispatch({ type: 'RESOLVE_GUARD', guarderId: chosen.instanceId });
          } else {
            dispatch({ type: 'RESOLVE_GUARD' });
          }
        } else if (stateRef.current.prompt.type === 'TRIGGER' || stateRef.current.prompt.type === 'RUNE_TRIGGER') {
          showToast('相手がルーン効果を発動！', 'warn');
          soundManager.playRuneTrigger();
          dispatch({ type: 'RESOLVE_TRIGGER', apply: true });
        }
      }, 700);
      return () => clearTimeout(timer);
    }
  }, [state.prompt, state.winner]);

  // Automated AI Turn Sequencer (Ver 0.07 Heuristic Engine with Human Pacing)
  useEffect(() => {
    if (state.winner) return;
    if (state.currentPlayer === 'player2' && !state.prompt && !isRunningAITurnRef.current) {
      runAITurnSequence();
    }
  }, [state.currentPlayer, state.turnCount, state.phase, state.prompt, state.winner]);

  const runAITurnSequence = async () => {
    if (isRunningAITurnRef.current) {
      console.log('[AI] Turn already running, ignoring duplicate trigger.');
      return;
    }
    isRunningAITurnRef.current = true;
    
    // Safety check helper
    const isSafeToContinue = () => {
      return stateRef.current.currentPlayer === 'player2' && !stateRef.current.winner;
    };

    // Wait for prompt helper with timeout
    const waitForPrompt = async (timeoutMs: number = 15000) => {
      console.log('[AI] Waiting for prompt to resolve...');
      const start = Date.now();
      while (stateRef.current.prompt) {
        if (Date.now() - start > timeoutMs) {
          console.error(`[AI] Prompt wait timeout! Type: ${stateRef.current.prompt.type}`);
          throw new Error('Prompt wait timeout');
        }
        await sleep(300);
        if (!isSafeToContinue()) {
          console.log('[AI] Game state changed during prompt wait, aborting wait.');
          return false;
        }
      }
      console.log('[AI] Prompt resolved.');
      return true;
    };

    try {
      if (!isSafeToContinue()) return;
      console.log(`[AI] --- Turn Start --- Turn: ${stateRef.current.turnCount}, Phase: ${stateRef.current.phase}`);

      // ① 総合プランの策定（全シミュレーション）
      console.log('[AI] Thinking started...');
      const plan = ScriptiaAIEngine.planBestTurn(stateRef.current);
      console.log("[AI] Plan generated:", plan.reason, "Score:", plan.totalScore);
      setAiThinkingText(plan.reason);

      // ② マナチャージの実行（プランでチャージが選ばれた場合のみ）
      if (stateRef.current.phase === 'ARCANA_PLACEMENT' && !stateRef.current.flags.hasPlacedArcanaThisTurn) {
        if (plan.chargeCard && plan.chargeCard.instanceId) {
          await sleep(1000);
          if (!isSafeToContinue()) return;
          console.log(`[AI] Charging arcana: ${plan.chargeCard.name}`);
          showToast(`相手がアルカナに【${plan.chargeCard.name}】を配置`, 'info');
          soundManager.playManaCharge();
          dispatch({ type: 'PLACE_ARCANA', instanceId: plan.chargeCard.instanceId });
          await sleep(800);
        } else {
          await sleep(600); // チャージしない場合も少し思考ウェイト
          if (stateRef.current.phase === 'ARCANA_PLACEMENT' && !stateRef.current.flags.hasPlacedArcanaThisTurn) {
            console.log('[AI] Skipping arcana charge, next phase.');
            dispatch({ type: 'NEXT_PHASE' });
            await sleep(600);
          }
        }
      }

      if (!isSafeToContinue()) return;

      // ③ カードプレイの順次実行
      for (const playAction of plan.plays) {
        if (!isSafeToContinue()) return;
        
        const promptCleared = await waitForPrompt();
        if (!promptCleared) return;

        await sleep(900);
        const card = playAction.card;
        if (!card.instanceId) continue;

        if (stateRef.current.player2.field.length >= 6 && card.type !== 'Evolution' && card.cardType !== 'EVOLUTION') {
          console.log(`[AI] Field full, skipping card: ${card.name}`);
          continue;
        }

        console.log(`[AI] Playing card: ${card.name}`);
        setAiThinkingText(`【${card.name}】を展開中...`);
        const isEvolution = card.type === 'Evolution' || card.cardType === 'EVOLUTION';
        if (isEvolution) {
          soundManager.playEvolve();
          showToast(`相手が【${card.name}】へ進化！`, 'warn');
        } else if (card.type === 'Spell' || card.cardType === 'SPELL') {
          soundManager.playCardSwipe();
          showToast(`相手がスペル【${card.name}】を詠唱！`, 'info');
        } else {
          soundManager.playSummonUnit();
          showToast(`相手が【${card.name}】を召喚！`, 'info');
        }

        const action = getAIPlayAction(stateRef.current, card as any);
        dispatch(action);
        console.log(`[AI] Card play action dispatched.`);
        await sleep(1000);
      }

      if (!isSafeToContinue()) return;

      // ④ 攻撃の順次実行
      for (const attack of plan.attacks) {
        if (!isSafeToContinue()) return;
        
        const promptCleared = await waitForPrompt();
        if (!promptCleared) return;

        const currentAttacker = stateRef.current.player2.field.find(u => u.instanceId === attack.attacker.instanceId);
        if (!currentAttacker || currentAttacker.isRested) {
          console.log(`[AI] Attacker invalid or rested, skipping attack.`);
          continue;
        }

        await sleep(1100);
        console.log(`[AI] Initiating attack with ${attack.attacker.card.name}`);
        setAiThinkingText(attack.targetType === 'PLAYER' ? '相手プレイヤー/結界へ攻撃' : `相手の【${attack.targetUnit?.card.name}】へ攻撃`);
        setActiveAttackerId(attack.attacker.instanceId);
        soundManager.playAttackLock();
        await sleep(600);

        if (!isSafeToContinue()) {
          console.log(`[AI] Attack aborted due to state change.`);
          setActiveAttackerId(null);
          return;
        }

        soundManager.playAttackClash();
        setIsScreenShaking(true);
        setTimeout(() => setIsScreenShaking(false), 380);

        if (attack.targetType === 'PLAYER') {
          console.log(`[AI] Declaring attack on Player`);
          showToast(`相手の【${attack.attacker.card.name}】がプレイヤーへ直接攻撃！`, 'warn');
          dispatch({ type: 'DECLARE_ATTACK', attackerId: attack.attacker.instanceId });
        } else if (attack.targetUnit) {
          const targetExists = stateRef.current.player1.field.some(u => u.instanceId === attack.targetUnit!.instanceId);
          if (targetExists) {
            console.log(`[AI] Declaring attack on Unit ${attack.targetUnit.card.name}`);
            showToast(`相手の【${attack.attacker.card.name}】が【${attack.targetUnit.card.name}】へ攻撃！`, 'warn');
            dispatch({
              type: 'DECLARE_ATTACK',
              attackerId: attack.attacker.instanceId,
              targetId: attack.targetUnit.instanceId,
            });
          } else if (!attack.attacker.card.restrictions?.cannotAttackPlayer) {
            console.log(`[AI] Target unit disappeared, redirecting attack to Player`);
            showToast(`相手の【${attack.attacker.card.name}】がプレイヤーへ攻撃！`, 'warn');
            dispatch({ type: 'DECLARE_ATTACK', attackerId: attack.attacker.instanceId });
          }
        }

        setActiveAttackerId(null);
        await sleep(1100);
        
        const afterAttackPromptCleared = await waitForPrompt();
        if (!afterAttackPromptCleared) return;
      }

      if (!isSafeToContinue()) return;

      // ⑤ ターン終了
      console.log('[AI] Ending turn...');
      setAiThinkingText('ターン終了');
      await sleep(800);
      if (isSafeToContinue()) {
        console.log('[AI] --- Turn Complete ---');
        dispatch({ type: 'NEXT_PHASE' });
      }
    } catch (err) {
      console.error('[AI] Exception during AI Turn Sequence:', err, 'State:', { turnCount: stateRef.current.turnCount, phase: stateRef.current.phase, currentPlayer: stateRef.current.currentPlayer });
      // 安全な復旧（フォールバック）
      if (stateRef.current.currentPlayer === 'player2' && !stateRef.current.winner) {
        console.log('[AI] Attempting safe fallback to NEXT_PHASE...');
        dispatch({ type: 'NEXT_PHASE' });
      }
    } finally {
      isRunningAITurnRef.current = false;
      setAiThinkingText(null);
      setActiveAttackerId(null);
      console.log('[AI] Turn lock released.');
    }
  };

  const triggerCutin = (card: CardTemplate, title: string) => {
    setCutinCard({ card, title });
    setTimeout(() => {
      setCutinCard(null);
    }, 1400);
  };

  const handleBoardClick = () => {
    setSelectedCardId(null);
    setPreviewCard(null);
    setPreviewStats(undefined);
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

  // Drop onto friendly unit (Evolution summon via HTML5 drag or pointer)
  const handleDropOnUnit = (baseUnit: UnitState, e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const raw = e.dataTransfer.getData('application/json');
    if (!raw) return;
    try {
      const card = JSON.parse(raw);
      const cardId = card.cardId || card.id;
      const tpl = getCard(cardId);
      if (tpl.type === 'Evolution') {
        const playable = isMyTurn && state.phase === 'ACTION' && canPlayCard(tpl, me.currentArcana, me.arcana, me.field.length);
        if (playable) {
          soundManager.playEvolve();
          triggerCutin(tpl, '進化召喚！');
          dispatch({
            type: 'PLAY_CARD',
            instanceId: card.instanceId,
            evolutionTargetId: baseUnit.instanceId,
          });
          showToast(`⚡ 【${tpl.name}】へ進化！`, 'success');
          setSelectedCardId(null);
        } else {
          showToast('アルカナまたは進化条件が足りません', 'warn');
        }
      }
    } catch {
      // ignore
    }
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
        soundManager.playManaCharge();
        dispatch({ type: 'PLACE_ARCANA', instanceId: card.instanceId });
        showToast('⚡ アルカナ充填！ 行動フェーズへ移行', 'success');
        setSelectedCardId(null);
      } else {
        showToast('今ターンはすでにアルカナを充填済みです', 'warn');
      }
    } else if (coords.y < 275 && coords.y > 40 && coords.x > 70 && coords.x < 770) {
      // Dropped onto Field Arena
      const tpl = getCard(card.cardId);
      const playable = isMyTurn && state.phase === 'ACTION' && canPlayCard(tpl, me.currentArcana, me.arcana, me.field.length);
      if (playable) {
        if (tpl.type === 'Evolution') {
          // Identify evolution target: check if dropped over a player unit slot
          let targetUnit: UnitState | undefined = undefined;

          // Check each friendly unit slot position (slot centers around x: 232 + slotIdx*76, y: 240)
          me.field.forEach((unit, slotIdx) => {
            const slotCenterX = 232 + slotIdx * 76;
            if (Math.abs(coords.x - slotCenterX) <= 42 && coords.y >= 170 && coords.y <= 290) {
              targetUnit = unit;
            }
          });

          // If not dropped directly on a slot, fallback to first valid evolution target on field
          if (!targetUnit) {
            if (tpl.evolutionTarget) {
              targetUnit = me.field.find(u => getCard(u.cards[0].cardId).lineage === tpl.evolutionTarget) || me.field[0];
            } else if (me.field.length > 0) {
              targetUnit = me.field[0];
            }
          }

          if (targetUnit) {
            soundManager.playEvolve();
            triggerCutin(tpl, '進化召喚！');
            dispatch({
              type: 'PLAY_CARD',
              instanceId: card.instanceId,
              evolutionTargetId: targetUnit.instanceId,
            });
            showToast(`⚡ 【${tpl.name}】へ進化召喚！`, 'success');
            setSelectedCardId(null);
          } else {
            showToast('自軍フィールドに進化元のユニットがいません', 'warn');
          }
        } else {
          if (tpl.type === 'Unit') {
            soundManager.playSummonUnit();
          } else if (tpl.type === 'Spell') {
            soundManager.playCardSwipe();
          }
          handlePlayHandCard(card.instanceId);
        }
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
    // 1. Check pendingSpell target selection mode
    if (pendingSpell) {
      if (targetType === 'unit' && targetUnit) {
        return pendingSpell.validTargets.includes(targetUnit.instanceId);
      }
      if (targetType === 'domain' && pendingSpell.targetTypes.includes('domain')) {
        return opp.domain ? pendingSpell.validTargets.includes(opp.domain.instanceId) : false;
      }
      if (targetType === 'rune' && pendingSpell.targetTypes.includes('rune')) {
        return true;
      }
      return false;
    }

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

  // Attack animation execution with sound & spark flash
  const performAttackAnimation = (attackerId: string, targetId?: string, targetPos?: { x: number; y: number }) => {
    setActiveAttackerId(attackerId);
    if (targetPos) {
      setClashSparkPos(targetPos);
      setTimeout(() => setClashSparkPos(null), 420);
    }
    soundManager.playAttackClash();
    setTimeout(() => {
      setIsScreenShaking(true);
      setTimeout(() => setIsScreenShaking(false), 380);
      setActiveAttackerId(null);
      dispatch({ type: 'DECLARE_ATTACK', attackerId, targetId });
    }, 200);
  };

  // 0.7s Long-Press / Drag logic for Friendly Units
  const clearPlayerUnitLongPressTimer = () => {
    if (playerUnitLongPressTimer.current !== null) {
      clearTimeout(playerUnitLongPressTimer.current as NodeJS.Timeout);
      playerUnitLongPressTimer.current = null;
    }
  };

  const handlePlayerUnitPointerDown = (unit: UnitState, slotIdx: number, e: React.PointerEvent) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    e.stopPropagation();

    // Guard against firing long-press if already attacking or dragging
    if (activeAttackerId !== null || isDraggingRef.current || attackDrag) return;

    clearPlayerUnitLongPressTimer();
    hasPlayerUnitLongPressed.current = false;
    touchStartPosRef.current = { x: e.clientX, y: e.clientY };
    isDraggingRef.current = false;

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

    playerUnitPointerDownPos.current = {
      unit,
      slotIdx,
      clientX: e.clientX,
      clientY: e.clientY,
      canvasStartX: startX,
      canvasStartY: startY,
      time: Date.now(),
    };

    // Start 700ms long press timer for smart floating HUD
    playerUnitLongPressTimer.current = setTimeout(() => {
      if (!isDraggingRef.current && activeAttackerId === null && !attackDrag) {
        hasPlayerUnitLongPressed.current = true;
        soundManager.playDetailOpen();
        const card = getCard(unit.cards[0].cardId);
        const stats = calculateUnitStats(state, 'player1', unit);
        setPreviewCard(card);
        setPreviewStats(stats);
      }
      clearPlayerUnitLongPressTimer();
    }, 700);

    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      // ignore
    }
  };

  const handlePlayerUnitPointerMove = (unit: UnitState, slotIdx: number, e: React.PointerEvent) => {
    if (!playerUnitPointerDownPos.current || playerUnitPointerDownPos.current.unit.instanceId !== unit.instanceId) return;

    const dx = Math.abs(e.clientX - playerUnitPointerDownPos.current.clientX);
    const dy = Math.abs(e.clientY - playerUnitPointerDownPos.current.clientY);

    // Cancel 700ms long-press immediately when moved more than 8px
    if (dx > 8 || dy > 8) {
      isDraggingRef.current = true;
      clearPlayerUnitLongPressTimer();

      // Check if unit is ready to attack
      const isAttackerReady = isMyTurn && state.phase === 'ACTION' && !unit.isRested && !unit.hasSummoningSickness;
      if (isAttackerReady && !attackDrag) {
        const currentCoords = getCanvasCoords(e.clientX, e.clientY);
        setAttackDrag({
          attackerId: unit.instanceId,
          startX: playerUnitPointerDownPos.current.canvasStartX,
          startY: playerUnitPointerDownPos.current.canvasStartY,
          currentX: currentCoords.x,
          currentY: currentCoords.y,
          lockedTarget: null,
        });
        setSelectedCardId(unit.instanceId);
      }
    }
  };

  const handlePlayerUnitPointerUp = (unit: UnitState, slotIdx: number, e: React.PointerEvent) => {
    clearPlayerUnitLongPressTimer();
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }

    const hadLongPressed = hasPlayerUnitLongPressed.current;
    const wasDragging = attackDrag !== null || isDraggingRef.current;

    playerUnitPointerDownPos.current = null;
    touchStartPosRef.current = null;
    hasPlayerUnitLongPressed.current = false;
    setTimeout(() => {
      isDraggingRef.current = false;
    }, 50);

    if (!wasDragging && !hadLongPressed) {
      // Short tap (<700ms, <8px)
      soundManager.playCardTouch();
      handleCardClick(unit.instanceId, e as any);
    }
  };

  // 0.7s Long-Press logic for Opponent Units
  const clearOppUnitLongPressTimer = () => {
    if (oppUnitLongPressTimer.current !== null) {
      clearTimeout(oppUnitLongPressTimer.current as NodeJS.Timeout);
      oppUnitLongPressTimer.current = null;
    }
  };

  const handleOppUnitPointerDown = (unit: UnitState, slotIdx: number, e: React.PointerEvent) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    e.stopPropagation();

    if (activeAttackerId !== null || isDraggingRef.current || attackDrag) return;

    clearOppUnitLongPressTimer();
    hasOppUnitLongPressed.current = false;
    touchStartPosRef.current = { x: e.clientX, y: e.clientY };
    isDraggingRef.current = false;

    oppUnitPointerDownPos.current = {
      unit,
      slotIdx,
      clientX: e.clientX,
      clientY: e.clientY,
    };

    oppUnitLongPressTimer.current = setTimeout(() => {
      if (!isDraggingRef.current && activeAttackerId === null && !attackDrag) {
        hasOppUnitLongPressed.current = true;
        soundManager.playDetailOpen();
        const card = getCard(unit.cards[0].cardId);
        const stats = calculateUnitStats(state, 'player2', unit);
        setPreviewCard(card);
        setPreviewStats(stats);
      }
      clearOppUnitLongPressTimer();
    }, 700);

    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      // ignore
    }
  };

  const handleOppUnitPointerMove = (unit: UnitState, e: React.PointerEvent) => {
    if (!oppUnitPointerDownPos.current || oppUnitPointerDownPos.current.unit.instanceId !== unit.instanceId) return;
    const dx = Math.abs(e.clientX - oppUnitPointerDownPos.current.clientX);
    const dy = Math.abs(e.clientY - oppUnitPointerDownPos.current.clientY);
    if (dx > 8 || dy > 8) {
      isDraggingRef.current = true;
      clearOppUnitLongPressTimer();
    }
  };

  const handleOppUnitPointerUp = (unit: UnitState, e: React.PointerEvent) => {
    clearOppUnitLongPressTimer();
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }
    const hadLongPressed = hasOppUnitLongPressed.current;
    const wasDragging = isDraggingRef.current;
    oppUnitPointerDownPos.current = null;
    touchStartPosRef.current = null;
    hasOppUnitLongPressed.current = false;
    setTimeout(() => {
      isDraggingRef.current = false;
    }, 50);

    if (!hadLongPressed && !wasDragging) {
      soundManager.playCardTouch();
      handleCardClick(unit.instanceId, e as any);
    }
  };

  // 0.7s Long-Press logic for Domain and Runes
  const clearSlotLongPressTimer = () => {
    if (slotLongPressTimer.current !== null) {
      clearTimeout(slotLongPressTimer.current as NodeJS.Timeout);
      slotLongPressTimer.current = null;
    }
  };

  const handleSlotCardPointerDown = (card: CardTemplate, instanceId: string, e: React.PointerEvent) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    e.stopPropagation();

    if (activeAttackerId !== null || isDraggingRef.current || attackDrag) return;

    clearSlotLongPressTimer();
    hasSlotLongPressed.current = false;
    touchStartPosRef.current = { x: e.clientX, y: e.clientY };
    isDraggingRef.current = false;

    slotPointerDownPos.current = {
      clientX: e.clientX,
      clientY: e.clientY,
      card,
      instanceId,
    };

    slotLongPressTimer.current = setTimeout(() => {
      if (!isDraggingRef.current && activeAttackerId === null && !attackDrag) {
        hasSlotLongPressed.current = true;
        soundManager.playDetailOpen();
        setPreviewCard(card);
        setPreviewStats(undefined);
      }
      clearSlotLongPressTimer();
    }, 700);

    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      // ignore
    }
  };

  const handleSlotCardPointerMove = (e: React.PointerEvent) => {
    if (!slotPointerDownPos.current) return;
    const dx = Math.abs(e.clientX - slotPointerDownPos.current.clientX);
    const dy = Math.abs(e.clientY - slotPointerDownPos.current.clientY);
    if (dx > 8 || dy > 8) {
      isDraggingRef.current = true;
      clearSlotLongPressTimer();
    }
  };

  const handleSlotCardPointerUp = (instanceId: string, e: React.PointerEvent) => {
    clearSlotLongPressTimer();
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }
    const hadLongPressed = hasSlotLongPressed.current;
    const wasDragging = isDraggingRef.current;
    slotPointerDownPos.current = null;
    touchStartPosRef.current = null;
    hasSlotLongPressed.current = false;
    setTimeout(() => {
      isDraggingRef.current = false;
    }, 50);

    if (!hadLongPressed && !wasDragging) {
      soundManager.playCardTouch();
      handleCardClick(instanceId, e as any);
    }
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

    const currentLockedId = locked ? (locked.type === 'unit' ? locked.id : 'player') : null;
    if (currentLockedId && currentLockedId !== prevLockedTargetId.current) {
      soundManager.playAttackLock();
    }
    prevLockedTargetId.current = currentLockedId;

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
        attackDrag.lockedTarget.type === 'unit' ? attackDrag.lockedTarget.id : undefined,
        { x: attackDrag.lockedTarget.snapX, y: attackDrag.lockedTarget.snapY }
      );
      showToast(
        attackDrag.lockedTarget.type === 'player'
          ? '⚔️ ダイレクトアタック！'
          : `⚔️ 【${attackDrag.lockedTarget.name}】へ攻撃！`,
        'success'
      );
      setSelectedCardId(null);
    }
    prevLockedTargetId.current = null;
    setAttackDrag(null);
  };

  const handleOpponentDirectAttack = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (canDirectAttack && selectedCardId) {
      performAttackAnimation(selectedCardId, undefined, { x: 422, y: 55 });
      setSelectedCardId(null);
    }
  };

  const handleCardClick = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isMyTurn) return;

    // 0. Pending Spell Target Resolution (v0.07 Fix)
    if (pendingSpell) {
      if (pendingSpell.validTargets.includes(id)) {
        soundManager.playCardSwipe();
        triggerCutin(pendingSpell.template, '呪文詠唱！');
        dispatch({
          type: 'PLAY_CARD',
          instanceId: pendingSpell.cardInstance.instanceId,
          targetId: id,
        });
        showToast(`【${pendingSpell.template.name}】を発動しました！`, 'success');
        setPendingSpell(null);
        setSelectedCardId(null);
        return;
      } else {
        showToast('そのカードは対象に選択できません', 'warn');
        return;
      }
    }

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

    // Target selection mode active prompt
    if (state.prompt?.type === 'TARGET_SELECTION') {
      if (state.prompt.validTargets.includes(id)) {
        soundManager.playCardSwipe();
        dispatch({ type: 'RESOLVE_SPELL_TARGET', targetId: id });
        setSelectedCardId(null);
        return;
      }
    }

    // Action Phase
    if (state.phase === 'ACTION') {
      const inHand = me.hand.find(c => c.instanceId === id);
      if (inHand) {
        const tpl = getCard(inHand.cardId);

        // Spell card clicked in hand: initiate play or target selection
        if (tpl.type === 'Spell') {
          handlePlaySpell(inHand);
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

      // Opponent Domain clicked
      if (opp.domain && opp.domain.instanceId === id) {
        if (selectedCardId) {
          const selHand = me.hand.find(c => c.instanceId === selectedCardId);
          if (selHand) {
            const spellTpl = getCard(selHand.cardId);
            if (spellTpl.id === 'BN-03') {
              triggerCutin(spellTpl, '呪文詠唱！');
              dispatch({ type: 'PLAY_CARD', instanceId: selectedCardId, targetId: id });
              setSelectedCardId(null);
              return;
            }
          }
        }
      }

      // Opponent Rune clicked
      const clickedRune = opp.runes.find(r => r.instanceId === id);
      if (clickedRune) {
        if (selectedCardId) {
          const selHand = me.hand.find(c => c.instanceId === selectedCardId);
          if (selHand) {
            const spellTpl = getCard(selHand.cardId);
            if (spellTpl.id === 'BN-04') {
              triggerCutin(spellTpl, '呪文詠唱！');
              dispatch({ type: 'PLAY_CARD', instanceId: selectedCardId, targetId: id });
              setSelectedCardId(null);
              return;
            }
          }
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

  const handleRestartGame = () => {
    soundManager.playCardSwipe();
    setPreviewCard(null);
    setPreviewStats(undefined);
    setSelectedCardId(null);
    setPendingSpell(null);
    setAttackDrag(null);
    setActiveAttackerId(null);
    setArcanaMode(false);
    dispatch({ type: 'START_GAME' });
  };

  const handlePlaySpell = (cardInst: CardInstance) => {
    const tpl = getCard(cardInst.cardId);

    // 【BW-13】聖者の祈り：アーカイブからこのカード以外のスペルかルーン1枚を回収
    if (tpl.id === 'BW-13') {
      const validArchiveCards = me.archive.filter(c => {
        if (c.cardId === 'BW-13') return false;
        const t = getCard(c.cardId);
        return t.type === 'Spell' || t.type === 'Rune';
      });
      if (validArchiveCards.length === 0) {
        soundManager.playCardSwipe();
        triggerCutin(tpl, '呪文詠唱！');
        dispatch({ type: 'PLAY_CARD', instanceId: cardInst.instanceId });
        showToast('アーカイブに対象が存在しないため不発となりました', 'warn');
        setSelectedCardId(null);
        setPendingSpell(null);
        return;
      }
      setZoneModal({
        isOpen: true,
        title: '【聖者の祈り】：回収するスペルまたはルーンを選択',
        zoneType: 'archive',
        cards: validArchiveCards,
        isOpponent: false,
        selectionMode: {
          promptText: '手札に加えるカードを選択してください',
          canSelect: (cTpl) => (cTpl.type === 'Spell' || cTpl.type === 'Rune') && cTpl.id !== 'BW-13',
          onSelect: (chosenId) => {
            soundManager.playCardSwipe();
            triggerCutin(tpl, '呪文詠唱！');
            dispatch({ type: 'PLAY_CARD', instanceId: cardInst.instanceId, targetId: chosenId });
            showToast(`【${tpl.name}】を発動しました！`, 'success');
            setSelectedCardId(null);
            setPendingSpell(null);
          },
        },
      });
      return;
    }

    // 対象が必要なスペル判定（BR-12, BB-12, BW-12, BG-13, BD-13, BN-03, BN-04）
    const targetSpellIds = ['BR-12', 'BB-12', 'BW-12', 'BG-13', 'BD-13', 'BN-03', 'BN-04'];
    if (tpl.targetReq || targetSpellIds.includes(tpl.id)) {
      const validTargetIds = getValidSpellTargets(state, tpl.id, cardInst.instanceId);

      // 有効な対象が盤面に存在しない場合は不発として安全に解決（フリーズ防止）
      if (validTargetIds.length === 0) {
        soundManager.playCardSwipe();
        triggerCutin(tpl, '呪文詠唱！');
        dispatch({ type: 'PLAY_CARD', instanceId: cardInst.instanceId });
        showToast(`対象が存在しないため【${tpl.name}】の効果は不発となりました`, 'warn');
        setSelectedCardId(null);
        setPendingSpell(null);
        return;
      }

      // 対象選択モードへ移行
      let targetTypes: ('unit' | 'domain' | 'rune' | 'archive')[] = ['unit'];
      let targetDesc = '対象の相手ユニットを選択してください';
      if (tpl.id === 'BN-03') {
        targetTypes = ['domain'];
        targetDesc = '破壊する相手のドメインを選択してください';
      } else if (tpl.id === 'BN-04') {
        targetTypes = ['rune'];
        targetDesc = '手札に戻す相手のルーンを選択してください';
      }

      setPendingSpell({
        cardInstance: cardInst,
        template: tpl,
        validTargets: validTargetIds,
        targetTypes,
        message: `【${tpl.name}】：${targetDesc}`,
      });
      setSelectedCardId(null);
      showToast(`【${tpl.name}】の対象を選択してください`, 'info');
      return;
    }

    // 対象不要のスペル（BR-13, BB-13, BG-12, BD-12 等）：即時発動
    soundManager.playCardSwipe();
    triggerCutin(tpl, '呪文詠唱！');
    dispatch({ type: 'PLAY_CARD', instanceId: cardInst.instanceId });
    showToast(`【${tpl.name}】を発動！`, 'success');
    setSelectedCardId(null);
    setPendingSpell(null);
  };

  const handlePlayHandCard = (instanceId: string) => {
    const cardInst = me.hand.find(c => c.instanceId === instanceId);
    if (cardInst) {
      const tpl = getCard(cardInst.cardId);
      if (tpl.type === 'Spell') {
        handlePlaySpell(cardInst);
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

        {/* Top-Left: Hamburger Menu Button, Sound Mute Button & Turn Counter */}
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
          {onOpenDeckBuilder && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onOpenDeckBuilder();
              }}
              className="w-7 h-7 rounded-lg bg-black/70 hover:bg-black/90 border border-cyan-500/40 hover:border-cyan-400 flex items-center justify-center text-cyan-300 hover:text-white transition-all shadow-md active:scale-95 cursor-pointer backdrop-blur-sm"
              title="デッキ編成画面を開く"
            >
              <Layers size={14} />
            </button>
          )}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              const nextMuted = soundManager.toggleMute();
              setIsMuted(nextMuted);
            }}
            className="w-7 h-7 rounded-lg bg-black/70 hover:bg-black/90 border border-white/20 hover:border-cyan-400 flex items-center justify-center text-slate-200 hover:text-white transition-all shadow-md active:scale-95 cursor-pointer backdrop-blur-sm"
            title={isMuted ? '効果音: OFF (タップでON)' : '効果音: ON (タップでOFF)'}
          >
            {isMuted ? <VolumeX size={14} className="text-red-400" /> : <Volume2 size={14} className="text-cyan-400" />}
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
        {/* 2. LEFT CYBER SLOTS: Domain & Runes (Candidate B: 52px x 70px)            */}
        {/* ========================================================================= */}

        {/* Top-Left: Opponent Domain & Runes (Candidate B: 52px x 70px) */}
        <div className="absolute top-11 left-2.5 z-20 flex items-start space-x-1.5 pointer-events-auto select-none">
          {/* Opponent Domain */}
          {(() => {
            const isDomainTarget = !!opp.domain && (
              (pendingSpell && pendingSpell.targetTypes.includes('domain') && pendingSpell.validTargets.includes(opp.domain.instanceId)) ||
              (state.prompt?.type === 'TARGET_SELECTION' && state.prompt.validTargets.includes(opp.domain.instanceId)) ||
              (!!selectedCardId && me.hand.some(c => c.instanceId === selectedCardId && getCard(c.cardId).id === 'BN-03'))
            );
            return (
              <div className="flex flex-col items-center">
                <span className={`text-[7px] font-black uppercase tracking-wider mb-0.5 ${isDomainTarget ? 'text-yellow-300 animate-pulse' : 'text-amber-400'}`}>
                  DOMAIN {isDomainTarget ? '★TARGET' : ''}
                </span>
                {opp.domain ? (
                  <div
                    className={`w-[52px] h-[70px] rounded-md border overflow-hidden shadow-lg transition-transform ${
                      isDomainTarget
                        ? 'border-yellow-400 ring-2 ring-yellow-400 animate-pulse scale-105 shadow-[0_0_20px_rgba(250,204,21,0.9)] cursor-pointer z-30'
                        : 'border-amber-400/60 cursor-pointer hover:scale-105 active:scale-95'
                    }`}
                    onClick={(e) => {
                      if (isDomainTarget) {
                        e.stopPropagation();
                        soundManager.playCardSwipe();
                        if (pendingSpell) {
                          triggerCutin(pendingSpell.template, '呪文詠唱！');
                          dispatch({ type: 'PLAY_CARD', instanceId: pendingSpell.cardInstance.instanceId, targetId: opp.domain!.instanceId });
                          setPendingSpell(null);
                          showToast('相手のドメインを破壊しました！', 'success');
                        } else if (state.prompt?.type === 'TARGET_SELECTION') {
                          dispatch({ type: 'RESOLVE_SPELL_TARGET', targetId: opp.domain!.instanceId });
                        } else if (selectedCardId) {
                          dispatch({ type: 'PLAY_CARD', instanceId: selectedCardId, targetId: opp.domain!.instanceId });
                          setSelectedCardId(null);
                        }
                      }
                    }}
                    onPointerDown={(e) => !isDomainTarget && handleSlotCardPointerDown(getCard(opp.domain!.cardId), opp.domain!.instanceId, e)}
                    onPointerMove={!isDomainTarget ? handleSlotCardPointerMove : undefined}
                    onPointerUp={(e) => !isDomainTarget && handleSlotCardPointerUp(opp.domain!.instanceId, e)}
                    onPointerCancel={clearSlotLongPressTimer}
                  >
                    <CardView instance={opp.domain} size="compact" onInspect={() => {}} />
                  </div>
                ) : (
                  <div className="w-[52px] h-[70px] rounded-md border border-dashed border-amber-400/25 bg-amber-950/20 flex flex-col items-center justify-center text-[8px] text-amber-400/40 font-bold">
                    <span>空</span>
                    <span className="text-[6px] tracking-tighter opacity-60">DOMAIN</span>
                  </div>
                )}
              </div>
            );
          })()}

          {/* Opponent Runes (2 Sockets, Candidate B: 52px x 70px) */}
          <div className="flex flex-col items-center">
            <span className="text-[7px] font-black text-slate-400 uppercase tracking-wider mb-0.5">RUNES</span>
            <div className="flex space-x-1">
              {[0, 1].map((rIdx) => {
                const rune = opp.runes[rIdx];
                const isRuneTarget = !!rune && (
                  (pendingSpell && pendingSpell.targetTypes.includes('rune') && pendingSpell.validTargets.includes(rune.instanceId)) ||
                  (state.prompt?.type === 'TARGET_SELECTION' && state.prompt.validTargets.includes(rune.instanceId)) ||
                  (!!selectedCardId && me.hand.some(c => c.instanceId === selectedCardId && getCard(c.cardId).id === 'BN-04'))
                );
                return rune ? (
                  <div
                    key={rune.instanceId}
                    className={`w-[52px] h-[70px] rounded-md border overflow-hidden shadow transition-transform ${
                      isRuneTarget
                        ? 'border-yellow-400 ring-2 ring-yellow-400 animate-pulse scale-105 shadow-[0_0_20px_rgba(250,204,21,0.9)] cursor-pointer z-30'
                        : 'border-slate-600/60 cursor-pointer hover:scale-105 active:scale-95'
                    }`}
                    onClick={(e) => {
                      if (isRuneTarget) {
                        e.stopPropagation();
                        soundManager.playCardSwipe();
                        if (pendingSpell) {
                          triggerCutin(pendingSpell.template, '呪文詠唱！');
                          dispatch({ type: 'PLAY_CARD', instanceId: pendingSpell.cardInstance.instanceId, targetId: rune.instanceId });
                          setPendingSpell(null);
                          showToast('相手のルーンを手札に戻しました！', 'success');
                        } else if (state.prompt?.type === 'TARGET_SELECTION') {
                          dispatch({ type: 'RESOLVE_SPELL_TARGET', targetId: rune.instanceId });
                        } else if (selectedCardId) {
                          dispatch({ type: 'PLAY_CARD', instanceId: selectedCardId, targetId: rune.instanceId });
                          setSelectedCardId(null);
                        }
                      } else {
                        handleCardClick(rune.instanceId, e);
                      }
                    }}
                  >
                    <CardView isFaceDown size="compact" onInspect={() => {}} />
                  </div>
                ) : (
                  <div key={`empty-rune-${rIdx}`} className="w-[52px] h-[70px] rounded-md border border-dashed border-white/20 bg-black/30 flex flex-col items-center justify-center text-[8px] text-white/30 font-bold">
                    <span>{rIdx + 1}</span>
                    <span className="text-[6px] tracking-tighter opacity-50">RUNE</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Bottom-Left: Player Domain & Runes (Candidate B: 52px x 70px) */}
        <div className="absolute bottom-20 left-2.5 z-20 flex items-start space-x-1.5 pointer-events-auto select-none">
          {/* Player Domain */}
          <div className="flex flex-col items-center">
            <span className="text-[7px] font-black text-cyan-400 uppercase tracking-wider mb-0.5">DOMAIN</span>
            {me.domain ? (
              <div
                className="w-[52px] h-[70px] rounded-md border border-cyan-400/70 overflow-hidden shadow-lg shadow-cyan-500/20 cursor-pointer transition-transform hover:scale-105 active:scale-95"
                onPointerDown={(e) => handleSlotCardPointerDown(getCard(me.domain!.cardId), me.domain!.instanceId, e)}
                onPointerMove={handleSlotCardPointerMove}
                onPointerUp={(e) => handleSlotCardPointerUp(me.domain!.instanceId, e)}
                onPointerCancel={clearSlotLongPressTimer}
              >
                <CardView instance={me.domain} size="compact" onInspect={() => {}} />
              </div>
            ) : (
              <div className="w-[52px] h-[70px] rounded-md border border-dashed border-cyan-500/25 bg-cyan-950/20 flex flex-col items-center justify-center text-[8px] text-cyan-300/40 font-bold">
                <span>空</span>
                <span className="text-[6px] tracking-tighter opacity-60">DOMAIN</span>
              </div>
            )}
          </div>

          {/* Player Runes (2 Sockets, Candidate B: 52px x 70px) */}
          <div className="flex flex-col items-center">
            <span className="text-[7px] font-black text-cyan-400 uppercase tracking-wider mb-0.5">RUNES</span>
            <div className="flex space-x-1">
              {me.runes[0] ? (
                <div
                  className="w-[52px] h-[70px] rounded-md border border-cyan-500/50 overflow-hidden shadow-lg shadow-cyan-500/20 cursor-pointer transition-transform hover:scale-105 active:scale-95"
                  onPointerDown={(e) => handleSlotCardPointerDown(getCard(me.runes[0].cardId), me.runes[0].instanceId, e)}
                  onPointerMove={handleSlotCardPointerMove}
                  onPointerUp={(e) => handleSlotCardPointerUp(me.runes[0].instanceId, e)}
                  onPointerCancel={clearSlotLongPressTimer}
                >
                  <CardView isFaceDown size="compact" onInspect={() => {}} />
                </div>
              ) : (
                <div className="w-[52px] h-[70px] rounded-md border border-dashed border-cyan-500/30 bg-cyan-950/20 flex flex-col items-center justify-center text-[8px] text-cyan-300/40 font-bold">
                  <span>1</span>
                  <span className="text-[6px] tracking-tighter opacity-60">RUNE</span>
                </div>
              )}
              {me.runes[1] ? (
                <div
                  className="w-[52px] h-[70px] rounded-md border border-cyan-500/50 overflow-hidden shadow-lg shadow-cyan-500/20 cursor-pointer transition-transform hover:scale-105 active:scale-95"
                  onPointerDown={(e) => handleSlotCardPointerDown(getCard(me.runes[1].cardId), me.runes[1].instanceId, e)}
                  onPointerMove={handleSlotCardPointerMove}
                  onPointerUp={(e) => handleSlotCardPointerUp(me.runes[1].instanceId, e)}
                  onPointerCancel={clearSlotLongPressTimer}
                >
                  <CardView isFaceDown size="compact" onInspect={() => {}} />
                </div>
              ) : (
                <div className="w-[52px] h-[70px] rounded-md border border-dashed border-cyan-500/30 bg-cyan-950/20 flex flex-col items-center justify-center text-[8px] text-cyan-300/40 font-bold">
                  <span>2</span>
                  <span className="text-[6px] tracking-tighter opacity-60">RUNE</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* 3. CENTER BATTLEFIELD ARENA: Full-Width 6 vs 6 Unit Slots                 */}
        {/* ========================================================================= */}
        <div
          id="center-arena"
          className="absolute inset-x-16 top-9 bottom-4 flex flex-col justify-between items-center px-2 z-10 pointer-events-auto"
        >
          {/* Guide Banner for Pending Spell Target Selection (v0.07 Fix) */}
          {pendingSpell && (
            <div className="absolute top-1 z-50 bg-indigo-950/95 border border-emerald-400 px-3.5 py-0.5 rounded-full shadow-2xl text-[9.5px] font-bold text-emerald-300 flex items-center space-x-2 animate-pulse">
              <Zap size={11} className="text-yellow-300" />
              <span>{pendingSpell.message}</span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setPendingSpell(null);
                  showToast('スペル詠唱をキャンセルしました', 'info');
                }}
                className="ml-2 px-2 py-0.2 bg-rose-700/90 hover:bg-rose-600 text-white text-[8.5px] rounded-full font-bold transition-colors cursor-pointer"
              >
                キャンセル
              </button>
            </div>
          )}
          {state.prompt?.type === 'TARGET_SELECTION' && (
            <div className="absolute top-1 z-50 bg-indigo-950/95 border border-yellow-400 px-3.5 py-0.5 rounded-full shadow-xl text-[9px] font-bold text-yellow-300 flex items-center space-x-1 animate-pulse">
              <Zap size={10} className="text-yellow-300" />
              <span>{state.prompt.message || '対象を選択してください'}</span>
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
                  onPointerDown={(e) => unit && handleOppUnitPointerDown(unit, slotIdx, e)}
                  onPointerMove={(e) => unit && handleOppUnitPointerMove(unit, e)}
                  onPointerUp={(e) => unit && handleOppUnitPointerUp(unit, e)}
                  onPointerCancel={clearOppUnitLongPressTimer}
                  className={`relative w-[68px] h-[90px] rounded-lg flex items-center justify-center shrink-0 transition-all select-none ${
                    unit
                      ? 'overflow-visible cursor-pointer'
                      : 'border border-cyan-500/15 bg-cyan-950/10 shadow-inner'
                  } ${
                    isLockedTarget
                      ? 'ring-4 ring-yellow-400 shadow-[0_0_25px_rgba(250,204,21,1)] scale-105 z-40'
                      : isTarget
                        ? 'ring-2 ring-yellow-400 shadow-lg shadow-yellow-400/60 animate-pulse z-30'
                        : ''
                  } ${isAttacking ? 'animate-attack-dash z-40' : ''}`}
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
                      onInspect={() => {}}
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
              const isTarget = unit ? isTargetValidForSelected('unit', unit) : false;
              const isAttackerReady = unit && isMyTurn && state.phase === 'ACTION' && !unit.isRested && !unit.hasSummoningSickness;
              const isDraggingThisAttacker = unit && attackDrag?.attackerId === unit.instanceId;
              const isAttacking = unit && activeAttackerId === unit.instanceId;
              const hasRipple = !summonRippleSlot?.isOpponent && summonRippleSlot?.slotIdx === slotIdx;

              return (
                <div
                  key={unit ? unit.instanceId : `me-slot-${slotIdx}`}
                  id={`me-slot-${slotIdx}`}
                  onDragOver={(e) => {
                    if (unit) e.preventDefault();
                  }}
                  onDrop={(e) => {
                    if (unit) handleDropOnUnit(unit, e);
                  }}
                  onPointerDown={(e) => {
                    if (unit) {
                      handlePlayerUnitPointerDown(unit, slotIdx, e);
                    }
                  }}
                  onPointerMove={(e) => {
                    if (unit) {
                      handlePlayerUnitPointerMove(unit, slotIdx, e);
                    }
                  }}
                  onPointerUp={(e) => {
                    if (unit) {
                      handlePlayerUnitPointerUp(unit, slotIdx, e);
                    } else if (isSelectedHandPlayable && selectedHandCard) {
                      handlePlayHandCard(selectedHandCard.instanceId);
                    }
                  }}
                  onPointerCancel={clearPlayerUnitLongPressTimer}
                  className={`relative w-[68px] h-[90px] rounded-lg flex items-center justify-center shrink-0 transition-all select-none ${
                    unit
                      ? 'overflow-visible cursor-pointer'
                      : isSelectedHandPlayable
                        ? 'border-2 border-emerald-400 bg-emerald-950/40 cursor-pointer shadow-lg shadow-emerald-500/40 animate-pulse'
                        : 'border border-cyan-500/15 bg-cyan-950/10 shadow-inner'
                  } ${
                    isDraggingThisAttacker
                      ? 'ring-4 ring-amber-400 scale-105 shadow-[0_0_25px_rgba(245,158,11,1)] z-40'
                      : isTarget
                        ? 'ring-2 ring-emerald-400 shadow-lg shadow-emerald-400/60 animate-pulse z-30'
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
                      onInspect={() => {}}
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
        {/* SMART FLOATING HUD CARD PREVIEW (TOP-LEFT, NO DARKENING OVERLAY)          */}
        {/* ========================================================================= */}
        <FloatingCardPreview
          card={previewCard}
          computedStats={previewStats}
          onClose={() => {
            setPreviewCard(null);
            setPreviewStats(undefined);
          }}
        />

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
            onInspect={(card) => {
              setPreviewCard(card);
              setPreviewStats(undefined);
            }}
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
        {/* BATTLE CLASH SPARK FLASH OVERLAY                                          */}
        {/* ========================================================================= */}
        {clashSparkPos && (
          <div
            className="absolute pointer-events-none z-50 animate-clash-spark flex items-center justify-center -translate-x-1/2 -translate-y-1/2"
            style={{ left: `${clashSparkPos.x}px`, top: `${clashSparkPos.y}px` }}
          >
            {/* Radial Impact Flash */}
            <div className="w-28 h-28 rounded-full bg-gradient-to-r from-amber-300 via-yellow-200 to-white opacity-95 blur-xs shadow-[0_0_50px_rgba(251,191,36,1)]" />
            {/* Cross Laser Slash */}
            <div className="absolute w-44 h-1 bg-white shadow-[0_0_20px_rgba(255,255,255,1)] rotate-45" />
            <div className="absolute w-44 h-1 bg-white shadow-[0_0_20px_rgba(255,255,255,1)] -rotate-45" />
          </div>
        )}

        {/* ========================================================================= */}
        {/* AI THINKING STATUS HUD (Pulsing badge during opponent's turn)             */}
        {/* ========================================================================= */}
        {!isMyTurn && !state.winner && (
          <div className="absolute top-2 left-1/2 -translate-x-1/2 z-40 pointer-events-none flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-950/90 border border-amber-400/60 shadow-[0_0_20px_rgba(245,158,11,0.4)] text-amber-200 text-[11px] font-bold tracking-wide backdrop-blur animate-pulse">
            <Sparkles size={13} className="text-amber-400 animate-spin" style={{ animationDuration: '3s' }} />
            <span>{aiThinkingText || '相手AIが思考中...'}</span>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TURN START BANNER ("YOUR TURN" / "ENEMY TURN")                            */}
        {/* ========================================================================= */}
        {showYourTurnBanner && (
          <div className="absolute inset-0 pointer-events-none z-50 flex items-center justify-center animate-turn-banner">
            <div className={`px-12 py-3.5 rounded-2xl border-2 flex items-center space-x-3 backdrop-blur-md shadow-[0_0_60px_rgba(0,0,0,0.9)] ${
              isMyTurn
                ? 'bg-gradient-to-r from-cyan-950/95 via-blue-900/95 to-cyan-950/95 border-cyan-300 shadow-[0_0_50px_rgba(34,211,238,0.8)]'
                : 'bg-gradient-to-r from-red-950/95 via-amber-950/95 to-red-950/95 border-red-400 shadow-[0_0_50px_rgba(239,68,68,0.8)]'
            }`}>
              <Sparkles size={24} className={isMyTurn ? 'text-cyan-300 animate-spin' : 'text-red-400 animate-pulse'} />
              <div className="flex flex-col items-center">
                <span className="text-[11px] font-black tracking-widest text-slate-300 uppercase">
                  TURN {state.turnCount}
                </span>
                <span className={`text-2xl font-black tracking-wider uppercase drop-shadow-[0_0_20px_currentColor] ${
                  isMyTurn ? 'text-cyan-200' : 'text-red-300'
                }`}>
                  {isMyTurn ? 'YOUR TURN' : 'OPPONENT TURN'}
                </span>
              </div>
              <Sparkles size={24} className={isMyTurn ? 'text-cyan-300 animate-spin' : 'text-red-400 animate-pulse'} />
            </div>
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

              {/* Action 3: Deck Builder */}
              {onOpenDeckBuilder && (
                <button
                  type="button"
                  onClick={() => {
                    setShowMenu(false);
                    onOpenDeckBuilder();
                  }}
                  className="w-full py-2 px-3 rounded-xl bg-slate-900 hover:bg-slate-800 border border-cyan-700/50 flex items-center justify-between text-xs font-bold text-cyan-300 hover:text-white transition-colors cursor-pointer"
                >
                  <div className="flex items-center space-x-2">
                    <Layers size={14} className="text-cyan-400" />
                    <span>デッキ編成 (Deck Builder)</span>
                  </div>
                  <span className="text-[10px] text-cyan-400 font-bold">編集</span>
                </button>
              )}

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
          <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 backdrop-blur-md pointer-events-auto select-none p-4">
            <div className="bg-[#0b1329] border-2 border-cyan-400/80 rounded-2xl p-8 max-w-md w-full text-center shadow-[0_0_50px_rgba(6,182,212,0.6)] relative z-[10000] animate-in zoom-in-95">
              <h2 className={`text-4xl sm:text-5xl font-black mb-4 tracking-wider drop-shadow-lg ${state.winner === 'player1' ? 'text-amber-400 drop-shadow-[0_0_25px_rgba(251,191,36,0.6)]' : 'text-red-500 drop-shadow-[0_0_25px_rgba(239,68,68,0.6)]'}`}>
                {state.winner === 'player1' ? 'VICTORY' : 'DEFEAT'}
              </h2>
              <p className="text-slate-200 text-sm mb-6 leading-relaxed">
                {state.winner === 'player1' ? '対戦相手の結界を突破し、見事勝利しました！' : '自軍の結界がすべて破壊されました...'}
              </p>
              
              <div className="flex flex-col gap-2 relative z-[10001]">
                {/* 確実に押せる「もう一度遊ぶ」ボタン */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRestartGame();
                  }}
                  className="w-full py-3.5 px-6 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold rounded-xl shadow-[0_0_25px_rgba(6,182,212,0.6)] active:scale-95 transition-all cursor-pointer text-sm tracking-wider"
                >
                  もう一度遊ぶ
                </button>
                {onOpenDeckBuilder && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenDeckBuilder();
                    }}
                    className="w-full py-2.5 px-4 bg-slate-900/90 hover:bg-slate-800 text-cyan-300 font-bold rounded-xl border border-cyan-700/60 shadow active:scale-95 transition-all cursor-pointer text-xs flex items-center justify-center gap-1.5"
                  >
                    <Layers size={14} />
                    <span>デッキ編成へ</span>
                  </button>
                )}
              </div>
            </div>
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
