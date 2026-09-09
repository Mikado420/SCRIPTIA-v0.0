export interface DeckCardEntry {
  cardId: string;
  count: number;
}

export interface UserDeck {
  id: string;
  name: string;
  cards: DeckCardEntry[]; // cardIdと枚数のペア
  createdAt: number;
  updatedAt: number;
}
