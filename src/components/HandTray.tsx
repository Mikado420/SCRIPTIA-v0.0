import React, { useRef } from 'react';
import { CardView } from './CardView';
import { CardInstance, GameState, GameAction } from '../types';
import { getCard } from '../data/cards';
import { canPlayCard } from '../engine/engineUtils';
import { Zap, ChevronUp, X } from 'lucide-react';
import { soundManager } from '../utils/soundManager';

interface Props {
  hand: CardInstance[];
  state: GameState;
  dispatch: React.Dispatch<GameAction>;
  selectedCard: string | null;
  onSelect: (id: string) => void;
  onInspect: (card: any) => void;
  onPlayCard?: (id: string) => void;
  onArcanaPlace?: (id: string) => void;
  // Drag and Drop callbacks
  onCardDragStart?: (card: CardInstance, clientX: number, clientY: number) => void;
  onCardDragMove?: (clientX: number, clientY: number) => void;
  onCardDragEnd?: (card: CardInstance, clientX: number, clientY: number) => void;
  draggingCardId?: string | null;
}

export const HandTray: React.FC<Props> = ({
  hand,
  state,
  dispatch,
  selectedCard,
  onSelect,
  onInspect,
  onPlayCard,
  onArcanaPlace,
  onCardDragStart,
  onCardDragMove,
  onCardDragEnd,
  draggingCardId,
}) => {
  const me = state.player1;
  const isMyTurn = state.currentPlayer === 'player1';

  // Pointer drag and 700ms long-press tracking refs
  const pointerDownPos = useRef<{ x: number; y: number; id: string; time: number } | null>(null);
  const isDraggingRef = useRef<boolean>(false);
  const longPressTimerRef = useRef<NodeJS.Timeout | number | null>(null);
  const hasLongPressedRef = useRef<boolean>(false);

  const clearLongPressTimer = () => {
    if (longPressTimerRef.current !== null) {
      clearTimeout(longPressTimerRef.current as NodeJS.Timeout);
      longPressTimerRef.current = null;
    }
  };

  // Dynamic overlap for right-aligned hand fan (Duel Masters Plays style)
  const getOverlapMargin = () => {
    if (hand.length <= 1) return '';
    if (hand.length <= 3) return '-ml-4';
    if (hand.length <= 5) return '-ml-6 sm:-ml-7';
    if (hand.length <= 7) return '-ml-7 sm:-ml-8';
    return '-ml-8 sm:-ml-9';
  };

  const handlePointerDown = (c: CardInstance, e: React.PointerEvent) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    e.stopPropagation();
    clearLongPressTimer();

    pointerDownPos.current = {
      x: e.clientX,
      y: e.clientY,
      id: c.instanceId,
      time: Date.now(),
    };
    isDraggingRef.current = false;
    hasLongPressedRef.current = false;

    // Start 700ms long-press timer for card inspection
    longPressTimerRef.current = setTimeout(() => {
      if (!isDraggingRef.current) {
        hasLongPressedRef.current = true;
        soundManager.playDetailOpen();
        onInspect(getCard(c.cardId));
      }
      clearLongPressTimer();
    }, 700);

    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      // ignore
    }
  };

  const handlePointerMove = (c: CardInstance, e: React.PointerEvent) => {
    if (!pointerDownPos.current || pointerDownPos.current.id !== c.instanceId) return;
    const dist = Math.hypot(
      e.clientX - pointerDownPos.current.x,
      e.clientY - pointerDownPos.current.y
    );

    // Cancel 700ms long-press if movement exceeds 10px
    if (dist >= 10) {
      clearLongPressTimer();

      if (!isDraggingRef.current) {
        isDraggingRef.current = true;
        soundManager.playCardSwipe();
        if (onCardDragStart) {
          onCardDragStart(c, e.clientX, e.clientY);
        }
      }

      if (isDraggingRef.current && onCardDragMove) {
        onCardDragMove(e.clientX, e.clientY);
      }
    }
  };

  const handlePointerUp = (c: CardInstance, e: React.PointerEvent) => {
    if (!pointerDownPos.current || pointerDownPos.current.id !== c.instanceId) return;
    clearLongPressTimer();

    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }

    const wasDragging = isDraggingRef.current;
    const hadLongPressed = hasLongPressedRef.current;

    pointerDownPos.current = null;
    isDraggingRef.current = false;
    hasLongPressedRef.current = false;

    if (wasDragging) {
      if (onCardDragEnd) {
        onCardDragEnd(c, e.clientX, e.clientY);
      }
    } else if (!hadLongPressed) {
      // Tap action (<700ms, <10px): toggle selection
      soundManager.playCardTouch();
      const nextSel = selectedCard === c.instanceId ? '' : c.instanceId;
      onSelect(nextSel);
    }
  };

  const handlePointerCancel = (c: CardInstance, e: React.PointerEvent) => {
    clearLongPressTimer();
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }
    if (isDraggingRef.current && onCardDragEnd) {
      onCardDragEnd(c, e.clientX, e.clientY);
    }
    pointerDownPos.current = null;
    isDraggingRef.current = false;
    hasLongPressedRef.current = false;
  };

  return (
    <div
      id="hand-tray-container"
      className="relative flex items-end justify-end pointer-events-auto h-[92px] select-none pr-1 touch-none"
    >
      <div className="flex items-end justify-end">
        {hand.map((c, i) => {
          const isSelected = selectedCard === c.instanceId;
          const isBeingDragged = draggingCardId === c.instanceId;
          const cardData = getCard(c.cardId);

          // Check playability
          const isPlayableNow =
            isMyTurn &&
            state.phase === 'ACTION' &&
            canPlayCard(cardData, me.currentArcana, me.arcana, me.field.length);

          const canPlaceArcana =
            isMyTurn &&
            !state.flags.hasPlacedArcanaThisTurn;

          // Hand trigger detection (e.g. BR-03 即応兵 ゼルガン)
          const isTriggerCard = cardData.effectText?.includes('結界が破壊された時') || cardData.id === 'BR-03';
          const isTriggerActive = isTriggerCard && (state.prompt !== null);

          // Slight rotation or curve for fan effect if multiple cards
          const rotDeg = Math.max(-8, Math.min(8, (i - (hand.length - 1) / 2) * 2.5));

          return (
            <div
              key={c.instanceId}
              style={{
                zIndex: isSelected ? 60 : 10 + i,
              }}
              className={`relative shrink-0 select-none group transition-all duration-200 touch-none ${
                i > 0 ? getOverlapMargin() : ''
              } ${isBeingDragged ? 'opacity-20 pointer-events-none' : ''} ${
                isTriggerActive ? 'animate-hand-trigger-pulse rounded-lg z-50 ring-2 ring-yellow-400' : ''
              }`}
              onPointerDown={(e) => handlePointerDown(c, e)}
              onPointerMove={(e) => handlePointerMove(c, e)}
              onPointerUp={(e) => handlePointerUp(c, e)}
              onPointerCancel={(e) => handlePointerCancel(c, e)}
            >
              {/* Rising Card Container */}
              <div
                style={{
                  transform: isSelected
                    ? 'translateY(-26px) scale(1.18)'
                    : `rotate(${rotDeg}deg) translateY(0px)`,
                  transformOrigin: 'bottom center',
                }}
                className={`transition-all duration-200 ease-out origin-bottom ${
                  isSelected
                    ? 'z-50 shadow-2xl shadow-yellow-400/40'
                    : 'hover:-translate-y-4 hover:scale-110 hover:z-40'
                }`}
              >
                {/* Action Buttons Bubble above Selected Card (Duel Masters Plays Style) */}
                {isSelected && !isBeingDragged && (
                  <div
                    className="absolute -top-11 left-1/2 -translate-x-1/2 flex items-center space-x-1.5 z-50 whitespace-nowrap animate-in fade-in slide-in-from-bottom-2 duration-150"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {/* Action 1: Neon Green PLAY Button (Duel Masters signature) */}
                    {state.phase === 'ACTION' && (
                      <button
                        type="button"
                        disabled={!isPlayableNow}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (onPlayCard) {
                            onPlayCard(c.instanceId);
                          } else {
                            dispatch({ type: 'PLAY_CARD', instanceId: c.instanceId });
                            onSelect('');
                          }
                        }}
                        className={`px-3 py-1 rounded-full text-[11px] font-black flex items-center space-x-1 shadow-2xl transition-all ${
                          isPlayableNow
                            ? 'bg-gradient-to-r from-emerald-500 via-green-400 to-emerald-500 hover:brightness-110 text-slate-950 ring-2 ring-emerald-300 shadow-[0_0_16px_rgba(52,211,153,0.9)] animate-bounce active:scale-95 cursor-pointer'
                            : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700 opacity-60'
                        }`}
                      >
                        <ChevronUp size={13} className="stroke-[3]" />
                        <span>PLAY</span>
                        {isPlayableNow && (
                          <span className="text-[8.5px] opacity-85">
                            ({cardData.type === 'Spell' ? '発動' : cardData.type === 'Rune' ? '設置' : '召喚'})
                          </span>
                        )}
                      </button>
                    )}

                    {/* Action 2: Arcana Placement Button */}
                    {canPlaceArcana && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (onArcanaPlace) {
                            onArcanaPlace(c.instanceId);
                          } else {
                            dispatch({ type: 'PLACE_ARCANA', instanceId: c.instanceId });
                            onSelect('');
                          }
                        }}
                        className="px-3 py-1 bg-gradient-to-r from-blue-600 to-indigo-500 hover:from-blue-500 hover:to-indigo-400 text-white rounded-full text-[11px] font-black flex items-center space-x-1 shadow-xl active:scale-95 ring-2 ring-blue-300 shadow-[0_0_14px_rgba(59,130,246,0.8)] cursor-pointer"
                      >
                        <Zap size={11} className="fill-yellow-300 text-yellow-300" />
                        <span>CHARGE</span>
                      </button>
                    )}

                    {/* Action 3: Close / Deselect */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelect('');
                      }}
                      className="p-1 rounded-full bg-slate-900/90 border border-white/20 hover:bg-red-950 text-slate-400 hover:text-red-300 transition-colors cursor-pointer shadow"
                      title="選択解除"
                    >
                      <X size={12} />
                    </button>
                  </div>
                )}

                {/* Card Element */}
                <CardView
                  instance={c}
                  size="hand"
                  selected={isSelected}
                  playable={isPlayableNow || canPlaceArcana}
                  onClick={(e) => {
                    e.stopPropagation();
                  }}
                  onInspect={() => onInspect(cardData)}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};


