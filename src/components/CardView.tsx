import React from 'react';
import { CardInstance, CardTemplate } from '../types';
import { getCard } from '../data/cards';

interface CardViewProps {
  instance?: CardInstance;
  template?: CardTemplate;
  onClick?: () => void;
  className?: string;
  isFaceDown?: boolean;
  selected?: boolean;
  playable?: boolean;
}

export const CardView: React.FC<CardViewProps> = ({ instance, template, onClick, className = '', isFaceDown, selected, playable }) => {
  const card = template || (instance ? getCard(instance.cardId) : null);

  if (isFaceDown || !card) {
    return (
      <div 
        onClick={onClick}
        className={`w-24 h-36 bg-slate-700 border-2 border-slate-500 rounded-md shadow-md flex items-center justify-center bg-[url('https://www.transparenttextures.com/patterns/dark-matter.png')] cursor-pointer transition-transform hover:scale-105 ${className}`}
      >
        <div className="w-12 h-12 rounded-full border border-slate-500 flex items-center justify-center">
          <span className="text-slate-400 font-serif text-xl font-bold">S</span>
        </div>
      </div>
    );
  }

  const getSystemColor = (sys: string) => {
    switch(sys) {
      case 'Fire': return 'bg-red-900 border-red-500 text-red-100';
      case 'Water': return 'bg-blue-900 border-blue-500 text-blue-100';
      case 'Earth': return 'bg-emerald-900 border-emerald-500 text-emerald-100';
      case 'Light': return 'bg-amber-100 border-amber-400 text-amber-900';
      case 'Dark': return 'bg-purple-950 border-purple-500 text-purple-200';
      default: return 'bg-gray-700 border-gray-400 text-gray-100';
    }
  };

  const getBadgeColor = (sys: string) => {
    switch(sys) {
      case 'Fire': return 'bg-red-600';
      case 'Water': return 'bg-blue-600';
      case 'Earth': return 'bg-emerald-600';
      case 'Light': return 'bg-amber-400 text-black';
      case 'Dark': return 'bg-purple-700';
      default: return 'bg-gray-500';
    }
  }

  const sysColor = getSystemColor(card.system);
  const badgeColor = getBadgeColor(card.system);

  return (
    <div 
      onClick={onClick}
      className={`w-28 h-40 flex flex-col relative rounded-md shadow-lg border-2 select-none overflow-hidden transition-all
        ${sysColor} 
        ${selected ? 'ring-4 ring-yellow-400 scale-105 z-10' : ''} 
        ${playable ? 'cursor-pointer hover:border-yellow-300' : ''}
        ${className}
      `}
    >
      {/* Cost Badge */}
      <div className={`absolute -top-1 -left-1 w-6 h-6 rounded-full flex items-center justify-center font-bold text-sm border border-black z-10 ${badgeColor}`}>
        {card.cost}
      </div>

      {/* Header */}
      <div className="px-1 pt-2 pb-1 bg-black/40 text-[10px] font-bold leading-tight min-h-[32px] flex items-center text-center justify-center">
        {card.name}
      </div>

      {/* Type & Lineage */}
      <div className="px-1 py-0.5 text-[8px] bg-black/20 flex justify-between uppercase">
        <span>{card.type}</span>
        {card.lineage && <span>{card.lineage}</span>}
      </div>

      {/* Image Placeholder */}
      <div className="flex-1 flex items-center justify-center bg-black/10">
         {card.type === 'Unit' || card.type === 'Evolution' ? (
           <div className="w-10 h-10 rounded-full border border-current opacity-30" />
         ) : (
           <div className="w-8 h-8 rotate-45 border border-current opacity-30" />
         )}
      </div>

      {/* Stats footer (Units only) */}
      {(card.type === 'Unit' || card.type === 'Evolution') && (
        <div className="flex justify-between items-center px-1 py-1 bg-black/50 text-[10px] font-bold">
          <span className="text-red-300" title="ATK">{card.atk}</span>
          <span className="text-yellow-300 text-[8px]" title="BRK">{card.brk}</span>
          <span className="text-blue-300" title="DEF">{card.def}</span>
        </div>
      )}
    </div>
  );
};
