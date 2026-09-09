import React from 'react';
import { CardTemplate } from '../types';
import { formatCardMetaJapanese } from '../utils/cardFormatter';

export { formatCardMetaJapanese };

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

  const isUnitOrEvolution = card.type === 'Unit' || card.type === 'Evolution';
  const atk = computedStats ? computedStats.atk : (card.atk ?? 0);
  const def = computedStats ? computedStats.def : (card.def ?? 0);
  const brk = computedStats ? computedStats.brk : (card.brk ?? 1);

  return (
    <div
      id="floating-card-preview"
      className="fixed top-3 left-3 z-[100] w-[340px] max-w-[92vw] pointer-events-auto select-none animate-in fade-in duration-150"
    >
      <div className="bg-[#080d1a]/95 backdrop-blur-md border border-cyan-500/70 rounded-xl p-3.5 shadow-[0_0_30px_rgba(6,182,212,0.35)] text-white font-sans">
        
        {/* ヘッダー行 */}
        <div className="flex items-center justify-between pb-2 mb-2 border-b border-cyan-500/20">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-amber-400 to-orange-600 flex items-center justify-center font-black text-sm text-white shadow-[0_0_10px_rgba(245,158,11,0.5)]">
              {card.cost}
            </div>
            <div>
              <div className="text-base font-bold tracking-wide text-white leading-tight">
                {card.name}
              </div>
              <div className="text-[11px] text-cyan-300/80 font-medium">
                {formatCardMetaJapanese(card)}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-6 h-6 rounded-full bg-slate-800/90 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center text-xs transition-colors border border-slate-700 cursor-pointer"
            title="閉じる"
          >
            ✕
          </button>
        </div>

        {/* スタッツバー（洗練されたTCG仕様のSVGアイコン） */}
        {isUnitOrEvolution && (
          <div className="grid grid-cols-3 gap-2 py-1.5 px-3 mb-2.5 bg-slate-900/90 rounded-lg border border-cyan-900/60 items-center text-center">
            {/* ATK */}
            <div className="flex items-center justify-center gap-1.5">
              <svg className="w-3.5 h-3.5 text-red-400 fill-current drop-shadow-[0_0_4px_rgba(248,113,113,0.8)]" viewBox="0 0 24 24">
                <path d="M14.5 2.5L12 5l2 2-7.5 7.5-3 0.5 0.5-3 7.5-7.5 2 2 2.5-2.5 1.5 1.5-2.5 2.5zM3 21l3.5-0.5-2-2L3 21z" />
              </svg>
              <span className="text-[10px] font-bold text-slate-400 tracking-wider">ATK</span>
              <span className="text-red-400 font-black text-sm tracking-tight">{atk}</span>
            </div>

            {/* BRK */}
            <div className="flex items-center justify-center gap-1.5 border-x border-slate-700/60">
              <svg className="w-3.5 h-3.5 text-amber-400 fill-current drop-shadow-[0_0_4px_rgba(251,191,36,0.8)]" viewBox="0 0 24 24">
                <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
              </svg>
              <span className="text-[10px] font-bold text-slate-400 tracking-wider">BRK</span>
              <span className="text-amber-400 font-black text-sm tracking-tight">{brk}</span>
            </div>

            {/* DEF */}
            <div className="flex items-center justify-center gap-1.5">
              <svg className="w-3.5 h-3.5 text-cyan-400 fill-current drop-shadow-[0_0_4px_rgba(34,211,238,0.8)]" viewBox="0 0 24 24">
                <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4z" />
              </svg>
              <span className="text-[10px] font-bold text-slate-400 tracking-wider">DEF</span>
              <span className="text-cyan-400 font-black text-sm tracking-tight">{def}</span>
            </div>
          </div>
        )}

        {/* 効果テキスト */}
        <div className="p-2.5 bg-slate-950/80 rounded-lg border border-slate-800/80 text-xs text-slate-200 leading-relaxed min-h-[50px] shadow-inner">
          {card.effectText ? (
            <span className="whitespace-pre-wrap">{card.effectText}</span>
          ) : (
            <span className="text-slate-500 italic">通常能力なし</span>
          )}
        </div>

        {/* フッター */}
        <div className="flex justify-between items-center mt-2 text-[9px] text-slate-400 font-mono">
          <span>{card.id}</span>
          <span>SCRIPTIA TCG v0.07</span>
        </div>
      </div>
    </div>
  );
};
