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
  deckCount: number;
  archiveCount: number;
  onNextPhase: () => void;
  onArcanaCharge: () => void;
  onOpenArchive: () => void;
}

export const ActionControls: React.FC<Props> = ({
  phase,
  isMyTurn,
  hasPlacedArcanaThisTurn,
  hasPrompt,
  isHandSelected,
  deckCount,
  archiveCount,
  onNextPhase,
  onArcanaCharge,
  onOpenArchive,
}) => {
  const canAct = isMyTurn && !hasPrompt;

  return (
    <div className="flex flex-col items-end space-y-1.5 pointer-events-auto select-none shrink-0">
      {/* Upper Utility: Player Deck & Archive Counters */}
      <div className="flex items-center space-x-1 text-[9.5px] font-bold">
        {/* Deck Count */}
        <div
          className="flex items-center space-x-1 bg-slate-900/90 border border-slate-700/80 px-2 py-1 rounded-md text-slate-200 shadow-sm"
          title={`自軍山札残り: ${deckCount}枚`}
        >
          <Layers size={11} className="text-amber-400" />
          <span className="font-mono font-bold text-white text-[10px]">{deckCount}</span>
        </div>

        {/* Archive / Graveyard */}
        <button
          type="button"
          onClick={onOpenArchive}
          className="flex items-center space-x-1 bg-slate-900/90 hover:bg-slate-800 border border-purple-500/40 hover:border-purple-400 px-2 py-1 rounded-md text-purple-300 shadow-sm cursor-pointer transition-colors active:scale-95"
          title={`自軍アーカイブ: ${archiveCount}枚 (タップで確認)`}
        >
          <Archive size={11} className="text-purple-400" />
          <span className="font-mono font-bold text-purple-200 text-[10px]">{archiveCount}</span>
        </button>
      </div>

      {/* Main Action Buttons */}
      <div className="flex items-center space-x-1.5">
        {/* Arcana Placement Quick Button (in Arcana Phase) */}
        {phase === 'ARCANA_PLACEMENT' && isMyTurn && !hasPlacedArcanaThisTurn && (
          <button
            type="button"
            onClick={onArcanaCharge}
            className={`px-2 py-1.5 rounded-xl font-black text-[10px] transition-all shadow-md active:scale-95 flex items-center space-x-1 border shrink-0 ${
              isHandSelected
                ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white border-blue-300 ring-2 ring-blue-400 animate-pulse'
                : 'bg-blue-950/90 hover:bg-blue-900 text-blue-200 border-blue-500/60'
            }`}
          >
            <Zap size={12} className="text-yellow-300 fill-yellow-300" />
            <span>{isHandSelected ? 'チャージ' : 'アルカナ'}</span>
          </button>
        )}

        {/* Heavy 3D "TURN END" / "行動フェーズ ＞" Button (Duel Masters Plays Inspired) */}
        <button
          type="button"
          disabled={!canAct}
          onClick={onNextPhase}
          className={`relative group w-24 sm:w-26 h-11 sm:h-12 rounded-xl font-black tracking-wider transition-all select-none shadow-2xl active:scale-95 flex items-center justify-center border-2 shrink-0 ${
            canAct
              ? phase === 'ARCANA_PLACEMENT'
                ? 'bg-gradient-to-b from-blue-500 via-indigo-600 to-blue-800 border-blue-300/80 text-white shadow-blue-500/40 hover:brightness-110'
                : 'bg-gradient-to-b from-amber-400 via-yellow-500 to-amber-600 border-yellow-200 text-slate-950 shadow-yellow-500/50 hover:brightness-110 ring-2 ring-amber-300/60 animate-pulse'
              : 'bg-gradient-to-b from-slate-800 via-slate-900 to-slate-950 border-slate-700/60 text-slate-500 cursor-not-allowed'
          }`}
          style={{
            boxShadow: canAct
              ? '0 4px 0 rgba(0,0,0,0.6), 0 6px 14px rgba(0,0,0,0.4)'
              : '0 3px 0 rgba(0,0,0,0.8)',
            transform: canAct ? 'translateY(-2px)' : 'none',
          }}
        >
          {/* Internal 3D Glint */}
          <div className="absolute top-0.5 inset-x-1.5 h-1/3 rounded-t-lg bg-gradient-to-b from-white/30 to-transparent pointer-events-none" />

          {/* Label Content */}
          <div className="flex items-center space-x-1 z-10 text-[11px] sm:text-xs">
            {!isMyTurn ? (
              <>
                <Loader2 size={13} className="animate-spin text-amber-400" />
                <span className="font-bold tracking-tight">思考中...</span>
              </>
            ) : phase === 'ARCANA_PLACEMENT' ? (
              <>
                <span>行動フェーズ</span>
                <ChevronRight size={13} />
              </>
            ) : (
              <>
                <span className="drop-shadow">TURN END</span>
                <ChevronRight size={13} className="stroke-[3]" />
              </>
            )}
          </div>
        </button>
      </div>
    </div>
  );
};
