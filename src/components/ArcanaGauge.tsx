import React from 'react';
import { CardInstance, System } from '../types';
import { getCard } from '../data/cards';
import { Flame, Droplet, Mountain, Sun, Moon, Hexagon, Layers, Archive, Sparkles } from 'lucide-react';

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

const ALL_SYSTEMS: { id: System; name: string; color: string; glow: string; icon: React.ReactNode }[] = [
  { id: 'Fire', name: '火', color: 'bg-red-600 text-white border-red-400', glow: 'shadow-red-500/80', icon: <Flame size={10} /> },
  { id: 'Water', name: '水', color: 'bg-blue-600 text-white border-blue-400', glow: 'shadow-blue-500/80', icon: <Droplet size={10} /> },
  { id: 'Earth', name: '地', color: 'bg-emerald-600 text-white border-emerald-400', glow: 'shadow-emerald-500/80', icon: <Mountain size={10} /> },
  { id: 'Light', name: '光', color: 'bg-amber-400 text-slate-950 border-yellow-200', glow: 'shadow-yellow-400/80', icon: <Sun size={10} /> },
  { id: 'Dark', name: '闇', color: 'bg-purple-700 text-white border-purple-400', glow: 'shadow-purple-500/80', icon: <Moon size={10} /> },
  { id: 'Neutral', name: '無', color: 'bg-slate-600 text-white border-slate-400', glow: 'shadow-slate-400/80', icon: <Hexagon size={10} /> },
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
  // Collect active systems in Arcana zone
  const activeSystems = new Set(arcanaCards.map(c => getCard(c.cardId).system));

  if (isOpponent) {
    // Compact Opponent Meter
    return (
      <div className="flex items-center space-x-2 bg-slate-950/80 backdrop-blur-md px-2.5 py-1.5 rounded-xl border border-red-500/30 shadow-lg">
        {/* Arcana Orb */}
        <button
          type="button"
          onClick={onOpenArcana}
          className="relative group flex items-center space-x-1.5 cursor-pointer"
          title="相手のアルカナゾーンを確認"
        >
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-950 via-slate-900 to-purple-950 border-2 border-indigo-400/60 shadow-inner flex flex-col items-center justify-center">
            <span className="text-[7px] font-black text-indigo-300 leading-none">ARCANA</span>
            <span className="font-mono font-black text-xs text-white leading-none mt-0.5">
              {current}/{max}
            </span>
          </div>

          {/* Active Affinities */}
          <div className="flex -space-x-1">
            {ALL_SYSTEMS.filter(s => activeSystems.has(s.id)).map(s => (
              <div
                key={s.id}
                className={`w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-black border shadow ${s.color} ${s.glow}`}
                title={`${s.name}属性有効`}
              >
                {s.icon}
              </div>
            ))}
          </div>
        </button>

        <div className="h-5 w-px bg-white/10" />

        {/* Deck & Archive count */}
        <div className="flex items-center space-x-2 text-[10px] font-bold text-slate-400">
          <span title="相手の山札枚数" className="flex items-center space-x-1">
            <Layers size={12} className="text-slate-500" />
            <span className="font-mono text-white">{deckCount}</span>
          </span>
          <button
            type="button"
            onClick={onOpenArchive}
            title="相手のアーカイブ(墓地)を確認"
            className="flex items-center space-x-1 hover:text-purple-300 transition-colors cursor-pointer"
          >
            <Archive size={12} className="text-purple-400" />
            <span className="font-mono text-purple-200">{archiveCount}</span>
          </button>
        </div>
      </div>
    );
  }

  // Giant Circular Arcana Gauge for Player (Duel Masters Plays Style)
  return (
    <div className="flex items-center space-x-3 pointer-events-auto">
      {/* Outer Metallic Sphere */}
      <button
        type="button"
        onClick={onOpenArcana}
        className="relative group cursor-pointer active:scale-95 transition-transform"
        title="アルカナゾーンを確認"
      >
        {/* Ambient Glow */}
        <div className="absolute -inset-1.5 rounded-full bg-blue-500/30 blur-md group-hover:bg-blue-400/40 transition-colors animate-pulse" />

        {/* Outer Circular Frame */}
        <div className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-full bg-gradient-to-b from-slate-700 via-slate-900 to-black p-1 shadow-2xl border-2 border-amber-400/60 flex items-center justify-center">
          {/* Beveled Inset */}
          <div className="w-full h-full rounded-full bg-gradient-to-br from-indigo-950 via-slate-950 to-blue-950 border border-blue-400/40 flex flex-col items-center justify-center relative overflow-hidden shadow-inner">
            {/* Background Mystic Runes */}
            <div className="absolute inset-0 bg-[radial-gradient(#38bdf8_1px,transparent_1px)] [background-size:8px_8px] opacity-20" />

            {/* Label */}
            <span className="text-[9px] sm:text-[10px] font-black text-cyan-300 tracking-wider drop-shadow">
              ARCANA
            </span>

            {/* Huge Counter */}
            <div className="flex items-baseline justify-center font-mono font-black text-white leading-none my-0.5">
              <span className="text-2xl sm:text-3xl text-cyan-200 drop-shadow-[0_0_12px_rgba(56,189,248,0.8)]">
                {current}
              </span>
              <span className="text-sm sm:text-base text-cyan-400/70 mx-0.5">/</span>
              <span className="text-sm sm:text-base text-slate-300">
                {max}
              </span>
            </div>

            <span className="text-[7.5px] sm:text-[8px] font-bold text-slate-400">TAP TO VIEW</span>
          </div>

          {/* Elemental Affinity Orbs arrayed around the rim */}
          {ALL_SYSTEMS.map((sys, idx) => {
            const isActive = activeSystems.has(sys.id);
            // Position 6 orbs in a circle: angle = idx * (360 / 6) - 90 deg
            const angle = (idx * 60 - 90) * (Math.PI / 180);
            const radius = 38; // px offset from center in container
            const x = 50 + radius * Math.cos(angle);
            const y = 50 + radius * Math.sin(angle);

            return (
              <div
                key={sys.id}
                style={{
                  left: `${x}%`,
                  top: `${y}%`,
                  transform: 'translate(-50%, -50%)',
                }}
                className={`absolute w-5 h-5 sm:w-6 sm:h-6 rounded-full flex items-center justify-center border shadow-lg transition-all duration-300 ${
                  isActive
                    ? `${sys.color} ${sys.glow} scale-110 ring-1 ring-white/80 z-20`
                    : 'bg-slate-900/90 border-slate-700 text-slate-500 opacity-40 grayscale z-10'
                }`}
                title={`${sys.name}系統: ${isActive ? '解放済' : '未配置'}`}
              >
                {sys.icon}
              </div>
            );
          })}
        </div>
      </button>

      {/* Side HUD: Deck & Archive Badges */}
      <div className="flex flex-col space-y-1.5">
        {/* Deck Count */}
        <div 
          className="flex items-center space-x-1.5 bg-slate-950/80 backdrop-blur border border-slate-700 px-2.5 py-1 rounded-lg shadow"
          title="自分の山札残り枚数"
        >
          <Layers size={13} className="text-amber-400" />
          <span className="text-[10px] font-bold text-slate-300">山札</span>
          <span className="font-mono font-black text-xs text-white">{deckCount}</span>
        </div>

        {/* Archive / Graveyard Count */}
        <button
          type="button"
          onClick={onOpenArchive}
          className="flex items-center space-x-1.5 bg-slate-950/80 hover:bg-slate-900 backdrop-blur border border-purple-500/40 hover:border-purple-400 px-2.5 py-1 rounded-lg shadow transition-colors cursor-pointer text-left"
          title="自分のアーカイブ(墓地)を確認"
        >
          <Archive size={13} className="text-purple-400" />
          <span className="text-[10px] font-bold text-purple-300">墓地</span>
          <span className="font-mono font-black text-xs text-white">{archiveCount}</span>
        </button>
      </div>
    </div>
  );
};
