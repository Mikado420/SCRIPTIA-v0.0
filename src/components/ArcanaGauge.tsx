import React from 'react';
import { CardInstance, System } from '../types';
import { getCard } from '../data/cards';
import { Flame, Droplet, Mountain, Sun, Moon, Layers, Archive } from 'lucide-react';

interface Props {
  current: number;
  max: number;
  arcanaCards: CardInstance[];
  deckCount: number;
  archiveCount: number;
  onOpenArcana: () => void;
  onOpenArchive: () => void;
  isOpponent?: boolean;
}

// Strictly the 5 elemental systems (Neutral has no elemental condition)
const ELEMENTAL_SYSTEMS: { id: System; name: string; color: string; glow: string; activeBorder: string; icon: React.ReactNode }[] = [
  { id: 'Fire', name: '火', color: 'bg-red-600 text-white', glow: 'shadow-red-500/80', activeBorder: 'border-red-300 ring-2 ring-red-400/80', icon: <Flame size={11} className="fill-current" /> },
  { id: 'Water', name: '水', color: 'bg-blue-600 text-white', glow: 'shadow-blue-500/80', activeBorder: 'border-blue-300 ring-2 ring-blue-400/80', icon: <Droplet size={11} className="fill-current" /> },
  { id: 'Earth', name: '地', color: 'bg-emerald-600 text-white', glow: 'shadow-emerald-500/80', activeBorder: 'border-emerald-300 ring-2 ring-emerald-400/80', icon: <Mountain size={11} className="fill-current" /> },
  { id: 'Light', name: '光', color: 'bg-amber-400 text-slate-950', glow: 'shadow-yellow-400/80', activeBorder: 'border-yellow-100 ring-2 ring-yellow-400/80', icon: <Sun size={11} className="fill-current" /> },
  { id: 'Dark', name: '闇', color: 'bg-purple-700 text-white', glow: 'shadow-purple-500/80', activeBorder: 'border-purple-300 ring-2 ring-purple-400/80', icon: <Moon size={11} className="fill-current" /> },
];

