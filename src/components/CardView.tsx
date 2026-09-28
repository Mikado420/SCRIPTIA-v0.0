import React from 'react';
import { CardInstance, CardTemplate } from '../types';
import { getCard } from '../data/cards';
import { Shield, Zap, Skull, ShieldOff, Crosshair, Ban, Moon, Sword } from 'lucide-react';
import { ElementSigil, elementOf, TYPE_LABEL, LINEAGE_LABEL, KEYWORD_INFO } from './ui/elements';

export type CardViewSize = 'field' | 'hand' | 'opponent-hand' | 'compact' | 'grid' | 'large' | 'default';

interface CardViewProps {
  instance?: CardInstance;
  template?: CardTemplate;
  onClick?: (e: React.MouseEvent) => void;
  onContextMenu?: (e: React.MouseEvent) => void;
  onInspect?: () => void;
  className?: string;
  isFaceDown?: boolean;
  selected?: boolean;
  /** 手札: プレイ可能（false なら暗く表示）/ 盤面: 攻撃可能 */
  playable?: boolean;
  computedStats?: { atk: number; def: number; brk: number };
  size?: CardViewSize;
  isRested?: boolean;
  hasSummoningSickness?: boolean;
  evoCount?: number;
  isDragging?: boolean;
  /** 手札で playable=false でも暗くしない（相手ターン中など） */
  noDim?: boolean;
  /** large で効果テキストを出さない（横に説明パネルがある時） */
  hideEffect?: boolean;
}

const SIZE: Record<CardViewSize, { w: number; h: number }> = {
  'opponent-hand': { w: 28, h: 39 },
  compact: { w: 40, h: 56 },
  field: { w: 70, h: 96 },
  hand: { w: 72, h: 100 },
  grid: { w: 86, h: 120 },
  default: { w: 96, h: 134 },
  large: { w: 176, h: 246 },
};

const KEYWORD_ICON: Record<string, React.ComponentType<{ size?: number; strokeWidth?: number }>> = {
  Guard: Shield,
  Rush: Zap,
  Lethal: Skull,
  CannotBeGuarded: ShieldOff,
  CanAttackActive: Crosshair,
  CannotAttackPlayer: Ban,
};

export const cardKeywords = (card: CardTemplate): string[] => {
  const set = new Set<string>(card.keywords ?? []);
  if (card.restrictions?.cannotAttackPlayer) set.add('CannotAttackPlayer');
  if (card.restrictions?.cannotBeGuarded) set.add('CannotBeGuarded');
  if (card.restrictions?.canAttackActive) set.add('CanAttackActive');
  return [...set].filter(k => KEYWORD_INFO[k]);
};

/** カード裏面（相手の手札・伏せルーン・山札） */
export const CardBack: React.FC<{ w: number; h: number; className?: string; onClick?: (e: React.MouseEvent) => void }> = ({
  w,
  h,
  className = '',
  onClick,
}) => (
  <div
    onClick={onClick}
    className={`relative shrink-0 overflow-hidden select-none ${className}`}
    style={{
      width: w,
      height: h,
      borderRadius: Math.max(3, w * 0.08),
      background: 'radial-gradient(circle at 50% 45%, #2a2340 0%, #14172a 55%, #0a0b14 100%)',
      border: '1px solid #9c7b3f',
      boxShadow: 'inset 0 0 0 2px rgba(0,0,0,0.55), inset 0 0 0 3px rgba(210,171,95,0.35), 0 2px 5px rgba(0,0,0,0.5)',
    }}
  >
    <svg viewBox="0 0 100 140" className="absolute inset-0 w-full h-full" preserveAspectRatio="none">
      <circle cx="50" cy="70" r="30" fill="none" stroke="#d2ab5f" strokeOpacity="0.55" strokeWidth="2" />
      <circle cx="50" cy="70" r="22" fill="none" stroke="#d2ab5f" strokeOpacity="0.35" strokeWidth="1" strokeDasharray="3 3" />
      <polygon points="50,44 72,82 28,82" fill="none" stroke="#e6c77f" strokeOpacity="0.4" strokeWidth="1.2" />
      <polygon points="50,96 28,58 72,58" fill="none" stroke="#e6c77f" strokeOpacity="0.4" strokeWidth="1.2" />
    </svg>
    {w >= 26 && (
      <div
        className="absolute inset-0 flex items-center justify-center font-rune font-bold"
        style={{ color: '#f2dea6', fontSize: Math.max(7, w * 0.26), textShadow: '0 0 6px rgba(230,199,127,0.5)' }}
      >
        S
      </div>
    )}
  </div>
);

