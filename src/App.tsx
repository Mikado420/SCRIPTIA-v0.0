import React, { useReducer, useState } from 'react';
import { GameBoard } from './components/GameBoard';
import { LandscapeContainer } from './components/LandscapeContainer';
import { CardDetailModal } from './components/CardDetailModal';
import { gameReducer, createInitialState } from './engine/gameEngine';
import { useAIEngine } from './engine/aiEngine';
import { CardTemplate } from './types';

function App() {
  const [gameState, dispatch] = useReducer(gameReducer, null, createInitialState);
  const [inspectCard, setInspectCard] = useState<CardTemplate | null>(null);

  // Activate automated AI turn sequencer
  useAIEngine(gameState, dispatch);

  return (
    <LandscapeContainer>
      <GameBoard 
        state={gameState} 
        dispatch={dispatch} 
        onInspect={(card) => setInspectCard(card)} 
      />
      {inspectCard && (
        <CardDetailModal 
          card={inspectCard} 
          onClose={() => setInspectCard(null)} 
        />
      )}
    </LandscapeContainer>
  );
}

export default App;
