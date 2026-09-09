import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardTemplate } from '../types';
import { CARDS } from '../data/cards';
import { FloatingCardPreview } from './FloatingCardPreview';

export interface UserDeck {
  id: string;
  name: string;
  keyCardId: string;
  cards: { cardId: string; count: number }[];
  updatedAt: number;
}

export const STORAGE_KEY = 'scriptia_user_decks_v2';
export const ACTIVE_DECK_KEY = 'scriptia_active_deck_id';

export const STARTER_DECK_FIRE: UserDeck = {
  id: 'deck_fire_basic',
  name: '火系統ベーシックデッキ',
  keyCardId: 'BR-10',
  cards: [
    { cardId: 'BR-01', count: 4 }, { cardId: 'BR-02', count: 4 },
    { cardId: 'BR-03', count: 4 }, { cardId: 'BR-04', count: 4 },
    { cardId: 'BR-05', count: 4 }, { cardId: 'BR-07', count: 4 },
    { cardId: 'BR-08', count: 4 }, { cardId: 'BR-10', count: 4 },
    { cardId: 'BR-11', count: 4 }, { cardId: 'BR-12', count: 4 },
  ],
  updatedAt: Date.now(),
};

export const STARTER_DECK_WATER: UserDeck = {
  id: 'deck_water_basic',
  name: '水系統ベーシックデッキ',
  keyCardId: 'BB-11',
  cards: [
    { cardId: 'BB-01', count: 4 }, { cardId: 'BB-02', count: 4 },
    { cardId: 'BB-04', count: 4 }, { cardId: 'BB-05', count: 4 },
    { cardId: 'BB-07', count: 4 }, { cardId: 'BB-09', count: 4 },
    { cardId: 'BB-10', count: 4 }, { cardId: 'BB-11', count: 4 },
    { cardId: 'BB-12', count: 4 }, { cardId: 'BB-13', count: 4 },
  ],
  updatedAt: Date.now(),
};

export const STARTER_DECK_LIGHT: UserDeck = {
  id: 'deck_light_basic',
  name: '光系統ベーシックデッキ',
  keyCardId: 'BW-11',
  cards: [
    { cardId: 'BW-01', count: 4 }, { cardId: 'BW-02', count: 4 },
    { cardId: 'BW-03', count: 4 }, { cardId: 'BW-04', count: 4 },
    { cardId: 'BW-05', count: 4 }, { cardId: 'BW-07', count: 4 },
    { cardId: 'BW-09', count: 4 }, { cardId: 'BW-10', count: 4 },
    { cardId: 'BW-11', count: 4 }, { cardId: 'BW-12', count: 4 },
  ],
  updatedAt: Date.now(),
};

export const STARTER_DECK_CONTROL = STARTER_DECK_WATER;

export const PRESET_DECKS: UserDeck[] = [
  STARTER_DECK_FIRE,
  STARTER_DECK_WATER,
  STARTER_DECK_LIGHT,
];