export const CardView: React.FC<CardViewProps> = ({
  instance,
  template,
  onClick,
  onContextMenu,
  onInspect,
  className = '',
  isFaceDown,
  selected,
  playable,
  computedStats,
  size = 'default',
  isRested,
  hasSummoningSickness,
  evoCount = 1,
  isDragging,
  noDim,
  hideEffect,
}) => {
  const card = template || (instance ? getCard(instance.cardId) : null);
  const { w, h } = SIZE[size];

  if (isFaceDown || !card) {
    return <CardBack w={w} h={h} onClick={onClick} className={className} />;
  }

  const el = elementOf(card.system);
  const isUnit = card.type === 'Unit' || card.type === 'Evolution';
  const atk = computedStats ? computedStats.atk : card.atk ?? 0;
  const def = computedStats ? computedStats.def : card.def ?? 0;
  const brk = computedStats ? computedStats.brk : card.brk ?? 1;
  const atkBuff = computedStats && card.atk !== undefined ? Math.sign(computedStats.atk - card.atk) : 0;
  const defBuff = computedStats && card.def !== undefined ? Math.sign(computedStats.def - card.def) : 0;
  const keywords = cardKeywords(card);

  const small = w < 60;
  const isLarge = size === 'large';
  const showType = w >= 72 && (isUnit || isLarge);
  const showEffect = isLarge && !hideEffect;

  const radius = Math.max(4, w * 0.075);
  const gem = Math.round(w * (small ? 0.36 : 0.26));
  const nameSize = isLarge ? 15 : small ? Math.max(6, w * 0.15) : Math.max(7.2, w * 0.108);
  const statSize = isLarge ? 20 : Math.max(9, w * 0.165);

  const dimmed = size === 'hand' && playable === false && !noDim;
  const ready = size === 'field' && playable && !isRested;

  const ring = selected
    ? '0 0 0 2px #fbeec4, 0 0 0 3.5px rgba(173,135,68,0.9), 0 0 18px rgba(230,199,127,0.6)'
    : size === 'hand' && playable
      ? '0 0 0 1.5px rgba(134,236,220,0.9), 0 0 10px rgba(79,214,194,0.45)'
      : '0 3px 8px rgba(0,0,0,0.55)';

  const typeLine = [TYPE_LABEL[card.type] || card.type, card.lineage && card.lineage !== 'None' ? LINEAGE_LABEL[card.lineage] || card.lineage : null]
    .filter(Boolean)
    .join(' ・ ');

  return (
    <div
      onClick={onClick}
      onContextMenu={onContextMenu}
      className={`relative shrink-0 select-none ${ready ? 'sc-anim-ready' : ''} ${className}`}
      style={{
        width: w,
        height: h,
        borderRadius: radius,
        transform: isRested ? 'rotate(90deg) scale(0.74)' : undefined,
        transition: 'transform 220ms var(--ease-out-quint), filter 160ms ease, box-shadow 160ms ease',
        filter: dimmed ? 'brightness(0.55) saturate(0.45)' : isRested ? 'saturate(0.55) brightness(0.8)' : undefined,
        boxShadow: ready ? undefined : ring,
        opacity: isDragging ? 0.95 : 1,
      }}
      title={card.name}
    >
      {/* 進化元の重なり */}
      {evoCount > 1 &&
        Array.from({ length: Math.min(2, evoCount - 1) }).map((_, i) => (
          <div
            key={i}
            className="absolute"
            style={{
              inset: 0,
              transform: `translate(${(i + 1) * 2.5}px, ${(i + 1) * -2.5}px)`,
              borderRadius: radius,
              background: '#1a1d2c',
              border: `1px solid ${el.color}88`,
              zIndex: -1 - i,
            }}
          />
        ))}

      {/* 本体フレーム */}
      <div
        className="absolute inset-0 overflow-hidden flex flex-col"
        style={{
          borderRadius: radius,
          background: `radial-gradient(120% 70% at 50% 42%, ${el.color}33 0%, ${el.deep} 55%, #07080e 100%)`,
          border: `1.5px solid ${el.color}`,
          boxShadow: `inset 0 0 0 1px rgba(0,0,0,0.6), inset 0 0 0 2px ${el.light}22`,
        }}
      >
        {/* 名前 */}
        <div
          className="relative shrink-0 flex items-center"
          style={{
            minHeight: small ? h * 0.3 : isLarge ? 40 : h * 0.27,
            paddingLeft: small ? gem * 0.9 : gem + 3,
            paddingRight: isLarge && keywords.length > 0 ? 4 + Math.min(keywords.length, 4) * 24 : 4,
            paddingTop: 2,
            paddingBottom: 2,
            background: 'linear-gradient(180deg, rgba(4,5,10,0.92), rgba(4,5,10,0.6))',
            borderBottom: `1px solid ${el.color}66`,
          }}
        >
          <span
            className="font-bold text-parch-50 leading-[1.1]"
            style={{
              fontSize: nameSize,
              display: '-webkit-box',
              WebkitLineClamp: small ? 1 : 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
              wordBreak: 'break-all',
            }}
          >
            {card.name}
          </span>
        </div>

        {/* アート（魔法陣） */}
        <div className="relative flex-1 min-h-0 flex items-center justify-center">
          <ElementSigil element={card.system} size={Math.round(Math.min(w * (small ? 0.62 : 0.58), h * 0.38))} />
          {hasSummoningSickness && !isRested && (
            <div
              className="absolute bottom-0.5 left-1/2 -translate-x-1/2 flex items-center gap-0.5 rounded-full px-1.5 whitespace-nowrap"
              style={{ background: 'rgba(6,7,13,0.85)', border: '1px solid rgba(201,189,162,0.4)', height: Math.max(12, w * 0.19) }}
              title="召喚したターンは攻撃できません"
            >
              <Moon size={Math.max(7, w * 0.11)} className="text-brass-300" />
              <span className="font-bold text-parch-300" style={{ fontSize: Math.max(6.5, w * 0.1) }}>
                待機
              </span>
            </div>
          )}
        </div>

        {/* 種別・系譜 */}
        {showType && (
          <div
            className="shrink-0 text-center truncate font-bold"
            style={{
              fontSize: isLarge ? 11 : Math.max(6.5, w * 0.085),
              color: el.light,
              opacity: 0.9,
              padding: '1px 3px',
              background: 'rgba(4,5,10,0.55)',
            }}
          >
            {typeLine}
          </div>
        )}

        {/* 効果テキスト（詳細表示のみ） */}
        {showEffect && card.effectText && (
          <div className="shrink-0 px-2.5 py-1.5 text-[10.5px] leading-snug text-parch-100 max-h-[64px] overflow-hidden" style={{ background: 'rgba(4,5,10,0.7)' }}>
            {card.effectText}
          </div>
        )}

        {/* ステータス */}
        {isUnit ? (
          <div
            className="shrink-0 flex items-center justify-between"
            style={{
              height: isLarge ? 34 : small ? h * 0.24 : Math.max(18, h * 0.21),
              padding: `0 ${Math.max(3, w * 0.06)}px`,
              background: 'linear-gradient(180deg, #1b1f30, #07080e)',
              borderTop: '1px solid rgba(210,171,95,0.55)',
            }}
          >
            <span className="flex items-center gap-[2px] sc-num leading-none" style={{ color: atkBuff > 0 ? '#86ecdc' : atkBuff < 0 ? '#f39a90' : '#ffb4a3', fontSize: small ? statSize * 0.85 : statSize }}>
              {!small && <Sword size={Math.max(8, statSize * 0.62)} strokeWidth={2.6} />}
              {atk}
            </span>
            {!small && w >= 70 && (
              <span
                className="sc-num leading-none rounded-sm px-[3px]"
                title="ブレイク数"
                style={{ fontSize: Math.max(7, statSize * 0.58), color: '#221806', background: '#e6c77f' }}
              >
                {brk}
              </span>
            )}
            <span className="flex items-center gap-[2px] sc-num leading-none" style={{ color: defBuff > 0 ? '#86ecdc' : defBuff < 0 ? '#f39a90' : '#a9d2ff', fontSize: small ? statSize * 0.85 : statSize }}>
              {!small && <Shield size={Math.max(8, statSize * 0.62)} strokeWidth={2.6} />}
              {def}
            </span>
          </div>
        ) : (
          !small && (
            <div
              className="shrink-0 text-center font-bold tracking-wider"
              style={{
                fontSize: isLarge ? 12 : Math.max(7, w * 0.1),
                height: isLarge ? 26 : Math.max(14, h * 0.15),
                lineHeight: `${isLarge ? 26 : Math.max(14, h * 0.15)}px`,
                color: el.light,
                background: 'linear-gradient(180deg, #1b1f30, #07080e)',
                borderTop: '1px solid rgba(210,171,95,0.55)',
              }}
            >
              {TYPE_LABEL[card.type] || card.type}
            </div>
          )
        )}
      </div>

      {/* コスト宝石 */}
      <div
        className="absolute flex items-center justify-center sc-num"
        style={{
          left: -Math.max(2, w * 0.04),
          top: -Math.max(2, w * 0.04),
          width: gem,
          height: gem,
          borderRadius: '50%',
          fontSize: gem * 0.6,
          lineHeight: 1,
          color: el.id === 'Light' ? '#2a1f04' : '#fff',
          background: `radial-gradient(circle at 35% 30%, ${el.light} 0%, ${el.color} 45%, ${el.deep} 100%)`,
          border: '1.5px solid #f2dea6',
          boxShadow: '0 2px 4px rgba(0,0,0,0.6)',
          textShadow: el.id === 'Light' ? 'none' : '0 1px 2px rgba(0,0,0,0.7)',
          zIndex: 2,
        }}
      >
        {card.cost}
      </div>

      {/* キーワード能力 */}
      {keywords.length > 0 && !small && (
        <div className="absolute flex gap-[2px]" style={{ top: isLarge ? 8 : h * (small ? 0.3 : 0.27) + 2, right: isLarge ? 8 : 2, zIndex: 2 }}>
          {keywords.slice(0, isLarge ? 4 : 2).map(k => {
            const Icon = KEYWORD_ICON[k];
            const s = isLarge ? 22 : Math.max(12, w * 0.19);
            return (
              <span
                key={k}
                title={KEYWORD_INFO[k].label}
                className="flex items-center justify-center rounded-full"
                style={{ width: s, height: s, background: '#0b0d17', border: '1px solid #86ecdc', color: '#86ecdc' }}
              >
                <Icon size={s * 0.62} strokeWidth={2.4} />
              </span>
            );
          })}
        </div>
      )}

      {/* 進化数 */}
      {evoCount > 1 && (
        <div
          className="absolute sc-num rounded-full px-1 leading-none flex items-center"
          style={{ right: -3, bottom: isUnit ? h * 0.22 : 4, height: 13, fontSize: 9, background: '#e6c77f', color: '#221806', border: '1px solid #06070d', zIndex: 3 }}
          title={`進化 ${evoCount - 1} 段`}
        >
          +{evoCount - 1}
        </div>
      )}

    </div>
  );
};
