import React from 'react';
import { CardInstance, CardTemplate } from '../types';
import { getCard } from '../data/cards';
import { Info, Shield, Moon, Sword } from 'lucide-react';

export type CardViewSize = 'field' | 'hand' | 'opponent-hand' | 'compact' | 'default';

interface CardViewProps {
  instance?: CardInstance;
  template?: CardTemplate;
  onClick?: (e: React.MouseEvent) => void;
  onContextMenu?: (e: React.MouseEvent) => void;
  onInspect?: () => void;
  className?: string;
  isFaceDown?: boolean;
  selected?: boolean;
  playable?: boolean;
  computedStats?: { atk: number; def: number; brk: number };
  size?: CardViewSize;
  isRested?: boolean;
  hasSummoningSickness?: boolean;
  evoCount?: number;
}

const typeMap: Record<string, string> = {
  'Unit': 'ユニット',
  'Spell': 'スペル',
  'Rune': 'ルーン',
  'Domain': 'ドメイン',
  'Evolution': '進化',
};

const lineageMap: Record<string, string> = {
  'Rampage': 'ランページ',
  'Mechanoid': 'メカノイド',
  'Dragon': 'ドラゴン',
  'Merfolk': 'マーフォーク',
  'Aquatica': 'アクアティカ',
  'Leviathan': 'リヴァイアサン',
  'Bestia': 'ベスティア',
  'Insect': 'インセクト',
  'Titan': 'タイタン',
  'Guardian': 'ガーディアン',
  'Oracle': 'オラクル',
  'Angel': 'エンジェル',
  'Parasite': 'パラサイト',
  'Ghost': 'ゴースト',
  'Demon': 'デーモン',
  'Neutral': 'ニュートラル',
  'None': '',
};

