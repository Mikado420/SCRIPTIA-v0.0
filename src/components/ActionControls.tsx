import React, { useEffect, useState } from 'react';
import { Phase } from '../types';
import { ChevronRight, Hourglass } from 'lucide-react';
import { soundManager } from '../utils/soundManager';

interface Props {
  phase: Phase;
  turnCount: number;
  isMyTurn: boolean;
  hasPlacedArcanaThisTurn?: boolean;
  hasPrompt: boolean;
  selectedCardId?: string | null;
  isHandSelected?: boolean;
  /** まだ攻撃・プレイできるものが残っている（ターン終了を二度押しで確定させる） */
  hasPendingActions?: boolean;
  onNextPhase: () => void;
  onArcanaCharge?: () => void;
}

const STEPS: { id: 'charge' | 'action' | 'end'; label: string }[] = [
  { id: 'charge', label: 'チャージ' },
  { id: 'action', label: '行動' },
  { id: 'end', label: '終了' },
];

/** フェイズ表示とフェイズ進行／ターン終了ボタン */
export const ActionControls: React.FC<Props> = ({ phase, turnCount, isMyTurn, hasPrompt, hasPendingActions, onNextPhase }) => {
  const canAct = isMyTurn && !hasPrompt;
  const [armed, setArmed] = useState(false);

  useEffect(() => {
    setArmed(false);
  }, [phase, isMyTurn, turnCount]);

  useEffect(() => {
    if (!armed) return;
    const t = setTimeout(() => setArmed(false), 2600);
    return () => clearTimeout(t);
  }, [armed]);

  const current = phase === 'ARCANA_PLACEMENT' ? 'charge' : phase === 'ACTION' ? 'action' : 'end';

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!canAct) return;
    if (phase === 'ACTION' && hasPendingActions && !armed) {
      soundManager.playCardTouch();
      setArmed(true);
      return;
    }
    soundManager.playCardTouch();
    setArmed(false);
    onNextPhase();
  };

  let label: React.ReactNode;
  let variant = 'sc-btn--primary';
  if (!isMyTurn) {
    label = (
      <>
        <Hourglass size={14} />
        <span>相手のターン</span>
      </>
    );
    variant = '';
  } else if (hasPrompt) {
    label = <span>応答を選択中</span>;
    variant = '';
  } else if (phase === 'ARCANA_PLACEMENT') {
    label = (
      <>
        <span>行動へ進む</span>
        <ChevronRight size={16} strokeWidth={3} />
      </>
    );
    variant = 'sc-btn--confirm';
  } else if (armed) {
    label = <span>もう一度で終了</span>;
    variant = 'sc-btn--warning';
  } else {
    label = (
      <>
        <span>ターン終了</span>
        <ChevronRight size={16} strokeWidth={3} />
      </>
    );
  }

  return (
    <div className="flex flex-col items-stretch gap-1.5 select-none w-full" onClick={e => e.stopPropagation()}>
      <div className="flex items-baseline justify-between px-0.5">
        <span className="sc-eyebrow">Turn {turnCount}</span>
        <span className={`text-[11px] font-bold ${isMyTurn ? 'text-arcane-300' : 'text-crimson-300'}`}>
          {isMyTurn ? 'あなたの番' : '相手の番'}
        </span>
      </div>

      <div className="flex items-center gap-1" aria-label="フェイズ">
        {STEPS.map((s, i) => {
          const active = isMyTurn && s.id === current;
          const done = isMyTurn && STEPS.findIndex(x => x.id === current) > i;
          return (
            <React.Fragment key={s.id}>
              <div
                className={`${s.id === 'charge' ? 'flex-[1.35]' : 'flex-1'} h-[22px] rounded-md flex items-center justify-center text-[10px] font-bold whitespace-nowrap tracking-tight transition-colors`}
                style={{
                  background: active ? 'linear-gradient(180deg,#3a3222,#231d12)' : 'rgba(6,7,13,0.7)',
                  color: active ? '#fbf0d2' : done ? '#948a76' : '#5b5a61',
                  border: `1px solid ${active ? '#d2ab5f' : 'rgba(210,171,95,0.18)'}`,
                }}
              >
                {s.label}
              </div>
            </React.Fragment>
          );
        })}
      </div>

      <button
        type="button"
        disabled={!canAct}
        onClick={handleClick}
        className={`sc-btn sc-btn--lg w-full ${variant} ${canAct && phase === 'ACTION' && !armed && !hasPendingActions ? 'sc-anim-breathe' : ''}`}
        style={{ minHeight: 50 }}
      >
        {label}
      </button>
      <div className="h-3 text-center text-[9.5px] leading-3 text-parch-500">
        {armed ? 'まだ行動できるユニット／カードがあります' : ''}
      </div>
    </div>
  );
};
