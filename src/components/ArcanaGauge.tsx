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

  // 3D Circular Arcana Orb (Duel Masters Plays Mana Zone Orb style)
  // Symmetrically rendered for both player (bottom-left) and opponent (top-right)
  return (
    <div
      className={`flex items-center space-x-1.5 select-none pointer-events-auto shrink-0 ${
        isOpponent ? 'flex-row-reverse space-x-reverse' : ''
      }`}
    >
      {/* 3D Circular Arcana Orb (diameter ~64px) */}
      <button
        type="button"
        onClick={onOpenArcana}
        className="relative group cursor-pointer active:scale-95 transition-transform"
        title={isOpponent ? '相手のアルカナゾーン確認 (タップで展開)' : '自分のアルカナゾーン確認 (タップで展開)'}
      >
        {/* Pulsing Mana Aura */}
        <div
          className={`absolute -inset-1 rounded-full blur-md transition-colors animate-pulse ${
            isOpponent
              ? 'bg-amber-500/30 group-hover:bg-amber-400/60'
              : 'bg-cyan-500/30 group-hover:bg-cyan-400/60'
          }`}
        />

        {/* Outer Metallic Bezel with Cyber Ring */}
        <div
          className={`relative w-[64px] h-[64px] rounded-full p-1 shadow-[0_4px_16px_rgba(0,0,0,0.85)] flex items-center justify-center border-2 ${
            isOpponent
              ? 'bg-gradient-to-b from-amber-400 via-red-950 to-black border-amber-400'
              : 'bg-gradient-to-b from-amber-300 via-slate-900 to-black border-amber-400'
          }`}
        >
          {/* Inner Glowing Crystal Sphere */}
          <div
            className={`w-full h-full rounded-full border flex flex-col items-center justify-center relative overflow-hidden shadow-inner ${
              isOpponent
                ? 'bg-gradient-to-br from-red-950 via-slate-950 to-amber-950 border-amber-400/60'
                : 'bg-gradient-to-br from-cyan-950 via-slate-950 to-blue-950 border-cyan-400/60'
            }`}
          >
            {/* Top Gloss Highlight */}
            <div className="absolute top-0 inset-x-2 h-1/2 rounded-t-full bg-gradient-to-b from-white/30 to-transparent pointer-events-none" />

            {/* Top Micro Label */}
            <span
              className={`text-[6px] font-black tracking-wider uppercase leading-none z-10 ${
                isOpponent ? 'text-amber-300' : 'text-cyan-300'
              }`}
            >
              MANA
            </span>

            {/* Digital Numbers: Current / Max */}
            <div className="flex items-baseline justify-center font-mono font-black text-white leading-none my-0.5 z-10">
              <span
                className={`text-lg drop-shadow-[0_0_8px_rgba(245,158,11,1)] ${
                  isOpponent ? 'text-amber-300' : 'text-cyan-200'
                }`}
              >
                {current}
              </span>
              <span className="text-[9px] text-white/40 mx-0.5">/</span>
              <span className="text-[10.5px] text-slate-300">
                {max}
              </span>
            </div>

            {/* Bottom mini status */}
            <span
              className={`text-[5.5px] font-bold z-10 tracking-tighter ${
                isOpponent ? 'text-red-300/90' : 'text-amber-300/90'
              }`}
            >
              ARCANA
            </span>
          </div>
        </div>
      </button>

      {/* 5 Elemental Affinity Gems Column */}
      <div className="flex flex-col space-y-0.5 bg-black/70 backdrop-blur-sm p-1 rounded-xl border border-white/10 shadow-md">
        {ELEMENTAL_SYSTEMS.map(sys => {
          const isActive = activeSystems.has(sys.id);
          return (
            <div
              key={sys.id}
              className={`w-3 h-3 rounded-full flex items-center justify-center text-[5.5px] font-black border transition-all ${
                isActive
                  ? `${sys.color} ${sys.glow} border-white/80 scale-110`
                  : 'bg-slate-900/90 border-slate-700 text-slate-600 opacity-25 grayscale'
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
