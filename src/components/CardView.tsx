import React from 'react';
import { CardInstance, CardTemplate } from '../types';
import { getCard } from '../data/cards';
import { calculateUnitStats } from '../engine/engineUtils';

interface CardViewProps {
  instance?: CardInstance;
  template?: CardTemplate;
  onClick?: () => void;
  onContextMenu?: (e: React.MouseEvent) => void;
  className?: string;
  isFaceDown?: boolean;
  selected?: boolean;
  playable?: boolean;
  computedStats?: { atk: number, def: number, brk: number };
}

const typeMap: Record<string, string> = {
  'Unit': 'ユニット', 'Spell': 'スペル', 'Rune': 'ルーン', 'Domain': 'ドメイン', 'Evolution': '進化',
};

const lineageMap: Record<string, string> = {
  'Rampage': 'ランページ', 'Mechanoid': 'メカノイド', 'Dragon': 'ドラゴン', 'Merfolk': 'マーフォーク',
  'Aquatica': 'アクアティカ', 'Leviathan': 'リヴァイアサン', 'Bestia': 'ベスティア', 'Insect': 'インセクト',
  'Titan': 'タイタン', 'Guardian': 'ガーディアン', 'Oracle': 'オラクル', 'Angel': 'エンジェル',
  'Parasite': 'パラサイト', 'Ghost': 'ゴースト', 'Demon': 'デーモン', 'Neutral': 'ニュートラル', 'None': '',
};

export const CardView: React.FC<CardViewProps> = ({ instance, template, onClick, onContextMenu, className = '', isFaceDown, selected, playable, computedStats }) => {
  const card = template || (instance ? getCard(instance.cardId) : null);

  if (isFaceDown || !card) {
    return (
      <div 
        onClick={onClick} onContextMenu={onContextMenu}
        className={`w-28 h-40 bg-slate-700 border-2 border-slate-500 rounded-md shadow-md flex items-center justify-center cursor-pointer transition-transform hover:scale-105 ${className}`}
      >
        <div className="w-12 h-12 rounded-full border-2 border-slate-500 flex items-center justify-center">
          <span className="text-slate-400 font-serif text-xl font-bold">S</span>
        </div>
      </div>
    );
  }

  const sysColor = {
    'Fire': 'bg-red-900 border-red-500 text-red-100',
    'Water': 'bg-blue-900 border-blue-500 text-blue-100',
    'Earth': 'bg-emerald-900 border-emerald-500 text-emerald-100',
    'Light': 'bg-amber-100 border-amber-400 text-amber-900',
    'Dark': 'bg-purple-950 border-purple-500 text-purple-200',
    'Neutral': 'bg-gray-700 border-gray-400 text-gray-100'
  }[card.system];

  const badgeColor = {
    'Fire': 'bg-red-600', 'Water': 'bg-blue-600', 'Earth': 'bg-emerald-600',
    'Light': 'bg-amber-400 text-black', 'Dark': 'bg-purple-700', 'Neutral': 'bg-gray-500'
  }[card.system];

  const displayAtk = computedStats ? computedStats.atk : card.atk;
  const displayDef = computedStats ? computedStats.def : card.def;
  const displayBrk = computedStats ? computedStats.brk : card.brk;

  const atkColor = computedStats && displayAtk !== card.atk ? 'text-green-400' : 'text-red-300';
  const defColor = computedStats && displayDef !== card.def ? (displayDef! < card.def! ? 'text-red-400' : 'text-green-400') : 'text-blue-300';

  return (
    <div 
      onClick={onClick} onContextMenu={onContextMenu}
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

      <div className="px-1 pt-3 pb-1 bg-black/50 text-[10px] font-bold leading-tight min-h-[36px] flex items-center text-center justify-center shadow-inner">
        {card.name}
      </div>

      <div className="px-1 py-0.5 text-[8px] bg-black/30 flex justify-between uppercase font-bold tracking-wider">
        <span>{typeMap[card.type] || card.type}</span>
        {card.lineage && <span>{lineageMap[card.lineage] || card.lineage}</span>}
      </div>

      <div className="flex-1 flex items-center justify-center bg-black/10 relative">
         <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
         {card.type === 'Unit' || card.type === 'Evolution' ? (
           <div className="w-12 h-12 rounded-full border-2 border-current opacity-30 blur-[1px]" />
         ) : (
           <div className="w-10 h-10 rotate-45 border-2 border-current opacity-30 blur-[1px]" />
         )}
      </div>

      {(card.type === 'Unit' || card.type === 'Evolution') && (
        <div className="flex justify-between items-center px-1 py-1 bg-black/70 text-[11px] font-black tracking-widest border-t border-white/10">
          <span className={atkColor} title="ATK">{displayAtk}</span>
          <span className="text-yellow-400 text-[9px] bg-black px-1 rounded-sm" title="BRK">{displayBrk}</span>
          <span className={defColor} title="DEF">{displayDef}</span>
        </div>
      )}
    </div>
  );
};
