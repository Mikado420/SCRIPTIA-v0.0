import React from 'react';
import { CardTemplate } from '../types';
import { X } from 'lucide-react';

interface Props {
  card: CardTemplate;
  onClose: () => void;
}

export const CardDetailModal: React.FC<Props> = ({ card, onClose }) => {
  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm" onClick={onClose}>
      <div 
        className="w-[320px] h-[480px] rounded-xl shadow-[0_0_40px_rgba(0,0,0,0.8)] border border-slate-600 bg-slate-900 flex flex-col relative overflow-hidden animate-in fade-in zoom-in-95 duration-200"
        onClick={e => e.stopPropagation()}
      >
        <button onClick={onClose} className="absolute top-2 right-2 text-white/50 hover:text-white z-10 bg-black/50 rounded-full p-1">
          <X size={20} />
        </button>

        {/* Art placeholder */}
        <div className="h-[45%] bg-slate-800 flex items-center justify-center relative">
          <div className="absolute inset-0 bg-gradient-to-b from-transparent to-slate-900" />
          <div className="text-slate-600 font-bold text-4xl opacity-20 rotate-12">{card.system}</div>
        </div>

        {/* Content */}
        <div className="flex-1 p-4 flex flex-col relative">
          <div className="absolute -top-6 left-4 w-12 h-12 bg-slate-950 rounded-full border-2 border-yellow-500 flex items-center justify-center text-xl font-black text-white shadow-lg">
            {card.cost}
          </div>

          <div className="ml-14 mb-4">
            <h2 className="text-xl font-black text-white leading-none">{card.name}</h2>
            <div className="text-xs text-yellow-400 font-bold mt-1">
              {card.system} / {card.type} {card.lineage ? ` / ${card.lineage}` : ''}
            </div>
          </div>

          <div className="flex-1 text-sm text-slate-300 leading-relaxed whitespace-pre-wrap font-medium">
            {card.effectText || '（効果なし）'}
          </div>

          {(card.type === 'Unit' || card.type === 'Evolution') && (
            <div className="mt-4 pt-4 border-t border-slate-700/50 flex justify-between items-center px-4 bg-black/20 rounded-lg py-2">
              <div className="text-center">
                <div className="text-[10px] text-slate-500 font-bold">ATK</div>
                <div className="text-2xl font-black text-red-400">{card.atk}</div>
              </div>
              <div className="text-center">
                <div className="text-[10px] text-slate-500 font-bold">BRK</div>
                <div className="text-xl font-black text-yellow-400">{card.brk}</div>
              </div>
              <div className="text-center">
                <div className="text-[10px] text-slate-500 font-bold">DEF</div>
                <div className="text-2xl font-black text-blue-400">{card.def}</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