export const CardView: React.FC<CardViewProps> = ({
  instance,
  template,
  onClick,
  onContextMenu,
  onInspect,
  className = '',
  isFaceDown,
  selected,
  playable,
  computedStats,
  size = 'default',
  isRested,
  hasSummoningSickness,
  evoCount = 1,
}) => {
  const card = template || (instance ? getCard(instance.cardId) : null);

  // Size dimensions map
  const sizeClasses = {
    'opponent-hand': 'w-[34px] h-[46px] rounded-sm',
    'field': 'w-[72px] h-[96px] rounded-lg',
    'hand': 'w-[68px] h-[96px] rounded-lg',
    'compact': 'w-[36px] h-[28px] rounded-sm',
    'default': 'w-24 h-34 sm:w-28 sm:h-40 rounded-md',
  }[size];

  // Face down rendering
  if (isFaceDown || !card) {
    return (
      <div
        onClick={onClick}
        onContextMenu={onContextMenu}
        className={`${sizeClasses} bg-gradient-to-br from-slate-800 via-slate-900 to-indigo-950 border border-amber-500/40 shadow-md flex items-center justify-center cursor-pointer select-none relative overflow-hidden transition-transform shrink-0 ${className}`}
      >
        <div className="absolute inset-0 bg-[radial-gradient(#3b82f6_1px,transparent_1px)] [background-size:6px_6px] opacity-20" />
        <div className="w-5 h-5 rounded-full border border-amber-400/60 flex items-center justify-center bg-black/40 shadow-inner">
          <span className="text-amber-300 font-serif text-[10px] font-black">S</span>
        </div>
      </div>
    );
  }

  const sysColor = {
    Fire: 'from-red-950 via-slate-900 to-red-950 border-red-500/80 text-red-100',
    Water: 'from-blue-950 via-slate-900 to-blue-950 border-blue-500/80 text-blue-100',
    Earth: 'from-emerald-950 via-slate-900 to-emerald-950 border-emerald-500/80 text-emerald-100',
    Light: 'from-amber-950 via-slate-900 to-yellow-950 border-amber-400/80 text-amber-100',
    Dark: 'from-purple-950 via-slate-900 to-slate-950 border-purple-500/80 text-purple-200',
    Neutral: 'from-slate-800 via-slate-900 to-slate-800 border-slate-400/60 text-slate-100',
  }[card.system];

  const badgeColor = {
    Fire: 'bg-red-600 text-white',
    Water: 'bg-blue-600 text-white',
    Earth: 'bg-emerald-600 text-white',
    Light: 'bg-amber-400 text-slate-950',
    Dark: 'bg-purple-700 text-white',
    Neutral: 'bg-slate-600 text-white',
  }[card.system];

  const displayAtk = computedStats ? computedStats.atk : card.atk;
  const displayDef = computedStats ? computedStats.def : card.def;
  const displayBrk = computedStats ? computedStats.brk : card.brk;

  const isUnit = card.type === 'Unit' || card.type === 'Evolution';
  const hasGuard = card.keywords?.includes('Guard');

  // 1. FIELD CARD DISPLAY (Duel Masters Plays Creature Plate)
  if (size === 'field') {
    return (
      <div
        onClick={onClick}
        onContextMenu={onContextMenu}
        className={`relative ${sizeClasses} bg-gradient-to-b ${sysColor} border-2 flex flex-col justify-between select-none overflow-hidden shrink-0 transition-all duration-200 shadow-lg
          ${selected ? 'ring-2 ring-yellow-400 ring-offset-2 ring-offset-black scale-105 z-30 shadow-yellow-500/50' : ''}
          ${playable ? 'cursor-pointer hover:border-yellow-300' : ''}
          ${isRested ? 'rotate-90 scale-[0.85] origin-center opacity-85 shadow-md' : ''}
          ${className}
        `}
      >
        {/* Top-Left: Cost Badge */}
        <div className={`absolute -top-1 -left-1 w-4 h-4 sm:w-5 sm:h-5 rounded-full flex items-center justify-center font-black text-[8.5px] sm:text-[10px] border border-black shadow-md z-20 ${badgeColor}`}>
          {card.cost}
        </div>

        {/* Top-Right: Evolution Counter or Guard Sigil */}
        <div className="absolute top-0.5 right-0.5 flex items-center space-x-0.5 z-20">
          {hasGuard && (
            <div className="w-3.5 h-3.5 sm:w-4 sm:h-4 rounded bg-cyan-950 border border-cyan-400 text-cyan-300 flex items-center justify-center shadow" title="ガード能力">
              <Shield size={9} className="fill-cyan-400/40" />
            </div>
          )}
          {evoCount > 1 && (
            <div className="bg-yellow-400 text-slate-950 text-[7px] sm:text-[8px] font-black px-1 rounded-full border border-black shadow">
              +{evoCount - 1}
            </div>
          )}
        </div>

        {/* Name Bar */}
        <div className="pt-2 sm:pt-2.5 px-0.5 sm:px-1 pb-0.5 bg-black/75 text-center truncate whitespace-nowrap overflow-hidden text-[7px] sm:text-[8.5px] leading-tight font-black tracking-tight text-white shadow-inner">
          {card.name}
        </div>

        {/* Center Art / Sigil Area */}
        <div className="flex-1 flex flex-col items-center justify-center relative my-0.5 px-0.5 sm:px-1">
          <div className="w-5 h-5 sm:w-7 sm:h-7 rounded-full border border-white/20 bg-black/40 flex items-center justify-center shadow-inner">
            <span className="text-[7.5px] sm:text-[9px] font-black text-white/70">{card.system[0]}</span>
          </div>
          {card.lineage && (
            <span className="text-[5.5px] sm:text-[6.5px] font-bold text-amber-300/80 truncate max-w-full mt-0.5">
              {lineageMap[card.lineage] || card.lineage}
            </span>
          )}

          {/* Summoning Sickness (Sleep / 待機 indicator) */}
          {hasSummoningSickness && !isRested && (
            <div className="absolute inset-0 bg-black/60 backdrop-blur-[1px] flex items-center justify-center z-10">
              <div className="bg-amber-950/90 border border-amber-400/80 px-1 py-0.5 rounded-full flex items-center space-x-0.5 shadow-lg animate-pulse">
                <Moon size={8} className="text-yellow-300 fill-yellow-300" />
                <span className="text-[6.5px] sm:text-[7.5px] font-black text-amber-200">待機</span>
              </div>
            </div>
          )}
        </div>

        {/* Bottom Combat Stats Bar (ATK / BRK / DEF) */}
        {isUnit && (
          <div className="grid grid-cols-3 items-center py-0.5 bg-slate-950/95 border-t border-white/15 text-[7px] sm:text-[8.5px] font-black leading-none text-center shadow-inner">
            <div className="text-red-400 flex items-center justify-center space-x-0.5" title="ATK (攻撃力)">
              <span>{displayAtk}</span>
            </div>
            <div className="text-yellow-400 bg-amber-950/50 py-0.5 rounded mx-0.5" title="BRK (結界破壊力)">
              <span>{displayBrk}</span>
            </div>
            <div className="text-blue-400 flex items-center justify-center space-x-0.5" title="DEF (守備力)">
              <span>{displayDef}</span>
            </div>
          </div>
        )}
      </div>
    );
  }

  // 2. HAND CARD DISPLAY
  if (size === 'hand') {
    return (
      <div
        onClick={onClick}
        onContextMenu={onContextMenu}
        className={`relative ${sizeClasses} bg-gradient-to-b ${sysColor} border-2 flex flex-col justify-between select-none overflow-hidden shrink-0 transition-all shadow-lg
          ${selected ? 'ring-3 ring-yellow-400 ring-offset-2 ring-offset-black -translate-y-3 scale-105 z-30 shadow-yellow-500/50' : 'hover:-translate-y-2 hover:scale-105'}
          ${
            playable
              ? 'border-emerald-400 ring-2 ring-emerald-400/90 shadow-[0_0_18px_rgba(52,211,153,0.85)] animate-pulse cursor-pointer hover:border-emerald-300 hover:shadow-[0_0_24px_rgba(52,211,153,1)]'
              : 'opacity-50 grayscale-[40%] brightness-75 border-slate-700/60'
          }
          ${className}
        `}
      >
        {/* Cost Badge */}
        <div className={`absolute -top-1 -left-1 w-5 h-5 rounded-full flex items-center justify-center font-black text-[10px] border border-black shadow z-10 ${badgeColor}`}>
          {card.cost}
        </div>

        {/* Inspect / Info button */}
        {onInspect && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onInspect();
            }}
            title="詳細を見る"
            className="absolute top-0.5 right-0.5 w-4 h-4 rounded-full bg-black/60 hover:bg-black text-amber-300 flex items-center justify-center z-20 border border-amber-400/40"
          >
            <Info size={10} />
          </button>
        )}

        {/* Name and Type */}
        <div className="pt-3 px-1 pb-0.5 bg-black/60 text-center">
          <div className="truncate whitespace-nowrap overflow-hidden text-[11px] leading-tight font-black tracking-tight text-white">
            {card.name}
          </div>
          <div className="text-[6.5px] text-amber-300/90 font-bold uppercase tracking-tight truncate">
            {typeMap[card.type] || card.type} {card.lineage ? `• ${lineageMap[card.lineage] || card.lineage}` : ''}
          </div>
        </div>

        {/* Center Art Area */}
        <div className="flex-1 flex flex-col items-center justify-center relative p-1 bg-black/10">
          <div className="w-6 h-6 rounded-full border border-white/20 flex items-center justify-center">
            <span className="text-[8px] font-black text-white/50">{card.system}</span>
          </div>
          {card.effectText && (
            <div className="text-[6.5px] text-slate-200 line-clamp-2 text-center mt-0.5 leading-tight opacity-90">
              {card.effectText.replace(/◆|【|】/g, '')}
            </div>
          )}
        </div>

        {/* Stats Footer for Units */}
        {isUnit ? (
          <div className="flex justify-between items-center px-1.5 py-0.5 bg-black/85 text-[9px] font-black border-t border-white/10 leading-none">
            <span className="text-red-400">{card.atk}</span>
            <span className="text-yellow-400 text-[8px] bg-slate-900 px-1 rounded">{card.brk}</span>
            <span className="text-blue-400">{card.def}</span>
          </div>
        ) : (
          <div className="text-center py-0.5 bg-black/85 text-[7px] font-bold text-amber-300 border-t border-white/10 uppercase">
            {typeMap[card.type]}
          </div>
        )}
      </div>
    );
  }

  // 3. COMPACT CARD DISPLAY (Domain / Rune slot)
  if (size === 'compact') {
    return (
      <div
        onClick={onClick}
        onContextMenu={onContextMenu}
        className={`relative ${sizeClasses} bg-gradient-to-b ${sysColor} border flex flex-col justify-between select-none overflow-hidden shrink-0 shadow ${className}`}
      >
        <div className={`absolute -top-1 -left-1 w-3.5 h-3.5 rounded-full flex items-center justify-center font-black text-[8px] border border-black shadow ${badgeColor}`}>
          {card.cost}
        </div>
        <div className="pt-2 px-0.5 bg-black/60 truncate whitespace-nowrap overflow-hidden text-[7.5px] leading-tight font-bold tracking-tight text-center text-white">
          {card.name}
        </div>
        <div className="text-center text-[6.5px] text-amber-300/80 bg-black/70 py-0.5 uppercase font-bold">
          {typeMap[card.type]}
        </div>
      </div>
    );
  }

  // 4. DEFAULT CARD DISPLAY
  return (
    <div
      onClick={onClick}
      onContextMenu={onContextMenu}
      className={`w-28 h-40 flex flex-col relative rounded-md shadow-lg border-2 select-none overflow-hidden transition-all group shrink-0
        ${sysColor}
        ${selected ? 'ring-4 ring-yellow-400 scale-105 z-20' : ''}
        ${playable ? 'cursor-pointer hover:border-yellow-300' : ''}
        ${className}
      `}
    >
      <div className={`absolute -top-1 -left-1 w-6 h-6 rounded-full flex items-center justify-center font-bold text-sm border border-black z-10 shadow ${badgeColor}`}>
        {card.cost}
      </div>

      <div className="px-1 pt-3 pb-1 bg-black/50 truncate whitespace-nowrap overflow-hidden text-[10px] leading-tight font-bold tracking-tight min-h-[36px] flex items-center text-center justify-center shadow-inner text-white">
        {card.name}
      </div>

      <div className="px-1 py-0.5 text-[8px] bg-black/30 flex justify-between uppercase font-bold tracking-wider">
        <span>{typeMap[card.type] || card.type}</span>
        {card.lineage && <span>{lineageMap[card.lineage] || card.lineage}</span>}
      </div>

      <div className="flex-1 flex items-center justify-center bg-black/10 relative">
        <div className="w-10 h-10 rounded-full border-2 border-current opacity-30" />
      </div>

      {isUnit && (
        <div className="flex justify-between items-center px-1 py-1 bg-black/70 text-[11px] font-black tracking-widest border-t border-white/10">
          <span className="text-red-400" title="ATK">{displayAtk}</span>
          <span className="text-yellow-400 text-[9px] bg-black px-1 rounded-sm" title="BRK">{displayBrk}</span>
          <span className="text-blue-400" title="DEF">{displayDef}</span>
        </div>
      )}
    </div>
  );
};
