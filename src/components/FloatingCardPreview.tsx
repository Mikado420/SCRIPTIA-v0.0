import React from 'react';
import { CardTemplate } from '../types';

interface FloatingCardPreviewProps {
  card: CardTemplate | null;
  computedStats?: { atk: number; def: number; brk: number };
  onClose: () => void;
}

export const FloatingCardPreview: React.FC<FloatingCardPreviewProps> = ({
  card,
  computedStats,
  onClose,
}) => {
  if (!card) return null;

  // Stats priority: dynamically computed stats, then base template stats
  const atk = computedStats ? computedStats.atk : (card.atk ?? 0);
  const def = computedStats ? computedStats.def : (card.def ?? 0);
  const brk = computedStats ? computedStats.brk : (card.brk ?? 1);

  const isUnitOrEvolution = card.type === 'Unit' || card.type === 'Evolution';

  return (
    <div
      id="floating-card-preview"
      className="fixed top-3 left-3 z-[100] w-[340px] max-w-[92vw] pointer-events-auto select-none animate-in fade-in duration-150"
    >
      <div className="bg-[#0b1325]/95 backdrop-blur-md border-2 border-cyan-400/80 rounded-2xl p-3.5 shadow-[0_0_25px_rgba(6,182,212,0.4)] text-white">
        {/* ヘッダー行 */}
        <div className="flex items-center justify-between pb-2 mb-2 border-b border-cyan-500/30">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center font-black text-sm text-white shadow-md">
              {card.cost}
            </div>
            <div>
              <div className="text-base font-bold tracking-wide text-white leading-tight">
                {card.name}
              </div>
              <div className="text-[11px] text-cyan-300/80">
                {card.system || '無'}属性 • {card.type} {card.lineage ? `• ${card.lineage}` : ''}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-6 h-6 rounded-full bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center text-xs transition-colors cursor-pointer"
            title="閉じる"
          >
            ✕
          </button>
        </div>

        {/* スタッツ（ユニット・進化ユニットのみ） */}
        {isUnitOrEvolution && (
          <div className="grid grid-cols-3 gap-1.5 py-1.5 px-2 mb-2.5 bg-slate-900/80 rounded-lg border border-cyan-900/50 text-center">
            <div className="flex items-center justify-center gap-1">
              <span className="text-red-400 text-xs">🗡</span>
              <span className="text-[11px] text-slate-400">ATK</span>
              <span className="text-red-400 font-extrabold text-sm ml-0.5">{atk}</span>
            </div>
            <div className="flex items-center justify-center gap-1 border-x border-slate-700/50">
              <span className="text-yellow-400 text-xs">⚡</span>
              <span className="text-[11px] text-slate-400">BRK</span>
              <span className="text-yellow-400 font-extrabold text-sm ml-0.5">{brk}</span>
            </div>
            <div className="flex items-center justify-center gap-1">
              <span className="text-cyan-400 text-xs">🛡</span>
              <span className="text-[11px] text-slate-400">DEF</span>
              <span className="text-cyan-400 font-extrabold text-sm ml-0.5">{def}</span>
            </div>
          </div>
        )}

        {/* 効果テキスト */}
        <div className="p-2.5 bg-slate-950/70 rounded-lg border border-slate-800 text-xs text-slate-200 leading-relaxed min-h-[48px]">
          {card.effectText ? (
            <span className="whitespace-pre-wrap">{card.effectText}</span>
          ) : (
            <span className="text-slate-500 italic">通常能力なし</span>
          )}
        </div>

        {/* フッター */}
        <div className="flex justify-between items-center mt-2 text-[10px] text-slate-400 font-mono">
          <span>{card.id}</span>
          <span>SCRIPTIA TCG v0.07</span>
        </div>
      </div>
    </div>
  );
};
