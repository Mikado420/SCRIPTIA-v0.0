// Gesture and Long-Press Detection Engine for SCRIPTIA TCG
// 700ms long-press with 10px move cancellation and zero conflict drag resolution

import React, { useRef } from 'react';
import { soundManager } from './soundManager';

export interface CardGestureOptions {
  onLongPress: () => void;
  onTap?: () => void;
  onDragStart?: (clientX: number, clientY: number) => void;
  onDragMove?: (clientX: number, clientY: number) => void;
  onDragEnd?: (clientX: number, clientY: number) => void;
  longPressDelayMs?: number; // default 700
  dragThresholdPx?: number;  // default 10
}

export function useCardGesture(options: CardGestureOptions) {
  const {
    onLongPress,
    onTap,
    onDragStart,
    onDragMove,
    onDragEnd,
    longPressDelayMs = 700,
    dragThresholdPx = 10,
  } = options;

  const timerRef = useRef<NodeJS.Timeout | number | null>(null);
  const startPosRef = useRef<{ x: number; y: number } | null>(null);
  const isDraggingRef = useRef<boolean>(false);
  const hasLongPressedRef = useRef<boolean>(false);

  const clearTimer = () => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current as NodeJS.Timeout);
      timerRef.current = null;
    }
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    // Only handle primary pointer (left click or single touch)
    if (e.button !== 0 && e.pointerType === 'mouse') return;

    clearTimer();
    startPosRef.current = { x: e.clientX, y: e.clientY };
    isDraggingRef.current = false;
    hasLongPressedRef.current = false;

    // Start 700ms long press timer
    timerRef.current = setTimeout(() => {
      if (!isDraggingRef.current) {
        hasLongPressedRef.current = true;
        soundManager.playDetailOpen();
        onLongPress();
      }
      clearTimer();
    }, longPressDelayMs);

    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      // ignore
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!startPosRef.current) return;

    const dist = Math.hypot(
      e.clientX - startPosRef.current.x,
      e.clientY - startPosRef.current.y
    );

    // If moved beyond 10px, CANCEL long-press immediately
    if (dist >= dragThresholdPx) {
      clearTimer();

      if (!isDraggingRef.current) {
        isDraggingRef.current = true;
        if (onDragStart) {
          onDragStart(e.clientX, e.clientY);
        }
      }

      if (isDraggingRef.current && onDragMove) {
        onDragMove(e.clientX, e.clientY);
      }
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!startPosRef.current) return;

    clearTimer();
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }

    const wasDragging = isDraggingRef.current;
    const hadLongPressed = hasLongPressedRef.current;

    startPosRef.current = null;
    isDraggingRef.current = false;
    hasLongPressedRef.current = false;

    if (wasDragging) {
      if (onDragEnd) {
        onDragEnd(e.clientX, e.clientY);
      }
    } else if (!hadLongPressed) {
      // Short tap (<700ms, <10px)
      if (onTap) {
        onTap();
      }
    }
  };

  const handlePointerCancel = (e: React.PointerEvent) => {
    clearTimer();
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }
    if (isDraggingRef.current && onDragEnd) {
      onDragEnd(e.clientX, e.clientY);
    }
    startPosRef.current = null;
    isDraggingRef.current = false;
    hasLongPressedRef.current = false;
  };

  return {
    onPointerDown: handlePointerDown,
    onPointerMove: handlePointerMove,
    onPointerUp: handlePointerUp,
    onPointerCancel: handlePointerCancel,
  };
}
