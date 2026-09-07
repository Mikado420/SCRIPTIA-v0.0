import React, { useReducer } from 'react';
import { GameBoard } from './components/GameBoard';
import { LandscapeContainer } from './components/LandscapeContainer';
import { gameReducer, createInitialState } from './engine/gameEngine';

function App() {
  const [gameState, dispatch] = useReducer(gameReducer, null, createInitialState);

  return (
    <LandscapeContainer>
      <GameBoard 
        state={gameState} 
        dispatch={dispatch} 
        onInspect={() => {}} 
      />
    </LandscapeContainer>
  );
}

export default App;
