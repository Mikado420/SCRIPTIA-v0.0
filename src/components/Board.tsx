import React from 'react';
import { CardView } from './CardView';
import { UnitState, PlayerState, GameState, GameAction, Prompt } from '../types';
import { getCard } from '../data/cards';
import { Shield, Zap, CircleDashed } from 'lucide-react';

interface BoardProps {
  state: GameState;
  dispatch: React.Dispatch<GameAction>;
}

export const Board: React.FC<BoardProps> = ({ state, dispatch }) => {
  const [selectedHandCard, setSelectedHandCard] = React.useState<string | null>(null);
  const [selectedAttacker, setSelectedAttacker] = React.useState<string | null>(null);

  const handleHandCardClick = (playerId: string, instanceId: string) => {
    if (state.currentPlayer !== playerId || state.prompt) return;
    const card = state[state.currentPlayer].hand.find(c => c.instanceId === instanceId);
    if (!card) return;
    const tpl = getCard(card.cardId);

    if (state.phase === 'ARCANA_PLACEMENT') {
      dispatch({ type: 'PLACE_ARCANA', instanceId });
      setSelectedHandCard(null);
    } else if (state.phase === 'ACTION') {
      if (tpl.requiresTarget) {
        setSelectedHandCard(selectedHandCard === instanceId ? null : instanceId);
      } else if (tpl.type === 'Evolution') {
        setSelectedHandCard(selectedHandCard === instanceId ? null : instanceId);
      } else {
        dispatch({ type: 'PLAY_CARD', instanceId });
        setSelectedHandCard(null);
      }
    }
  };

  const handleUnitClick = (ownerId: string, unit: UnitState) => {
    if (state.prompt) {
      if (state.prompt.type === 'GUARD' && state.prompt.playerId === ownerId) {
        // Only allow clicking own active units with Guard
        const tpl = getCard(unit.cards[0].cardId);
        if (!unit.isRested && tpl.keywords?.includes('Guard')) {
          dispatch({ type: 'RESOLVE_GUARD', guarderId: unit.instanceId });
        }
      }
      return;
    }

    if (state.phase === 'ACTION' && state.currentPlayer === 'player1') {
      if (ownerId === 'player1') {
        if (selectedHandCard) {
          // Play evolution or target own unit
          const hCard = state.player1.hand.find(c => c.instanceId === selectedHandCard);
          if (hCard && getCard(hCard.cardId).type === 'Evolution') {
             dispatch({ type: 'PLAY_CARD', instanceId: selectedHandCard, evolutionTargetId: unit.instanceId });
             setSelectedHandCard(null);
          } else {
             dispatch({ type: 'PLAY_CARD', instanceId: selectedHandCard, targetId: unit.instanceId });
             setSelectedHandCard(null);
          }
          return;
        }

        // Select to attack
        if (!unit.isRested && !unit.hasSummoningSickness) {
          setSelectedAttacker(selectedAttacker === unit.instanceId ? null : unit.instanceId);
        }
      } else if (ownerId === 'player2') {
        if (selectedHandCard) {
           // Play spell targeting enemy
           dispatch({ type: 'PLAY_CARD', instanceId: selectedHandCard, targetId: unit.instanceId });
           setSelectedHandCard(null);
        } else if (selectedAttacker) {
           // Attack enemy unit (only active if allowed, normally only rested)
           const attackerTpl = getCard(state.player1.field.find(u => u.instanceId === selectedAttacker)!.cards[0].cardId);
           if (unit.isRested || attackerTpl.effectText?.includes('Can attack active')) {
             dispatch({ type: 'DECLARE_ATTACK', attackerId: selectedAttacker, targetId: unit.instanceId });
             setSelectedAttacker(null);
           }
        }
      }
    }
  };

  const handlePlayerAvatarClick = (playerId: string) => {
    if (state.phase === 'ACTION' && state.currentPlayer === 'player1' && selectedAttacker && playerId === 'player2') {
      dispatch({ type: 'DECLARE_ATTACK', attackerId: selectedAttacker });
      setSelectedAttacker(null);
    }
  };

  const renderPlayerArea = (p: PlayerState, isOpponent: boolean) => (
    <div className={`flex-1 flex flex-col ${isOpponent ? 'flex-col-reverse justify-end' : 'justify-end'} p-4 gap-4`}>
      {/* Hand & Arcana Row */}
      <div className={`flex justify-between items-end ${isOpponent ? 'flex-row-reverse' : ''}`}>
         {/* Arcana */}
         <div className="flex flex-col items-center gap-1 w-32 shrink-0">
           <div className="text-sm font-bold text-purple-300 flex items-center gap-1">
             <Zap size={16}/> {p.currentArcana} / {p.maxArcana}
           </div>
           <div className="relative w-full h-32 bg-slate-800/50 rounded-lg border border-slate-700 flex overflow-hidden p-1">
             {p.arcana.map((c, i) => (
                <div key={i} className="absolute left-0" style={{ transform: `translateX(${i * 8}px)` }}>
                  <CardView instance={c} className="scale-75 origin-top-left" />
                </div>
             ))}
           </div>
         </div>

         {/* Hand */}
         <div className="flex-1 flex justify-center items-center h-40">
           <div className="flex -space-x-8">
             {p.hand.map(c => (
               <CardView 
                 key={c.instanceId} 
                 instance={c} 
                 isFaceDown={isOpponent && !state.winner} 
                 selected={selectedHandCard === c.instanceId}
                 playable={state.currentPlayer === p.id && (state.phase === 'ARCANA_PLACEMENT' || state.phase === 'ACTION')}
                 onClick={() => handleHandCardClick(p.id, c.instanceId)}
                 className="hover:-translate-y-4 transition-transform z-0 hover:z-10"
               />
             ))}
           </div>
         </div>

         {/* Runes & Domain & Deck Info */}
         <div className="flex gap-2 w-48 shrink-0">
            <div className="flex flex-col gap-1 flex-1">
              <div className="text-xs text-slate-400 text-center">Runes</div>
              <div className="flex gap-1 h-24">
                {[0,1].map(i => (
                   <div key={i} className="flex-1 border border-dashed border-slate-600 rounded bg-slate-800/30 flex items-center justify-center">
                     {p.runes[i] ? <CardView instance={p.runes[i]} isFaceDown className="scale-50" /> : null}
                   </div>
                ))}
              </div>
            </div>
            <div className="flex flex-col gap-1 w-20">
              <div className="text-xs text-slate-400 text-center">Domain</div>
              <div className="h-24 border border-dashed border-slate-600 rounded bg-slate-800/30 flex items-center justify-center">
                {p.domain ? <CardView instance={p.domain} className="scale-50" /> : null}
              </div>
            </div>
         </div>
      </div>

      {/* Field & Avatar Row */}
      <div className={`flex gap-4 items-center ${isOpponent ? 'flex-row-reverse' : ''}`}>
         {/* Avatar & Barrier */}
         <div 
           className={`w-32 h-32 rounded-xl border-4 flex flex-col items-center justify-center cursor-pointer transition-colors
             ${selectedAttacker && !isOpponent ? 'border-yellow-400 bg-yellow-900/30 animate-pulse' : 'border-slate-700 bg-slate-800'}
           `}
           onClick={() => handlePlayerAvatarClick(p.id)}
         >
           <Shield size={32} className={p.barrier > 0 ? 'text-blue-400' : 'text-red-500'} />
           <div className="text-3xl font-black mt-2">{p.barrier}</div>
           <div className="text-xs text-slate-400">Barrier</div>
         </div>

         {/* Field */}
         <div className="flex-1 flex justify-center gap-2 h-44 bg-slate-900/50 rounded-xl p-2 border border-slate-800">
            {[0,1,2,3,4,5].map(i => {
               const u = p.field[i];
               return (
                 <div key={i} className="w-28 h-40 border-2 border-dashed border-slate-700 rounded-md relative flex items-center justify-center">
                   {u ? (
                     <div 
                       className={`transition-all ${u.isRested ? 'rotate-90 scale-90' : ''}`}
                       onClick={() => handleUnitClick(p.id, u)}
                     >
                       <CardView 
                         instance={u.cards[0]} 
                         selected={selectedAttacker === u.instanceId}
                         className={`
                           ${u.hasSummoningSickness ? 'opacity-80 grayscale-[30%]' : ''}
                           ${state.prompt?.type === 'GUARD' && state.prompt.playerId === p.id && !u.isRested && getCard(u.cards[0].cardId).keywords?.includes('Guard') ? 'ring-4 ring-green-500 cursor-pointer animate-pulse' : ''}
                         `}
                       />
                       {u.cards.length > 1 && (
                         <div className="absolute -bottom-2 -right-2 bg-yellow-600 text-xs px-1 rounded font-bold border border-black z-20">+{u.cards.length - 1}</div>
                       )}
                     </div>
                   ) : <CircleDashed className="text-slate-700 opacity-30" size={32} />}
                 </div>
               )
            })}
         </div>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen bg-slate-950 text-slate-200 font-sans select-none">
      <div className="flex-1 flex flex-col relative overflow-hidden">
        {/* Opponent Top */}
        {renderPlayerArea(state.player2, true)}
        
        {/* Center Divider / HUD */}
        <div className="h-12 bg-slate-900 border-y border-slate-700 flex items-center justify-between px-8 shadow-xl z-20 relative">
          <div className="flex gap-4">
            <div className="text-xl font-black tracking-widest text-slate-400">SCRIPTIA</div>
            <div className="text-sm font-bold bg-slate-800 px-3 py-1 rounded text-yellow-400">TURN {state.turnCount}</div>
          </div>
          
          <div className="flex gap-4 items-center">
            <div className="text-lg font-bold text-white">
              {state.currentPlayer === 'player1' ? 'YOUR TURN' : 'OPPONENT TURN'} - {state.phase}
            </div>
            {state.currentPlayer === 'player1' && state.phase !== 'ACTION' && (
              <button 
                onClick={() => dispatch({type:'NEXT_PHASE'})}
                className="px-4 py-1 bg-blue-600 hover:bg-blue-500 rounded font-bold transition-colors"
              >
                {state.phase === 'ARCANA_PLACEMENT' ? 'Skip to Action' : 'Next Phase'}
              </button>
            )}
            {state.currentPlayer === 'player1' && state.phase === 'ACTION' && (
              <button 
                onClick={() => dispatch({type:'NEXT_PHASE'})}
                className="px-4 py-1 bg-red-600 hover:bg-red-500 rounded font-bold transition-colors"
              >
                End Turn
              </button>
            )}
          </div>
        </div>

        {/* Prompt Overlay */}
        {state.prompt && (
          <div className="absolute inset-0 bg-black/60 z-30 flex items-center justify-center pointer-events-none">
            <div className="bg-slate-800 border-2 border-yellow-500 p-6 rounded-xl shadow-2xl pointer-events-auto flex flex-col items-center">
              <h2 className="text-2xl font-bold mb-4 text-yellow-400">
                {state.prompt.type === 'GUARD' ? 'Opponent is attacking!' : 'Select Target'}
              </h2>
              {state.prompt.type === 'GUARD' && (
                <div className="flex flex-col items-center gap-4">
                  <p>Select a valid active Guard unit on the field, or take the hit.</p>
                  <button 
                    className="px-6 py-2 bg-red-600 hover:bg-red-500 font-bold rounded"
                    onClick={() => dispatch({ type: 'RESOLVE_GUARD' })}
                  >
                    Skip Guard (Take Hit)
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {state.winner && (
          <div className="absolute inset-0 bg-black/80 z-50 flex items-center justify-center">
            <div className="text-6xl font-black text-yellow-400 drop-shadow-[0_0_15px_rgba(250,204,21,0.8)]">
              {state.winner === 'player1' ? 'YOU WIN!' : 'OPPONENT WINS!'}
            </div>
          </div>
        )}

        {/* Player Bottom */}
        {renderPlayerArea(state.player1, false)}
      </div>

      {/* Right Sidebar Log */}
      <div className="w-80 bg-slate-900 border-l border-slate-800 flex flex-col shrink-0">
        <div className="p-4 border-b border-slate-800 font-bold bg-slate-800/50">Action Log</div>
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-2 text-sm font-mono text-slate-300">
          {state.log.map((entry, i) => (
            <div key={i} className="border-b border-slate-800/50 pb-1">{entry}</div>
          ))}
          <div className="h-4" /> {/* Spacer */}
        </div>
      </div>
    </div>
  );
};
