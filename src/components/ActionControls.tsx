import React from 'react';
import { Phase } from '../types';
import { ChevronRight, Zap, Loader2, Layers, Archive } from 'lucide-react';

interface Props {
  phase: Phase;
  turnCount: number;
  isMyTurn: boolean;
  hasPlacedArcanaThisTurn: boolean;
  hasPrompt: boolean;
  selectedCardId: string | null;
  isHandSelected: boolean;
  onNextPhase: () => void;
  onArcanaCharge: () => void;
}

export const ActionControls: React.FC<Props> = ({
  phase,
  isMyTurn,
  hasPlacedArcanaThisTurn,
  hasPrompt,
  isHandSelected,
  onNextPhase,
  onArcanaCharge,
}) => {
  const canAct = isMyTurn && !hasPrompt;

  return (
    <div className="flex flex-col items-center space-y-1.5 pointer-events-auto select-none shrink-0">
      {/* 3D Cyber "TURN END" / Phase Advance Button (Duel Masters Plays Iconic Shape) */}
      <button
        type="button"
        disabled={!canAct}
        onClick={onNextPhase}
        className={`relative group w-22 sm:w-24 h-11 sm:h-12 rounded-2xl font-black tracking-wider transition-all select-none shadow-2xl active:scale-95 flex flex-col items-center justify-center border-2 shrink-0 ${
          canAct
            ? phase === 'ARCANA_PLACEMENT'
              ? 'bg-gradient-to-b from-cyan-500 via-blue-600 to-indigo-900 border-cyan-300 text-white shadow-[0_0_15px_rgba(6,182,212,0.6)] hover:brightness-110 cursor-pointer'
              : 'bg-gradient-to-b from-amber-300 via-yellow-500 to-amber-600 border-amber-200 text-slate-950 shadow-[0_0_20px_rgba(245,158,11,0.8)] hover:brightness-110 ring-2 ring-yellow-300/80 animate-pulse cursor-pointer'
            : 'bg-gradient-to-b from-slate-800 via-slate-900 to-slate-950 border-slate-700/60 text-slate-500 cursor-not-allowed opacity-75'
        }`}
        style={{
          boxShadow: canAct
            ? '0 4px 0 rgba(0,0,0,0.8), 0 8px 16px rgba(0,0,0,0.6)'
            : '0 2px 0 rgba(0,0,0,0.8)',
          transform: canAct ? 'translateY(-2px)' : 'none',
        }}
      >
        {/* Internal 3D Specular Highlight */}
        <div className="absolute top-0.5 inset-x-2 h-1/3 rounded-t-xl bg-gradient-to-b from-white/40 to-transparent pointer-events-none" />

        {/* Action Label */}
        <div className="flex items-center space-x-1 z-10 text-[10.5px] sm:text-[11.5px] leading-tight font-black">
          {!isMyTurn ? (
            <>
              <Loader2 size={12} className="animate-spin text-amber-400" />
              <span className="font-bold tracking-tighter">WAIT</span>
            </>
          ) : phase === 'ARCANA_PLACEMENT' ? (
            <>
              <span className="drop-shadow">行動へ</span>
              <ChevronRight size={13} className="stroke-[3]" />
            </>
          ) : (
            <>
              <span className="drop-shadow font-black">TURN END</span>
              <ChevronRight size={13} className="stroke-[3]" />
            </>
          )}
        </div>

        {/* Phase Subtitle */}
        {isMyTurn && (
          <span className={`text-[7.5px] font-mono tracking-tighter uppercase leading-none opacity-80 ${
            phase === 'ARCANA_PLACEMENT' ? 'text-cyan-100' : 'text-slate-950'
          }`}>
            {phase === 'ARCANA_PLACEMENT' ? 'CHARGE PHASE' : 'ACTION PHASE'}
          </span>
        )}
      </button>

      {/* Secondary Row: Quick Arcana Charge Button (in Arcana Phase) */}
      {phase === 'ARCANA_PLACEMENT' && isMyTurn && !hasPlacedArcanaThisTurn && (
        <button
          type="button"
          onClick={onArcanaCharge}
          className={`w-full py-1 rounded-lg font-black text-[9px] transition-all shadow-md active:scale-95 flex items-center justify-center space-x-1 border shrink-0 cursor-pointer ${
            isHandSelected
              ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white border-blue-300 ring-2 ring-blue-400 animate-pulse'
              : 'bg-blue-950/90 hover:bg-blue-900 text-blue-200 border-blue-500/60'
          }`}
        >
          <Zap size={10} className="text-yellow-300 fill-yellow-300" />
          <span>{isHandSelected ? 'チャージ決定' : 'アルカナ充填'}</span>
        </button>
      )}
    </div>
  );
};

