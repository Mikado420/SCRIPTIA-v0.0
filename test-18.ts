import { createInitialState } from './src/engine/gameEngine';
import { ScriptiaAIEngine } from './src/engine/aiEngine';

const state = createInitialState();
state.currentPlayer = 'player2';
state.opponent = state.player2;
state.player = state.player1;
state.player2.arcana = [
  { instanceId: 'a1', cardId: 'BR-01' },
  { instanceId: 'a2', cardId: 'BR-01' },
];
state.player2.hand = [
  { instanceId: 'h1', cardId: 'BR-01' }, // cost 2
  { instanceId: 'h2', cardId: 'BR-02' }, // cost 2
  { instanceId: 'h3', cardId: 'BR-03' }, // cost 2
];

const plan = ScriptiaAIEngine.planBestTurn(state);
console.log(JSON.stringify(plan, null, 2));
