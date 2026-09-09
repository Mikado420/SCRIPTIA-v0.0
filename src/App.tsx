import React, { useState, useReducer, useEffect, useCallback } from 'react';
import { GameBoard } from './components/GameBoard';
import { LandscapeContainer } from './components/LandscapeContainer';
import { DeckManager } from './components/DeckManager';
import { STARTER_DECK_FIRE, STORAGE_KEY, ACTIVE_DECK_KEY } from './components/DeckManager';
import { gameReducer, createInitialState } from './engine/gameEngine';
import { UserDeck } from './types/deck';

type ViewMode = 'BATTLE' | 'DECK_BUILDER';

// DeckCardEntry[] から 40枚の cardId 配列をフラットに展開する
const expandDeckToCardIds = (deck: UserDeck): string[] => {
  const list: string[] = [];
  deck.cards.forEach(entry => {
    for (let i = 0; i < entry.count; i++) {
      list.push(entry.cardId);
    }
  });
  return list;
};

function App() {
  const [currentView, setCurrentView] = useState<ViewMode>('BATTLE');

  // アクティブデッキの取得
  const getInitialDeck = (): UserDeck => {
    try {
      const savedDecksJson = localStorage.getItem(STORAGE_KEY);
      const activeId = localStorage.getItem(ACTIVE_DECK_KEY);
      if (savedDecksJson) {
        const parsed: UserDeck[] = JSON.parse(savedDecksJson);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const found = parsed.find(d => d.id === activeId);
          if (found && found.cards.reduce((s, c) => s + c.count, 0) === 40) {
            return found;
          }
          const validDeck = parsed.find(d => d.cards.reduce((s, c) => s + c.count, 0) === 40);
          if (validDeck) return validDeck;
        }
      }
    } catch {
      // ignore
    }
    return STARTER_DECK_FIRE;
  };

  const [activeDeck, setActiveDeck] = useState<UserDeck>(getInitialDeck);

  // 初回ゲーム初期化
  const [gameState, dispatch] = useReducer(
    gameReducer,
    null,
    () => {
      const deck = getInitialDeck();
      const ids = expandDeckToCardIds(deck);
      return createInitialState(ids.length === 40 ? ids : undefined);
    }
  );

  // デッキ変更を伴うバトル開始
  const handleStartBattle = useCallback((newDeck?: UserDeck) => {
    const deckToUse = newDeck || activeDeck;
    const cardIds = expandDeckToCardIds(deckToUse);

    if (cardIds.length === 40) {
      setActiveDeck(deckToUse);
      localStorage.setItem(ACTIVE_DECK_KEY, deckToUse.id);
      dispatch({
        type: 'START_GAME',
        p1CardIds: cardIds,
      });
    }
    setCurrentView('BATTLE');
  }, [activeDeck]);

  return (
    <LandscapeContainer>
      {currentView === 'BATTLE' ? (
        <GameBoard
          state={gameState}
          dispatch={dispatch}
          onInspect={() => {}}
          onOpenDeckBuilder={() => setCurrentView('DECK_BUILDER')}
        />
      ) : (
        <DeckManager
          onBackToBattle={handleStartBattle}
        />
      )}
    </LandscapeContainer>
  );
}

export default App;
