import React, { useState, useEffect, useRef } from 'react';
import { GameState, GameAction, CardInstance, CardTemplate, UnitState } from '../types';
import { CardView } from './CardView';
import { HandTray } from './HandTray';
import { ArcanaGauge } from './ArcanaGauge';
import { ActionControls } from './ActionControls';
import { PlaymatSelector, PlaymatThemeId, PLAYMAT_THEMES } from './PlaymatSelector';
import { ZoneViewerModal, ZoneSelectionConfig } from './ZoneViewerModal';
import { FloatingCardPreview } from './FloatingCardPreview';
import { AttackArrowOverlay } from './AttackArrowOverlay';
import { getCard } from '../data/cards';
import { calculateUnitStats, canPlayCard } from '../engine/engineUtils';
import { canUnitGuard, isValidAttackTarget } from '../engine/combatEngine';
import { getValidSpellTargets } from '../engine/spellSystem';
import { OpponentObserver, runAITurn, decidePromptResponse, aiDebug } from '../engine/ai';
import { History, X, Shield, Sparkles, Zap, Palette, Menu, Volume2, VolumeX, Layers, ScrollText, Eye, Hand, BookOpen } from 'lucide-react';
import { ELEMENTS } from './ui/elements';
import { Modal } from './ui/Modal';
import { Toast } from './ui/Toast';
import { CardBack } from './CardView';
import { soundManager } from '../utils/soundManager';

interface Props {
  state: GameState;
  dispatch: React.Dispatch<GameAction>;
  onInspect: (card: any) => void;
  onOpenDeckBuilder?: () => void;
}


// ---------------------------------------------------------------------------
// 盤面の小さな部品（再描画で再マウントされないようモジュール直下に置く）
// ---------------------------------------------------------------------------
const BarrierPips = ({ count, danger }: { count: number; danger?: boolean }) => (
  <div className="flex items-center gap-[3px]" aria-label={`結界 ${count}/5`}>
    {Array.from({ length: 5 }).map((_, i) => (
      <span
        key={i}
        className="w-[8px] h-[8px] rotate-45 rounded-[2px]"
        style={{
          background: i < count ? (danger ? 'linear-gradient(135deg,#f39a90,#c7423a)' : 'linear-gradient(135deg,#b9f7ec,#25b3a1)') : 'rgba(45,51,77,0.6)',
          border: `1px solid ${i < count ? '#fbf0d2' : 'rgba(162,168,187,0.25)'}`,
        }}
      />
    ))}
  </div>
);

const ZoneSlot = ({
  label,
  children,
  empty,
  highlight,
  onClick,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
}: {
  label: string;
  children?: React.ReactNode;
  empty?: boolean;
  highlight?: boolean;
  onClick?: (e: React.MouseEvent) => void;
  onPointerDown?: (e: React.PointerEvent) => void;
  onPointerMove?: (e: React.PointerEvent) => void;
  onPointerUp?: (e: React.PointerEvent) => void;
  onPointerCancel?: () => void;
  key?: React.Key;
}) => (
  <div className="flex flex-col items-center gap-[3px]">
    <div
      className={`relative w-[40px] h-[56px] rounded-[5px] flex items-center justify-center ${highlight ? 'sc-anim-target cursor-pointer' : empty ? '' : 'cursor-pointer active:scale-95 transition-transform'}`}
      style={empty ? { border: '1px dashed rgba(210,171,95,0.28)', background: 'rgba(6,7,13,0.45)' } : undefined}
      onClick={onClick}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
    >
      {children}
    </div>
    <span className="text-[8.5px] font-bold text-parch-500 leading-none">{label}</span>
  </div>
);

const SummonCircle = ({ color }: { color: string }) => (
  <div className="absolute pointer-events-none z-30" style={{ inset: -18, animation: 'sc-summon-circle 700ms var(--ease-out-quint) both' }}>
    <svg viewBox="0 0 100 100" className="w-full h-full">
      <circle cx="50" cy="50" r="46" fill="none" stroke={color} strokeWidth="2" />
      <circle cx="50" cy="50" r="38" fill="none" stroke={color} strokeWidth="1" strokeDasharray="4 3" />
      <polygon points="50,12 83,69 17,69" fill="none" stroke={color} strokeWidth="1.2" />
      <polygon points="50,88 17,31 83,31" fill="none" stroke={color} strokeWidth="1.2" />
    </svg>
  </div>
);

