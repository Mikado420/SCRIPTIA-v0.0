import React from 'react';
import { CardView } from './CardView';
import { CardInstance, GameState, GameAction } from '../types';
import { getCard } from '../data/cards';
import { canPlayCard } from '../engine/engineUtils';
import { Zap, Play, Info, X } from 'lucide-react';

interface Props {
  hand: CardInstance[];
  state: GameState;
  dispatch: React.Dispatch<GameAction>;
  selectedCard: string | null;
  onSelect: (id: string) => void;
  onInspect: (card: any) => void;
  onPlayCard?: (id: string) => void;
  onArcanaPlace?: (id: string) => void;
}

export const HandTray: React.FC<Props> = ({
  hand,
  state,
  dispatch,
  selectedCard,
  onSelect,
  onInspect,
  onPlayCard,
  onArcanaPlace,
}) => {
  const me = state.player1;
  const isMyTurn = state.currentPlayer === 'player1';

  // Dynamic overlap for right-aligned hand fan (Duel Masters Plays style)
  const getOverlapMargin = () => {
    if (hand.length <= 1) return '';
    if (hand.length <= 3) return '-ml-4';
    if (hand.length <= 5) return '-ml-6 sm:-ml-7';
    if (hand.length <= 7) return '-ml-7 sm:-ml-8';
    return '-ml-8 sm:-ml-9';
  };

  return (
    <div
      id="hand-tray-container"
      className="relative flex items-end justify-end pointer-events-auto h-[92px] select-none pr-1"
    >
      <div className="flex items-end justify-end">
        {hand.map((c, i) => {
          const isSelected = selectedCard === c.instanceId;
          const cardData = getCard(c.cardId);

          // Check playability
          const isPlayableNow =
            isMyTurn &&
            state.phase === 'ACTION' &&
            canPlayCard(cardData, me.currentArcana, me.arcana, me.field.length);

          const canPlaceArcana =
            isMyTurn &&
            state.phase === 'ARCANA_PLACEMENT' &&
            !state.flags.hasPlacedArcanaThisTurn;

          // Slight rotation or curve for fan effect if multiple cards
          const rotDeg = Math.max(-8, Math.min(8, (i - (hand.length - 1) / 2) * 2.5));

          return (
            <div
              key={c.instanceId}
              style={{
                zIndex: isSelected ? 60 : 10 + i,
              }}
              className={`relative shrink-0 select-none group transition-all duration-200 ${
                i > 0 ? getOverlapMargin() : ''
              }`}
            >
              {/* Rising Card Container */}
              <div
                style={{
                  transform: isSelected
                    ? 'translateY(-26px) scale(1.18)'
                    : `rotate(${rotDeg}deg) translateY(0px)`,
                  transformOrigin: 'bottom center',
                }}
                className={`transition-all duration-200 ease-out origin-bottom ${
                  isSelected
                    ? 'z-50 shadow-2xl shadow-yellow-400/40'
                    : 'hover:-translate-y-4 hover:scale-110 hover:z-40'
                }`}
              >
                {/* Action Buttons Bubble above Selected Card */}
                {isSelected && (
                  <div
                    className="absolute -top-8 left-1/2 -translate-x-1/2 flex items-center space-x-1 bg-slate-950/95 border border-yellow-400 rounded-full px-2 py-0.5 shadow-2xl z-50 whitespace-nowrap animate-in fade-in zoom-in-90 duration-150"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {/* Action 1: Summon / Play */}
                    {state.phase === 'ACTION' && (
                      <button
                        type="button"
                        disabled={!isPlayableNow}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (onPlayCard) {
                            onPlayCard(c.instanceId);
                          } else {
                            dispatch({ type: 'PLAY_CARD', instanceId: c.instanceId });
                            onSelect('');
                          }
                        }}
                        className={`px-2.5 py-1 rounded-full text-[10px] font-black flex items-center space-x-1 shadow transition-all ${
                          isPlayableNow
                            ? 'bg-gradient-to-r from-amber-500 to-yellow-400 hover:brightness-110 text-slate-950 ring-1 ring-yellow-200 animate-pulse active:scale-95 cursor-pointer'
                            : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'
                        }`}
                      >
                        <Play size={10} className="fill-current" />
                        <span>{cardData.type === 'Spell' ? '発動' : cardData.type === 'Rune' ? '設置' : '召喚'}</span>
                      </button>
                    )}

                    {/* Action 2: Place into Arcana */}
                    {state.phase === 'ARCANA_PLACEMENT' && canPlaceArcana && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (onArcanaPlace) {
                            onArcanaPlace(c.instanceId);
                          } else {
                            dispatch({ type: 'PLACE_ARCANA', instanceId: c.instanceId });
                            onSelect('');
                          }
                        }}
                        className="px-2.5 py-1 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-full text-[10px] font-black flex items-center space-x-1 shadow active:scale-95 ring-1 ring-blue-300 cursor-pointer"
                      >
                        <Zap size={10} className="fill-yellow-300 text-yellow-300" />
                        <span>アルカナへ</span>
                      </button>
                    )}

                    {/* Action 3: Inspect */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onInspect(cardData);
                      }}
                      title="詳細カード情報"
                      className="p-1 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
                    >
                      <Info size={11} />
                    </button>

                    {/* Action 4: Close / Deselect */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelect('');
                      }}
                      className="p-1 rounded-full bg-slate-800 hover:bg-red-950 text-slate-400 hover:text-red-300 transition-colors cursor-pointer"
                    >
                      <X size={11} />
                    </button>
                  </div>
                )}

                {/* Card Element */}
                <CardView
                  instance={c}
                  size="hand"
                  selected={isSelected}
                  playable={isPlayableNow || canPlaceArcana}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelect(isSelected ? '' : c.instanceId);
                  }}
                  onInspect={() => onInspect(cardData)}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

