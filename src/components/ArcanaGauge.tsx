import React from 'react';
import { CardInstance } from '../types';
import { getCard } from '../data/cards';
import { ElementDot, ELEMENTS } from './ui/elements';

interface Props {
  current: number;
  max: number;
  arcanaCards: CardInstance[];
  deckCount?: number;
  archiveCount?: number;
  onOpenArcana: () => void;
  onOpenArchive?: () => void;
  isOpponent?: boolean;
  /** ドラッグ中に「ここへ置ける」ことを示す */
  highlight?: boolean;
}

const SYSTEMS = ['Fire', 'Water', 'Earth', 'Light', 'Dark'] as const;

/**
 * アルカナ（魔力）の魔法石。中央に「使える量 / 最大量」、下に解放済みの属性。
 * 使い切っている時は石が暗くなるので、残量が一目で分かる。
 */
export const ArcanaGauge: React.FC<Props> = ({ current, max, arcanaCards, onOpenArcana, isOpponent = false, highlight }) => {
  const active = new Set(arcanaCards.map(c => getCard(c.cardId).system).filter(s => s !== 'Neutral'));
  const ratio = max > 0 ? current / max : 0;
  const tint = isOpponent ? '227,102,92' : '79,214,194';

  return (
    <button
      type="button"
      onClick={e => {
        e.stopPropagation();
        onOpenArcana();
      }}
      className="flex items-center gap-2 select-none active:scale-95 transition-transform"
      aria-label={`${isOpponent ? '相手' : '自分'}のアルカナ ${current}/${max}`}
    >
      <div
        className="relative w-[54px] h-[54px] rounded-full shrink-0 flex items-center justify-center"
        style={{
          background: 'conic-gradient(from 200deg, #f2dea6, #85652f, #e6c77f, #5c451f, #f2dea6)',
          padding: 2.5,
          boxShadow: highlight
            ? `0 0 0 3px rgba(${tint},0.9), 0 0 22px rgba(${tint},0.8)`
            : '0 3px 10px rgba(0,0,0,0.6)',
          transition: 'box-shadow 160ms ease',
        }}
      >
        <div
          className="w-full h-full rounded-full flex flex-col items-center justify-center relative overflow-hidden"
          style={{
            background: `radial-gradient(circle at 40% 30%, rgba(${tint},${0.25 + ratio * 0.55}) 0%, #0b0d17 70%)`,
            boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.7), inset 0 -6px 12px rgba(0,0,0,0.6)',
          }}
        >
          <div className="absolute top-0.5 inset-x-3 h-2.5 rounded-full bg-gradient-to-b from-white/20 to-transparent" />
          <div className="flex items-baseline leading-none z-10">
            <span className="sc-num text-[21px]" style={{ color: current > 0 ? '#fbf0d2' : '#c9bda2', textShadow: '0 1px 3px rgba(0,0,0,0.9)' }}>
              {current}
            </span>
            <span className="sc-num text-[11px] text-parch-300 ml-0.5" style={{ textShadow: '0 1px 3px rgba(0,0,0,0.9)' }}>/{max}</span>
          </div>
          <span className="text-[7.5px] font-bold tracking-widest z-10 mt-0.5" style={{ color: `rgb(${tint})` }}>
            アルカナ
          </span>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-[3px]">
        {SYSTEMS.map(s => (
          <ElementDot key={s} element={s} size={14} active={active.has(s)} title={`${ELEMENTS[s].label}属性: ${active.has(s) ? '使用可能' : '未解放'}`} />
        ))}
      </div>
    </button>
  );
};
