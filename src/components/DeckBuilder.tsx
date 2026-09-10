import React from 'react';
import { UserDeck } from '../types/deck';
import { DeckManager, STARTER_DECK_FIRE, STARTER_DECK_CONTROL, STORAGE_KEY, ACTIVE_DECK_KEY } from './DeckManager';

export { STARTER_DECK_FIRE, STARTER_DECK_CONTROL, STORAGE_KEY, ACTIVE_DECK_KEY };

interface DeckBuilderProps {
  onBackToBattle: (selectedDeck?: UserDeck) => void;
}

export const DeckBuilder: React.FC<DeckBuilderProps> = ({ onBackToBattle }) => {
  return <DeckManager onBackToBattle={onBackToBattle} />;
};
