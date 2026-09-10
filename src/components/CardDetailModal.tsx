import React from 'react';
import { CardTemplate } from '../types';
import { X, Shield, Swords, Flame, Droplet, Mountain, Sun, Moon, Hexagon } from 'lucide-react';

interface Props {
  card: CardTemplate;
  onClose: () => void;
}

const typeMap: Record<string, string> = {
  Unit: 'ユニット',
  Spell: 'スペル',
  Rune: 'ルーン',
  Domain: 'ドメイン',
  Evolution: '進化',
};

const lineageMap: Record<string, string> = {
  Rampage: 'ランページ',
  Mechanoid: 'メカノイド',
  Dragon: 'ドラゴン',
  Merfolk: 'マーフォーク',
  Aquatica: 'アクアティカ',
  Leviathan: 'リヴァイアサン',
  Bestia: 'ベスティア',
  Insect: 'インセクト',
  Titan: 'タイタン',
  Guardian: 'ガーディアン',
  Oracle: 'オラクル',
  Angel: 'エンジェル',
  Parasite: 'パラサイト',
  Ghost: 'ゴースト',
  Demon: 'デーモン',
  Neutral: 'ニュートラル',
  None: '',
};

export const CardDetailModal: React.FC<Props> = ({ card, onClose }) => {
  const isUnit = card.type === 'Unit' || card.type === 'Evolution';

  const systemIcon = () => {
    switch (card.system) {
      case 'Fire': return <Flame size={18} className="text-red-400" />;
      case 'Water': return <Droplet size={18} className="text-blue-400" />;
      case 'Earth': return <Mountain size={18} className="text-emerald-400" />;
      case 'Light': return <Sun size={18} className="text-amber-300" />;
      case 'Dark': return <Moon size={18} className="text-purple-400" />;
      default: return <Hexagon size={18} className="text-slate-400" />;
    }
  };

  const sysColor = {
    Fire: 'border-red-500/80 bg-red-950/90 text-red-100',
    Water: 'border-blue-500/80 bg-blue-950/90 text-blue-100',
    Earth: 'border-emerald-500/80 bg-emerald-950/90 text-emerald-100',
    Light: 'border-amber-400/80 bg-amber-950/90 text-amber-100',
    Dark: 'border-purple-500/80 bg-purple-950/90 text-purple-100',
    Neutral: 'border-slate-500/80 bg-slate-900/90 text-slate-100',
  }[card.system];

  return (
    <div
      className="absolute inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 pointer-events-auto"
      onClick={onClose}
    >
      <div
        className={`w-full max-w-sm rounded-xl border-2 shadow-2xl p-4 flex flex-col relative overflow-hidden max-h-[92vh] ${sysColor}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-2.5 right-2.5 w-7 h-7 rounded-full bg-black/60 hover:bg-black text-white/80 hover:text-white flex items-center justify-center z-10 border border-white/20"
        >
          <X size={16} />
        </button>

        {/* Header */}
        <div className="flex items-center space-x-2.5 mb-2.5 pr-8">
          <div className="w-8 h-8 rounded-full bg-black/70 border border-amber-400 flex items-center justify-center font-black text-base text-amber-300 shadow shrink-0">
            {card.cost}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-black text-white truncate leading-tight">{card.name}</h2>
            <div className="flex items-center space-x-1.5 text-xs text-amber-300 font-bold mt-0.5">
              {systemIcon()}
              <span>{card.system}</span>
              <span>•</span>
              <span>{typeMap[card.type] || card.type}</span>
              {card.lineage && (
                <>
                  <span>•</span>
                  <span>{lineageMap[card.lineage] || card.lineage}</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Card Artwork Emblem Placeholder */}
        <div className="w-full h-24 rounded-lg bg-black/40 border border-white/10 flex items-center justify-center relative overflow-hidden mb-3">
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
          <div className="flex flex-col items-center justify-center z-10">
            <div className="w-12 h-12 rounded-full border-2 border-white/30 flex items-center justify-center bg-black/30">
              <span className="text-lg font-black text-white/70">{card.system}</span>
            </div>
            <span className="text-[10px] text-white/50 tracking-widest mt-1 font-mono">{card.id}</span>
          </div>
        </div>

        {/* Rule Text */}
        <div className="flex-1 overflow-y-auto bg-black/50 border border-white/10 rounded-lg p-2.5 mb-3 text-xs leading-relaxed text-slate-200">
          {card.effectText ? (
            <div className="whitespace-pre-wrap font-medium">
              {card.effectText}
            </div>
          ) : (
            <div className="text-slate-400 italic text-center py-2">（バニラ / 特殊効果なし）</div>
          )}
        </div>

        {/* Combat Stats Footer */}
        {isUnit && (
          <div className="flex justify-around items-center bg-black/80 border border-white/10 rounded-lg py-2 px-3">
            <div className="flex items-center space-x-1.5">
              <Swords size={16} className="text-red-400" />
              <div className="flex flex-col">
                <span className="text-[9px] text-slate-400 font-bold leading-none">ATK</span>
                <span className="text-base font-black text-red-400 leading-none">{card.atk}</span>
              </div>
            </div>

            <div className="h-6 w-px bg-white/10" />

            <div className="flex items-center space-x-1.5">
              <Shield size={16} className="text-yellow-400" />
              <div className="flex flex-col">
                <span className="text-[9px] text-slate-400 font-bold leading-none">BRK</span>
                <span className="text-base font-black text-yellow-400 leading-none">{card.brk}</span>
              </div>
            </div>

            <div className="h-6 w-px bg-white/10" />

            <div className="flex items-center space-x-1.5">
              <Shield size={16} className="text-blue-400" />
              <div className="flex flex-col">
                <span className="text-[9px] text-slate-400 font-bold leading-none">DEF</span>
                <span className="text-base font-black text-blue-400 leading-none">{card.def}</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
