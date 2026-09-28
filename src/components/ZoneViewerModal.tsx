import React from 'react';
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
  if (!isOpen) return null;
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
          <span className="text-[10.5px] text-brass-300">カードをタップ</span>
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
            const isSelectable = selectionMode ? selectionMode.canSelect(template) : false;
            return (
              <button
                type="button"
                key={cardInstance.instanceId}
                className={`relative transition-transform active:scale-95 ${selectionMode && !isSelectable ? 'opacity-35 grayscale' : ''}`}
                onClick={() => {
                  if (selectionMode && isSelectable) {
                    selectionMode.onSelect(cardInstance.instanceId);
                    onClose();
                  } else {
                    handleInspect(template);
                  }
                }}
              >
                <CardView instance={cardInstance} size="grid" selected={isSelectable} />
                {isSelectable && (
                  <span className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full flex items-center justify-center" style={{ background: '#e6c77f', color: '#221806' }}>
                    <Check size={12} />
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
      <p className="text-[10.5px] text-parch-500 mt-3 text-center">カードをタップすると詳細を確認できます</p>
    </Modal>
  );
};
