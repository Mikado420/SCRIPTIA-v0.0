import React from 'react';
import { CardView } from './CardView';
import { CardInstance, GameState, GameAction } from '../types';
import { getCard } from '../data/cards';

interface Props {
  hand: CardInstance[];
  state: GameState;
  dispatch: React.Dispatch<GameAction>;
  selectedCard: string | null;
  onSelect: (id: string) => void;
  onInspect: (card: any) => void;
}

export const HandTray: React.FC<Props> = ({
  hand,
  state,
  dispatch,
  selectedCard,
  onSelect,
  onInspect,
}) => {
  const isActionable =
    state.currentPlayer === 'player1' &&
    (state.phase === 'ARCANA_PLACEMENT' || state.phase === 'ACTION');

  // Dynamic spacing based on hand card count
  const getOverlapClass = () => {
    if (hand.length <= 4) return 'space-x-1 sm:space-x-2';
    if (hand.length <= 6) return '-space-x-2 sm:-space-x-1';
    if (hand.length <= 8) return '-space-x-4 sm:-space-x-3';
    return '-space-x-5 sm:-space-x-4';
  };

  return (
    <div className="w-full h-full flex items-end justify-center pb-1 pointer-events-auto">
      <div className={`flex items-end justify-center ${getOverlapClass()} max-w-full px-2`}>
        {hand.map((c, i) => {
          const isSelected = selectedCard === c.instanceId;
          const cardData = getCard(c.cardId);

          return (
            <div
              key={c.instanceId}
              style={{ zIndex: isSelected ? 40 : 10 + i }}
              className="relative shrink-0 transition-transform duration-150"
              onContextMenu={(e) => {
                e.preventDefault();
                onInspect(cardData);
              }}
            >
              <CardView
                instance={c}
                size="hand"
                selected={isSelected}
                playable={isActionable}
                onClick={() => onSelect(c.instanceId)}
                onInspect={() => onInspect(cardData)}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
};
