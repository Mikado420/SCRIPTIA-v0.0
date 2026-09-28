import React, { useEffect, useState } from 'react';
import { CardInstance, CardTemplate } from '../types';
import { getCard } from '../data/cards';
import { CardView } from './CardView';
import { Layers, Sparkles, Check } from 'lucide-react';
import { Modal } from './ui/Modal';
import { ElementDot, ELEMENTS, TYPE_LABEL } from './ui/elements';

export interface ZoneSelectionConfig {
  promptText: string;
  canSelect: (card: CardTemplate) => boolean;
  onSelect: (instanceId: string) => void;
  /** 選べる instanceId（指定時は canSelect より優先） */
  selectableIds?: string[];
  /** 指定すると「count 枚選んで確定」モードになる */
  count?: number;
  onConfirm?: (instanceIds: string[]) => void;
  /** 「〜できる」効果で、選ばずに進める */
  onDecline?: () => void;
}

interface ZoneViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  zoneType: 'arcana' | 'archive';
  cards: CardInstance[];
  isOpponent?: boolean;
  selectionMode?: ZoneSelectionConfig | null;
  onInspectCard?: (card: CardTemplate) => void;
  onInspect?: (card: CardTemplate) => void;
}

export const ZoneViewerModal: React.FC<ZoneViewerModalProps> = ({
  isOpen,
  onClose,
  title,
  zoneType,
  cards,
  isOpponent = false,
  selectionMode,
  onInspectCard,
  onInspect,
}) => {
  const [picked, setPicked] = useState<string[]>([]);
  useEffect(() => setPicked([]), [selectionMode, isOpen]);

  if (!isOpen) return null;
  const pickMode = !!selectionMode && selectionMode.count !== undefined;
  const need = selectionMode?.count ?? 0;
  const handleInspect = onInspectCard || onInspect || (() => {});

  const counts: Record<string, number> = {};
  cards.forEach(c => {
    const t = getCard(c.cardId);
    const key = zoneType === 'arcana' ? t.system : t.type;
    counts[key] = (counts[key] || 0) + 1;
  });

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      fixed
      zIndex={90}
      width={620}
      eyebrow={zoneType === 'arcana' ? 'Arcana' : 'Archive'}
      title={
        <span className="flex items-center gap-2">
          {title}
          <span className="sc-chip">{cards.length}枚</span>
          {isOpponent && <span className="sc-chip" style={{ color: '#f7c3bc', borderColor: 'rgba(243,154,144,0.5)' }}>相手</span>}
        </span>
      }
      icon={<Layers size={18} />}
      bodyClassName="!pt-2"
    >
      {selectionMode && (
        <div className="mb-2 px-3 py-2 rounded-lg flex items-center gap-2 text-[12px] font-bold" style={{ background: 'rgba(58,50,34,0.6)', border: '1px solid rgba(230,199,127,0.5)', color: '#fbf0d2' }}>
          <Sparkles size={14} />
          <span className="flex-1">{selectionMode.promptText}</span>
          <span className="text-[10.5px] text-brass-300 whitespace-nowrap">
            {pickMode ? (
              <>
                選択中 <span className="sc-num text-[12px] text-brass-100">{picked.length}</span> / {need}
              </>
            ) : (
              'カードをタップ'
            )}
          </span>
        </div>
      )}

      {cards.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 mb-2.5">
          {Object.entries(counts).map(([k, n]) =>
            zoneType === 'arcana' ? (
              <span key={k} className="sc-chip">
                <ElementDot element={k} size={13} />
                {ELEMENTS[k as keyof typeof ELEMENTS]?.label ?? k} ×{n}
              </span>
            ) : (
              <span key={k} className="sc-chip">
                {TYPE_LABEL[k] ?? k} ×{n}
              </span>
            ),
          )}
        </div>
      )}

      {cards.length === 0 ? (
        <div className="h-36 flex flex-col items-center justify-center text-parch-500 gap-2">
          <Layers size={28} className="opacity-40" />
          <p className="text-[12px]">まだカードはありません</p>
        </div>
      ) : (
        <div className="grid gap-2.5 justify-items-center" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(90px, 1fr))' }}>
          {cards.map(cardInstance => {
            const template = getCard(cardInstance.cardId);
            const isSelectable = selectionMode
              ? selectionMode.selectableIds
                ? selectionMode.selectableIds.includes(cardInstance.instanceId)
                : selectionMode.canSelect(template)
              : false;
            const isPicked = picked.includes(cardInstance.instanceId);
            return (
              <button
                type="button"
                key={cardInstance.instanceId}
                className={`relative transition-transform active:scale-95 ${selectionMode && !isSelectable ? 'opacity-35 grayscale' : ''}`}
                onClick={() => {
                  if (pickMode && isSelectable) {
                    setPicked(prev =>
                      prev.includes(cardInstance.instanceId)
                        ? prev.filter(x => x !== cardInstance.instanceId)
                        : prev.length < need
                          ? [...prev, cardInstance.instanceId]
                          : prev,
                    );
                  } else if (selectionMode && isSelectable) {
                    selectionMode.onSelect(cardInstance.instanceId);
                    onClose();
                  } else {
                    handleInspect(template);
                  }
                }}
              >
                <CardView instance={cardInstance} size="grid" selected={pickMode ? isPicked : isSelectable} />
                {(pickMode ? isPicked : isSelectable) && (
                  <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full flex items-center justify-center" style={{ background: '#e6c77f', color: '#221806' }}>
                    <Check size={12} />
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
      {pickMode ? (
        <div className="flex items-center justify-end gap-2 mt-3">
          {selectionMode!.onDecline && (
            <button
              type="button"
              className="sc-btn sc-btn--cancel"
              onClick={() => {
                selectionMode!.onDecline!();
                onClose();
              }}
            >
              効果を使わない
            </button>
          )}
          <button
            type="button"
            className="sc-btn sc-btn--primary"
            disabled={picked.length !== need}
            onClick={() => {
              selectionMode!.onConfirm?.(picked);
              onClose();
            }}
          >
            {picked.length === need ? `この${need}枚で決定` : `あと${need - picked.length}枚選択`}
          </button>
        </div>
      ) : (
        <p className="text-[10.5px] text-parch-500 mt-3 text-center">カードをタップすると詳細を確認できます</p>
      )}
    </Modal>
  );
};