export const DeckManager: React.FC<{ onBackToBattle: (deck: UserDeck) => void }> = ({ onBackToBattle }) => {
  const [viewMode, setViewMode] = useState<'LIST' | 'EDIT'>('LIST');
  const [decks, setDecks] = useState<UserDeck[]>([]);
  const [selectedDeckId, setSelectedDeckId] = useState<string>('');
  const [editingDeck, setEditingDeck] = useState<UserDeck | null>(null);

  // 編集用ステート
  const [selectedElement, setSelectedElement] = useState<string>('ALL');
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<string>('ALL');
  const [showTypeDropdown, setShowTypeDropdown] = useState<boolean>(false);
  const [searchText, setSearchText] = useState<string>('');
  const [previewCard, setPreviewCard] = useState<Card | null>(null);
  const [showSuggestModal, setShowSuggestModal] = useState<boolean>(false);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed: UserDeck[] = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setDecks(parsed);
          setSelectedDeckId(parsed[0]?.id || PRESET_DECKS[0].id);
          return;
        }
      } catch (e) {
        console.error('Failed to parse saved decks', e);
      }
    }
    setDecks(PRESET_DECKS);
    setSelectedDeckId(PRESET_DECKS[0].id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(PRESET_DECKS));
  }, []);

  const currentSelectedDeck = decks.find(d => d.id === selectedDeckId) || decks[0] || PRESET_DECKS[0];

  const calculateDeckStats = (deck: UserDeck) => {
    const totalCount = deck.cards.reduce((sum, c) => sum + c.count, 0);
    const costCurve = [0, 0, 0, 0, 0, 0, 0, 0];
    const elementCounts: Record<string, number> = { Light: 0, Water: 0, Dark: 0, Fire: 0, Earth: 0, Neutral: 0 };
    let unitCount = 0, spellCount = 0, runeCount = 0, domainCount = 0;

    deck.cards.forEach(entry => {
      const card = CARDS.find(c => c.id === entry.cardId);
      if (!card) return;

      const idx = card.cost >= 8 ? 7 : Math.max(0, card.cost - 1);
      costCurve[idx] += entry.count;

      const el = card.element === '火' ? 'Fire' : card.element === '水' ? 'Water' : card.element === '地' ? 'Earth' : card.element === '光' ? 'Light' : card.element === '闇' ? 'Dark' : 'Neutral';
      elementCounts[el] = (elementCounts[el] || 0) + entry.count;

      if (card.cardType === 'UNIT' || card.cardType === 'EVOLUTION') unitCount += entry.count;
      else if (card.cardType === 'SPELL') spellCount += entry.count;
      else if (card.cardType === 'RUNE') runeCount += entry.count;
      else if (card.cardType === 'DOMAIN') domainCount += entry.count;
    });

    const keyCard = CARDS.find(c => c.id === deck.keyCardId) || CARDS.find(c => c.id === deck.cards[0]?.cardId);
    return { totalCount, costCurve, elementCounts, unitCount, spellCount, runeCount, domainCount, keyCard };
  };

  const listStats = useMemo(() => calculateDeckStats(currentSelectedDeck), [currentSelectedDeck]);
  const editStats = useMemo(() => editingDeck ? calculateDeckStats(editingDeck) : listStats, [editingDeck, listStats]);

  const handleCreateNewDeck = () => {
    const newDeck: UserDeck = {
      id: 'deck_' + Date.now(),
      name: `新規デッキ ${decks.length + 1}`,
      keyCardId: 'BR-01',
      cards: [],
      updatedAt: Date.now(),
    };
    setEditingDeck(newDeck);
    setViewMode('EDIT');
  };

  const handleStartEdit = () => {
    setEditingDeck(JSON.parse(JSON.stringify(currentSelectedDeck)));
    setViewMode('EDIT');
  };

  const handleDeleteDeck = (deckId: string) => {
    if (decks.length <= 1) {
      alert("最後の1つのデッキは削除できません。");
      return;
    }
    if (!confirm("このデッキを削除してもよろしいですか？")) return;
    const updated = decks.filter(d => d.id !== deckId);
    setDecks(updated);
    setSelectedDeckId(updated[0].id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  };

  const handleSaveDeck = () => {
    if (!editingDeck) return;
    const exists = decks.some(d => d.id === editingDeck.id);
    const updated = exists ? decks.map(d => d.id === editingDeck.id ? editingDeck : d) : [...decks, editingDeck];
    setDecks(updated);
    setSelectedDeckId(editingDeck.id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    localStorage.setItem(ACTIVE_DECK_KEY, editingDeck.id);
    setViewMode('LIST');
  };

  const handleSetKeyCard = (cardId: string) => {
    if (!editingDeck) return;
    setEditingDeck({ ...editingDeck, keyCardId: cardId });
  };

  const filteredPool = useMemo(() => {
    return CARDS.filter(card => {
      if (selectedElement !== 'ALL') {
        const elNorm = card.element === '火' ? 'Fire' : card.element === '水' ? 'Water' : card.element === '地' ? 'Earth' : card.element === '光' ? 'Light' : card.element === '闇' ? 'Dark' : 'Neutral';
        if (elNorm !== selectedElement) return false;
      }
      if (selectedTypeFilter !== 'ALL') {
        if (selectedTypeFilter === 'UNIT' && card.cardType !== 'UNIT') return false;
        if (selectedTypeFilter === 'EVOLUTION' && card.cardType !== 'EVOLUTION') return false;
        if (selectedTypeFilter === 'SPELL' && card.cardType !== 'SPELL') return false;
        if (selectedTypeFilter === 'RUNE' && card.cardType !== 'RUNE') return false;
        if (selectedTypeFilter === 'DOMAIN' && card.cardType !== 'DOMAIN') return false;
      }
      if (searchText.trim()) {
        const q = searchText.toLowerCase();
        return card.name.toLowerCase().includes(q) || (card.effectText || '').toLowerCase().includes(q);
      }
      return true;
    });
  }, [selectedElement, selectedTypeFilter, searchText]);

  const suggestedCards = useMemo(() => {
    if (!editingDeck) return [];
    const dominantEl = (Object.entries(editStats.elementCounts) as [string, number][])
      .sort((a, b) => (b[1] || 0) - (a[1] || 0))[0]?.[0] || 'Fire';
    return CARDS.filter(c => {
      const elNorm = c.element === '火' ? 'Fire' : c.element === '水' ? 'Water' : c.element === '地' ? 'Earth' : c.element === '光' ? 'Light' : c.element === '闇' ? 'Dark' : 'Neutral';
      const inDeckCount = editingDeck.cards.find(entry => entry.cardId === c.id)?.count || 0;
      return (elNorm === dominantEl || elNorm === 'Neutral') && inDeckCount < 4;
    }).slice(0, 8);
  }, [editingDeck, editStats]);

  const handleAddCardToEdit = (card: CardTemplate) => {
    if (!editingDeck || editStats.totalCount >= 40) return;
    const currentEntry = editingDeck.cards.find(c => c.cardId === card.id);
    if (currentEntry && currentEntry.count >= 4) return;

    let newCards = [...editingDeck.cards];
    if (currentEntry) {
      newCards = newCards.map(c => c.cardId === card.id ? { ...c, count: c.count + 1 } : c);
    } else {
      newCards.push({ cardId: card.id, count: 1 });
    }
    setEditingDeck({ ...editingDeck, cards: newCards });
  };

  const handleRemoveCardFromEdit = (cardId: string) => {
    if (!editingDeck) return;
    const currentEntry = editingDeck.cards.find(c => c.cardId === cardId);
    if (!currentEntry) return;

    let newCards = [...editingDeck.cards];
    if (currentEntry.count > 1) {
      newCards = newCards.map(c => c.cardId === cardId ? { ...c, count: c.count - 1 } : c);
    } else {
      newCards = newCards.filter(c => c.cardId !== cardId);
    }
    setEditingDeck({ ...editingDeck, cards: newCards });
  };

  const typeFilterLabels: Record<string, string> = {
    ALL: 'すべての種別',
    UNIT: 'ユニット',
    EVOLUTION: '進化ユニット',
    SPELL: 'スペル',
    RUNE: 'ルーン',
    DOMAIN: 'ドメイン',
  };

  return (
    <div className="fixed inset-0 bg-[#060c1d] text-white select-none overflow-hidden font-sans flex flex-col">
      <FloatingCardPreview card={previewCard} onClose={() => setPreviewCard(null)} />

      {/* ================================================================= */}
      {/* 画面1：デッキ一覧画面 */}
      {/* ================================================================= */}
      {viewMode === 'LIST' && (
        <div className="flex-1 flex flex-col h-full overflow-hidden">
          {/* ヘッダー */}
          <div className="h-12 px-4 flex items-center justify-between border-b border-cyan-800/40 bg-[#0a142d]/90 shrink-0">
            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  localStorage.setItem(ACTIVE_DECK_KEY, currentSelectedDeck.id);
                  onBackToBattle(currentSelectedDeck);
                }}
                className="px-4 py-1 bg-gradient-to-b from-red-600 to-red-800 hover:from-red-500 hover:to-red-700 text-white font-bold rounded-lg shadow-md border border-red-400/40 text-xs cursor-pointer transition-all active:scale-95"
              >
                戻る
              </button>
              <h1 className="text-base font-black italic tracking-wider text-cyan-200">
                SCRIPTIA デッキ一覧 <span className="text-[10px] text-cyan-400/60 font-mono ml-1">Ver 0.07</span>
              </h1>
            </div>
            <div className="text-xs text-slate-400 font-bold">
              作成デッキ <span className="text-cyan-400 font-black">{decks.length}</span> / 30
            </div>
          </div>

          {/* メインエリア */}
          <div className="flex-1 flex p-3 gap-3 overflow-hidden">
            {/* 左側：デッキグリッド */}
            <div className="flex-1 grid grid-cols-2 gap-2.5 overflow-y-auto pr-1 custom-scrollbar content-start">
              <div
                onClick={handleCreateNewDeck}
                className="h-24 border-2 border-dashed border-cyan-600/50 hover:border-cyan-400 rounded-xl bg-slate-900/40 hover:bg-cyan-950/20 flex flex-col items-center justify-center cursor-pointer transition-all group"
              >
                <span className="text-2xl text-cyan-400 group-hover:scale-125 transition-transform">＋</span>
                <span className="text-xs font-bold text-cyan-300 mt-0.5">新規作成</span>
              </div>

              {decks.map((deck) => {
                const isSelected = deck.id === currentSelectedDeck.id;
                const stats = calculateDeckStats(deck);
                return (
                  <div
                    key={deck.id}
                    onClick={() => setSelectedDeckId(deck.id)}
                    className={`h-24 rounded-xl p-2 flex flex-col justify-between cursor-pointer transition-all border-2 relative ${isSelected ? 'border-amber-400 bg-[#0e2142] shadow-[0_0_15px_rgba(251,191,36,0.35)]' : 'border-slate-800 bg-[#091428] hover:border-cyan-700/60'}`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-white truncate max-w-[130px]">{deck.name}</span>
                      <span className="text-[10px] font-mono font-bold text-emerald-400 bg-slate-900 px-1.5 py-0.2 rounded border border-emerald-500/40">
                        {stats.totalCount}/40
                      </span>
                    </div>

                    <div className="text-[10px] text-cyan-300/80 truncate">
                      キーカード: {stats.keyCard ? stats.keyCard.name : '未設定'}
                    </div>

                    <div className="flex items-center gap-2 text-[10px] font-mono border-t border-cyan-900/40 pt-1">
                      <span className="text-amber-400">光{stats.elementCounts.Light}</span>
                      <span className="text-cyan-400">水{stats.elementCounts.Water}</span>
                      <span className="text-purple-400">闇{stats.elementCounts.Dark}</span>
                      <span className="text-red-400">火{stats.elementCounts.Fire}</span>
                      <span className="text-emerald-400">地{stats.elementCounts.Earth}</span>
                      <span className="text-slate-400">無{stats.elementCounts.Neutral}</span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* 右側：詳細パネル（画面内フィット版） */}
            <div className="w-[380px] bg-[#09152e]/95 border border-cyan-800/60 rounded-xl p-3 flex flex-col justify-between overflow-hidden shadow-2xl shrink-0">
              <div className="space-y-2">
                {/* キーカード表示 */}
                <div className="bg-[#060e22] border border-cyan-700/40 rounded-lg p-2 relative shadow-inner">
                  <div className="flex justify-between items-center text-[10px] mb-1">
                    <span className="font-bold text-amber-400">★ キーカード</span>
                    <span className="text-cyan-300 font-bold">コスト {listStats.keyCard?.cost ?? 0} • {listStats.keyCard?.cardType === 'EVOLUTION' ? '進化ユニット' : (listStats.keyCard?.cardType || 'ユニット')}</span>
                  </div>
                  <div className="text-sm font-black text-white truncate">{listStats.keyCard?.name || '未設定'}</div>
                  <div className="text-[10px] text-slate-300 line-clamp-1 mt-0.5">{listStats.keyCard?.effectText || '通常能力なし'}</div>
                  {(listStats.keyCard?.cardType === 'UNIT' || listStats.keyCard?.cardType === 'EVOLUTION') && (
                    <div className="text-[10px] font-mono font-bold text-cyan-400 mt-1">
                      ATK {listStats.keyCard.atk} / DEF {listStats.keyCard.def}
                    </div>
                  )}
                </div>

                <div className="text-sm font-black text-white truncate">{currentSelectedDeck.name}</div>

                {/* 系統別枚数 */}
                <div className="flex items-center justify-between px-2 py-1 bg-slate-950/80 rounded border border-slate-800 text-[10px] font-mono">
                  <span className="text-amber-400">光 {listStats.elementCounts.Light}</span>
                  <span className="text-cyan-400">水 {listStats.elementCounts.Water}</span>
                  <span className="text-purple-400">闇 {listStats.elementCounts.Dark}</span>
                  <span className="text-red-400">火 {listStats.elementCounts.Fire}</span>
                  <span className="text-emerald-400">地 {listStats.elementCounts.Earth}</span>
                  <span className="text-slate-400">無 {listStats.elementCounts.Neutral}</span>
                </div>

                {/* マナカーブ棒グラフ */}
                <div className="bg-slate-950/90 p-2 rounded-lg border border-slate-800">
                  <div className="flex justify-between text-[9px] text-slate-400 font-bold mb-1">
                    <span>マナカーブ</span>
                    <span className="text-amber-400">ルーン: {listStats.runeCount}枚</span>
                  </div>
                  <div className="flex items-end justify-between h-14 px-1.5 bg-[#050b18] rounded border border-slate-800/80 pt-1">
                    {[1, 2, 3, 4, 5, 6, 7, 8].map((cost, i) => {
                      const count = listStats.costCurve[i];
                      const heightPercent = Math.min(100, Math.max(8, (count / 14) * 100));
                      return (
                        <div key={cost} className="flex flex-col items-center justify-end h-full w-5">
                          <span className="text-[8px] font-mono font-bold text-amber-300 mb-0.5">{count > 0 ? count : ''}</span>
                          <div
                            style={{ height: `${count === 0 ? 2 : heightPercent}%` }}
                            className={`w-3 rounded-t-xs ${count > 0 ? 'bg-gradient-to-t from-orange-600 to-amber-400 shadow-[0_0_6px_rgba(245,158,11,0.5)]' : 'bg-slate-800'}`}
                          />
                          <span className="text-[8px] text-slate-400 font-mono mt-0.5">{cost === 8 ? '8~' : cost}</span>
                        </div>
                      );
                    })}
                    <div className="flex flex-col items-center justify-end h-full w-5 border-l border-slate-700/60 pl-1">
                      <span className="text-[8px] font-mono font-bold text-yellow-300 mb-0.5">{listStats.runeCount || ''}</span>
                      <div
                        style={{ height: `${Math.min(100, Math.max(8, (listStats.runeCount / 14) * 100))}%` }}
                        className="w-3 bg-gradient-to-t from-yellow-600 to-yellow-300 rounded-t-xs shadow-[0_0_6px_rgba(234,179,8,0.5)]"
                      />
                      <span className="text-[8px] text-yellow-400 font-bold mt-0.5">⚡</span>
                    </div>
                  </div>
                </div>

                {/* 内訳 */}
                <div className="grid grid-cols-4 gap-1 text-[10px] bg-slate-950/70 p-1.5 rounded border border-slate-800 text-center font-medium">
                  <div>ユ: <span className="text-white font-bold">{listStats.unitCount}</span></div>
                  <div>ス: <span className="text-white font-bold">{listStats.spellCount}</span></div>
                  <div>ル: <span className="text-white font-bold">{listStats.runeCount}</span></div>
                  <div>ド: <span className="text-white font-bold">{listStats.domainCount}</span></div>
                </div>
              </div>

              {/* 下部ボタン群 */}
              <div className="flex gap-2 pt-2 border-t border-cyan-900/50 mt-1">
                <button
                  onClick={() => handleDeleteDeck(currentSelectedDeck.id)}
                  className="px-2.5 py-1.5 bg-red-950/80 hover:bg-red-900 text-red-300 border border-red-700/50 rounded-lg text-xs font-bold cursor-pointer transition-all"
                >
                  削除
                </button>
                <button
                  onClick={handleStartEdit}
                  className="flex-1 py-1.5 bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-cyan-700/60 rounded-lg text-xs font-bold text-center cursor-pointer transition-all"
                >
                  デッキ編成
                </button>
                <button
                  onClick={() => {
                    localStorage.setItem(ACTIVE_DECK_KEY, currentSelectedDeck.id);
                    onBackToBattle(currentSelectedDeck);
                  }}
                  className="flex-1 py-1.5 bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white font-black rounded-lg shadow-md text-xs text-center cursor-pointer transition-all active:scale-95"
                >
                  このデッキで対戦
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* 画面2：デッキ編成画面（レイアウト崩れ完全修正版） */}
      {/* ================================================================= */}
      {viewMode === 'EDIT' && editingDeck && (
        <div className="flex-1 flex flex-col h-full overflow-hidden">
          {/* 最上部ステータスバー */}
          <div className="h-11 px-3 bg-[#081226] border-b border-cyan-800/40 flex items-center justify-between gap-3 shrink-0">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setViewMode('LIST')}
                className="px-3 py-1 bg-red-700 hover:bg-red-600 text-white font-bold rounded-lg text-xs shrink-0 shadow cursor-pointer transition-all"
              >
                戻る
              </button>
              <input
                type="text"
                placeholder="カード名・テキストで検索..."
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                className="bg-slate-900/90 border border-cyan-700/50 rounded-lg px-2.5 py-0.5 text-xs text-white focus:outline-none focus:border-cyan-400 w-44"
              />
            </div>

            {/* 種別内訳 */}
            <div className="flex items-center gap-3 text-[11px] text-slate-300 font-medium">
              <span>ユニット: <b className="text-white">{editStats.unitCount}</b></span>
              <span>スペル: <b className="text-white">{editStats.spellCount}</b></span>
              <span>ルーン: <b className="text-white">{editStats.runeCount}</b></span>
              <span>ドメイン: <b className="text-white">{editStats.domainCount}</b></span>
            </div>

            {/* デッキ名 ＆ カウンター */}
            <div className="flex items-center gap-3 shrink-0">
              <input
                type="text"
                value={editingDeck.name}
                onChange={(e) => setEditingDeck({ ...editingDeck, name: e.target.value })}
                className="bg-transparent text-right font-black text-xs text-cyan-300 border-b border-transparent hover:border-cyan-500 focus:border-cyan-400 focus:outline-none w-36 truncate"
              />
              <span className={`text-xs font-mono font-bold ${editStats.totalCount === 40 ? 'text-emerald-400' : 'text-amber-400'}`}>
                {editStats.totalCount} / 40枚
              </span>
            </div>
          </div>

          {/* メイン編集エリア */}
          <div className="flex-1 flex overflow-hidden">
            {/* 左端：属性切り替え縦タブ（コンパクト化・高さ均等） */}
            <div className="w-12 bg-[#050b1a] border-r border-cyan-900/40 flex flex-col justify-between py-1.5 px-1 shrink-0">
              {[
                { id: 'ALL', label: 'ALL', color: 'bg-slate-700' },
                { id: 'Light', label: '光', color: 'bg-amber-400 text-black' },
                { id: 'Water', label: '水', color: 'bg-cyan-500 text-black' },
                { id: 'Dark', label: '闇', color: 'bg-purple-600' },
                { id: 'Fire', label: '火', color: 'bg-red-600' },
                { id: 'Earth', label: '地', color: 'bg-emerald-600' },
                { id: 'Neutral', label: '無', color: 'bg-slate-500' },
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setSelectedElement(tab.id)}
                  className={`h-8 rounded-md flex items-center justify-center font-black text-xs transition-all cursor-pointer ${selectedElement === tab.id ? `${tab.color} scale-105 shadow-md` : 'bg-slate-900/80 text-slate-400 hover:text-white border border-slate-800'}`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* 中央：カード一覧（オレンジヘッダー・ドロップダウン形式） */}
            <div className="flex-1 flex flex-col bg-[#071024] border-r border-cyan-900/40 overflow-hidden">
              <div className="h-8 bg-gradient-to-r from-orange-600 to-amber-600 px-3 flex items-center justify-between text-xs font-black shadow shrink-0 relative">
                <span>カード一覧 ({filteredPool.length}枚)</span>

                {/* すべて ▾ ドロップダウンボタン（ボタン乱立を完全解消！） */}
                <div className="relative">
                  <button
                    onClick={() => setShowTypeDropdown(!showTypeDropdown)}
                    className="px-2.5 py-0.5 bg-black/40 hover:bg-black/60 text-amber-200 border border-amber-400/40 rounded text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors"
                  >
                    <span>{typeFilterLabels[selectedTypeFilter]}</span>
                    <span className="text-[10px]">▼</span>
                  </button>

                  {showTypeDropdown && (
                    <div className="absolute right-0 top-full mt-1 w-32 bg-[#09152e] border border-cyan-500/70 rounded-lg shadow-2xl z-50 overflow-hidden">
                      {Object.entries(typeFilterLabels).map(([key, label]) => (
                        <div
                          key={key}
                          onClick={() => {
                            setSelectedTypeFilter(key);
                            setShowTypeDropdown(false);
                          }}
                          className={`px-3 py-1.5 text-xs font-bold cursor-pointer hover:bg-cyan-950 transition-colors ${selectedTypeFilter === key ? 'text-amber-400 bg-cyan-900/30' : 'text-slate-200'}`}
                        >
                          {label}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* カード一覧グリッド */}
              <div className="flex-1 p-2 overflow-y-auto grid grid-cols-4 gap-2 content-start custom-scrollbar">
                {filteredPool.map(card => {
                  const inDeckCount = editingDeck.cards.find(c => c.cardId === card.id)?.count || 0;
                  return (
                    <div
                      key={card.id}
                      onClick={() => handleAddCardToEdit(card)}
                      onContextMenu={(e) => { e.preventDefault(); setPreviewCard(card as Card); }}
                      className={`h-28 rounded-lg border p-1.5 flex flex-col justify-between cursor-pointer select-none transition-all ${inDeckCount >= 4 ? 'bg-slate-950/40 border-slate-800 opacity-50' : 'bg-[#0a1633] hover:bg-[#0f214a] border-cyan-800/60 hover:border-cyan-400 shadow-sm'}`}
                    >
                      <div className="flex justify-between items-center">
                        <span className="w-5 h-5 rounded-full bg-amber-500 text-black font-black text-xs flex items-center justify-center shadow">
                          {card.cost}
                        </span>
                        <span className="text-[10px] font-mono font-bold text-cyan-400 bg-slate-900 px-1 py-0.2 rounded border border-cyan-900/60">
                          x{inDeckCount}
                        </span>
                      </div>
                      <div className="font-bold text-xs text-white truncate">{card.name}</div>
                      <div className="text-[9px] text-cyan-400/80 truncate">
                        {card.element || '無'}系統 • {card.cardType === 'EVOLUTION' ? '進化' : card.cardType}
                      </div>
                      <div className="text-[9px] text-slate-400 truncate">{card.effectText || '通常'}</div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 右側：マイデッキ（右上に「オススメ」ボタン配置！） */}
            <div className="w-[320px] bg-[#060e20] flex flex-col shrink-0 overflow-hidden">
              <div className="h-8 bg-gradient-to-r from-blue-700 to-cyan-600 px-3 flex items-center justify-between text-xs font-black shadow shrink-0">
                <div className="flex items-center gap-2">
                  <span>マイデッキ</span>
                  <span className="text-cyan-200 font-mono font-normal">({editStats.totalCount}/40)</span>
                </div>
                {/* デュエプレ同位置の「オススメ」ボタン！ */}
                <button
                  onClick={() => setShowSuggestModal(true)}
                  className="px-2 py-0.5 bg-blue-950/90 hover:bg-blue-900 text-amber-300 border border-amber-400/50 rounded text-[11px] font-bold shadow transition-all cursor-pointer active:scale-95"
                >
                  オススメ
                </button>
              </div>

              {/* マイデッキリスト */}
              <div className="flex-1 p-2 overflow-y-auto space-y-1 custom-scrollbar">
                {editingDeck.cards.map(entry => {
                  const card = CARDS.find(c => c.id === entry.cardId);
                  if (!card) return null;
                  const isKey = editingDeck.keyCardId === card.id;

                  return (
                    <div
                      key={card.id}
                      className={`h-9 rounded-md bg-[#0a1736] border flex items-center justify-between px-2 transition-all ${isKey ? 'border-amber-400 shadow-[0_0_8px_rgba(251,191,36,0.3)]' : 'border-cyan-800/50 hover:border-cyan-500'}`}
                    >
                      <div
                        onClick={() => handleRemoveCardFromEdit(card.id)}
                        className="flex items-center gap-1.5 overflow-hidden flex-1 cursor-pointer group"
                      >
                        <span className="w-4 h-4 rounded-full bg-amber-500 text-black font-black text-[10px] flex items-center justify-center shrink-0">
                          {card.cost}
                        </span>
                        <span className="text-xs font-bold text-slate-200 truncate group-hover:text-red-300">
                          {card.name}
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          onClick={() => handleSetKeyCard(card.id)}
                          className={`text-[10px] px-1 py-0.2 rounded font-bold cursor-pointer transition-colors ${isKey ? 'bg-amber-400 text-black shadow-sm' : 'bg-slate-800 text-slate-400 hover:text-amber-300'}`}
                          title="キーカードに設定"
                        >
                          ★
                        </button>
                        <span className="text-xs font-mono font-black text-cyan-300 bg-slate-900 px-1.5 py-0.2 rounded border border-cyan-900/60">
                          {entry.count}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* 保存ボタン */}
              <div className="p-2 border-t border-cyan-900/40 shrink-0">
                <button
                  onClick={handleSaveDeck}
                  disabled={editStats.totalCount !== 40}
                  className={`w-full py-2 rounded-lg font-black text-xs shadow transition-all ${editStats.totalCount === 40 ? 'bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white cursor-pointer shadow-[0_0_15px_rgba(6,182,212,0.5)] active:scale-98' : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700'}`}
                >
                  {editStats.totalCount === 40 ? 'デッキ保存' : `40枚必要です (${editStats.totalCount}/40)`}
                </button>
              </div>
            </div>
          </div>

          {/* オススメカード候補モーダル */}
          {showSuggestModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
              <div className="bg-[#09152e] border-2 border-cyan-400/80 rounded-xl p-4 max-w-lg w-full shadow-2xl">
                <div className="flex justify-between items-center pb-2 border-b border-cyan-800/60 mb-3">
                  <h3 className="text-sm font-black text-cyan-200">オススメ候補カード</h3>
                  <button
                    onClick={() => setShowSuggestModal(false)}
                    className="w-6 h-6 rounded-full bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center text-xs cursor-pointer"
                  >
                    ✕
                  </button>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 max-h-60 overflow-y-auto custom-scrollbar p-1">
                  {suggestedCards.map(card => (
                    <div
                      key={card.id}
                      onClick={() => {
                        handleAddCardToEdit(card);
                        setShowSuggestModal(false);
                      }}
                      className="p-2 rounded-lg bg-slate-900 hover:bg-cyan-950 border border-cyan-700/50 hover:border-cyan-400 cursor-pointer transition-all"
                    >
                      <div className="flex justify-between text-[10px] font-bold text-amber-400 mb-0.5">
                        <span>コスト {card.cost}</span>
                        <span>{card.cardType === 'EVOLUTION' ? '進化' : card.cardType}</span>
                      </div>
                      <div className="font-bold text-xs text-white truncate">{card.name}</div>
                      <div className="text-[9px] text-slate-400 truncate mt-0.5">{card.effectText || '通常'}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
