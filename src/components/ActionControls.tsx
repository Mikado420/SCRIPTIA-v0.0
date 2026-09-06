import React from 'react';
import { Phase } from '../types';
import { ChevronRight, Zap, Loader2, Palette, History } from 'lucide-react';

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
  onToggleLog: () => void;
  onOpenPlaymat: () => void;
}

export const ActionControls: React.FC<Props> = ({
  phase,
  turnCount,
  isMyTurn,
  hasPlacedArcanaThisTurn,
  hasPrompt,
  selectedCardId,
  isHandSelected,
  onNextPhase,
  onArcanaCharge,
  onToggleLog,
  onOpenPlaymat,
}) => {
  const canAct = isMyTurn && !hasPrompt;

  return (
    <div className="flex flex-col items-end space-y-2 pointer-events-auto">
      {/* Mini Utility Bar: Turn Counter, Playmat Theme & Combat Log */}
      <div className="flex items-center space-x-1.5">
        <span className="text-[10px] font-black text-slate-300 bg-slate-900/90 border border-slate-700 px-2 py-0.5 rounded shadow">
          TURN {turnCount}
        </span>

        <button
          type="button"
          onClick={onOpenPlaymat}
          title="戦場マット変更"
          className="px-2 py-1 bg-slate-900/90 hover:bg-slate-800 text-amber-300 rounded border border-amber-500/40 flex items-center space-x-1 text-[10px] font-bold shadow active:scale-95 transition-all"
        >
          <Palette size={12} />
          <span>MAT</span>
        </button>

        <button
          type="button"
          onClick={onToggleLog}
          title="バトル履歴ログ"
          className="px-2 py-1 bg-slate-900/90 hover:bg-slate-800 text-slate-300 rounded border border-slate-700 flex items-center space-x-1 text-[10px] font-bold shadow active:scale-95 transition-all"
        >
          <History size={12} />
          <span>LOG</span>
        </button>
      </div>

      {/* Main Action Buttons */}
      <div className="flex items-center space-x-1.5 sm:space-x-2">
        {/* Arcana Placement Quick Button (if in Arcana Phase) */}
        {phase === 'ARCANA_PLACEMENT' && isMyTurn && !hasPlacedArcanaThisTurn && (
          <button
            type="button"
            onClick={onArcanaCharge}
            className={`px-2.5 py-2 sm:px-3 sm:py-2.5 rounded-lg sm:rounded-xl font-black text-[10px] sm:text-xs transition-all shadow-lg active:scale-95 flex items-center space-x-1 sm:space-x-1.5 border min-h-[44px] ${
              isHandSelected
                ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white border-blue-300 ring-2 ring-blue-400 animate-pulse'
                : 'bg-blue-950/90 hover:bg-blue-900 text-blue-200 border-blue-500/60'
            }`}
          >
            <Zap size={13} className="text-yellow-300 fill-yellow-300" />
            <span>{isHandSelected ? 'チャージ' : 'アルカナ配置'}</span>
          </button>
        )}

        {/* Heavy 3D "TURN END" / "NEXT PHASE" Button (Duel Masters Plays Inspired) */}
        <button
          type="button"
          disabled={!canAct}
          onClick={onNextPhase}
          className={`relative group w-28 h-14 rounded-2xl font-black tracking-wider transition-all select-none shadow-2xl active:scale-95 flex items-center justify-center border-2 shrink-0 ${
            canAct
              ? phase === 'ARCANA_PLACEMENT'
                ? 'bg-gradient-to-b from-blue-500 via-indigo-600 to-blue-800 border-blue-300/80 text-white shadow-blue-500/40 hover:brightness-110'
                : 'bg-gradient-to-b from-amber-400 via-yellow-500 to-amber-600 border-yellow-200 text-slate-950 shadow-yellow-500/50 hover:brightness-110 ring-2 ring-amber-300/60 animate-pulse'
              : 'bg-gradient-to-b from-slate-800 via-slate-900 to-slate-950 border-slate-700/60 text-slate-500 cursor-not-allowed'
          }`}
          style={{
            boxShadow: canAct
              ? '0 4px 0 rgba(0,0,0,0.6), 0 8px 16px rgba(0,0,0,0.4)'
              : '0 3px 0 rgba(0,0,0,0.8)',
            transform: canAct ? 'translateY(-2px)' : 'none',
          }}
        >
          {/* Internal 3D Glint */}
          <div className="absolute top-0.5 inset-x-2 h-1/3 rounded-t-xl bg-gradient-to-b from-white/30 to-transparent pointer-events-none" />

          {/* Label Content */}
          <div className="flex items-center space-x-1 sm:space-x-1.5 z-10 text-[11px] sm:text-xs md:text-sm">
            {!isMyTurn ? (
              <>
                <Loader2 size={14} className="animate-spin text-amber-400" />
                <span className="font-bold tracking-tight">思考中...</span>
              </>
            ) : phase === 'ARCANA_PLACEMENT' ? (
              <>
                <span>行動フェーズ</span>
                <ChevronRight size={14} />
              </>
            ) : (
              <>
                <span className="drop-shadow">TURN END</span>
                <ChevronRight size={14} className="stroke-[3]" />
              </>
            )}
          </div>
        </button>
      </div>
    </div>
  );
};
