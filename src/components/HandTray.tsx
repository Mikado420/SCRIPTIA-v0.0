import React, { useState } from 'react';
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

export const HandTray: React.FC<Props> = ({ hand, state, dispatch, selectedCard, onSelect, onInspect }) => {
  const [isHovered, setIsHovered] = useState(false);
  const isActionable = state.currentPlayer === 'player1' && (state.phase === 'ARCANA_PLACEMENT' || state.phase === 'ACTION');

  return (
    <div 
      className={`absolute bottom-0 left-0 right-0 flex justify-center items-end transition-all duration-300 ease-out z-40 pb-4
        ${isHovered || selectedCard ? 'translate-y-0' : 'translate-y-12 opacity-90'}
      `}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className="flex justify-center items-end -space-x-12 px-12">
        {hand.map((c, i) => {
          const isSelected = selectedCard === c.instanceId;
          const rotation = (i - (hand.length - 1) / 2) * 5;
          const yOffset = Math.abs(i - (hand.length - 1) / 2) * 4;
          
          return (
            <div 
              key={c.instanceId}
              className="relative transition-all duration-200"
              style={{
                transform: isHovered || selectedCard 
                  ? `translateY(${isSelected ? '-30px' : '0px'}) rotate(${isSelected ? 0 : rotation}deg)` 
                  : `translateY(${yOffset}px) rotate(${rotation}deg)`,
                zIndex: isSelected ? 50 : i
              }}
              onContextMenu={(e) => {
                e.preventDefault();
                onInspect(getCard(c.cardId));
              }}
            >
              <CardView
                instance={c}
                selected={isSelected}
                playable={isActionable}
                onClick={() => onSelect(c.instanceId)}
                className="shadow-[0_10px_20px_rgba(0,0,0,0.5)] hover:shadow-yellow-500/20"
              />
            </div>
          );
        })}
      </div>
    </div>
  );
};