const PlayerPlate = ({ mine, p, onOpenArchive }: { mine: boolean; p: GameState['player1']; onOpenArchive: () => void }) => {
  return (
    <div
      id={mine ? 'me-plate' : 'opp-plate'}
      className="sc-panel--flat w-full px-2 py-1.5 flex flex-col gap-1"
      style={{ borderColor: mine ? 'rgba(134,236,220,0.35)' : 'rgba(243,154,144,0.35)' }}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 shrink-0">
          <span
            className="w-[18px] h-[18px] rounded-full flex items-center justify-center shrink-0"
            style={{
              background: mine ? 'radial-gradient(circle at 35% 30%, #b9f7ec, #145f57)' : 'radial-gradient(circle at 35% 30%, #f39a90, #7d2320)',
              border: '1px solid #f2dea6',
            }}
          >
            <BookOpen size={10} className="text-ink-950" strokeWidth={2.6} />
          </span>
          <span className="text-[12px] font-bold text-parch-50 whitespace-nowrap">{mine ? 'あなた' : '相手'}</span>
        </div>
        <BarrierPips count={p.barrier} danger={!mine} />
      </div>
      <div className="flex items-center gap-1 text-[10px] font-bold text-parch-300">
        <span className="flex items-center gap-0.5" title="手札">
          <Hand size={11} className="text-brass-400" />
          <span className="sc-num text-parch-50 text-[11px]">{p.hand.length}</span>
        </span>
        <span className="text-parch-500">・</span>
        <span title="山札">
          山札 <span className="sc-num text-parch-50 text-[11px]">{p.deck.length}</span>
        </span>
        <button
          type="button"
          onClick={e => {
            e.stopPropagation();
            onOpenArchive();
          }}
          className="ml-auto flex items-center gap-0.5 px-1.5 h-[20px] rounded-md active:scale-95 transition-transform"
          style={{ background: 'rgba(6,7,13,0.8)', border: '1px solid rgba(210,171,95,0.3)' }}
          aria-label={`${mine ? '自分' : '相手'}の墓地を見る`}
        >
          墓地 <span className="sc-num text-parch-50 text-[11px]">{p.archive.length}</span>
        </button>
      </div>
    </div>
  );
};


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
  const [turnBanner, setTurnBanner] = useState<{ mine: boolean; key: number } | null>(null);
  const [arcanaFlash, setArcanaFlash] = useState(false);
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
  const [feedbackToast, setFeedbackToast] = useState<{ text: string; type: 'info' | 'warn' | 'success'; key: number } | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showToast = (text: string, type: 'info' | 'warn' | 'success' = 'info') => {
    setFeedbackToast({ text, type, key: Date.now() });
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setFeedbackToast(null), 1700);
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

  // 論理キャンバス: 基準 844x390。画面比率に合わせて幅または高さを伸ばし、黒帯を作らない。
  // （情報を削るのではなく、余白と配置で吸収する）
  const rootRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [canvasSize, setCanvasSize] = useState({ w: 844, h: 390 });
  useEffect(() => {
    const updateScale = () => {
      const el = rootRef.current;
      let w = window.innerWidth;
      let h = window.innerHeight;
      if (el) {
        const cs = getComputedStyle(el);
        w = el.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
        h = el.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
      }
      if (w <= 0 || h <= 0) return;
      const aspect = w / h;
      const base = 844 / 390;
      const cw = aspect >= base ? Math.min(1000, 390 * aspect) : 844;
      const ch = aspect >= base ? 390 : Math.min(520, 844 / aspect);
      setCanvasSize({ w: Math.round(cw), h: Math.round(ch) });
      setScale(Math.min(w / cw, h / ch));
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
  const prevTurnCount = useRef(-1);
  useEffect(() => {
    const changed = prevPlayer.current !== state.currentPlayer || prevTurnCount.current !== state.turnCount;
    prevPlayer.current = state.currentPlayer;
    prevTurnCount.current = state.turnCount;
    if (!changed || state.winner) return;
    const mine = state.currentPlayer === 'player1';
    setShowYourTurnBanner(true);
    setTurnBanner({ mine, key: Date.now() });
    if (mine) soundManager.playTurnStart();
    const t = setTimeout(() => setShowYourTurnBanner(false), mine ? 1100 : 900);
    return () => clearTimeout(t);
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
  // AIターンの実行ロック（同時に1つのランナーしか動かさない）
  const aiRunningRef = useRef(false);
  // アンマウント後に古いランナーが dispatch し続けないようにする
  const aliveRef = useRef(true);
  const observerRef = useRef<OpponentObserver | null>(null);
  if (!observerRef.current) observerRef.current = new OpponentObserver('player2');
  const prevObservedStateRef = useRef<GameState>(state);

  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
    };
  }, []);

  // 相手（プレイヤー）の公開情報を観測する。
  // AIターンへの切り替わりを検出した時点で、切り替え直前（= AIドロー前）の盤面から相手デッキ分析を1回行う。
  useEffect(() => {
    const prev = prevObservedStateRef.current;
    prevObservedStateRef.current = state;
    try {
      observerRef.current!.observe(prev, state);
    } catch (e) {
      aiDebug.warn('相手の観測に失敗しました（ゲーム進行には影響しません）', e);
    }
  }, [state]);

  // プレイヤーのターン中にAIが応答するプロンプト（ルーン誘発・結界破壊時召喚など）
  // AIのターン中のプロンプトは runAITurn 側で処理する。
  useEffect(() => {
    if (state.winner) return;
    if (!state.prompt || state.prompt.playerId !== 'player2' || state.currentPlayer === 'player2') return;

    const timer = setTimeout(() => {
      const cur = stateRef.current;
      if (cur.winner || !cur.prompt || cur.prompt.playerId !== 'player2' || cur.currentPlayer === 'player2') return;

      let response: GameAction | null = null;
      try {
        response = decidePromptResponse(cur, 'player2', null);
      } catch (e) {
        aiDebug.warn('プロンプト応答の思考に失敗しました', e);
      }
      if (!response) {
        response =
          cur.prompt.type === 'GUARD'
            ? { type: 'RESOLVE_GUARD' }
            : cur.prompt.type === 'TARGET_SELECTION'
              ? { type: 'CANCEL_SPELL_CAST' }
              : { type: 'RESOLVE_TRIGGER', apply: true };
      }
      aiDebug.prompt(`${cur.prompt.type} → ${JSON.stringify(response)}`);

      if (response.type === 'RESOLVE_GUARD' && response.guarderId) {
        const guarderId = response.guarderId;
        const g = cur.player2.field.find(u => u.instanceId === guarderId);
        if (g) showToast(`相手が【${getCard(g.cards[0].cardId).name}】で守護を発動！`, 'info');
        soundManager.playShieldBreak();
      } else if (response.type === 'RESOLVE_TRIGGER' && response.apply) {
        showToast('相手がルーン効果を発動！', 'warn');
        soundManager.playRuneTrigger();
      }
      dispatch(response);
    }, 700);
    return () => clearTimeout(timer);
  }, [state.prompt, state.winner, state.currentPlayer]);

  // AIの行動を演出する（行動の決定・実行は runAITurn、ここは表示と効果音のみ）
  const presentAIAction = async (action: GameAction, st: GameState) => {
    const ai = st.player2;
    if (action.type === 'PLACE_ARCANA') {
      const c = ai.hand.find(h => h.instanceId === action.instanceId);
      if (c) {
        setAiThinkingText('魔力を集中');
        showToast(`相手が【${getCard(c.cardId).name}】をアルカナに捧げた`, 'info');
        soundManager.playManaCharge();
      }
    } else if (action.type === 'PLAY_CARD') {
      const c = ai.hand.find(h => h.instanceId === action.instanceId);
      if (!c) return;
      const t = getCard(c.cardId);
      setAiThinkingText(t.type === 'Spell' ? '魔法発動' : t.type === 'Evolution' ? '進化召喚' : '召喚');
      if (t.type === 'Evolution') {
        soundManager.playEvolve();
        showToast(`相手が【${t.name}】へ進化`, 'warn');
      } else if (t.type === 'Spell') {
        soundManager.playCardSwipe();
        showToast(`相手が【${t.name}】を詠唱`, 'info');
      } else {
        soundManager.playSummonUnit();
        if (t.type === 'Unit') {
          setSummonRippleSlot({ isOpponent: true, slotIdx: ai.field.length });
          setTimeout(() => setSummonRippleSlot(null), 800);
        }
        showToast(`相手が【${t.name}】を召喚`, 'info');
      }
    } else if (action.type === 'DECLARE_ATTACK') {
      const attacker = ai.field.find(u => u.instanceId === action.attackerId);
      if (!attacker) return;
      const aName = getCard(attacker.cards[0].cardId).name;
      const target = action.targetId ? st.player1.field.find(u => u.instanceId === action.targetId) : undefined;
      const tName = target ? getCard(target.cards[0].cardId).name : null;
      setAiThinkingText('攻撃');
      setActiveAttackerId(action.attackerId);
      setActiveAttackerId(action.attackerId);
      soundManager.playAttackLock();
      showToast(tName ? `【${aName}】が【${tName}】を攻撃` : `【${aName}】があなたの結界を攻撃`, 'warn');
    } else if (action.type === 'NEXT_PHASE' && st.phase === 'ACTION') {
      setAiThinkingText('ターン終了');
    }
  };

  const startAITurn = () => {
    if (aiRunningRef.current) return;
    const s = stateRef.current;
    if (s.winner || s.currentPlayer !== 'player2') return;
    aiRunningRef.current = true;

    runAITurn({
      aiId: 'player2',
      getState: () => stateRef.current,
      dispatch,
      getProfile: st => observerRef.current!.getProfileForTurn(st),
      isCancelled: () => !aliveRef.current,
      pacing: { beforeAction: 900, afterAction: 700, pollInterval: 50, dispatchTimeout: 3000 },
      config: { timeBudgetMs: 900 },
      hooks: {
        // 思考エンジンの判断理由（decision.reason）は内部情報なので画面には出さない。
        // 行動ごとの表示は presentAIAction が「召喚」「攻撃」など自然な言葉で行う。
        onStatus: text => {
          if (text === null) setAiThinkingText(null);
        },
        onBeforeAction: (action, _label, st) => presentAIAction(action, st),
        onAfterAction: action => {
          if (action.type === 'DECLARE_ATTACK') {
            soundManager.playAttackClash();
            setIsScreenShaking(true);
            setTimeout(() => setIsScreenShaking(false), 380);
            setActiveAttackerId(null);
          }
          setAiThinkingText(null);
        },
      },
    })
      .catch(e => aiDebug.warn('AIターンの実行が異常終了しました', e))
      .finally(() => {
        aiRunningRef.current = false;
        setAiThinkingText(null);
        setActiveAttackerId(null);
        // ランナー終了までの間に次のAIターンが始まっていた場合は、すぐに引き継ぐ
        const cur = stateRef.current;
        if (aliveRef.current && !cur.winner && cur.currentPlayer === 'player2') {
          setTimeout(startAITurn, 0);
        }
      });
  };

  // AIの手番になったらランナーを起動する（多重起動はロックで防ぐ）
  useEffect(() => {
    if (state.winner) return;
    if (state.currentPlayer === 'player2') startAITurn();
  }, [state.currentPlayer, state.turnCount, state.phase, state.prompt, state.winner]);

  // ウォッチドッグ: AIの手番なのにランナーが動いていない状態を検出したら再開する。
  // ランナーは常に現在の盤面から判断し直すため、再開しても状態は壊れない。
  useEffect(() => {
    const id = setInterval(() => {
      const s = stateRef.current;
      if (aliveRef.current && !s.winner && s.currentPlayer === 'player2' && !aiRunningRef.current) {
        aiDebug.warn('AIターンが停止していたため再開します');
        startAITurn();
      }
    }, 2500);
    return () => clearInterval(id);
  }, []);

  const triggerCutin = (card: CardTemplate, title: string) => {
    setCutinCard({ card, title });
    setTimeout(() => {
      setCutinCard(null);
    }, 1150);
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

  // 要素の位置をキャンバス座標で取得（ドロップ判定・攻撃ロックオン用）
  const rectInCanvas = (id: string) => {
    const el = document.getElementById(id);
    if (!el || !canvasRef.current) return null;
    const r = el.getBoundingClientRect();
    const c = canvasRef.current.getBoundingClientRect();
    return {
      x: (r.left - c.left) / scale,
      y: (r.top - c.top) / scale,
      w: r.width / scale,
      h: r.height / scale,
    };
  };
  const pointIn = (p: { x: number; y: number }, r: { x: number; y: number; w: number; h: number } | null, pad = 0) =>
    !!r && p.x >= r.x - pad && p.x <= r.x + r.w + pad && p.y >= r.y - pad && p.y <= r.y + r.h + pad;
  const dropZoneAt = (p: { x: number; y: number }): 'arcana' | 'field' | null => {
    if (pointIn(p, rectInCanvas('me-arcana-orb'), 22)) return 'arcana';
    if (pointIn(p, rectInCanvas('battle-field-zone'), 0)) return 'field';
    return null;
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

    setDragHoverZone(dropZoneAt(coords));
  };

  const handleCardDragEnd = (card: CardInstance, clientX: number, clientY: number) => {
    const coords = getCanvasCoords(clientX, clientY);
    const zone = dropZoneAt(coords);

    if (zone === 'arcana') {
      // Dropped onto Arcana Gauge
      if (isMyTurn && state.phase === 'ARCANA_PLACEMENT' && !state.flags.hasPlacedArcanaThisTurn) {
        handlePlaceHandArcana(card.instanceId);
      } else if (isMyTurn && state.flags.hasPlacedArcanaThisTurn) {
        showToast('このターンはすでにアルカナを捧げました', 'warn');
      } else if (isMyTurn) {
        showToast('アルカナはチャージフェイズにだけ捧げられます', 'warn');
      }
    } else if (zone === 'field') {
      // Dropped onto Field Arena
      const tpl = getCard(card.cardId);
      const playable = isMyTurn && state.phase === 'ACTION' && canPlayCard(tpl, me.currentArcana, me.arcana, me.field.length);
      if (playable) {
        if (tpl.type === 'Evolution') {
          // Identify evolution target: check if dropped over a player unit slot
          let targetUnit: UnitState | undefined = undefined;

          me.field.forEach((unit, slotIdx) => {
            if (pointIn(coords, rectInCanvas(`me-slot-${slotIdx}`), 6)) {
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
        showToast(playBlockReason(tpl) ?? 'いまはプレイできません', 'warn');
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
      const barrier = rectInCanvas('opp-barrier-row');
      const oppField = rectInCanvas('opponent-field-row');
      if (barrier && (pointIn(coords, barrier, 18) || (oppField && coords.y < oppField.y))) {
        locked = {
          type: 'player',
          name: '結界',
          snapX: barrier.x + barrier.w / 2,
          snapY: barrier.y + barrier.h / 2,
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
          ? '相手の結界へ攻撃'
          : `【${attackDrag.lockedTarget.name}】へ攻撃`,
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
      const barrier = rectInCanvas('opp-barrier-row');
      performAttackAnimation(selectedCardId, undefined, barrier ? { x: barrier.x + barrier.w / 2, y: barrier.y + barrier.h / 2 } : undefined);
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
    const c = me.hand.find(h => h.instanceId === instanceId);
    soundManager.playManaCharge();
    dispatch({ type: 'PLACE_ARCANA', instanceId });
    if (c) showToast(`【${getCard(c.cardId).name}】をアルカナに捧げた`, 'success');
    setArcanaFlash(true);
    setTimeout(() => setArcanaFlash(false), 700);
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

  // プレイできない理由（ボタン・通知で「なぜ押せないか」を伝える）
  const playBlockReason = (tpl: CardTemplate): string | null => {
    if (!isMyTurn) return '相手のターンです';
    if (state.phase !== 'ACTION') return 'チャージフェイズ中です';
    if (me.currentArcana < tpl.cost) return `アルカナが足りません（あと${tpl.cost - me.currentArcana}）`;
    if (tpl.type === 'Unit' && me.field.length >= 6) return '場がいっぱいです';
    if (tpl.type === 'Evolution' && me.field.length === 0) return '進化元のユニットがいません';
    if (!canPlayCard(tpl, me.currentArcana, me.arcana, me.field.length)) return `${ELEMENTS[tpl.system]?.label ?? ''}属性のアルカナが必要です`;
    return null;
  };

  // 手札タップ: 1回目で選択（持ち上げ＋操作バー表示）、選択中のカードをもう一度タップで実行。
  // 誤タップでいきなりプレイされないようにする。
  const handleHandTap = (instanceId: string) => {
    if (!isMyTurn || state.prompt) {
      const c = me.hand.find(h => h.instanceId === instanceId);
      if (c) {
        setPreviewCard(getCard(c.cardId));
        setPreviewStats(undefined);
      }
      return;
    }
    if (pendingSpell) return;
    if (selectedCardId !== instanceId) {
      soundManager.playCardTouch();
      setSelectedCardId(instanceId);
      return;
    }
    handleHandPrimary(instanceId);
  };

  const handleHandPrimary = (instanceId: string) => {
    const c = me.hand.find(h => h.instanceId === instanceId);
    if (!c) return;
    const tpl = getCard(c.cardId);
    if (state.phase === 'ARCANA_PLACEMENT') {
      if (!state.flags.hasPlacedArcanaThisTurn) handlePlaceHandArcana(instanceId);
      return;
    }
    const reason = playBlockReason(tpl);
    if (reason) {
      showToast(reason, 'warn');
      return;
    }
    if (tpl.type === 'Evolution') {
      setSelectedCardId(instanceId);
      showToast('進化させる自分のユニットをタップ', 'info');
      return;
    }
    if (tpl.id === 'BW-08' && me.archive.some(a => ['Spell', 'Rune'].includes(getCard(a.cardId).type))) {
      handleCardClick(instanceId, { stopPropagation: () => {} } as React.MouseEvent);
      return;
    }
    if (tpl.type === 'Unit') soundManager.playSummonUnit();
    handlePlayHandCard(instanceId);
  };

  const handlePrompt = (apply: boolean, targetId?: string) => {
    if (state.prompt?.type === 'GUARD') {
      dispatch({ type: 'RESOLVE_GUARD', guarderId: apply ? targetId : undefined });
    } else {
      dispatch({ type: 'RESOLVE_TRIGGER', apply, targetId });
    }
  };

  // ======================================================================
  // 表示用の派生情報
  // ======================================================================
  const W = canvasSize.w;
  const H = canvasSize.h;
  const RAIL = 136;
  const SIDE = RAIL + 16;
  const centerWidth = W - SIDE * 2;
  const HAND_H = 112;

  const canAttackNow = (u: UnitState) =>
    isValidAttackTarget(state, u.instanceId, undefined) || opp.field.some(t => isValidAttackTarget(state, u.instanceId, t.instanceId));
  const myActionPhase = isMyTurn && state.phase === 'ACTION' && !state.prompt;
  const readyAttackers = myActionPhase ? me.field.filter(u => canAttackNow(u)) : [];
  const playableHandCount = myActionPhase
    ? me.hand.filter(c => canPlayCard(getCard(c.cardId), me.currentArcana, me.arcana, me.field.length)).length
    : 0;
  const selectedAttacker = selectedCardId ? me.field.find(u => u.instanceId === selectedCardId) : undefined;
  const selectedHandTpl = selectedHandCard ? getCard(selectedHandCard.cardId) : null;
  const myPrompt = state.prompt && state.prompt.playerId === 'player1' && state.prompt.type !== 'TARGET_SELECTION' ? state.prompt : null;
  const attackLockedOnPlayer = attackDrag?.lockedTarget?.type === 'player';
  const oppBarrierTargetable = canDirectAttack || attackLockedOnPlayer || (!!attackDrag && isValidAttackTarget(state, attackDrag.attackerId, undefined));

  // 画面中央のガイド: 「今なにができるか」を一文で伝える
  let guide: { text: string; tone: 'mine' | 'opp' | 'target' } | null = null;
  if (state.winner) guide = null;
  else if (!isMyTurn) guide = { text: `相手のターン ・ ${aiThinkingText ?? '行動を選択中'}`, tone: 'opp' };
  else if (pendingSpell) guide = { text: pendingSpell.message, tone: 'target' };
  else if (state.prompt?.type === 'TARGET_SELECTION' && state.prompt.playerId === 'player1') guide = { text: state.prompt.message || '対象を選択してください', tone: 'target' };
  else if (state.prompt) guide = { text: '選択してください', tone: 'target' };
  else if (state.phase === 'ARCANA_PLACEMENT') guide = { text: '手札を1枚選んでアルカナに捧げる（オーブへドラッグも可）', tone: 'mine' };
  else if (selectedAttacker) guide = { text: '攻撃先を選択 ・ 相手ユニット または 結界', tone: 'target' };
  else if (selectedHandTpl?.type === 'Evolution') guide = { text: '進化させる自分のユニットをタップ', tone: 'target' };
  else if (readyAttackers.length > 0 || playableHandCount > 0) guide = { text: 'カードをプレイ ・ 光るユニットを引いて攻撃', tone: 'mine' };
  else guide = { text: 'できる行動はありません ・ ターン終了', tone: 'mine' };

  const openArchive = (mine: boolean) =>
    setZoneModal({
      isOpen: true,
      title: mine ? '自分の墓地（アーカイブ）' : '相手の墓地（アーカイブ）',
      zoneType: 'archive',
      cards: mine ? me.archive : opp.archive,
      isOpponent: !mine,
    });
  const openArcana = (mine: boolean) =>
    setZoneModal({
      isOpen: true,
      title: mine ? '自分のアルカナ' : '相手のアルカナ',
      zoneType: 'arcana',
      cards: mine ? me.arcana : opp.arcana,
      isOpponent: !mine,
    });

  // ----------------------------------------------------------------------
  // 小さな部品
  // ----------------------------------------------------------------------
  const resolveBoardTarget = (targetId: string, successText: string) => {
    soundManager.playCardSwipe();
    if (pendingSpell) {
      triggerCutin(pendingSpell.template, '魔法発動');
      dispatch({ type: 'PLAY_CARD', instanceId: pendingSpell.cardInstance.instanceId, targetId });
      setPendingSpell(null);
      showToast(successText, 'success');
    } else if (state.prompt?.type === 'TARGET_SELECTION') {
      dispatch({ type: 'RESOLVE_SPELL_TARGET', targetId });
    } else if (selectedCardId) {
      dispatch({ type: 'PLAY_CARD', instanceId: selectedCardId, targetId });
      setSelectedCardId(null);
    }
  };

  const renderOppZones = () => {
    const domainTarget =
      !!opp.domain &&
      ((pendingSpell && pendingSpell.targetTypes.includes('domain') && pendingSpell.validTargets.includes(opp.domain.instanceId)) ||
        (state.prompt?.type === 'TARGET_SELECTION' && state.prompt.validTargets.includes(opp.domain.instanceId)) ||
        (!!selectedCardId && me.hand.some(c => c.instanceId === selectedCardId && getCard(c.cardId).id === 'BN-03')));
    return (
      <div className="flex items-start gap-[5px]">
        <ZoneSlot
          label="ドメイン"
          empty={!opp.domain}
          highlight={domainTarget}
          onClick={e => {
            if (domainTarget && opp.domain) {
              e.stopPropagation();
              resolveBoardTarget(opp.domain.instanceId, '相手のドメインを破壊した');
            }
          }}
          onPointerDown={e => opp.domain && !domainTarget && handleSlotCardPointerDown(getCard(opp.domain.cardId), opp.domain.instanceId, e)}
          onPointerMove={e => !domainTarget && handleSlotCardPointerMove(e)}
          onPointerUp={e => opp.domain && !domainTarget && handleSlotCardPointerUp(opp.domain.instanceId, e)}
          onPointerCancel={clearSlotLongPressTimer}
        >
          {opp.domain && <CardView instance={opp.domain} size="compact" />}
        </ZoneSlot>
        {[0, 1].map(rIdx => {
          const rune = opp.runes[rIdx];
          const runeTarget =
            !!rune &&
            ((pendingSpell && pendingSpell.targetTypes.includes('rune') && pendingSpell.validTargets.includes(rune.instanceId)) ||
              (state.prompt?.type === 'TARGET_SELECTION' && state.prompt.validTargets.includes(rune.instanceId)) ||
              (!!selectedCardId && me.hand.some(c => c.instanceId === selectedCardId && getCard(c.cardId).id === 'BN-04')));
          return (
            <ZoneSlot
              key={rIdx}
              label="ルーン"
              empty={!rune}
              highlight={runeTarget}
              onClick={e => {
                if (!rune) return;
                if (runeTarget) {
                  e.stopPropagation();
                  resolveBoardTarget(rune.instanceId, '相手のルーンを手札に戻した');
                } else {
                  handleCardClick(rune.instanceId, e);
                }
              }}
            >
              {rune && <CardBack w={40} h={56} />}
            </ZoneSlot>
          );
        })}
      </div>
    );
  };

  const renderMyZones = () => (
    <div className="flex items-start gap-[5px]">
      <ZoneSlot
        label="ドメイン"
        empty={!me.domain}
        onPointerDown={e => me.domain && handleSlotCardPointerDown(getCard(me.domain.cardId), me.domain.instanceId, e)}
        onPointerMove={handleSlotCardPointerMove}
        onPointerUp={e => me.domain && handleSlotCardPointerUp(me.domain.instanceId, e)}
        onPointerCancel={clearSlotLongPressTimer}
      >
        {me.domain && <CardView instance={me.domain} size="compact" />}
      </ZoneSlot>
      {[0, 1].map(rIdx => {
        const rune = me.runes[rIdx];
        return (
          <ZoneSlot
            key={rIdx}
            label="ルーン"
            empty={!rune}
            onPointerDown={e => rune && handleSlotCardPointerDown(getCard(rune.cardId), rune.instanceId, e)}
            onPointerMove={handleSlotCardPointerMove}
            onPointerUp={e => rune && handleSlotCardPointerUp(rune.instanceId, e)}
            onPointerCancel={clearSlotLongPressTimer}
          >
            {rune && (
              <div className="relative">
                <CardBack w={40} h={56} />
                <span className="absolute bottom-0.5 inset-x-0 text-center text-[7px] font-bold text-arcane-300">伏せ</span>
              </div>
            )}
          </ZoneSlot>
        );
      })}
    </div>
  );

  const renderBarrierRow = (mine: boolean) => {
    const count = mine ? me.barrier : opp.barrier;
    const shattering = mine ? shatteringPlayerShieldIdx : shatteringOppShieldIdx;
    const targetable = !mine && oppBarrierTargetable && isMyTurn;
    return (
      <div
        id={mine ? 'me-barrier-row' : 'opp-barrier-row'}
        className={`relative flex items-center justify-center gap-2 h-[24px] px-3 rounded-full ${targetable ? 'cursor-pointer' : ''}`}
        style={
          targetable
            ? { background: 'rgba(125,35,32,0.35)', boxShadow: attackLockedOnPlayer ? '0 0 0 2px #f39a90, 0 0 22px rgba(227,102,92,0.9)' : undefined }
            : undefined
        }
        onClick={!mine && canDirectAttack ? handleOpponentDirectAttack : undefined}
        aria-label={`${mine ? '自分' : '相手'}の結界 ${count}/5`}
      >
        {targetable && (
          <span className="absolute -left-[74px] top-1/2 -translate-y-1/2 text-[10px] font-bold text-crimson-300 whitespace-nowrap">結界を攻撃 ›</span>
        )}
        {Array.from({ length: 5 }).map((_, idx) => {
          const active = idx < count;
          const isShattering = shattering === idx;
          return (
            <div key={idx} className={`relative ${targetable && active ? 'sc-anim-target rounded-[4px]' : ''}`}>
              <div
                className="w-[26px] h-[18px] rounded-[4px] flex items-center justify-center transition-all duration-300"
                style={
                  active
                    ? {
                        background: mine
                          ? 'linear-gradient(180deg, #2a6e66, #123a36)'
                          : 'linear-gradient(180deg, #7a2d28, #3c1210)',
                        border: `1px solid ${mine ? '#86ecdc' : '#f39a90'}`,
                        boxShadow: `inset 0 1px 0 rgba(255,255,255,0.25), 0 0 8px ${mine ? 'rgba(79,214,194,0.35)' : 'rgba(227,102,92,0.35)'}`,
                      }
                    : { background: 'rgba(6,7,13,0.4)', border: '1px dashed rgba(162,168,187,0.18)' }
                }
              >
                {active && <Shield size={10} className={mine ? 'text-arcane-200' : 'text-crimson-300'} strokeWidth={2.4} />}
              </div>
              {isShattering && (
                <div className="absolute inset-0 pointer-events-none z-50 flex items-center justify-center">
                  <div className={`w-full h-full rounded animate-shield-break ${mine ? 'bg-crimson-400' : 'bg-arcane-300'}`} />
                  {[
                    ['-24px', '-18px', '-80deg'],
                    ['22px', '-22px', '90deg'],
                    ['-18px', '20px', '45deg'],
                    ['20px', '18px', '-60deg'],
                  ].map(([x, y, r], i) => (
                    <div
                      key={i}
                      className="absolute w-2 h-2 bg-brass-100 rounded-xs animate-shatter-shard"
                      style={{ '--tw-shatter-x': x, '--tw-shatter-y': y, '--tw-shatter-r': r } as React.CSSProperties}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  const selectedBarLabel = (() => {
    if (!selectedHandTpl) return null;
    if (state.phase === 'ARCANA_PLACEMENT') return state.flags.hasPlacedArcanaThisTurn ? null : 'アルカナに捧げる';
    if (selectedHandTpl.type === 'Unit') return '召喚する';
    if (selectedHandTpl.type === 'Spell') return '詠唱する';
    if (selectedHandTpl.type === 'Evolution') return null;
    return '設置する';
  })();
  const selectedBlock = selectedHandTpl && state.phase === 'ACTION' ? playBlockReason(selectedHandTpl) : null;

  return (
    <div
      id="gameboard-root"
      ref={rootRef}
      className="fixed inset-0 w-screen h-screen overflow-hidden flex items-center justify-center select-none"
      style={{
        background: '#06070d',
        paddingTop: 'env(safe-area-inset-top)',
        paddingBottom: 'env(safe-area-inset-bottom)',
        paddingLeft: 'env(safe-area-inset-left)',
        paddingRight: 'env(safe-area-inset-right)',
      }}
      onClick={handleBoardClick}
    >
      <div
        id="gameboard-canvas"
        ref={canvasRef}
        onPointerMove={handleGlobalPointerMove}
        onPointerUp={handleGlobalPointerUp}
        onPointerCancel={handleGlobalPointerUp}
        style={{
          width: `${W}px`,
          height: `${H}px`,
          transform: `scale(${scale})`,
          transformOrigin: 'center center',
          touchAction: 'none',
          ...currentTheme.bgStyle,
        }}
        className={`relative shrink-0 overflow-hidden text-parch-100 select-none ${isScreenShaking ? 'animate-screen-shake' : ''}`}
      >
        {/* 盤面の魔法陣（静的な装飾のみ） */}
        <div className="absolute inset-0 pointer-events-none" style={{ boxShadow: `inset 0 0 140px ${currentTheme.ambientGlow}, inset 0 0 60px rgba(0,0,0,0.7)` }} />
        <svg className="absolute pointer-events-none opacity-[0.07]" style={{ left: W / 2 - 170, top: (H - HAND_H) / 2 - 150, width: 340, height: 300 }} viewBox="0 0 100 88">
          <ellipse cx="50" cy="44" rx="48" ry="42" fill="none" stroke="#e6c77f" strokeWidth="0.5" />
          <ellipse cx="50" cy="44" rx="40" ry="35" fill="none" stroke="#e6c77f" strokeWidth="0.3" strokeDasharray="1 1.5" />
          <polygon points="50,6 88,66 12,66" fill="none" stroke="#e6c77f" strokeWidth="0.3" />
          <polygon points="50,82 12,22 88,22" fill="none" stroke="#e6c77f" strokeWidth="0.3" />
        </svg>

        {/* ================= 左レール: アルカナ・ドメイン・ルーン ================= */}
        <div className="absolute z-20 flex flex-col justify-between" style={{ left: 10, top: 8, bottom: 8, width: RAIL }}>
          <div className="flex flex-col gap-2">
            <ArcanaGauge current={opp.currentArcana} max={opp.maxArcana} arcanaCards={opp.arcana} onOpenArcana={() => openArcana(false)} isOpponent />
            {renderOppZones()}
          </div>
          <div className="flex flex-col gap-2">
            {renderMyZones()}
            <div id="me-arcana-orb" className={`self-start rounded-full ${arcanaFlash ? 'sc-anim-seal' : ''}`}>
              <ArcanaGauge
                current={me.currentArcana}
                max={me.maxArcana}
                arcanaCards={me.arcana}
                onOpenArcana={() => openArcana(true)}
                highlight={dragHoverZone === 'arcana' || (!!draggingCard && isMyTurn && state.phase === 'ARCANA_PLACEMENT' && !state.flags.hasPlacedArcanaThisTurn)}
              />
            </div>
          </div>
        </div>

        {/* ================= 右レール: システム・相手/自分の情報・フェイズ ================= */}
        <div className="absolute z-30 flex flex-col" style={{ right: 10, top: 8, bottom: 8, width: RAIL }}>
          <div className="flex items-center justify-between gap-1 mb-1.5">
            <button
              type="button"
              className="sc-btn sc-btn--ghost sc-btn--icon"
              style={{ minHeight: 30, width: 30 }}
              onClick={e => {
                e.stopPropagation();
                setShowLog(true);
              }}
              aria-label="バトルログ"
            >
              <ScrollText size={15} />
            </button>
            <button
              type="button"
              className="sc-btn sc-btn--ghost sc-btn--icon"
              style={{ minHeight: 30, width: 30 }}
              onClick={e => {
                e.stopPropagation();
                setIsMuted(soundManager.toggleMute());
              }}
              aria-label={isMuted ? '効果音をオンにする' : '効果音をオフにする'}
            >
              {isMuted ? <VolumeX size={15} className="text-crimson-300" /> : <Volume2 size={15} />}
            </button>
            {onOpenDeckBuilder && (
              <button
                type="button"
                className="sc-btn sc-btn--ghost sc-btn--icon"
                style={{ minHeight: 30, width: 30 }}
                title="デッキ編成画面を開く"
                aria-label="デッキ編成"
                onClick={e => {
                  e.stopPropagation();
                  onOpenDeckBuilder();
                }}
              >
                <Layers size={15} />
              </button>
            )}
            <button
              type="button"
              className="sc-btn sc-btn--ghost sc-btn--icon"
              style={{ minHeight: 30, width: 30 }}
              onClick={e => {
                e.stopPropagation();
                setShowMenu(true);
              }}
              aria-label="メニュー"
            >
              <Menu size={15} />
            </button>
          </div>

          <PlayerPlate mine={false} p={opp} onOpenArchive={() => openArchive(false)} />
          {/* 相手の手札（枚数だけが公開情報） */}
          <div className="flex justify-center mt-1 h-[20px]" aria-hidden>
            {opp.hand.slice(0, 8).map((c, i) => (
              <div key={c.instanceId} style={{ marginLeft: i === 0 ? 0 : -6, transform: `rotate(${(i - (Math.min(opp.hand.length, 8) - 1) / 2) * 4}deg)` }}>
                <CardBack w={14} h={20} />
              </div>
            ))}
          </div>

          <div className="flex-1 flex items-center">
            <ActionControls
              phase={state.phase}
              turnCount={state.turnCount}
              isMyTurn={isMyTurn}
              hasPlacedArcanaThisTurn={state.flags.hasPlacedArcanaThisTurn}
              hasPrompt={!!state.prompt}
              selectedCardId={selectedCardId}
              isHandSelected={!!selectedHandCard}
              hasPendingActions={readyAttackers.length > 0}
              onNextPhase={() => {
                dispatch({ type: 'NEXT_PHASE' });
                setArcanaMode(false);
                setSelectedCardId(null);
              }}
              onArcanaCharge={handleArcanaChargeBtn}
            />
          </div>

          <PlayerPlate mine p={me} onOpenArchive={() => openArchive(true)} />
        </div>

        {/* ================= 中央: 結界・戦場 ================= */}
        <div
          id="center-arena"
          className="absolute z-10 flex flex-col items-center justify-center"
          style={{ left: SIDE, right: SIDE, top: 4, bottom: HAND_H - 4 }}
        >
          <div id="battle-field-zone" className="flex flex-col items-center">
            {renderBarrierRow(false)}

            <div id="opponent-field-row" className="flex items-center justify-center gap-2 mt-1">
              {Array.from({ length: 6 }).map((_, slotIdx) => {
                const unit = opp.field[slotIdx];
                const stats = unit ? calculateUnitStats(state, 'player2', unit) : null;
                const isTarget = unit ? isTargetValidForSelected('unit', unit) : false;
                const dragTarget = !!unit && !!attackDrag && isValidAttackTarget(state, attackDrag.attackerId, unit.instanceId);
                const isLockedTarget = !!unit && attackDrag?.lockedTarget?.id === unit.instanceId;
                const isAttacking = !!unit && activeAttackerId === unit.instanceId;
                const hasRipple = summonRippleSlot?.isOpponent && summonRippleSlot.slotIdx === slotIdx;
                return (
                  <div
                    key={unit ? unit.instanceId : `opp-slot-${slotIdx}`}
                    id={`opp-slot-${slotIdx}`}
                    onPointerDown={e => unit && handleOppUnitPointerDown(unit, slotIdx, e)}
                    onPointerMove={e => unit && handleOppUnitPointerMove(unit, e)}
                    onPointerUp={e => unit && handleOppUnitPointerUp(unit, e)}
                    onPointerCancel={clearOppUnitLongPressTimer}
                    onClick={e => e.stopPropagation()}
                    className={`relative w-[70px] h-[96px] rounded-[6px] flex items-center justify-center shrink-0 ${unit ? 'cursor-pointer' : ''} ${
                      isAttacking ? 'animate-attack-dash z-40' : ''
                    } ${(isTarget || dragTarget) && !isLockedTarget ? 'sc-anim-target' : ''}`}
                    style={{
                      ...(unit ? {} : { border: '1px solid rgba(227,102,92,0.10)', background: 'rgba(6,7,13,0.25)' }),
                      ...(isLockedTarget ? { boxShadow: '0 0 0 3px #f39a90, 0 0 26px rgba(227,102,92,1)', transform: 'scale(1.06)', zIndex: 40 } : {}),
                    }}
                  >
                    {hasRipple && <SummonCircle color="#f39a90" />}
                    {unit && (
                      <div className="sc-anim-land">
                        <CardView
                          instance={unit.cards[0]}
                          size="field"
                          computedStats={stats!}
                          isRested={unit.isRested}
                          hasSummoningSickness={unit.hasSummoningSickness}
                          evoCount={unit.cards.length}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* ガイド（今できること） */}
            <div className="h-[28px] flex items-center justify-center w-full relative">
              <div className="absolute inset-x-6 top-1/2 sc-divider" />
              {guide && (
                <div
                  key={guide.text}
                  className="relative px-3 h-[22px] rounded-full flex items-center gap-1.5 text-[11px] font-bold whitespace-nowrap sc-anim-pop"
                  style={{
                    background: 'rgba(6,7,13,0.9)',
                    border: `1px solid ${guide.tone === 'opp' ? 'rgba(243,154,144,0.55)' : guide.tone === 'target' ? 'rgba(242,222,166,0.8)' : 'rgba(134,236,220,0.5)'}`,
                    color: guide.tone === 'opp' ? '#f7c3bc' : guide.tone === 'target' ? '#fbf0d2' : '#c9fbf2',
                    maxWidth: centerWidth - 20,
                  }}
                >
                  {guide.tone === 'opp' ? (
                    <Sparkles size={12} style={{ animation: 'sc-spin-slow 3s linear infinite' }} />
                  ) : guide.tone === 'target' ? (
                    <Zap size={12} />
                  ) : null}
                  <span className="truncate">{guide.text}</span>
                  {pendingSpell && (
                    <button
                      type="button"
                      onClick={e => {
                        e.stopPropagation();
                        setPendingSpell(null);
                        showToast('詠唱をやめました', 'info');
                      }}
                      className="ml-1 px-2 h-[18px] rounded-full text-[10px] font-bold"
                      style={{ background: 'rgba(125,35,32,0.9)', color: '#ffe3df' }}
                    >
                      やめる
                    </button>
                  )}
                </div>
              )}
            </div>

            <div id="player-field-row" className="flex items-center justify-center gap-2">
              {Array.from({ length: 6 }).map((_, slotIdx) => {
                const unit = me.field[slotIdx];
                const stats = unit ? calculateUnitStats(state, 'player1', unit) : null;
                const isSelected = !!unit && selectedCardId === unit.instanceId;
                const isTarget = unit ? isTargetValidForSelected('unit', unit) : false;
                const isEvoBase = !!unit && selectedHandTpl?.type === 'Evolution' && myActionPhase;
                const isReady = !!unit && readyAttackers.some(r => r.instanceId === unit.instanceId);
                const isDraggingThisAttacker = !!unit && attackDrag?.attackerId === unit.instanceId;
                const isAttacking = !!unit && activeAttackerId === unit.instanceId;
                const hasRipple = summonRippleSlot && !summonRippleSlot.isOpponent && summonRippleSlot.slotIdx === slotIdx;
                const summonHere = !unit && isSelectedHandPlayable && selectedHandTpl?.type === 'Unit';
                return (
                  <div
                    key={unit ? unit.instanceId : `me-slot-${slotIdx}`}
                    id={`me-slot-${slotIdx}`}
                    onDragOver={e => {
                      if (unit) e.preventDefault();
                    }}
                    onDrop={e => {
                      if (unit) handleDropOnUnit(unit, e);
                    }}
                    onPointerDown={e => {
                      if (unit) handlePlayerUnitPointerDown(unit, slotIdx, e);
                    }}
                    onPointerMove={e => {
                      if (unit) handlePlayerUnitPointerMove(unit, slotIdx, e);
                    }}
                    onPointerUp={e => {
                      if (unit) handlePlayerUnitPointerUp(unit, slotIdx, e);
                      else if (isSelectedHandPlayable && selectedHandCard) handleHandPrimary(selectedHandCard.instanceId);
                    }}
                    onPointerCancel={clearPlayerUnitLongPressTimer}
                    onClick={e => e.stopPropagation()}
                    className={`relative w-[70px] h-[96px] rounded-[6px] flex items-center justify-center shrink-0 ${unit ? 'cursor-pointer' : ''} ${
                      isAttacking ? 'animate-attack-dash z-40' : ''
                    }`}
                    style={{
                      ...(unit
                        ? {}
                        : summonHere
                          ? { border: '1.5px solid rgba(134,236,220,0.8)', background: 'rgba(20,95,87,0.25)', cursor: 'pointer' }
                          : { border: '1px solid rgba(134,236,220,0.10)', background: 'rgba(6,7,13,0.25)' }),
                      ...(isDraggingThisAttacker ? { boxShadow: '0 0 0 3px #f2dea6, 0 0 22px rgba(230,199,127,0.9)', zIndex: 40 } : {}),
                      ...((isTarget || isEvoBase) && !isDraggingThisAttacker ? { boxShadow: '0 0 0 2px #86ecdc, 0 0 16px rgba(79,214,194,0.7)', zIndex: 30 } : {}),
                    }}
                  >
                    {hasRipple && <SummonCircle color="#86ecdc" />}
                    {unit ? (
                      <div className="sc-anim-land">
                        <CardView
                          instance={unit.cards[0]}
                          size="field"
                          computedStats={stats!}
                          isRested={unit.isRested}
                          hasSummoningSickness={unit.hasSummoningSickness}
                          evoCount={unit.cards.length}
                          selected={isSelected}
                          playable={isReady && !isSelected}
                        />
                      </div>
                    ) : (
                      summonHere && <span className="text-[10px] font-bold text-arcane-300 pointer-events-none">ここに召喚</span>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="mt-1">{renderBarrierRow(true)}</div>
          </div>
        </div>

        {/* ================= 手札 ================= */}
        <div className="absolute z-30 flex justify-center" style={{ left: SIDE, right: SIDE, bottom: 0, height: HAND_H }}>
          <HandTray
            hand={me.hand}
            state={state}
            dispatch={dispatch}
            selectedCard={selectedHandCard ? selectedCardId : null}
            onSelect={id => setSelectedCardId(id || null)}
            onInspect={card => {
              setPreviewCard(card);
              setPreviewStats(undefined);
            }}
            onPlayCard={handleHandTap}
            onArcanaPlace={handlePlaceHandArcana}
            onCardDragStart={handleCardDragStart}
            onCardDragMove={handleCardDragMove}
            onCardDragEnd={handleCardDragEnd}
            draggingCardId={draggingCard?.instanceId}
            trayWidth={centerWidth}
          />
        </div>

        {/* 選択中の手札の操作バー */}
        {selectedHandTpl && isMyTurn && !state.prompt && !pendingSpell && !draggingCard && (
          <div
            className="absolute z-40 left-1/2 -translate-x-1/2 sc-anim-pop"
            style={{ bottom: HAND_H + 2 }}
            onClick={e => e.stopPropagation()}
            onPointerUp={e => e.stopPropagation()}
          >
            <div className="sc-panel flex items-center gap-2 pl-3 pr-1.5 py-1.5" style={{ borderRadius: 999 }}>
              <span className="text-[12px] font-bold text-parch-50 max-w-[150px] truncate">{selectedHandTpl.name}</span>
              <button
                type="button"
                className="sc-btn sc-btn--ghost sc-btn--sm"
                onClick={() => {
                  setPreviewCard(selectedHandTpl);
                  setPreviewStats(undefined);
                }}
              >
                <Eye size={13} /> 詳細
              </button>
              {selectedBarLabel ? (
                <button
                  type="button"
                  className={`sc-btn sc-btn--sm ${state.phase === 'ARCANA_PLACEMENT' ? 'sc-btn--arcane' : 'sc-btn--primary'}`}
                  disabled={!!selectedBlock}
                  onClick={() => selectedHandCard && handleHandPrimary(selectedHandCard.instanceId)}
                >
                  {selectedBlock ?? selectedBarLabel}
                </button>
              ) : (
                selectedHandTpl.type === 'Evolution' && (
                  <span className="text-[11px] font-bold text-brass-200 pr-2">{selectedBlock ?? '進化元をタップ'}</span>
                )
              )}
              <button
                type="button"
                className="sc-btn sc-btn--ghost sc-btn--icon"
                style={{ minHeight: 32, width: 32, borderRadius: 999 }}
                onClick={() => setSelectedCardId(null)}
                aria-label="選択をやめる"
              >
                <X size={14} />
              </button>
            </div>
          </div>
        )}

        {/* 攻撃の矢印 */}
        {attackDrag && (
          <AttackArrowOverlay
            startX={attackDrag.startX}
            startY={attackDrag.startY}
            currentX={attackDrag.currentX}
            currentY={attackDrag.currentY}
            lockedTarget={attackDrag.lockedTarget}
          />
        )}

        {/* ドラッグ中の手札 */}
        {draggingCard && dragCanvasPos && (
          <div
            className="absolute pointer-events-none z-50 flex flex-col items-center"
            style={{ left: dragCanvasPos.x, top: dragCanvasPos.y, transform: 'translate(-50%, -78%)' }}
          >
            {(() => {
              const tpl = getCard(draggingCard.cardId);
              let text: string | null = null;
              let ok = true;
              if (dragHoverZone === 'arcana') {
                ok = isMyTurn && state.phase === 'ARCANA_PLACEMENT' && !state.flags.hasPlacedArcanaThisTurn;
                text = ok ? '離してアルカナに捧げる' : state.flags.hasPlacedArcanaThisTurn ? '今ターンは捧げ済み' : 'チャージフェイズのみ';
              } else if (dragHoverZone === 'field') {
                const reason = playBlockReason(tpl);
                ok = !reason;
                text = reason ?? (tpl.type === 'Spell' ? '離して詠唱' : tpl.type === 'Evolution' ? '進化元の上で離す' : '離して召喚');
              }
              return text ? (
                <div
                  className="mb-1.5 px-2.5 h-[22px] rounded-full flex items-center text-[11px] font-bold whitespace-nowrap"
                  style={{
                    background: ok ? 'linear-gradient(180deg,#5fe3cf,#13776c)' : 'linear-gradient(180deg,#8f2c27,#5a1614)',
                    color: ok ? '#03211d' : '#ffe3df',
                    border: `1px solid ${ok ? '#c4fbf1' : '#e3665c'}`,
                  }}
                >
                  {text}
                </div>
              ) : null;
            })()}
            <div style={{ transform: 'rotate(-4deg) scale(1.08)', filter: 'drop-shadow(0 12px 16px rgba(0,0,0,0.7))' }}>
              <CardView instance={draggingCard} size="hand" isDragging selected />
            </div>
          </div>
        )}

        {/* ルーン発動の暗転 */}
        {state.prompt?.type === 'RUNE_TRIGGER' && (
          <div className="absolute inset-0 pointer-events-none z-40 bg-black/70 animate-rune-darken" />
        )}

        {/* 攻撃の火花 */}
        {clashSparkPos && (
          <div
            className="absolute pointer-events-none z-50 animate-clash-spark flex items-center justify-center -translate-x-1/2 -translate-y-1/2"
            style={{ left: clashSparkPos.x, top: clashSparkPos.y }}
          >
            <div className="w-24 h-24 rounded-full" style={{ background: 'radial-gradient(circle, #fff 0%, #f2dea6 30%, rgba(230,199,127,0) 70%)' }} />
            <div className="absolute w-36 h-[3px] bg-white rotate-45" />
            <div className="absolute w-36 h-[3px] bg-white -rotate-45" />
          </div>
        )}

        {/* ターン開始の帯 */}
        {showYourTurnBanner && turnBanner && (
          <div key={turnBanner.key} className="absolute inset-x-0 pointer-events-none z-50 flex items-center justify-center" style={{ top: (H - HAND_H) / 2 - 30, height: 60 }}>
            <div
              className="absolute inset-0"
              style={{
                background: turnBanner.mine
                  ? 'linear-gradient(90deg, transparent, rgba(20,95,87,0.92) 20%, rgba(20,95,87,0.92) 80%, transparent)'
                  : 'linear-gradient(90deg, transparent, rgba(125,35,32,0.92) 20%, rgba(125,35,32,0.92) 80%, transparent)',
                borderTop: '1px solid rgba(242,222,166,0.6)',
                borderBottom: '1px solid rgba(242,222,166,0.6)',
                animation: `sc-banner ${turnBanner.mine ? 1100 : 900}ms var(--ease-out-quint) both`,
              }}
            />
            <div className="relative flex flex-col items-center" style={{ animation: `sc-banner-text ${turnBanner.mine ? 1100 : 900}ms ease-out both` }}>
              <span className="sc-eyebrow text-brass-200">Turn {state.turnCount}</span>
              <span className="sc-title text-[24px] leading-tight">{turnBanner.mine ? 'あなたのターン' : '相手のターン'}</span>
            </div>
          </div>
        )}

        {/* 通知 */}
        {feedbackToast && <Toast key={feedbackToast.key} text={feedbackToast.text} tone={feedbackToast.type} top={34} />}

        {/* 魔法・能力発動のカットイン */}
        {cutinCard && (
          <div className="absolute inset-0 pointer-events-none z-50 flex items-center justify-center" style={{ background: 'radial-gradient(ellipse at center, rgba(3,4,9,0.55), rgba(3,4,9,0) 70%)' }}>
            <div className="relative flex flex-col items-center" style={{ animation: 'sc-cast 1150ms var(--ease-out-quint) both' }}>
              <svg className="absolute" style={{ width: 260, height: 260, top: -20, animation: 'sc-spin-slow 6s linear infinite', opacity: 0.55 }} viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="47" fill="none" stroke="#e6c77f" strokeWidth="0.8" />
                <circle cx="50" cy="50" r="40" fill="none" stroke="#e6c77f" strokeWidth="0.5" strokeDasharray="2 2" />
                <polygon points="50,6 88,72 12,72" fill="none" stroke="#e6c77f" strokeWidth="0.6" />
                <polygon points="50,94 12,28 88,28" fill="none" stroke="#e6c77f" strokeWidth="0.6" />
              </svg>
              <div className="relative mb-2 px-3 h-[24px] rounded-full flex items-center gap-1 text-[12px] font-bold" style={{ background: 'linear-gradient(180deg,#f3dc9b,#a57c36)', color: '#221806' }}>
                <Sparkles size={12} />
                {cutinCard.title.replace(/！/g, '')}
              </div>
              <div className="relative">
                <CardView template={cutinCard.card} size="grid" />
              </div>
            </div>
          </div>
        )}

        {/* ================= 相手の攻撃への応答（守護・ルーン） ================= */}
        {myPrompt && (
          <Modal
            open
            dismissible={false}
            width={myPrompt.type === 'GUARD' ? 440 : 340}
            eyebrow={myPrompt.type === 'GUARD' ? 'Guard' : myPrompt.type === 'RUNE_TRIGGER' ? 'Rune' : 'Trigger'}
            title={myPrompt.type === 'GUARD' ? '守護しますか？' : myPrompt.type === 'RUNE_TRIGGER' ? 'ルーン発動' : '効果を発動しますか？'}
            icon={myPrompt.type === 'GUARD' ? <Shield size={20} /> : <Zap size={20} />}
            tone={myPrompt.type === 'GUARD' ? 'danger' : 'arcane'}
            zIndex={60}
            footer={
              myPrompt.type === 'GUARD' ? (
                <button type="button" className="sc-btn sc-btn--cancel" onClick={() => handlePrompt(false)}>
                  守護しない
                </button>
              ) : (
                <>
                  <button type="button" className="sc-btn sc-btn--cancel" onClick={() => handlePrompt(false)}>
                    発動しない
                  </button>
                  <button type="button" className="sc-btn sc-btn--arcane" onClick={() => handlePrompt(true)}>
                    発動する
                  </button>
                </>
              )
            }
          >
            {(() => {
              const attacker = myPrompt.attackerId ? opp.field.find(u => u.instanceId === myPrompt.attackerId) : undefined;
              const guarders = me.field.filter(u => canUnitGuard(u));
              if (myPrompt.type !== 'GUARD') {
                return <p className="text-[13px] leading-relaxed text-parch-50">{myPrompt.text || myPrompt.message}</p>;
              }
              return (
                <div className="flex gap-3 items-start">
                  {attacker && (
                    <div className="flex flex-col items-center gap-1 shrink-0">
                      <span className="text-[10px] font-bold text-crimson-300">攻撃してくる</span>
                      <CardView instance={attacker.cards[0]} size="field" computedStats={calculateUnitStats(state, 'player2', attacker)} />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] leading-snug text-parch-100 mb-2">{myPrompt.text || myPrompt.message || '守護するユニットを選んでください。'}</p>
                    <div className="flex flex-wrap gap-2">
                      {guarders.map(u => (
                        <button
                          key={u.instanceId}
                          type="button"
                          onClick={() => handlePrompt(true, u.instanceId)}
                          className="flex flex-col items-center gap-1 rounded-lg p-1 active:scale-95 transition-transform"
                          style={{ border: '1px solid rgba(134,236,220,0.45)', background: 'rgba(20,95,87,0.18)' }}
                        >
                          <CardView instance={u.cards[0]} size="field" computedStats={calculateUnitStats(state, 'player1', u)} />
                          <span className="text-[11px] font-bold text-arcane-200 flex items-center gap-1">
                            <Shield size={11} /> 守護
                          </span>
                        </button>
                      ))}
                      {guarders.length === 0 && <span className="text-[12px] text-parch-500">守護できるユニットがいません。</span>}
                    </div>
                  </div>
                </div>
              );
            })()}
          </Modal>
        )}

        {/* ================= メニュー ================= */}
        <Modal open={showMenu} onClose={() => setShowMenu(false)} title="メニュー" eyebrow={`Turn ${state.turnCount}`} icon={<Menu size={18} />} width={320}>
          <div className="flex flex-col gap-2">
            <button
              type="button"
              className="sc-btn sc-btn--block justify-between"
              onClick={() => {
                setShowMenu(false);
                setShowLog(true);
              }}
            >
              <span className="flex items-center gap-2">
                <ScrollText size={15} /> バトルログ
              </span>
              <span className="text-[11px] text-parch-500">{state.log.length}件</span>
            </button>
            <button
              type="button"
              className="sc-btn sc-btn--block justify-between"
              onClick={() => {
                setShowMenu(false);
                setShowPlaymatSelector(true);
              }}
            >
              <span className="flex items-center gap-2">
                <Palette size={15} /> プレイマット
              </span>
              <span className="text-[11px] text-brass-300">{currentTheme.name}</span>
            </button>
            <button type="button" className="sc-btn sc-btn--block justify-between" onClick={() => setIsMuted(soundManager.toggleMute())}>
              <span className="flex items-center gap-2">
                {isMuted ? <VolumeX size={15} /> : <Volume2 size={15} />} 効果音
              </span>
              <span className="text-[11px] text-parch-500">{isMuted ? 'オフ' : 'オン'}</span>
            </button>
            {onOpenDeckBuilder && (
              <button
                type="button"
                className="sc-btn sc-btn--block justify-between"
                onClick={() => {
                  setShowMenu(false);
                  onOpenDeckBuilder();
                }}
              >
                <span className="flex items-center gap-2">
                  <Layers size={15} /> デッキ編成
                </span>
              </button>
            )}
            <button type="button" className="sc-btn sc-btn--primary sc-btn--block mt-1" onClick={() => setShowMenu(false)}>
              対戦に戻る
            </button>
          </div>
        </Modal>

        {/* ================= バトルログ ================= */}
        {showLog && (
          <div className="absolute inset-0 z-50" onClick={() => setShowLog(false)} style={{ animation: 'sc-fade-in 120ms ease-out both', background: 'rgba(3,4,9,0.35)' }}>
            <div
              id="battle-log-drawer"
              className="sc-panel sc-anim-slide-right absolute top-2 right-2 bottom-2 flex flex-col"
              style={{ width: 300 }}
              onClick={e => e.stopPropagation()}
              onPointerDown={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between px-3 py-2">
                <div className="flex items-center gap-2">
                  <History size={15} className="text-brass-300" />
                  <span className="sc-title text-[14px]">バトルログ</span>
                </div>
                <button type="button" onClick={() => setShowLog(false)} className="sc-btn sc-btn--ghost sc-btn--icon" aria-label="閉じる">
                  <X size={15} />
                </button>
              </div>
              <div className="sc-divider mx-2" />
              <BattleLogList entries={state.log} />
            </div>
          </div>
        )}

        {/* ================= 勝敗 ================= */}
        {state.winner && (
          <div className="absolute inset-0 z-[80] flex items-center justify-center" style={{ background: 'rgba(3,4,9,0.8)', animation: 'sc-fade-in 240ms ease-out both' }}>
            <div className="sc-panel sc-corners sc-modal w-[360px] px-6 py-5 flex flex-col items-center text-center">
              <div className="relative w-[84px] h-[84px] mb-2 sc-anim-seal">
                <svg viewBox="0 0 100 100" className="absolute inset-0">
                  <circle cx="50" cy="50" r="46" fill="none" stroke={state.winner === 'player1' ? '#e6c77f' : '#e3665c'} strokeWidth="2" />
                  <circle cx="50" cy="50" r="38" fill="none" stroke={state.winner === 'player1' ? '#e6c77f' : '#e3665c'} strokeWidth="1" strokeDasharray="3 3" />
                  <polygon points="50,10 85,70 15,70" fill="none" stroke={state.winner === 'player1' ? '#f2dea6' : '#f39a90'} strokeWidth="1.2" />
                  <polygon points="50,90 15,30 85,30" fill="none" stroke={state.winner === 'player1' ? '#f2dea6' : '#f39a90'} strokeWidth="1.2" />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  {state.winner === 'player1' ? <Sparkles size={30} className="text-brass-200" /> : <Shield size={28} className="text-crimson-300" />}
                </div>
              </div>
              <div className="sc-eyebrow">{state.winner === 'player1' ? 'Victory' : 'Defeat'}</div>
              <div className="sc-title text-[34px] leading-tight" style={{ color: state.winner === 'player1' ? '#fbf0d2' : '#f7c3bc' }}>
                {state.winner === 'player1' ? '勝利' : '敗北'}
              </div>
              <p className="text-[12.5px] text-parch-300 mt-1 mb-4">
                {state.winner === 'player1' ? '相手の結界をすべて打ち破った。' : 'あなたの結界はすべて破られた。'}
                <span className="block text-parch-500 text-[11px] mt-0.5">{state.turnCount} ターンで決着</span>
              </p>
              <div className="flex flex-col gap-2 w-full">
                <button
                  type="button"
                  onClick={e => {
                    e.stopPropagation();
                    handleRestartGame();
                  }}
                  className="sc-btn sc-btn--primary sc-btn--lg sc-btn--block"
                >
                  もう一度対戦する
                </button>
                {onOpenDeckBuilder && (
                  <button
                    type="button"
                    onClick={e => {
                      e.stopPropagation();
                      onOpenDeckBuilder();
                    }}
                    className="sc-btn sc-btn--block"
                  >
                    <Layers size={15} /> デッキ編成へ
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* カード詳細（長押し） */}
        <FloatingCardPreview
          card={previewCard}
          computedStats={previewStats}
          onClose={() => {
            setPreviewCard(null);
            setPreviewStats(undefined);
          }}
        />

        <ZoneViewerModal
          isOpen={zoneModal.isOpen}
          onClose={() => setZoneModal(prev => ({ ...prev, isOpen: false, selectionMode: null }))}
          title={zoneModal.title}
          zoneType={zoneModal.zoneType}
          cards={zoneModal.cards}
          isOpponent={zoneModal.isOpponent}
          selectionMode={zoneModal.selectionMode}
          onInspect={card => {
            setPreviewCard(card);
            setPreviewStats(undefined);
          }}
        />

        <PlaymatSelector
          isOpen={showPlaymatSelector}
          onClose={() => setShowPlaymatSelector(false)}
          currentTheme={playmatTheme}
          onSelectTheme={themeId => setPlaymatTheme(themeId)}
        />
      </div>
    </div>
  );
};

/** バトルログ: 新しい記録が来たら末尾へスクロール */
const BattleLogList: React.FC<{ entries: string[] }> = ({ entries }) => {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight;
  }, [entries.length]);
  if (entries.length === 0) return <div className="flex-1 flex items-center justify-center text-[12px] text-parch-500">まだ記録がありません</div>;
  return (
    <div ref={ref} className="sc-scroll flex-1 min-h-0 px-2 py-2 space-y-1">
      {entries.map((entry, idx) => (
        <div
          key={idx}
          className="px-2.5 py-1.5 rounded-md text-[11.5px] leading-snug text-parch-100"
          style={{ background: idx % 2 ? 'rgba(22,26,41,0.6)' : 'rgba(11,13,23,0.6)', borderLeft: '2px solid rgba(210,171,95,0.45)' }}
        >
          {entry}
        </div>
      ))}
    </div>
  );
};
