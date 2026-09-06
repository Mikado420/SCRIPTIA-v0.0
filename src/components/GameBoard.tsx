import React, { useState } from 'react';
import { GameState, GameAction, PlayerState, UnitState, CardInstance } from '../types';
import { CardView } from './CardView';
import { HandTray } from './HandTray';
import { getCard } from '../data/cards';
import { calculateUnitStats } from '../engine/engineUtils';
import { Shield, Droplet, Flame, Mountain, Sun, Moon, Hexagon, History } from 'lucide-react';

interface Props {
  state: GameState;
  dispatch: React.Dispatch<GameAction>;
  onInspect: (card: any) => void;
}

const SystemIcon: React.FC<{ sys: string }> = ({ sys }) => {
  switch (sys) {
    case 'Fire': return <Flame size={16} className="text-red-500" />;
    case 'Water': return <Droplet size={16} className="text-blue-500" />;
    case 'Earth': return <Mountain size={16} className="text-emerald-500" />;
    case 'Light': return <Sun size={16} className="text-amber-400" />;
    case 'Dark': return <Moon size={16} className="text-purple-500" />;
    default: return <Hexagon size={16} className="text-slate-400" />;
  }
};

export const GameBoard: React.FC<Props> = ({ state, dispatch, onInspect }) => {
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [arcanaMode, setArcanaMode] = useState(false);
  const [showLog, setShowLog] = useState(false);

  const me = state.player1;
  const opp = state.player2;
  const isMyTurn = state.currentPlayer === 'player1';

  const handleCardClick = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    
    // Handle specific prompt target clicks
    if (state.prompt) {
      if (state.prompt.type === 'GUARD' && isMyTurn) {
         // player1 can't respond to player2's guard prompt, wait, player2 is AI or local? 
         // For local 2-player testing, we let the prompt be handled by whoever's prompt it is.
         // Actually, state.prompt.playerId dictates who acts.
         // If it's single player MVP, let's just dispatch based on ID.
      }
    }

    if (!isMyTurn) return; // For MVP, player1 only interaction unless guarding

    if (arcanaMode && state.phase === 'ARCANA_PLACEMENT') {
      dispatch({ type: 'PLACE_ARCANA', instanceId: id });
      setArcanaMode(false);
      setSelectedCardId(null);
      return;
    }

    if (state.phase === 'ACTION') {
      const inHand = me.hand.find(c => c.instanceId === id);
      if (inHand) {
        setSelectedCardId(id === selectedCardId ? null : id);
        return;
      }
      
      const inField = me.field.find(c => c.instanceId === id);
      if (inField) {
        if (selectedCardId) {
          const selHand = me.hand.find(c => c.instanceId === selectedCardId);
          if (selHand && getCard(selHand.cardId).type === 'Evolution') {
             dispatch({ type: 'PLAY_CARD', instanceId: selectedCardId, evolutionTargetId: id });
             setSelectedCardId(null);
             return;
          }
        }
        if (!inField.isRested && !inField.hasSummoningSickness) {
          setSelectedCardId(id === selectedCardId ? null : id);
          return;
        }
      }

      const inOppField = opp.field.find(c => c.instanceId === id);
      if (inOppField && selectedCardId) {
        const selHand = me.hand.find(c => c.instanceId === selectedCardId);
        if (selHand) {
          dispatch({ type: 'PLAY_CARD', instanceId: selectedCardId, targetId: id });
        } else {
          dispatch({ type: 'DECLARE_ATTACK', attackerId: selectedCardId, targetId: id });
        }
        setSelectedCardId(null);
        return;
      }
      
      // Target opponent domain/runes
      const oppRune = opp.runes.find(c => c.instanceId === id);
      if (oppRune && selectedCardId) {
         dispatch({ type: 'PLAY_CARD', instanceId: selectedCardId, targetId: id });
         setSelectedCardId(null);
         return;
      }
      
      if (opp.domain?.instanceId === id && selectedCardId) {
         dispatch({ type: 'PLAY_CARD', instanceId: selectedCardId, targetId: id });
         setSelectedCardId(null);
         return;
      }
    }
  };

  const handleOpponentClick = () => {
    if (isMyTurn && state.phase === 'ACTION' && selectedCardId) {
       const selHand = me.hand.find(c => c.instanceId === selectedCardId);
       if (!selHand) {
         dispatch({ type: 'DECLARE_ATTACK', attackerId: selectedCardId });
         setSelectedCardId(null);
       }
    }
  };

  const handleFieldClick = () => {
    if (isMyTurn && state.phase === 'ACTION' && selectedCardId) {
      const selHand = me.hand.find(c => c.instanceId === selectedCardId);
      if (selHand && selHand.cardId !== 'Evolution') {
         dispatch({ type: 'PLAY_CARD', instanceId: selectedCardId });
         setSelectedCardId(null);
      }
    }
  };
  
  const handlePrompt = (apply: boolean, targetId?: string) => {
    dispatch({ type: 'RESOLVE_TRIGGER', apply, targetId });
  };
  
  const handleGuardPrompt = (guarderId?: string) => {
    dispatch({ type: 'RESOLVE_GUARD', guarderId });
  };

  const renderUnit = (p: PlayerState, u: UnitState) => (
    <div key={u.instanceId} className={`relative transition-transform ${u.isRested ? 'opacity-70 rotate-[-5deg]' : ''}`}>
      <CardView 
        instance={u.cards[0]} 
        computedStats={calculateUnitStats(state, p.id, u)}
        selected={selectedCardId === u.instanceId}
        onClick={(e) => handleCardClick(u.instanceId, e)}
        onContextMenu={(e) => { e.preventDefault(); onInspect(getCard(u.cards[0].cardId)); }}
      />
      {u.cards.length > 1 && (
        <div className="absolute -top-2 -right-2 bg-yellow-500 text-black text-[10px] font-bold px-1 rounded-full shadow border border-black z-20">
          EVO x{u.cards.length - 1}
        </div>
      )}
      {u.hasSummoningSickness && (
        <div className="absolute inset-0 bg-black/40 flex items-center justify-center rounded-md pointer-events-none z-10">
          <span className="text-white text-xs font-bold rotate-[-15deg] opacity-70">Zzz...</span>
        </div>
      )}
      {u.modifiers.length > 0 && (
         <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 flex space-x-1 z-20">
            {u.modifiers.map((m, i) => <div key={i} className={`w-2 h-2 rounded-full ${m.atk > 0 ? 'bg-red-500' : 'bg-blue-500'}`} />)}
         </div>
      )}
    </div>
  );

  return (
    <div className="flex h-full w-full bg-slate-900 text-slate-100 font-sans overflow-hidden">
      {/* Main Board Area */}
      <div className="flex-1 flex flex-col relative" onClick={() => setSelectedCardId(null)}>
        
        {/* Opponent Area */}
        <div className="h-1/3 border-b border-white/10 flex flex-col justify-end p-4 relative" onClick={handleOpponentClick}>
          {/* Opponent Hand (Face down) */}
          <div className="absolute top-2 left-1/2 -translate-x-1/2 flex -space-x-8 scale-75 opacity-80 pointer-events-none">
            {opp.hand.map(c => <CardView key={c.instanceId} isFaceDown />)}
          </div>
          
          <div className="flex justify-between items-end w-full mb-2">
             <div className="flex space-x-2">
                <div className="bg-black/50 p-2 rounded flex flex-col items-center border border-white/10">
                   <span className="text-[10px] text-slate-400 font-bold mb-1">DOMAIN</span>
                   {opp.domain ? <CardView instance={opp.domain} className="scale-75 origin-bottom" onClick={(e) => handleCardClick(opp.domain!.instanceId, e)} onContextMenu={(e)=>{e.preventDefault(); onInspect(getCard(opp.domain!.cardId));}} /> : <div className="w-16 h-24 border border-dashed border-white/20 rounded" />}
                </div>
                <div className="bg-black/50 p-2 rounded flex space-x-2 border border-white/10">
                   <div className="flex flex-col items-center">
                     <span className="text-[10px] text-slate-400 font-bold mb-1">RUNE 1</span>
                     {opp.runes[0] ? <CardView isFaceDown className="scale-75 origin-bottom" onClick={(e) => handleCardClick(opp.runes[0].instanceId, e)} /> : <div className="w-16 h-24 border border-dashed border-white/20 rounded" />}
                   </div>
                   <div className="flex flex-col items-center">
                     <span className="text-[10px] text-slate-400 font-bold mb-1">RUNE 2</span>
                     {opp.runes[1] ? <CardView isFaceDown className="scale-75 origin-bottom" onClick={(e) => handleCardClick(opp.runes[1].instanceId, e)} /> : <div className="w-16 h-24 border border-dashed border-white/20 rounded" />}
                   </div>
                </div>
             </div>
             
             <div className="flex flex-col items-end space-y-2">
                <div className="flex items-center space-x-1 bg-black/50 px-3 py-1.5 rounded-full border border-blue-900/50">
                   <span className="text-xs font-bold text-blue-400 mr-2">ARCANA</span>
                   <span className="font-mono font-bold text-lg">{opp.currentArcana}/{opp.maxArcana}</span>
                   <div className="flex ml-2">
                      {Array.from(new Set(opp.arcana.map(a => getCard(a.cardId).system))).map(sys => <SystemIcon key={sys as string} sys={sys as string} />)}
                   </div>
                </div>
                <div className="flex space-x-1 bg-black/50 px-3 py-1.5 rounded-full border border-yellow-900/50 cursor-pointer">
                   {Array.from({length: 5}).map((_, i) => (
                      <Shield key={i} size={20} className={i < opp.barrier ? 'text-yellow-400 drop-shadow-[0_0_5px_rgba(250,204,21,0.8)]' : 'text-slate-700'} />
                   ))}
                </div>
             </div>
          </div>
          
          {/* Opponent Field */}
          <div className="flex justify-center space-x-4 min-h-[160px] items-center">
            {opp.field.map(u => renderUnit(opp, u))}
            {Array.from({length: Math.max(0, 6 - opp.field.length)}).map((_, i) => (
              <div key={i} className="w-28 h-40 border-2 border-dashed border-white/5 rounded-md" />
            ))}
          </div>
        </div>

        {/* Player Area */}
        <div className="h-2/3 flex flex-col justify-start p-4 relative" onClick={handleFieldClick}>
          {/* Player Field */}
          <div className="flex justify-center space-x-4 min-h-[160px] items-center mb-6">
            {me.field.map(u => renderUnit(me, u))}
            {Array.from({length: Math.max(0, 6 - me.field.length)}).map((_, i) => (
              <div key={i} className="w-28 h-40 border-2 border-dashed border-white/5 rounded-md flex items-center justify-center opacity-50" />
            ))}
          </div>
          
          <div className="flex justify-between items-start w-full">
             <div className="flex flex-col space-y-2">
                <div className="flex space-x-1 bg-black/50 px-3 py-1.5 rounded-full border border-yellow-900/50">
                   {Array.from({length: 5}).map((_, i) => (
                      <Shield key={i} size={20} className={i < me.barrier ? 'text-yellow-400 drop-shadow-[0_0_5px_rgba(250,204,21,0.8)]' : 'text-slate-700'} />
                   ))}
                </div>
                <div className="flex items-center space-x-1 bg-black/50 px-3 py-1.5 rounded-full border border-blue-900/50">
                   <span className="text-xs font-bold text-blue-400 mr-2">ARCANA</span>
                   <span className="font-mono font-bold text-lg">{me.currentArcana}/{me.maxArcana}</span>
                   <div className="flex ml-2">
                      {Array.from(new Set(me.arcana.map(a => getCard(a.cardId).system))).map(sys => <SystemIcon key={sys as string} sys={sys as string} />)}
                   </div>
                </div>
             </div>
             
             <div className="flex space-x-2">
                <div className="bg-black/50 p-2 rounded flex space-x-2 border border-white/10">
                   <div className="flex flex-col items-center">
                     <span className="text-[10px] text-slate-400 font-bold mb-1">RUNE 1</span>
                     {me.runes[0] ? <CardView isFaceDown className="scale-75 origin-top" onContextMenu={(e)=>{e.preventDefault(); onInspect(getCard(me.runes[0].cardId));}} /> : <div className="w-16 h-24 border border-dashed border-white/20 rounded" />}
                   </div>
                   <div className="flex flex-col items-center">
                     <span className="text-[10px] text-slate-400 font-bold mb-1">RUNE 2</span>
                     {me.runes[1] ? <CardView isFaceDown className="scale-75 origin-top" onContextMenu={(e)=>{e.preventDefault(); onInspect(getCard(me.runes[1].cardId));}} /> : <div className="w-16 h-24 border border-dashed border-white/20 rounded" />}
                   </div>
                </div>
                <div className="bg-black/50 p-2 rounded flex flex-col items-center border border-white/10">
                   <span className="text-[10px] text-slate-400 font-bold mb-1">DOMAIN</span>
                   {me.domain ? <CardView instance={me.domain} className="scale-75 origin-top" onContextMenu={(e)=>{e.preventDefault(); onInspect(getCard(me.domain!.cardId));}} /> : <div className="w-16 h-24 border border-dashed border-white/20 rounded" />}
                </div>
             </div>
          </div>
          
          <HandTray 
            hand={me.hand} 
            state={state} 
            dispatch={dispatch} 
            selectedCard={selectedCardId} 
            onSelect={(id) => handleCardClick(id, { stopPropagation: () => {} } as any)} 
            onInspect={onInspect}
          />
        </div>
      </div>

      {/* Right Sidebar */}
      <div className="w-[280px] bg-slate-950 border-l border-white/10 flex flex-col z-30 shadow-[-10px_0_30px_rgba(0,0,0,0.5)]">
        <div className="p-4 border-b border-white/10 text-center">
          <div className="text-xs text-slate-400 font-bold tracking-widest mb-1">TURN {state.turnCount}</div>
          <div className={`text-xl font-black ${isMyTurn ? 'text-yellow-400' : 'text-slate-500'}`}>
            {isMyTurn ? 'YOUR TURN' : 'ENEMY TURN'}
          </div>
          
          <div className="mt-4 flex flex-col space-y-1">
             {['ARCANA_PLACEMENT', 'ACTION'].map(ph => (
                <div key={ph} className={`text-xs py-1 rounded font-bold tracking-wider ${state.phase === ph && isMyTurn ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-600'}`}>
                   {ph === 'ARCANA_PLACEMENT' ? 'アルカナ配置' : 'メイン行動'}
                </div>
             ))}
          </div>
        </div>

        <div className="flex-1 p-4 flex flex-col justify-end space-y-4">
          <button 
             onClick={() => setArcanaMode(!arcanaMode)}
             disabled={!isMyTurn || state.phase !== 'ARCANA_PLACEMENT' || state.flags.hasPlacedArcanaThisTurn}
             className={`w-full py-3 rounded font-bold transition-all shadow-lg text-sm
               ${arcanaMode ? 'bg-blue-500 text-white ring-2 ring-white' : 
                 (isMyTurn && state.phase === 'ARCANA_PLACEMENT' && !state.flags.hasPlacedArcanaThisTurn) ? 'bg-slate-800 text-blue-400 hover:bg-slate-700' : 'bg-slate-900 text-slate-600 cursor-not-allowed'}
             `}
          >
             {arcanaMode ? '配置するカードを選択...' : 'アルカナ配置 (1/1)'}
          </button>
          
          <button 
             onClick={() => { dispatch({ type: 'NEXT_PHASE' }); setArcanaMode(false); setSelectedCardId(null); }}
             disabled={!isMyTurn || !!state.prompt}
             className={`w-full py-6 rounded-lg font-black tracking-widest transition-all shadow-lg text-lg
               ${isMyTurn && !state.prompt ? 'bg-gradient-to-b from-yellow-500 to-amber-600 text-slate-950 hover:from-yellow-400 hover:to-amber-500 hover:shadow-[0_0_20px_rgba(250,204,21,0.5)]' : 'bg-slate-800 text-slate-600 cursor-not-allowed'}
             `}
          >
             {state.phase === 'ARCANA_PLACEMENT' ? '行動フェーズへ' : 'ターン終了'}
          </button>
        </div>

        <div className="h-1/3 border-t border-white/10 flex flex-col bg-black/30">
          <div className="px-4 py-2 border-b border-white/5 flex justify-between items-center text-xs text-slate-400 font-bold">
            <span className="flex items-center"><History size={14} className="mr-1"/> LOG</span>
          </div>
          <div className="flex-1 overflow-y-auto p-3 text-[11px] font-medium text-slate-400 space-y-2 flex flex-col-reverse">
            {[...state.log].reverse().map((msg, i) => (
              <div key={i} className="leading-snug">{msg}</div>
            ))}
          </div>
        </div>
      </div>

      {/* Prompts Overlay */}
      {state.prompt && (
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="bg-slate-900 border border-slate-600 rounded-xl p-6 shadow-[0_0_50px_rgba(0,0,0,0.8)] max-w-md w-full text-center">
            <h2 className="text-xl font-black text-white mb-4 animate-pulse text-yellow-400">
               {state.prompt.type === 'GUARD' ? '◆ 相手の直接攻撃 ◆' : '◆ 効果発動 ◆'}
            </h2>
            <p className="text-slate-300 mb-6 font-medium leading-relaxed">
               {state.prompt.message || (state.prompt.type === 'GUARD' ? '守護ユニットで攻撃を防ぎますか？' : '効果を解決しますか？')}
            </p>
            
            {state.prompt.type === 'GUARD' && state.prompt.playerId === 'player1' && (
              <div className="flex flex-col space-y-3">
                 <div className="flex justify-center space-x-2">
                   {me.field.filter(u => !u.isRested && getCard(u.cards[0].cardId).keywords?.includes('Guard')).map(u => (
                      <button 
                        key={u.instanceId}
                        onClick={() => handleGuardPrompt(u.instanceId)}
                        className="bg-blue-900 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded shadow"
                      >
                         【{getCard(u.cards[0].cardId).name}】で守護
                      </button>
                   ))}
                 </div>
                 <button onClick={() => handleGuardPrompt()} className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold py-2 px-4 rounded">
                   守護しない (結界/プレイヤーへのダメージを許容)
                 </button>
              </div>
            )}
            
            {/* Auto-resolve prompts if it's opponent's turn in a local test */}
            {state.prompt.playerId === 'player2' && (
              <div className="flex justify-center space-x-4 mt-4">
                 <button onClick={() => {
                   if (state.prompt?.type === 'GUARD') handleGuardPrompt();
                   else handlePrompt(false);
                 }} className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold py-2 px-6 rounded shadow">
                   [P2] スキップ
                 </button>
                 {state.prompt.type !== 'GUARD' && (
                    <button onClick={() => handlePrompt(true)} className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 px-6 rounded shadow">
                      [P2] 発動する
                    </button>
                 )}
                 {state.prompt.type === 'GUARD' && opp.field.some(u => !u.isRested && getCard(u.cards[0].cardId).keywords?.includes('Guard')) && (
                    <button onClick={() => {
                       const g = opp.field.find(u => !u.isRested && getCard(u.cards[0].cardId).keywords?.includes('Guard'));
                       handleGuardPrompt(g!.instanceId);
                    }} className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 px-6 rounded shadow">
                      [P2] 守護
                    </button>
                 )}
              </div>
            )}

            {(state.prompt.type === 'TRIGGER' || state.prompt.type === 'RUNE_TRIGGER') && state.prompt.playerId === 'player1' && (
              <div className="flex justify-center space-x-4">
                 <button onClick={() => handlePrompt(true)} className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 px-6 rounded shadow shadow-blue-900/50">
                   発動する
                 </button>
                 <button onClick={() => handlePrompt(false)} className="bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold py-2 px-6 rounded">
                   キャンセル
                 </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Game Over Screen */}
      {state.winner && (
        <div className="absolute inset-0 bg-black/90 z-[100] flex flex-col items-center justify-center">
          <h1 className="text-6xl font-black text-transparent bg-clip-text bg-gradient-to-b from-yellow-300 to-yellow-600 mb-8 drop-shadow-[0_0_30px_rgba(250,204,21,0.5)]">
            {state.winner === 'player1' ? 'VICTORY' : 'DEFEAT'}
          </h1>
          <button 
            onClick={() => dispatch({ type: 'START_GAME' })}
            className="bg-slate-800 hover:bg-slate-700 text-white font-bold py-3 px-8 rounded-full shadow-lg border border-slate-600"
          >
            もう一度プレイする
          </button>
        </div>
      )}
    </div>
  );
};
