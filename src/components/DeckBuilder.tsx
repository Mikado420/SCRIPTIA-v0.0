import React, { useState, useMemo, useRef } from 'react';
import { Card, CardTemplate } from '../types';
import { UserDeck } from '../types/deck';
import { CARDS, getCard } from '../data/cards';
import { CardDetailModal } from './CardDetailModal';
import { 
  ArrowLeft, Search, X, ChevronDown, Check, Sparkles, 
  Trash2, Shield, Swords, Flame, Droplet, Mountain, Sun, Moon, Hexagon,
  Info, Filter, RotateCcw
} from 'lucide-react';
import { 
  STARTER_DECK_FIRE, 
  STARTER_DECK_CONTROL, 
  STORAGE_KEY, 
  ACTIVE_DECK_KEY,
  normalizeElement,
  ELEMENT_ICONS
} from './DeckManager';

export { STARTER_DECK_FIRE, STARTER_DECK_CONTROL, STORAGE_KEY, ACTIVE_DECK_KEY };

interface DeckBuilderProps {
  initialDeck: UserDeck;
  onSave: (savedDeck: UserDeck) => void;
  onCancel: () => void;
}

type SortOption = 'cost_asc' | 'cost_desc' | 'name_asc' | 'atk_desc' | 'count_desc';

const typeLabelMap: Record<string, string> = {
  ALL: 'すべて',
  Unit: 'ユニット',
  Spell: 'スペル',
  Rune: 'ルーン',
  Domain: 'ドメイン',
  Evolution: '進化',
};

const keywordNameMap: Record<string, string> = {
  Guard: '守護',
  Rush: '速攻',
  Evolution: '進化',
  Lethal: '必殺',
};

const lineageNameMap: Record<string, string> = {
  Rampage: 'ランページ',
  Mechanoid: 'メカノイド',
  Dragon: 'ドラゴン',
  Merfolk: 'マーフォーク',
  Aquatica: 'アクアティカ',
  Leviathan: 'リヴァイアサン',
  Bestia: 'ベスティア',
  Insect: 'インセクト',
  Titan: 'タイタン',
  Guardian: 'ガーディアン',
  Oracle: 'オラクル',
  Angel: 'エンジェル',
  Parasite: 'パラサイト',
  Ghost: 'ゴースト',
  Demon: 'デーモン',
};

