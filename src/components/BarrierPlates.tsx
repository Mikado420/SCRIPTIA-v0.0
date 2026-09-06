import React, { useEffect, useRef, useState } from 'react';
import { Shield, Sparkles } from 'lucide-react';

interface Props {
  count: number;
  max?: number;
  isOpponent?: boolean;
  isTargetable?: boolean;
  orientation?: 'horizontal' | 'vertical';
  compact?: boolean;
  onClick?: () => void;
}

export const BarrierPlates: React.FC<Props> = ({
  count,
  max = 5,
  isOpponent = false,
  isTargetable = false,
  orientation = 'horizontal',
  compact = false,
  onClick,
}) => {
  const prevCount = useRef(count);
  const [shatteringIndex, setShatteringIndex] = useState<number | null>(null);

  useEffect(() => {
    if (count < prevCount.current) {
      // One or more barriers broke! Animate the last broken index
      setShatteringIndex(count);
      const timer = setTimeout(() => {
        setShatteringIndex(null);
      }, 900);
      return () => clearTimeout(timer);
    }
    prevCount.current = count;
  }, [count]);

  const isVertical = orientation === 'vertical';

  return (
    <div
      onClick={onClick}
      className={`flex ${
        isVertical
          ? 'flex-col items-center space-y-1 py-1 px-1'
          : 'flex-row items-center space-x-1 px-2 py-0.5'
      } rounded-xl transition-all select-none ${
        isTargetable
          ? 'cursor-pointer ring-2 ring-yellow-400 bg-red-950/90 shadow-[0_0_14px_rgba(250,204,21,0.9)] animate-pulse z-40'
          : 'bg-black/60 backdrop-blur-sm border border-white/10 shadow-sm'
      }`}
      title={isTargetable ? '相手の結界を直接攻撃！' : `結界: ${count}/${max}`}
    >
      <div className={`flex ${isVertical ? 'flex-col space-y-0.5' : 'flex-row items-center space-x-0.5'}`}>
        {Array.from({ length: max }).map((_, idx) => {
          const isActive = idx < count;
          const isJustShattered = shatteringIndex === idx;

          return (
            <div
              key={idx}
              className={`relative flex items-center justify-center transition-all duration-300 ${
                isActive
                  ? 'scale-100 hover:scale-110'
                  : 'scale-90 opacity-30 grayscale'
              }`}
            >
              {/* Floating Shield Plate */}
              <div
                className={`${compact ? 'w-4 h-4' : 'w-5 h-5'} flex items-center justify-center relative transition-all ${
                  isActive
                    ? isOpponent
                      ? 'text-yellow-400 drop-shadow-[0_0_6px_rgba(250,204,21,0.9)]'
                      : 'text-cyan-400 drop-shadow-[0_0_6px_rgba(56,189,248,0.9)]'
                    : 'text-slate-700'
                }`}
              >
                <Shield
                  className={`${compact ? 'w-3.5 h-3.5' : 'w-4 h-4'} transition-transform ${
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
                    <div className="w-1 h-1 rounded-full bg-white shadow-[0_0_4px_#fff]" />
                  </div>
                )}
              </div>

              {/* Shatter Glass Animation effect when broken */}
              {isJustShattered && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-50">
                  {/* Glowing shockwave */}
                  <div className="absolute w-8 h-8 rounded-full border-2 border-yellow-300 animate-summon-ripple" />
                  {/* Flying glass shards */}
                  {[-30, 30, -20, 20, 0].map((deg, sIdx) => (
                    <div
                      key={sIdx}
                      style={{
                        '--tw-shatter-x': `${(sIdx - 2) * 18}px`,
                        '--tw-shatter-y': `${sIdx % 2 === 0 ? -24 : 24}px`,
                        '--tw-shatter-r': `${deg * 2}deg`,
                      } as React.CSSProperties}
                      className="absolute w-2 h-2 bg-yellow-200 border border-white rotate-45 shadow-[0_0_8px_#fef08a] animate-shatter-shard"
                    />
                  ))}
                  <Sparkles size={14} className="text-yellow-300 animate-ping absolute" />
                </div>
              )}

              {/* Broken X mark */}
              {!isActive && !isJustShattered && (
                <div className="absolute inset-0 flex items-center justify-center text-[8px] font-black text-slate-500">
                  ✕
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Numerical Badge */}
      <span
        className={`font-mono font-black text-[11px] sm:text-xs ml-1 ${
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
