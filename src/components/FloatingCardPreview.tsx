import React from 'react';
import { X, Sword, Shield, Hammer } from 'lucide-react';
import { CardTemplate } from '../types';
import { formatCardMetaJapanese } from '../utils/cardFormatter';
import { CardView } from './CardView';
import { elementOf } from './ui/elements';

export { formatCardMetaJapanese };

interface FloatingCardPreviewProps {
  card: CardTemplate | null;
  computedStats?: { atk: number; def: number; brk: number };
  onClose: () => void;
  /** 下に置く操作ボタン（デッキ編成の「追加」など） */
  actions?: React.ReactNode;
}

/**
 * カード詳細。左に大きなカード、右に効果・能力の説明。
 * 背景を暗くしすぎず、盤面の状況を見ながら確認できる。
 */
export const FloatingCardPreview: React.FC<FloatingCardPreviewProps> = ({ card, computedStats, onClose, actions }) => {
  if (!card) return null;
  const el = elementOf(card.system);
  const isUnit = card.type === 'Unit' || card.type === 'Evolution';
  const atk = computedStats ? computedStats.atk : card.atk ?? 0;
  const def = computedStats ? computedStats.def : card.def ?? 0;
  const brk = computedStats ? computedStats.brk : card.brk ?? 1;

  return (
    <div
      id="floating-card-preview"
      className="fixed inset-0 z-[100] flex items-center justify-start pl-3 pr-3"
      style={{ background: 'linear-gradient(90deg, rgba(3,4,9,0.75), rgba(3,4,9,0.35) 60%, rgba(3,4,9,0.15))', animation: 'sc-fade-in 120ms ease-out both' }}
      onClick={e => {
        e.stopPropagation();
        onClose();
      }}
      onPointerDown={e => e.stopPropagation()}
      onPointerUp={e => e.stopPropagation()}
    >
      <div
        className="sc-panel sc-corners sc-anim-slide-left flex gap-3 p-3 max-h-full"
        style={{ width: 460, maxWidth: '100%', borderColor: `${el.color}aa` }}
        onClick={e => e.stopPropagation()}
      >
        <div className="shrink-0 self-start">
          <CardView template={card} size="large" computedStats={computedStats} hideEffect />
        </div>

        <div className="flex-1 min-w-0 flex flex-col">
          <div className="flex items-start gap-2">
            <div className="flex-1 min-w-0">
              <div className="sc-eyebrow" style={{ color: el.light }}>
                {formatCardMetaJapanese(card)}
              </div>
              <div className="sc-title text-[17px] leading-snug mt-0.5">{card.name}</div>
            </div>
            <button type="button" onClick={onClose} className="sc-btn sc-btn--ghost sc-btn--icon shrink-0" aria-label="閉じる">
              <X size={16} />
            </button>
          </div>

          <div className="sc-scroll min-h-0 flex-1 mt-2 space-y-2 pr-0.5">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="sc-chip">
                コスト <span className="sc-num text-brass-200 text-[12px]">{card.cost}</span>
              </span>
              {isUnit && (
                <>
                  <span className="sc-chip" style={{ color: '#ffb4a3' }}>
                    <Sword size={11} /> 攻撃 <span className="sc-num text-[12px]">{atk}</span>
                  </span>
                  <span className="sc-chip" style={{ color: '#a9d2ff' }}>
                    <Shield size={11} /> 防御 <span className="sc-num text-[12px]">{def}</span>
                  </span>
                  <span className="sc-chip" style={{ color: '#f2dea6' }} title="攻撃が通った時に破る結界の数">
                    <Hammer size={11} /> ブレイク <span className="sc-num text-[12px]">{brk}</span>
                  </span>
                </>
              )}
            </div>

            {card.effectText && (
              <div className="rounded-lg px-3 py-2.5 text-[12.5px] leading-relaxed text-parch-50 whitespace-pre-wrap" style={{ background: 'rgba(4,5,10,0.6)', border: '1px solid rgba(210,171,95,0.2)' }}>
                {card.effectText}
              </div>
            )}
          </div>

          {actions && <div className="flex gap-2 pt-2 shrink-0">{actions}</div>}
        </div>
      </div>
    </div>
  );
};