export const DeckBuilder: React.FC<DeckBuilderProps> = ({
  initialDeck,
  onSave,
  onCancel,
}) => {
  // 編集中のデッキデータ
  const [deck, setDeck] = useState<UserDeck>(() => JSON.parse(JSON.stringify(initialDeck)));
  const [deckName, setDeckName] = useState<string>(initialDeck.name);

  // 検索・ソート状態
  const [searchText, setSearchText] = useState<string>('');
  const [sortOption, setSortOption] = useState<SortOption>('cost_asc');

  // 5軸フィルター状態
  const [selectedType, setSelectedType] = useState<string>('ALL');
  const [selectedSystem, setSelectedSystem] = useState<string>('ALL');
  const [selectedCost, setSelectedCost] = useState<string>('ALL');
  const [selectedKeyword, setSelectedKeyword] = useState<string>('ALL');
  const [selectedLineage, setSelectedLineage] = useState<string>('ALL');
  const [showAdvancedFilter, setShowAdvancedFilter] = useState<boolean>(false);

  // カード詳細プレビュー用モーダル
  const [detailCard, setDetailCard] = useState<CardTemplate | null>(null);

  // トースト通知
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2200);
  };

  // 動的オプション（コスト一覧、系譜一覧）
  const availableCosts = useMemo(() => {
    const set = new Set<number>();
    CARDS.forEach(c => set.add(c.cost));
    return Array.from(set).sort((a, b) => a - b);
  }, []);

  const availableLineages = useMemo(() => {
    const set = new Set<string>();
    CARDS.forEach(c => {
      if (c.lineage && c.lineage !== 'None') {
        set.add(c.lineage);
      }
    });
    return Array.from(set);
  }, []);

  // 現在のデッキ投入カードマップ { cardId: count }
  const deckCardCountMap = useMemo(() => {
    const map = new Map<string, number>();
    deck.cards.forEach(entry => {
      map.set(entry.cardId, entry.count);
    });
    return map;
  }, [deck.cards]);

  // デッキ総枚数
  const totalDeckCount = useMemo(() => {
    return deck.cards.reduce((sum, entry) => sum + entry.count, 0);
  }, [deck.cards]);

  // システム別・タイプ別集計
  const deckStats = useMemo(() => {
    const systemCounts: Record<string, number> = {
      Light: 0, Water: 0, Dark: 0, Fire: 0, Earth: 0, Neutral: 0
    };
    const typeCounts: Record<string, number> = {
      Unit: 0, Spell: 0, Rune: 0, Domain: 0
    };
    const costCounts: Record<number, number> = {};

    deck.cards.forEach(entry => {
      const card = getCard(entry.cardId);
      if (!card) return;
      const sys = normalizeElement(card.system || card.element);
      systemCounts[sys] = (systemCounts[sys] || 0) + entry.count;

      const t = (card.type || card.cardType || 'Unit');
      if (t === 'Unit' || t === 'Evolution') {
        typeCounts.Unit = (typeCounts.Unit || 0) + entry.count;
      } else if (t === 'Spell') {
        typeCounts.Spell = (typeCounts.Spell || 0) + entry.count;
      } else if (t === 'Rune') {
        typeCounts.Rune = (typeCounts.Rune || 0) + entry.count;
      } else if (t === 'Domain') {
        typeCounts.Domain = (typeCounts.Domain || 0) + entry.count;
      }

      const costKey = Math.min(card.cost, 8);
      costCounts[costKey] = (costCounts[costKey] || 0) + entry.count;
    });

    return { systemCounts, typeCounts, costCounts };
  }, [deck.cards]);

  // フィルタ・ソート済みカードプール
  const filteredCards = useMemo(() => {
    return CARDS.filter(card => {
      // 1. システム（属性）フィルター
      if (selectedSystem !== 'ALL') {
        const sys = normalizeElement(card.system || card.element);
        if (sys !== selectedSystem) return false;
      }

      // 2. カードタイプフィルター
      if (selectedType !== 'ALL') {
        const t = card.type || card.cardType;
        if (selectedType === 'Unit' && t !== 'Unit' && t !== 'Evolution') return false;
        if (selectedType === 'Spell' && t !== 'Spell') return false;
        if (selectedType === 'Rune' && t !== 'Rune') return false;
        if (selectedType === 'Domain' && t !== 'Domain') return false;
        if (selectedType === 'Evolution' && t !== 'Evolution') return false;
      }

      // 3. コストフィルター
      if (selectedCost !== 'ALL') {
        if (card.cost !== Number(selectedCost)) return false;
      }

      // 4. 能力キーワードフィルター
      if (selectedKeyword !== 'ALL') {
        if (!card.keywords || !card.keywords.includes(selectedKeyword as any)) return false;
      }

      // 5. 系譜フィルター
      if (selectedLineage !== 'ALL') {
        if (card.lineage !== selectedLineage && card.evolutionTarget !== selectedLineage) return false;
      }

      // 6. テキスト検索（カード名・効果テキスト・系譜）
      if (searchText.trim()) {
        const q = searchText.toLowerCase();
        const matchName = card.name.toLowerCase().includes(q);
        const matchEffect = card.effectText ? card.effectText.toLowerCase().includes(q) : false;
        const matchLineage = card.lineage ? card.lineage.toLowerCase().includes(q) : false;
        const matchLineageJp = card.lineage && lineageNameMap[card.lineage] ? lineageNameMap[card.lineage].includes(q) : false;
        if (!matchName && !matchEffect && !matchLineage && !matchLineageJp) return false;
      }

      return true;
    }).sort((a, b) => {
      if (sortOption === 'cost_asc') {
        return a.cost - b.cost || a.name.localeCompare(b.name, 'ja');
      }
      if (sortOption === 'cost_desc') {
        return b.cost - a.cost || a.name.localeCompare(b.name, 'ja');
      }
      if (sortOption === 'name_asc') {
        return a.name.localeCompare(b.name, 'ja');
      }
      if (sortOption === 'atk_desc') {
        return (b.atk ?? 0) - (a.atk ?? 0) || a.cost - b.cost;
      }
      if (sortOption === 'count_desc') {
        const countA = deckCardCountMap.get(a.id) || 0;
        const countB = deckCardCountMap.get(b.id) || 0;
        return countB - countA || a.cost - b.cost;
      }
      return 0;
    });
  }, [selectedSystem, selectedType, selectedCost, selectedKeyword, selectedLineage, searchText, sortOption, deckCardCountMap]);

  // カード追加（最大4枚制限 & デッキ40枚制限）
  const handleAddCard = (card: CardTemplate) => {
    if (totalDeckCount >= 40) {
      triggerToast('デッキの上限（40枚）に達しています');
      return;
    }
    const currentCount = deckCardCountMap.get(card.id) || 0;
    if (currentCount >= 4) {
      triggerToast('同名カードは最大4枚までです');
      return;
    }

    const nextCards = [...deck.cards];
    const existingIndex = nextCards.findIndex(e => e.cardId === card.id);
    if (existingIndex >= 0) {
      nextCards[existingIndex] = {
        ...nextCards[existingIndex],
        count: nextCards[existingIndex].count + 1,
      };
    } else {
      nextCards.push({ cardId: card.id, count: 1 });
    }

    setDeck({ ...deck, cards: nextCards });
  };

  // カード削除（1枚減算、0枚で除外）
  const handleRemoveCard = (cardId: string) => {
    const nextCards = deck.cards
      .map(entry => entry.cardId === cardId ? { ...entry, count: entry.count - 1 } : entry)
      .filter(entry => entry.count > 0);

    setDeck({ ...deck, cards: nextCards });
  };

  // オススメ自動補充機能
  const handleRecommend = () => {
    if (totalDeckCount >= 40) {
      triggerToast('デッキはすでに40枚揃っています');
      return;
    }

    // 最も多く投入されている主要システムを特定
    let dominantSystem: 'Light' | 'Water' | 'Dark' | 'Fire' | 'Earth' | 'Neutral' = 'Fire';
    let maxCount = -1;
    (Object.keys(deckStats.systemCounts) as (keyof typeof deckStats.systemCounts)[]).forEach(sys => {
      if (deckStats.systemCounts[sys] > maxCount) {
        maxCount = deckStats.systemCounts[sys];
        dominantSystem = sys as any;
      }
    });

    const candidates = CARDS.filter(c => {
      const sys = normalizeElement(c.system || c.element);
      return sys === dominantSystem || sys === 'Neutral';
    }).sort((a, b) => a.cost - b.cost);

    let nextCards = [...deck.cards];
    let addedCount = 0;
    const needed = 40 - totalDeckCount;

    for (const cand of candidates) {
      if (addedCount >= needed) break;
      const existing = nextCards.find(e => e.cardId === cand.id);
      const cur = existing ? existing.count : 0;
      const canAdd = Math.min(4 - cur, needed - addedCount);
      if (canAdd > 0) {
        if (existing) {
          nextCards = nextCards.map(e => e.cardId === cand.id ? { ...e, count: e.count + canAdd } : e);
        } else {
          nextCards.push({ cardId: cand.id, count: canAdd });
        }
        addedCount += canAdd;
      }
    }

    setDeck({ ...deck, cards: nextCards });
    triggerToast(`オススメカードを ${addedCount}枚 追加しました`);
  };

  // 保存処理
  const handleSaveDeck = () => {
    if (totalDeckCount !== 40) {
      triggerToast(`デッキはちょうど40枚で編成してください（現在: ${totalDeckCount}枚）`);
      return;
    }

    const cleanedName = deckName.trim() || '新規デッキ';
    const finalDeck: UserDeck = {
      ...deck,
      name: cleanedName,
      keyCardId: deck.cards.length > 0 ? deck.cards[0].cardId : deck.keyCardId,
      updatedAt: Date.now(),
    };

    onSave(finalDeck);
  };

  // フィルター初期化
  const handleResetFilters = () => {
    setSelectedSystem('ALL');
    setSelectedType('ALL');
    setSelectedCost('ALL');
    setSelectedKeyword('ALL');
    setSelectedLineage('ALL');
    setSearchText('');
  };

  const isFilterActive = selectedSystem !== 'ALL' || selectedType !== 'ALL' || selectedCost !== 'ALL' || selectedKeyword !== 'ALL' || selectedLineage !== 'ALL' || searchText.trim() !== '';

  return (
    <div className="w-full h-full flex flex-col bg-[#050b18] text-white overflow-hidden select-none font-sans relative">
      {/* ================================================================= */}
      {/* 1. 上部コントロールバー（デュエプレ風：戻る、検索、ソート、フィルタ、枚数、保存） */}
      {/* ================================================================= */}
      <header className="h-14 bg-gradient-to-r from-[#071328] via-[#0d2146] to-[#071328] border-b border-cyan-800/60 px-3 md:px-5 flex items-center justify-between gap-2 md:gap-4 shrink-0 shadow-lg z-20">
        {/* 左側：戻るボタン ＆ デッキ名入力 */}
        <div className="flex items-center gap-2 md:gap-3 shrink-0">
          <button
            type="button"
            onClick={onCancel}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-b from-slate-700 to-slate-900 hover:from-slate-600 hover:to-slate-800 border border-slate-500/60 text-xs font-black shadow transition-all active:scale-95 cursor-pointer"
          >
            <ArrowLeft size={14} />
            <span className="hidden sm:inline">戻る</span>
          </button>

          <div className="flex items-center gap-1.5 bg-black/40 border border-cyan-900/60 rounded-lg px-2.5 py-1">
            <span className="text-[10px] text-cyan-400 font-bold uppercase tracking-wider hidden sm:inline">デッキ名</span>
            <input
              type="text"
              value={deckName}
              onChange={(e) => setDeckName(e.target.value)}
              maxLength={20}
              placeholder="デッキ名を入力…"
              className="bg-transparent text-xs font-black text-white focus:outline-none w-28 sm:w-40 border-b border-transparent focus:border-cyan-400 transition-colors"
            />
          </div>
        </div>

        {/* 中央：検索 ＆ ソート ＆ フィルターボタン */}
        <div className="flex items-center gap-1.5 md:gap-2.5 flex-1 max-w-xl justify-center">
          {/* 検索入力欄 */}
          <div className="relative flex-1 min-w-[120px] max-w-[240px]">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-cyan-400/70" />
            <input
              type="text"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="カード名を検索…"
              className="w-full h-8 pl-8 pr-7 bg-black/60 border border-cyan-700/60 rounded-full text-xs font-medium text-white placeholder:text-slate-400 focus:outline-none focus:border-cyan-400 transition-all shadow-inner"
            />
            {searchText && (
              <button
                type="button"
                onClick={() => setSearchText('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
              >
                <X size={12} />
              </button>
            )}
          </div>

          {/* ソートセレクタ */}
          <div className="relative shrink-0">
            <select
              value={sortOption}
              onChange={(e) => setSortOption(e.target.value as SortOption)}
              className="h-8 pl-2.5 pr-6 bg-slate-900/90 border border-cyan-700/60 rounded-lg text-xs font-bold text-cyan-200 focus:outline-none focus:border-cyan-400 appearance-none cursor-pointer"
            >
              <option value="cost_asc">コスト (昇順)</option>
              <option value="cost_desc">コスト (降順)</option>
              <option value="name_asc">カード名</option>
              <option value="atk_desc">攻撃力 (降順)</option>
              <option value="count_desc">投入枚数</option>
            </select>
            <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-cyan-400 pointer-events-none" />
          </div>

          {/* フィルターポップアップトグル */}
          <button
            type="button"
            onClick={() => setShowAdvancedFilter(!showAdvancedFilter)}
            className={`h-8 px-2.5 rounded-lg flex items-center gap-1 text-xs font-bold border transition-all cursor-pointer shadow ${
              isFilterActive 
                ? 'bg-amber-600/90 border-amber-400 text-white shadow-[0_0_10px_rgba(245,158,11,0.5)]' 
                : 'bg-slate-900/90 border-cyan-700/60 text-slate-300 hover:text-white hover:border-cyan-400'
            }`}
          >
            <Filter size={13} />
            <span className="hidden sm:inline">フィルター</span>
            {isFilterActive && <span className="w-1.5 h-1.5 rounded-full bg-amber-300 animate-pulse" />}
          </button>
        </div>

        {/* 右側：枚数インジケーター ＆ 保存ボタン */}
        <div className="flex items-center gap-2 md:gap-3 shrink-0">
          <div className="flex items-center gap-1 bg-black/50 border border-cyan-700/60 rounded-lg px-2.5 py-1">
            <span className="text-[10px] text-slate-400 font-bold hidden sm:inline">枚数</span>
            <span className={`text-xs font-black font-mono ${totalDeckCount === 40 ? 'text-emerald-400' : 'text-amber-400'}`}>
              {totalDeckCount} / 40
            </span>
          </div>

          <button
            type="button"
            onClick={handleSaveDeck}
            disabled={totalDeckCount !== 40}
            className={`px-3 md:px-4 py-1.5 rounded-lg text-xs font-black transition-all shadow-md flex items-center gap-1.5 ${
              totalDeckCount === 40
                ? 'bg-gradient-to-r from-blue-600 via-cyan-500 to-blue-600 hover:from-blue-500 hover:to-cyan-400 text-white shadow-[0_0_15px_rgba(6,182,212,0.6)] cursor-pointer active:scale-95'
                : 'bg-slate-800/80 border border-slate-700 text-slate-500 cursor-not-allowed'
            }`}
          >
            <Check size={14} />
            <span>デッキ保存</span>
          </button>
        </div>
      </header>

      {/* ================================================================= */}
      {/* 2. 詳細フィルターパネル（展開時） */}
      {/* ================================================================= */}
      {showAdvancedFilter && (
        <div className="bg-[#091733] border-b border-cyan-700/80 px-4 py-3 shadow-2xl z-30 flex flex-col gap-2.5 animate-in slide-in-from-top-2 duration-150">
          <div className="flex items-center justify-between border-b border-cyan-900/60 pb-1.5">
            <div className="flex items-center gap-2 text-xs font-black text-cyan-300">
              <Filter size={14} />
              <span>絞り込みフィルター</span>
            </div>
            <div className="flex items-center gap-2">
              {isFilterActive && (
                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="flex items-center gap-1 text-[11px] text-amber-400 hover:text-amber-300 font-bold cursor-pointer"
                >
                  <RotateCcw size={11} />
                  <span>すべて解除</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setShowAdvancedFilter(false)}
                className="text-slate-400 hover:text-white p-0.5"
              >
                <X size={14} />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3 text-xs">
            {/* 1. カードタイプ */}
            <div className="flex flex-col gap-1">
              <span className="text-[10px] text-slate-400 font-bold">カードタイプ</span>
              <div className="flex flex-wrap gap-1">
                {['ALL', 'Unit', 'Spell', 'Rune', 'Domain', 'Evolution'].map(t => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setSelectedType(t)}
                    className={`px-2 py-0.5 rounded text-[11px] font-bold border transition-colors ${
                      selectedType === t
                        ? 'bg-cyan-600 border-cyan-400 text-white'
                        : 'bg-black/40 border-slate-700 text-slate-300 hover:border-slate-500'
                    }`}
                  >
                    {typeLabelMap[t] || t}
                  </button>
                ))}
              </div>
            </div>

            {/* 2. システム（属性） */}
            <div className="flex flex-col gap-1">
              <span className="text-[10px] text-slate-400 font-bold">システム</span>
              <div className="flex flex-wrap gap-1">
                {['ALL', 'Fire', 'Water', 'Earth', 'Light', 'Dark', 'Neutral'].map(sys => {
                  const iconInfo = sys === 'ALL' ? null : ELEMENT_ICONS[sys];
                  return (
                    <button
                      key={sys}
                      type="button"
                      onClick={() => setSelectedSystem(sys)}
                      className={`px-2 py-0.5 rounded text-[11px] font-bold border transition-colors flex items-center gap-1 ${
                        selectedSystem === sys
                          ? 'bg-cyan-600 border-cyan-400 text-white'
                          : 'bg-black/40 border-slate-700 text-slate-300 hover:border-slate-500'
                      }`}
                    >
                      {iconInfo && <span className={iconInfo.text}>{iconInfo.iconChar}</span>}
                      <span>{sys === 'ALL' ? 'すべて' : iconInfo?.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 3. コスト */}
            <div className="flex flex-col gap-1">
              <span className="text-[10px] text-slate-400 font-bold">コスト</span>
              <div className="flex flex-wrap gap-1">
                <button
                  type="button"
                  onClick={() => setSelectedCost('ALL')}
                  className={`px-2 py-0.5 rounded text-[11px] font-bold border transition-colors ${
                    selectedCost === 'ALL'
                      ? 'bg-cyan-600 border-cyan-400 text-white'
                      : 'bg-black/40 border-slate-700 text-slate-300 hover:border-slate-500'
                  }`}
                >
                  すべて
                </button>
                {availableCosts.map(cost => (
                  <button
                    key={cost}
                    type="button"
                    onClick={() => setSelectedCost(String(cost))}
                    className={`w-6 h-6 rounded text-[11px] font-bold border flex items-center justify-center transition-colors ${
                      selectedCost === String(cost)
                        ? 'bg-amber-500 border-amber-300 text-black font-black'
                        : 'bg-black/40 border-slate-700 text-slate-300 hover:border-slate-500'
                    }`}
                  >
                    {cost}
                  </button>
                ))}
              </div>
            </div>

            {/* 4. 能力 */}
            <div className="flex flex-col gap-1">
              <span className="text-[10px] text-slate-400 font-bold">能力</span>
              <div className="flex flex-wrap gap-1">
                <button
                  type="button"
                  onClick={() => setSelectedKeyword('ALL')}
                  className={`px-2 py-0.5 rounded text-[11px] font-bold border transition-colors ${
                    selectedKeyword === 'ALL'
                      ? 'bg-cyan-600 border-cyan-400 text-white'
                      : 'bg-black/40 border-slate-700 text-slate-300 hover:border-slate-500'
                  }`}
                >
                  すべて
                </button>
                {['Guard', 'Rush', 'Evolution', 'Lethal'].map(kw => (
                  <button
                    key={kw}
                    type="button"
                    onClick={() => setSelectedKeyword(kw)}
                    className={`px-2 py-0.5 rounded text-[11px] font-bold border transition-colors ${
                      selectedKeyword === kw
                        ? 'bg-purple-600 border-purple-400 text-white'
                        : 'bg-black/40 border-slate-700 text-slate-300 hover:border-slate-500'
                    }`}
                  >
                    {keywordNameMap[kw] || kw}
                  </button>
                ))}
              </div>
            </div>

            {/* 5. 系譜 */}
            <div className="flex flex-col gap-1">
              <span className="text-[10px] text-slate-400 font-bold">系譜</span>
              <select
                value={selectedLineage}
                onChange={(e) => setSelectedLineage(e.target.value)}
                className="h-7 px-2 bg-black/60 border border-slate-700 rounded text-[11px] font-bold text-slate-200 focus:outline-none focus:border-cyan-400"
              >
                <option value="ALL">すべての系譜</option>
                {availableLineages.map(lin => (
                  <option key={lin} value={lin}>
                    {lineageNameMap[lin] || lin}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* 3. メインコンテンツ領域（左：カードブラウザ、右：マイデッキ） */}
      {/* ================================================================= */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden relative">
        {/* ------------------------------------------------------------- */}
        {/* 左側ペイン：カードブラウザ (Card Pool Browser) */}
        {/* ------------------------------------------------------------- */}
        <section className="flex-1 flex flex-col bg-[#050d1e] overflow-hidden border-r border-cyan-900/60">
          {/* オレンジのカード一覧ヘッダーバー（デュエプレ再現） */}
          <div className="h-8 bg-gradient-to-r from-orange-600 via-amber-600 to-orange-600 px-4 flex items-center justify-between text-xs font-black shadow shrink-0">
            <div className="flex items-center gap-2">
              <span className="text-white drop-shadow">カード一覧</span>
              <span className="text-[10px] bg-black/40 px-2 py-0.5 rounded-full text-amber-200 font-mono">
                {filteredCards.length} 種
              </span>
            </div>
            <div className="flex items-center gap-3 text-[11px] text-amber-100">
              <span className="hidden sm:inline">タップでデッキ追加 / 詳細アイコンで詳細確認</span>
            </div>
          </div>

          {/* クイック属性タブバー（ALL, 火, 水, 地, 光, 闇, 無） */}
          <div className="h-9 bg-[#08152e] border-b border-cyan-900/50 px-3 flex items-center gap-1.5 overflow-x-auto shrink-0 scrollbar-none">
            {['ALL', 'Fire', 'Water', 'Earth', 'Light', 'Dark', 'Neutral'].map(sys => {
              const iconInfo = sys === 'ALL' ? null : ELEMENT_ICONS[sys];
              const isSelected = selectedSystem === sys;
              return (
                <button
                  key={sys}
                  type="button"
                  onClick={() => setSelectedSystem(sys)}
                  className={`px-3 py-1 rounded-full text-xs font-bold shrink-0 transition-all flex items-center gap-1 border cursor-pointer ${
                    isSelected
                      ? 'bg-cyan-600 border-cyan-300 text-white shadow-[0_0_8px_rgba(6,182,212,0.6)]'
                      : 'bg-black/30 border-transparent text-slate-400 hover:text-slate-200 hover:bg-black/50'
                  }`}
                >
                  {iconInfo && <span className={iconInfo.text}>{iconInfo.iconChar}</span>}
                  <span>{sys === 'ALL' ? 'すべて' : iconInfo?.label}</span>
                </button>
              );
            })}
          </div>

          {/* カードグリッド表示エリア */}
          <div className="flex-1 overflow-y-auto p-3 sm:p-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2.5 sm:gap-3.5 content-start custom-scrollbar">
            {filteredCards.length === 0 ? (
              <div className="col-span-full py-16 text-center text-slate-500 font-bold text-sm">
                該当するカードが見つかりませんでした。
              </div>
            ) : (
              filteredCards.map(card => {
                const countInDeck = deckCardCountMap.get(card.id) || 0;
                const isMax = countInDeck >= 4;
                const isUnit = card.type === 'Unit' || card.type === 'Evolution';
                const sys = normalizeElement(card.system || card.element);
                const iconInfo = ELEMENT_ICONS[sys] || ELEMENT_ICONS.Neutral;

                return (
                  <div
                    key={card.id}
                    onClick={() => handleAddCard(card)}
                    className={`relative rounded-xl border-2 flex flex-col overflow-hidden transition-all group select-none cursor-pointer ${
                      isMax
                        ? 'border-slate-700 bg-slate-900/60 opacity-60'
                        : 'border-cyan-800/70 hover:border-cyan-400 bg-gradient-to-b from-[#0e1d3a] to-[#081226] hover:shadow-[0_0_15px_rgba(6,182,212,0.4)] active:scale-95'
                    }`}
                  >
                    {/* カード上部：コスト + 投入枚数バッジ */}
                    <div className="p-1.5 flex items-center justify-between shrink-0 bg-black/40">
                      <div className="w-6 h-6 rounded-full bg-amber-500 text-black font-black text-xs flex items-center justify-center shadow">
                        {card.cost}
                      </div>

                      {/* 投入枚数（×0〜×4）表示 */}
                      <div className={`px-2 py-0.5 rounded-full text-[11px] font-black font-mono shadow ${
                        countInDeck > 0
                          ? 'bg-cyan-500 text-black font-extrabold shadow-[0_0_8px_rgba(6,182,212,0.8)]'
                          : 'bg-black/60 text-slate-400 border border-white/10'
                      }`}>
                        ×{countInDeck}
                      </div>
                    </div>

                    {/* カードビジュアル部 */}
                    <div className="h-16 sm:h-20 bg-gradient-to-t from-black/80 to-black/20 flex flex-col items-center justify-center relative px-2 text-center overflow-hidden">
                      <div className={`w-8 h-8 rounded-full border border-white/20 flex items-center justify-center ${iconInfo.bg}/20 shadow-inner mb-1`}>
                        <span className={`text-sm font-black ${iconInfo.text}`}>{iconInfo.iconChar}</span>
                      </div>
                      <span className="text-xs font-black text-white leading-tight line-clamp-1 group-hover:text-cyan-300 transition-colors">
                        {card.name}
                      </span>
                      <span className="text-[10px] text-cyan-400/80 font-mono">{card.id}</span>

                      {/* 詳細確認ボタン */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDetailCard(card);
                        }}
                        className="absolute bottom-1 right-1 p-1 rounded bg-black/80 hover:bg-cyan-700 text-slate-300 hover:text-white border border-white/20 shadow transition-colors"
                        title="カード詳細を見る"
                      >
                        <Info size={12} />
                      </button>
                    </div>

                    {/* カード下部：スタッツ（攻撃力・防御値・ブレイク）またはタイプ */}
                    <div className="p-1.5 bg-black/60 border-t border-white/10 flex items-center justify-between text-[10px] font-bold">
                      {isUnit ? (
                        <>
                          <div className="flex items-center gap-0.5 text-red-400 font-mono">
                            <Swords size={11} />
                            <span>{card.atk ?? 0}</span>
                          </div>
                          <div className="flex items-center gap-0.5 text-amber-400 font-mono">
                            <Shield size={11} />
                            <span>{card.brk ?? 1}</span>
                          </div>
                          <div className="flex items-center gap-0.5 text-cyan-400 font-mono">
                            <Shield size={11} />
                            <span>{card.def ?? 0}</span>
                          </div>
                        </>
                      ) : (
                        <div className="w-full text-center text-cyan-300 font-medium py-0.5">
                          {typeLabelMap[card.type] || card.type}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>

        {/* ------------------------------------------------------------- */}
        {/* 右側ペイン：マイデッキサイドバー (My Deck Side Panel) */}
        {/* ------------------------------------------------------------- */}
        <aside className="w-full md:w-80 lg:w-96 bg-[#071329] flex flex-col shrink-0 border-t md:border-t-0 md:border-l border-cyan-900/60 shadow-2xl overflow-hidden max-h-[40vh] md:max-h-full">
          {/* 青いマイデッキヘッダーバー（デュエプレ再現） */}
          <div className="h-8 bg-gradient-to-r from-blue-700 via-cyan-600 to-blue-700 px-4 flex items-center justify-between text-xs font-black shadow shrink-0">
            <span className="text-white drop-shadow">マイデッキ</span>
            <div className="flex items-center gap-2">
              <span className={`text-xs font-black font-mono px-2 py-0.5 rounded-full ${
                totalDeckCount === 40 ? 'bg-emerald-950 text-emerald-300 border border-emerald-400' : 'bg-black/40 text-amber-300'
              }`}>
                {totalDeckCount} / 40
              </span>

              {/* オススメ自動補充ボタン */}
              <button
                type="button"
                onClick={handleRecommend}
                className="text-[11px] bg-cyan-950/80 hover:bg-cyan-800 px-2.5 py-0.5 rounded-full text-cyan-200 border border-cyan-400/50 shadow transition-all cursor-pointer font-bold active:scale-95"
                title="不足分のカードを自動的に補充します"
              >
                オススメ
              </button>
            </div>
          </div>

          {/* デッキ内カードタイプ・システム要約ミニバナー */}
          <div className="bg-[#050f22] border-b border-cyan-950 px-3 py-1.5 flex items-center justify-between text-[11px] font-bold text-slate-300 shrink-0">
            <div className="flex items-center gap-2">
              <span>ユニット: <strong className="text-cyan-300">{deckStats.typeCounts.Unit}</strong></span>
              <span>スペル: <strong className="text-blue-300">{deckStats.typeCounts.Spell}</strong></span>
              <span>ルーン: <strong className="text-amber-300">{deckStats.typeCounts.Rune}</strong></span>
            </div>
            <span className="text-[10px] text-slate-400">タップで1枚削除</span>
          </div>

          {/* マイデッキカードリスト（横長カードバー形式：独立スクロール） */}
          <div className="flex-1 overflow-y-auto p-2.5 flex flex-col gap-1.5 custom-scrollbar">
            {deck.cards.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-slate-500 py-12 text-center text-xs font-bold">
                <Sparkles size={24} className="mb-2 text-cyan-500/40" />
                <span>左側のカード一覧から</span>
                <span>カードをタップして追加してください</span>
              </div>
            ) : (
              deck.cards
                .map(entry => {
                  const card = getCard(entry.cardId);
                  return { entry, card };
                })
                .filter((item): item is { entry: { cardId: string; count: number }; card: CardTemplate } => item.card !== undefined)
                .sort((a, b) => a.card.cost - b.card.cost || a.card.name.localeCompare(b.card.name, 'ja'))
                .map(({ entry, card }) => {
                  const sys = normalizeElement(card.system || card.element);
                  const iconInfo = ELEMENT_ICONS[sys] || ELEMENT_ICONS.Neutral;
                  const isUnit = card.type === 'Unit' || card.type === 'Evolution';

                  return (
                    <div
                      key={card.id}
                      onClick={() => handleRemoveCard(card.id)}
                      className="group relative h-9 rounded-lg border border-cyan-900/60 hover:border-red-500/80 bg-gradient-to-r from-[#0c1b38] via-[#09152e] to-[#0c1b38] hover:from-red-950/40 hover:to-red-950/40 px-2.5 flex items-center justify-between gap-2 shadow transition-all cursor-pointer select-none"
                    >
                      {/* コスト + 属性アイコン + カード名 */}
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <div className="w-5 h-5 rounded-full bg-amber-500 text-black font-black text-[11px] flex items-center justify-center shrink-0 shadow">
                          {card.cost}
                        </div>
                        <span className={`text-xs font-bold ${iconInfo.text} shrink-0`}>
                          {iconInfo.iconChar}
                        </span>
                        <span className="text-xs font-bold text-slate-100 truncate group-hover:text-red-300 transition-colors">
                          {card.name}
                        </span>
                      </div>

                      {/* 攻撃力（ユニット時） + 投入枚数バッジ */}
                      <div className="flex items-center gap-2 shrink-0">
                        {isUnit && card.atk !== undefined && (
                          <div className="flex items-center gap-0.5 text-[11px] font-mono text-red-400 font-black">
                            <Swords size={11} />
                            <span>{card.atk}</span>
                          </div>
                        )}

                        <div className="w-6 h-6 rounded bg-cyan-950 border border-cyan-500/60 text-cyan-200 font-mono font-black text-xs flex items-center justify-center shadow">
                          {entry.count}
                        </div>
                      </div>
                    </div>
                  );
                })
            )}
          </div>
        </aside>
      </div>

      {/* ================================================================= */}
      {/* 4. カード詳細モーダル */}
      {/* ================================================================= */}
      {detailCard && (
        <CardDetailModal
          card={detailCard}
          onClose={() => setDetailCard(null)}
        />
      )}

      {/* ================================================================= */}
      {/* 5. トースト通知 */}
      {/* ================================================================= */}
      {toastMessage && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-gradient-to-r from-blue-700 via-cyan-600 to-blue-700 text-white font-black text-xs px-5 py-2.5 rounded-full shadow-[0_0_20px_rgba(6,182,212,0.8)] border border-cyan-300 z-[99999] animate-bounce">
          {toastMessage}
        </div>
      )}
    </div>
  );
};