export const ArcanaGauge: React.FC<Props> = ({
  current,
  max,
  arcanaCards,
  deckCount,
  archiveCount,
  onOpenArcana,
  onOpenArchive,
  isOpponent = false,
}) => {
  // Collect active systems in Arcana zone (excluding Neutral)
  const activeSystems = new Set(arcanaCards.map(c => getCard(c.cardId).system).filter(s => s !== 'Neutral'));

  if (isOpponent) {
    // Sleek Opponent Arcana Meter (Top-Left)
    return (
      <div className="flex items-center space-x-2 bg-slate-950/85 backdrop-blur-md px-2.5 py-1.5 rounded-2xl border border-red-500/40 shadow-xl select-none">
        {/* Arcana Orb */}
        <button
          type="button"
          onClick={onOpenArcana}
          className="relative group flex items-center space-x-2 cursor-pointer active:scale-95 transition-transform"
          title="相手のアルカナゾーンを確認"
        >
          <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-gradient-to-br from-indigo-950 via-slate-900 to-purple-950 border-2 border-red-400/60 shadow-[0_0_10px_rgba(239,68,68,0.4)] flex flex-col items-center justify-center">
            <span className="text-[6.5px] font-black text-indigo-300 tracking-wider leading-none">ARCANA</span>
            <span className="font-mono font-black text-xs sm:text-sm text-white leading-none mt-0.5">
              <span className="text-red-300">{current}</span>
              <span className="text-white/40 text-[10px] mx-0.5">/</span>
              <span className="text-slate-400 text-[10px]">{max}</span>
            </span>
          </div>

          {/* 5 Elemental Affinities (Opponent) */}
          <div className="flex items-center space-x-1">
            {ELEMENTAL_SYSTEMS.map(sys => {
              const isActive = activeSystems.has(sys.id);
              return (
                <div
                  key={sys.id}
                  className={`w-4 h-4 sm:w-4.5 sm:h-4.5 rounded-full flex items-center justify-center text-[7.5px] font-black border transition-all ${
                    isActive
                      ? `${sys.color} ${sys.glow} ${sys.activeBorder} shadow-md scale-105`
                      : 'bg-slate-900/90 border-slate-700/60 text-slate-600 opacity-40 grayscale'
                  }`}
                  title={`${sys.name}系統: ${isActive ? '解放済' : '未解放'}`}
                >
                  {sys.icon}
                </div>
              );
            })}
          </div>
        </button>

        <div className="h-6 w-px bg-white/10 mx-0.5" />

        {/* Opponent Deck & Archive Count */}
        <div className="flex items-center space-x-2 text-[10px] font-bold text-slate-400">
          <span title="相手の山札枚数" className="flex items-center space-x-1">
            <Layers size={13} className="text-slate-400" />
            <span className="font-mono font-bold text-white text-xs">{deckCount}</span>
          </span>
          <button
            type="button"
            onClick={onOpenArchive}
            title="相手のアーカイブ(墓地)を確認"
            className="flex items-center space-x-1 hover:text-purple-300 transition-colors cursor-pointer"
          >
            <Archive size={13} className="text-purple-400" />
            <span className="font-mono font-bold text-purple-200 text-xs">{archiveCount}</span>
          </button>
        </div>
      </div>
    );
  }

  // Unified Arcana Gauge for Player (Bottom-Left)
  return (
    <div className="flex items-center space-x-2 bg-slate-950/90 backdrop-blur-md px-2.5 py-1.5 rounded-2xl border border-cyan-500/40 shadow-2xl pointer-events-auto select-none">
      {/* Unified Circular Crystal Arcana Sphere */}
      <button
        type="button"
        onClick={onOpenArcana}
        className="relative group cursor-pointer active:scale-95 transition-transform shrink-0"
        title="アルカナゾーンを確認"
      >
        {/* Ambient Pulsing Aura */}
        <div className="absolute -inset-1 rounded-full bg-cyan-500/30 blur group-hover:bg-cyan-400/50 transition-colors animate-pulse" />

        {/* Outer Metallic Ring */}
        <div className="relative w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-gradient-to-b from-slate-700 via-slate-900 to-black p-0.5 shadow-xl border-2 border-amber-400/80 flex items-center justify-center">
          {/* Inner Glowing Crystal Sphere */}
          <div className="w-full h-full rounded-full bg-gradient-to-br from-indigo-950 via-slate-950 to-blue-950 border border-cyan-400/50 flex flex-col items-center justify-center relative overflow-hidden shadow-inner">
            <span className="text-[6.5px] sm:text-[7.5px] font-black text-cyan-300 tracking-wider leading-none">
              ARCANA
            </span>

            {/* Crisp Counter */}
            <div className="flex items-baseline justify-center font-mono font-black text-white leading-none my-0.5">
              <span className="text-base sm:text-xl text-cyan-200 drop-shadow-[0_0_8px_rgba(56,189,248,0.9)]">
                {current}
              </span>
              <span className="text-[10px] sm:text-xs text-cyan-400/70 mx-0.5">/</span>
              <span className="text-[10px] sm:text-xs text-slate-400">
                {max}
              </span>
            </div>
          </div>
        </div>
      </button>

      {/* Integrated Info Column: 5 Affinity Gems + Deck/Archive */}
      <div className="flex flex-col space-y-1">
        {/* 5 Elemental Affinity Gems (Illuminated in unified capsule) */}
        <div className="flex items-center space-x-1 bg-black/50 px-1.5 py-0.5 rounded-full border border-white/10">
          {ELEMENTAL_SYSTEMS.map(sys => {
            const isActive = activeSystems.has(sys.id);
            return (
              <div
                key={sys.id}
                className={`w-4 h-4 rounded-full flex items-center justify-center text-[7.5px] font-black border transition-all duration-200 ${
                  isActive
                    ? `${sys.color} ${sys.glow} ${sys.activeBorder} shadow-md scale-105`
                    : 'bg-slate-900/90 border-slate-700/60 text-slate-600 opacity-40 grayscale'
                }`}
                title={`${sys.name}系統: ${isActive ? '解放済' : '未解放'}`}
              >
                {sys.icon}
              </div>
            );
          })}
        </div>

        {/* Deck & Archive Quick Counters */}
        <div className="flex items-center space-x-1.5 text-[9px] font-bold">
          <div
            className="flex items-center space-x-1 bg-slate-900/90 border border-slate-700/80 px-1.5 py-0.5 rounded-md text-slate-300 shadow"
            title="自分の山札残り枚数"
          >
            <Layers size={11} className="text-amber-400" />
            <span className="font-mono font-bold text-white text-[11px]">{deckCount}</span>
          </div>

          <button
            type="button"
            onClick={onOpenArchive}
            className="flex items-center space-x-1 bg-slate-900/90 hover:bg-slate-800 border border-purple-500/40 hover:border-purple-400 px-1.5 py-0.5 rounded-md text-purple-300 shadow cursor-pointer transition-colors"
            title="自分のアーカイブ(墓地)を確認"
          >
            <Archive size={11} className="text-purple-400" />
            <span className="font-mono font-bold text-purple-200 text-[11px]">{archiveCount}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

