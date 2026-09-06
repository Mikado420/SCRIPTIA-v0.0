import React from 'react';
import { CardTemplate } from '../types';
import { Shield, Sword, Zap, X, Sparkles, Moon } from 'lucide-react';

interface QuickInspectPanelProps {
  card: CardTemplate | null;
  onClose?: () => void;
  computedStats?: { atk: number; def: number; brk: number };
}

const typeMap: Record<string, string> = {
  Unit: 'ユニット',
  Spell: 'スペル',
  Rune: 'ルーン',
  Domain: 'ドメイン',
  Evolution: '進化ユニット',
};

const systemMap: Record<string, { label: string; color: string; bg: string; text: string }> = {
  Fire: { label: '火属性', color: 'border-red-500', bg: 'bg-red-950/80', text: 'text-red-400' },
  Water: { label: '水属性', color: 'border-blue-500', bg: 'bg-blue-950/80', text: 'text-blue-400' },
  Earth: { label: '自然属性', color: 'border-emerald-500', bg: 'bg-emerald-950/80', text: 'text-emerald-400' },
  Light: { label: '光属性', color: 'border-amber-400', bg: 'bg-amber-950/80', text: 'text-amber-300' },
  Dark: { label: '闇属性', color: 'border-purple-500', bg: 'bg-purple-950/80', text: 'text-purple-400' },
  Neutral: { label: '無属性', color: 'border-slate-400', bg: 'bg-slate-900/80', text: 'text-slate-300' },
};

export const QuickInspectPanel: React.FC<QuickInspectPanelProps> = ({ card, onClose, computedStats }) => {
  if (!card) return null;

  const isUnit = card.type === 'Unit' || card.type === 'Evolution';
  const sys = systemMap[card.system] || systemMap.Neutral;
  const displayAtk = computedStats ? computedStats.atk : card.atk;
  const displayDef = computedStats ? computedStats.def : card.def;
  const displayBrk = computedStats ? computedStats.brk : card.brk;

  return (
    <div
      id="quick-card-inspect-panel"
      className="absolute top-2 left-2 z-50 w-[280px] max-h-[220px] overflow-y-auto select-none rounded-xl border-2 border-cyan-400 bg-slate-950/95 p-2.5 text-white shadow-[0_0_24px_rgba(6,182,212,0.6)] backdrop-blur-md animate-in fade-in zoom-in-95 duration-150"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Metallic Cyber Header */}
      <div className="flex items-center justify-between border-b border-cyan-500/40 pb-1.5 mb-1.5">
        <div className="flex items-center space-x-1.5 truncate max-w-[230px]">
          {/* Cost Circle */}
          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-black bg-gradient-to-br from-red-500 to-amber-500 text-xs font-black text-white shadow">
            {card.cost}
          </div>
          <div className="truncate">
            <h3 className="truncate text-[12px] font-black tracking-tight text-cyan-200">
              {card.name}
            </h3>
            <div className="flex items-center space-x-1 text-[8.5px] font-bold text-slate-400">
              <span className={sys.text}>{sys.label}</span>
              <span>•</span>
              <span className="text-amber-300">{typeMap[card.type] || card.type}</span>
              {card.lineage && (
                <>
                  <span>•</span>
                  <span className="text-slate-300">{card.lineage}</span>
                </>
              )}
            </div>
          </div>
        </div>

        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-800 text-slate-400 hover:bg-red-950 hover:text-red-300 transition-colors cursor-pointer"
          >
            <X size={12} />
          </button>
        )}
      </div>

      {/* Combat Power & Keyword Badges (if Unit) */}
      {isUnit && (
        <div className="mb-2 flex items-center justify-between rounded-lg border border-cyan-500/30 bg-black/50 px-2 py-1 shadow-inner">
          <div className="flex items-center space-x-1">
            <Sword size={12} className="text-red-400" />
            <span className="text-[9px] font-bold text-slate-400">ATK</span>
            <span className="text-xs font-black text-red-400">{displayAtk}</span>
          </div>

          <div className="flex items-center space-x-1">
            <Zap size={12} className="text-yellow-400" />
            <span className="text-[9px] font-bold text-slate-400">BRK</span>
            <span className="text-xs font-black text-yellow-300">{displayBrk}</span>
          </div>

          <div className="flex items-center space-x-1">
            <Shield size={12} className="text-blue-400" />
            <span className="text-[9px] font-bold text-slate-400">DEF</span>
            <span className="text-xs font-black text-blue-400">{displayDef}</span>
          </div>
        </div>
      )}

      {/* Keywords (e.g. Guard, Deadly, Piercing) */}
      {card.keywords && card.keywords.length > 0 && (
        <div className="mb-1.5 flex flex-wrap gap-1">
          {card.keywords.map((kw) => (
            <span
              key={kw}
              className="rounded border border-amber-400/50 bg-amber-950/60 px-1.5 py-0.5 text-[8px] font-black text-amber-200"
            >
              【{kw === 'Guard' ? '守護' : kw === 'Deadly' ? '必殺' : kw === 'Piercing' ? '貫通' : kw === 'CannotAttackPlayer' ? 'プレイヤー攻撃不可' : kw}】
            </span>
          ))}
        </div>
      )}

      {/* Effect Text Body */}
      <div className="rounded-lg border border-white/10 bg-slate-900/90 p-2 text-[10px] leading-relaxed text-slate-200 shadow-inner">
        {card.effectText ? (
          <p className="whitespace-pre-line font-medium">{card.effectText}</p>
        ) : (
          <p className="text-[9px] italic text-slate-500">能力なし（通常ユニット）</p>
        )}
      </div>

      {/* Card ID & Lineage Footnote */}
      <div className="mt-1.5 flex items-center justify-between text-[7.5px] font-mono text-slate-500">
        <span>{card.id}</span>
        <span>SCRIPTIA TCG v0.07</span>
      </div>
    </div>
  );
};
