import React, { useReducer } from 'react';
import { gameReducer, createInitialState } from './engine/engine';
import { Board } from './components/Board';

export default function App() {
  const [state, dispatch] = useReducer(gameReducer, undefined, createInitialState);

  return (
    <div className="min-h-screen bg-black">
      <Board state={state} dispatch={dispatch} />
    </div>
  );
}
