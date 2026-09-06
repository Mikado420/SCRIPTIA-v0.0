import React, { useRef } from 'react';
import { CardView } from './CardView';
import { CardInstance, GameState, GameAction, CardTemplate } from '../types';
import { getCard } from '../data/cards';
import { canPlayCard } from '../engine/engineUtils';
import { soundManager } from '../utils/soundManager';

interface Props {
  hand: CardInstance[];
  state: GameState;
  dispatch: React.Dispatch<GameAction>;
  selectedCard?: string | null;
  onSelect?: (id: string) => void;
  onInspect: (card: CardTemplate) => void;
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
  onInspect,
  onCardDragStart,
  onCardDragMove,
  onCardDragEnd,
  draggingCardId,
}) => {
  const me = state.player1;
  const isMyTurn = state.currentPlayer === 'player1';

  // Pointer drag and 700ms long-press tracking refs
  const touchStartPosRef = useRef<{ x: number; y: number; id: string } | null>(null);
  const isDraggingRef = useRef<boolean>(false);
  const longPressTimerRef = useRef<NodeJS.Timeout | number | null>(null);

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

    touchStartPosRef.current = {
      x: e.clientX,
      y: e.clientY,
      id: c.instanceId,
    };
    isDraggingRef.current = false;

    // Start 700ms long-press timer for card inspection HUD
    longPressTimerRef.current = setTimeout(() => {
      if (!isDraggingRef.current) {
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
    if (!touchStartPosRef.current || touchStartPosRef.current.id !== c.instanceId) return;

    const dx = Math.abs(e.clientX - touchStartPosRef.current.x);
    const dy = Math.abs(e.clientY - touchStartPosRef.current.y);

    // Cancel 700ms long-press immediately if moved more than 8px
    if (dx > 8 || dy > 8) {
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
    if (!touchStartPosRef.current || touchStartPosRef.current.id !== c.instanceId) return;
    clearLongPressTimer();

    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }

    const wasDragging = isDraggingRef.current;
    touchStartPosRef.current = null;
    setTimeout(() => {
      isDraggingRef.current = false;
    }, 50);

    if (wasDragging) {
      if (onCardDragEnd) {
        onCardDragEnd(c, e.clientX, e.clientY);
      }
    }
    // No onClick or tap selection action on hand cards. Operations are drag-only!
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
    touchStartPosRef.current = null;
    setTimeout(() => {
      isDraggingRef.current = false;
    }, 50);
  };

  return (
    <div
      id="hand-tray-container"
      className="relative flex items-end justify-end pointer-events-auto h-[92px] select-none pr-1 touch-none"
    >
      <div className="flex items-end justify-end">
        {hand.map((c, i) => {
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
                zIndex: 10 + i,
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
              {/* Card Container */}
              <div
                style={{
                  transform: `rotate(${rotDeg}deg) translateY(0px)`,
                  transformOrigin: 'bottom center',
                }}
                className="transition-all duration-200 ease-out origin-bottom hover:-translate-y-3 hover:scale-105 hover:z-40"
              >
                <CardView
                  instance={c}
                  size="hand"
                  playable={isPlayableNow || canPlaceArcana}
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
