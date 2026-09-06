import React from 'react';
import { Shield, Zap, Sparkles } from 'lucide-react';

interface Props {
  count: number;
  max?: number;
  isOpponent?: boolean;
  isTargetable?: boolean;
  onClick?: () => void;
}

export const BarrierPlates: React.FC<Props> = ({
  count,
  max = 5,
  isOpponent = false,
  isTargetable = false,
  onClick,
}) => {
  return (
    <div
      onClick={onClick}
      className={`flex items-center space-x-1 sm:space-x-1.5 px-2 py-1 rounded-xl transition-all select-none ${
        isTargetable
          ? 'cursor-pointer ring-2 ring-red-500 bg-red-950/60 shadow-lg shadow-red-500/40 animate-pulse'
          : 'bg-black/40 backdrop-blur-sm border border-white/10'
      }`}
      title={isTargetable ? '相手の結界を直接攻撃！' : `結界: ${count}/${max}`}
    >
      <div className="flex items-center space-x-1">
        {Array.from({ length: max }).map((_, idx) => {
          const isActive = idx < count;

          return (
            <div
              key={idx}
              className={`relative flex items-center justify-center transition-all duration-300 ${
                isActive
                  ? 'scale-100 hover:scale-110'
                  : 'scale-90 opacity-30 grayscale'
              }`}
            >
              {/* Hexagonal Floating Plate */}
              <div
                className={`w-6 h-7 sm:w-7 sm:h-8 flex items-center justify-center relative transition-all ${
                  isActive
                    ? isOpponent
                      ? 'text-yellow-400 drop-shadow-[0_0_8px_rgba(250,204,21,0.9)]'
                      : 'text-cyan-400 drop-shadow-[0_0_8px_rgba(56,189,248,0.9)]'
                    : 'text-slate-700'
                }`}
              >
                <Shield
                  size={24}
                  className={`transition-transform ${
                    isActive
                      ? isOpponent
                        ? 'fill-yellow-400/80 stroke-yellow-200 stroke-[1.5]'
                        : 'fill-cyan-400/80 stroke-cyan-200 stroke-[1.5]'
                      : 'fill-slate-900/60 stroke-slate-700 stroke-[1]'
                  }`}
                />

                {/* Crystal core glint */}
                {isActive && (
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="w-1.5 h-1.5 rounded-full bg-white shadow-[0_0_6px_#fff]" />
                  </div>
                )}
              </div>

              {/* Shatter indicator when broken */}
              {!isActive && (
                <div className="absolute inset-0 flex items-center justify-center text-[9px] font-black text-slate-500">
                  ✕
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Numerical Badge */}
      <span
        className={`font-mono font-black text-xs ml-1 ${
          count > 0
            ? isOpponent
              ? 'text-yellow-300'
              : 'text-cyan-300'
            : 'text-red-500 animate-bounce'
        }`}
      >
        {count}/{max}
      </span>
    </div>
  );
};
