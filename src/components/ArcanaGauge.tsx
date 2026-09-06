import React from 'react';
import { CardInstance, System } from '../types';
import { getCard } from '../data/cards';
import { Flame, Droplet, Mountain, Sun, Moon, Sparkles } from 'lucide-react';

interface Props {
  current: number;
  max: number;
  arcanaCards: CardInstance[];
  deckCount?: number;
  archiveCount?: number;
  onOpenArcana: () => void;
  onOpenArchive?: () => void;
  isOpponent?: boolean;
}

// Strictly the 5 elemental systems
const ELEMENTAL_SYSTEMS: { id: System; name: string; color: string; glow: string; icon: React.ReactNode }[] = [
  { id: 'Fire', name: '火', color: 'bg-red-600 text-white', glow: 'shadow-[0_0_6px_rgba(239,68,68,0.9)]', icon: <Flame size={9} className="fill-current" /> },
  { id: 'Water', name: '水', color: 'bg-blue-600 text-white', glow: 'shadow-[0_0_6px_rgba(59,130,246,0.9)]', icon: <Droplet size={9} className="fill-current" /> },
  { id: 'Earth', name: '地', color: 'bg-emerald-600 text-white', glow: 'shadow-[0_0_6px_rgba(16,185,129,0.9)]', icon: <Mountain size={9} className="fill-current" /> },
  { id: 'Light', name: '光', color: 'bg-amber-400 text-slate-950', glow: 'shadow-[0_0_6px_rgba(245,158,11,0.9)]', icon: <Sun size={9} className="fill-current" /> },
  { id: 'Dark', name: '闇', color: 'bg-purple-700 text-white', glow: 'shadow-[0_0_6px_rgba(168,85,247,0.9)]', icon: <Moon size={9} className="fill-current" /> },
];

export const ArcanaGauge: React.FC<Props> = ({
  current,
  max,
  arcanaCards,
  onOpenArcana,
  isOpponent = false,
}) => {
  // Active systems in Arcana zone
  const activeSystems = new Set(arcanaCards.map(c => getCard(c.cardId).system).filter(s => s !== 'Neutral'));

  if (isOpponent) {
    // Top-Bar Compact Opponent Arcana Pill
    return (
      <button
        type="button"
        onClick={onOpenArcana}
        className="flex items-center space-x-1.5 bg-black/60 hover:bg-black/80 backdrop-blur-sm px-2 py-0.5 rounded-full border border-red-500/40 shadow cursor-pointer transition-all active:scale-95 select-none"
        title="相手のアルカナゾーンを確認"
      >
        <div className="w-4 h-4 rounded-full bg-gradient-to-br from-red-600 to-indigo-900 border border-red-300 flex items-center justify-center">
          <Sparkles size={9} className="text-yellow-300" />
        </div>
        <span className="font-mono font-black text-[11px] text-white leading-none">
          <span className="text-red-300">{current}</span>
          <span className="text-white/40 text-[9px] mx-0.5">/</span>
          <span className="text-slate-400 text-[9px]">{max}</span>
        </span>

        {/* Mini 5 dots */}
        <div className="flex items-center space-x-0.5 ml-1">
          {ELEMENTAL_SYSTEMS.map(sys => {
            const isActive = activeSystems.has(sys.id);
            return (
              <div
                key={sys.id}
                className={`w-2 h-2 rounded-full border transition-all ${
                  isActive
                    ? `${sys.color} ${sys.glow} border-white/60 scale-110`
                    : 'bg-slate-800 border-slate-700 opacity-30'
                }`}
                title={`${sys.name}系統: ${isActive ? '解放済' : '未解放'}`}
              />
            );
          })}
        </div>
      </button>
    );
  }

  // Circular Arcana Orb (Duel Masters Plays Mana Zone Orb style) for Player (Bottom-Left)
  return (
    <div className="flex items-center space-x-1.5 select-none pointer-events-auto shrink-0">
      {/* 3D Circular Arcana Orb (diameter ~72px) */}
      <button
        type="button"
        onClick={onOpenArcana}
        className="relative group cursor-pointer active:scale-95 transition-transform"
        title="アルカナゾーン確認 (タップで展開)"
      >
        {/* Pulsing Mana Aura */}
        <div className="absolute -inset-1.5 rounded-full bg-cyan-500/30 blur-md group-hover:bg-cyan-400/60 transition-colors animate-pulse" />

        {/* Outer Metallic Bezel with Cyber Ring */}
        <div className="relative w-[72px] h-[72px] rounded-full bg-gradient-to-b from-amber-300 via-slate-900 to-black p-1 shadow-[0_4px_16px_rgba(0,0,0,0.8)] border-2 border-amber-400 flex items-center justify-center">
          {/* Inner Glowing Crystal Sphere */}
          <div className="w-full h-full rounded-full bg-gradient-to-br from-cyan-950 via-slate-950 to-blue-950 border border-cyan-400/60 flex flex-col items-center justify-center relative overflow-hidden shadow-inner">
            {/* Top Gloss Highlight */}
            <div className="absolute top-0 inset-x-2 h-1/2 rounded-t-full bg-gradient-to-b from-white/30 to-transparent pointer-events-none" />

            {/* Top Micro Label */}
            <span className="text-[6.5px] font-black text-cyan-300 tracking-wider uppercase leading-none z-10">
              MANA
            </span>

            {/* Digital Numbers: Current / Max */}
            <div className="flex items-baseline justify-center font-mono font-black text-white leading-none my-0.5 z-10">
              <span className="text-xl text-cyan-200 drop-shadow-[0_0_10px_rgba(56,189,248,1)]">
                {current}
              </span>
              <span className="text-[10px] text-cyan-400/80 mx-0.5">/</span>
              <span className="text-[11px] text-slate-300">
                {max}
              </span>
            </div>

            {/* Bottom mini status */}
            <span className="text-[6px] font-bold text-amber-300/90 z-10">
              ARCANA
            </span>
          </div>
        </div>
      </button>

      {/* 5 Elemental Affinity Gems Vertical Column */}
      <div className="flex flex-col space-y-1 bg-black/60 backdrop-blur-sm p-1 rounded-xl border border-white/10 shadow-md">
        {ELEMENTAL_SYSTEMS.map(sys => {
          const isActive = activeSystems.has(sys.id);
          return (
            <div
              key={sys.id}
              className={`w-3.5 h-3.5 rounded-full flex items-center justify-center text-[6px] font-black border transition-all ${
                isActive
                  ? `${sys.color} ${sys.glow} border-white/80 scale-110`
                  : 'bg-slate-900/90 border-slate-700 text-slate-600 opacity-30 grayscale'
              }`}
              title={`${sys.name}系統: ${isActive ? '解放済' : '未解放'}`}
            >
              {sys.icon}
            </div>
          );
        })}
      </div>
    </div>
  );
};
