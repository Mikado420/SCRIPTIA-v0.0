import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Card } from '../types';
import { UserDeck } from '../types/deck';
import { CARDS, getCard } from '../data/cards';
import { FloatingCardPreview } from './FloatingCardPreview';
import { formatCardMetaJapanese } from '../utils/cardFormatter';
import { 
  Trash2, Plus, Check, Edit2, Search, X, 
  Layers, ChevronDown, ArrowUpDown, Eye, Shield, Sparkles, RefreshCw
} from 'lucide-react';

export const STORAGE_KEY = 'scriptia_user_decks_v1';
export const ACTIVE_DECK_KEY = 'scriptia_active_deck_id';

// =====================================================================
// デュエプレ再現用：各文明ベーシックデッキ（画像1枚目再現：5つの完成デッキ）
// =====================================================================

export const STARTER_DECK_LIGHT: UserDeck = {
  id: 'deck_light_basic',
  name: '光文明ベーシックデッキ',
  keyCardId: 'BW-11', // 天聖護神 ソル・アイギス
  cards: [
    { cardId: 'BW-01', count: 4 }, // ア・ルクス (1)
    { cardId: 'BW-02', count: 4 }, // ク・ラリス (2)
    { cardId: 'BW-03', count: 4 }, // ガ・ルディス (2)
    { cardId: 'BW-04', count: 4 }, // レ・パコス (3)
    { cardId: 'BW-05', count: 4 }, // ザ・クエル (4)
    { cardId: 'BW-06', count: 4 }, // エルピス (4)
    { cardId: 'BW-07', count: 4 }, // ソフィア (4)
    { cardId: 'BW-09', count: 4 }, // ミカエル (6)
    { cardId: 'BW-11', count: 4 }, // ソル・アイギス (5進化)
    { cardId: 'BW-14', count: 4 }, // 眩惑の聖壁 (4ルーン)
  ],
  createdAt: 1700000000000,
  updatedAt: 1700000000000,
};

export const STARTER_DECK_WATER: UserDeck = {
  id: 'deck_water_basic',
  name: '水文明ベーシックデッキ',
  keyCardId: 'BB-11', // ルミナス・トライデント
  cards: [
    { cardId: 'BB-01', count: 4 }, // アクア・シールド (1)
    { cardId: 'BB-02', count: 4 }, // アクア・スカウト (2)
    { cardId: 'BB-03', count: 4 }, // ソードギル・シーカー (2)
    { cardId: 'BB-04', count: 4 }, // アクア・スカラー (3)
    { cardId: 'BB-05', count: 4 }, // アクア・ミラージュ (3)
    { cardId: 'BB-07', count: 4 }, // アクア・ランサー (4)
    { cardId: 'BB-08', count: 4 }, // キング・オルカ (5)
    { cardId: 'BB-09', count: 4 }, // アクア・タイド (5)
    { cardId: 'BB-11', count: 4 }, // ルミナス・トライデント (6進化)
    { cardId: 'BB-12', count: 4 }, // サージ・スパイラル (2スペル)
  ],
  createdAt: 1700000001000,
  updatedAt: 1700000001000,
};

export const STARTER_DECK_DARK: UserDeck = {
  id: 'deck_dark_basic',
  name: '闇文明ベーシックデッキ',
  keyCardId: 'BD-11', // 傀儡魔王 ネクロシア
  cards: [
    { cardId: 'BD-01', count: 4 }, // ポイズン・ペスト (2)
    { cardId: 'BD-02', count: 4 }, // 未練の霊 マリー (2)
    { cardId: 'BD-03', count: 4 }, // デス・ペスト (3)
    { cardId: 'BD-04', count: 4 }, // マインド・ペスト (3)
    { cardId: 'BD-06', count: 4 }, // 怨みの霊 ハイド (4)
    { cardId: 'BD-07', count: 4 }, // グレイブ・ペスト (4)
    { cardId: 'BD-08', count: 4 }, // 絶望の霊 ダンテ (5)
    { cardId: 'BD-09', count: 4 }, // 暗黒の悪魔 バールゼブル (6)
    { cardId: 'BD-11', count: 4 }, // 傀儡魔王 ネクロシア (6進化)
    { cardId: 'BD-14', count: 4 }, // デス・ジャッジメント (5ルーン)
  ],
  createdAt: 1700000002000,
  updatedAt: 1700000002000,
};

export const STARTER_DECK_FIRE: UserDeck = {
  id: 'deck_fire_basic',
  name: '火文明ベーシックデッキ',
  keyCardId: 'BR-10', // ボルカノ・ドラゴン
  cards: [
    { cardId: 'BR-01', count: 4 }, // レクス (2)
    { cardId: 'BR-02', count: 4 }, // ダンク (2)
    { cardId: 'BR-03', count: 4 }, // ゼルガン (2)
    { cardId: 'BR-04', count: 4 }, // ラグナ (3)
    { cardId: 'BR-05', count: 4 }, // タルカス (3)
    { cardId: 'BR-07', count: 4 }, // キース (4)
    { cardId: 'BR-08', count: 4 }, // クリムゾン・ドラゴン (5)
    { cardId: 'BR-10', count: 4 }, // ボルカノ・ドラゴン (6)
    { cardId: 'BR-11', count: 4 }, // グレンバーン (4進化)
    { cardId: 'BR-12', count: 4 }, // フレイム・ダーツ (2スペル)
  ],
  createdAt: 1700000003000,
  updatedAt: 1700000003000,
};

export const STARTER_DECK_EARTH: UserDeck = {
  id: 'deck_earth_basic',
  name: '自然文明ベーシックデッキ',
  keyCardId: 'BG-11', // 万虫覇王 アトラスロード
  cards: [
    { cardId: 'BG-01', count: 4 }, // 翡翠の牙 (2)
    { cardId: 'BG-02', count: 4 }, // 黒鉄の棍棒 (2)
    { cardId: 'BG-03', count: 4 }, // ブロンズ・ビートル (3)
    { cardId: 'BG-04', count: 4 }, // 黄金の首飾り (3)
    { cardId: 'BG-05', count: 4 }, // アシッド・マンティス (4)
    { cardId: 'BG-07', count: 4 }, // グランド・ヘラクレス (5)
    { cardId: 'BG-08', count: 4 }, // シャドウ・スティンガー (5)
    { cardId: 'BG-09', count: 4 }, // 夜明けの巨人 (6)
    { cardId: 'BG-11', count: 4 }, // 万虫覇王 アトラスロード (6進化)
    { cardId: 'BG-12', count: 4 }, // 大地の息吹 (2スペル)
  ],
  createdAt: 1700000004000,
  updatedAt: 1700000004000,
};

export const STARTER_DECK_CONTROL = STARTER_DECK_WATER;

export const DEFAULT_PRESET_DECKS: UserDeck[] = [
  STARTER_DECK_LIGHT,
  STARTER_DECK_WATER,
  STARTER_DECK_DARK,
  STARTER_DECK_FIRE,
  STARTER_DECK_EARTH,
];

// 系統色・アイコン定義
export const ELEMENT_ICONS: Record<string, { label: string; bg: string; text: string; iconChar: string; border: string }> = {
  Light: { label: '光', bg: 'bg-amber-400', text: 'text-amber-300', iconChar: '◎', border: 'border-amber-400' },
  Water: { label: '水', bg: 'bg-cyan-500', text: 'text-cyan-400', iconChar: '≈', border: 'border-cyan-400' },
  Dark: { label: '闇', bg: 'bg-purple-600', text: 'text-purple-400', iconChar: 'Ψ', border: 'border-purple-500' },
  Fire: { label: '火', bg: 'bg-red-600', text: 'text-red-400', iconChar: '⚙', border: 'border-red-500' },
  Earth: { label: '地', bg: 'bg-emerald-600', text: 'text-emerald-400', iconChar: '※', border: 'border-emerald-500' },
  Neutral: { label: '無', bg: 'bg-slate-500', text: 'text-slate-300', iconChar: '◇', border: 'border-slate-400' },
};

export const normalizeElement = (el: string | undefined): 'Light' | 'Water' | 'Dark' | 'Fire' | 'Earth' | 'Neutral' => {
  if (!el) return 'Neutral';
  if (el === '光' || el === 'Light') return 'Light';
  if (el === '水' || el === 'Water') return 'Water';
  if (el === '闇' || el === 'Dark') return 'Dark';
  if (el === '火' || el === 'Fire') return 'Fire';
  if (el === '地' || el === 'Earth' || el === '自然') return 'Earth';
  return 'Neutral';
};

// プレイマット一覧
const PLAYMAT_LIST = [
  { id: 'none', name: 'プレイマットなし', color: 'from-slate-900 via-blue-950 to-slate-950' },
  { id: 'divine', name: '聖域の白銀', color: 'from-amber-950/60 via-slate-900 to-amber-900/60' },
  { id: 'magma', name: '紅蓮の溶岩', color: 'from-red-950/60 via-slate-900 to-orange-950/60' },
  { id: 'abyss', name: '深淵の水鏡', color: 'from-cyan-950/60 via-slate-900 to-blue-950/60' },
];

export const DeckManager: React.FC<{ onBackToBattle: (deck: UserDeck) => void }> = ({ onBackToBattle }) => {
  const [viewMode, setViewMode] = useState<'LIST' | 'EDIT'>('LIST');
  const [decks, setDecks] = useState<UserDeck[]>([]);
  const [selectedDeckId, setSelectedDeckId] = useState<string>('');
  const [editingDeck, setEditingDeck] = useState<UserDeck | null>(null);

  // デッキ確認モーダル
  const [showDeckConfirmModal, setShowDeckConfirmModal] = useState<boolean>(false);
  const [confirmTargetDeck, setConfirmTargetDeck] = useState<UserDeck | null>(null);

  // デッキ名編集モーダル
  const [editingNameDeckId, setEditingNameDeckId] = useState<string | null>(null);
  const [editingNameValue, setEditingNameValue] = useState<string>('');

  // プレイマット選択インデックス
  const [playmatIdx, setPlaymatIdx] = useState<number>(0);

  // フィルタ・ソート（編集画面用）
  const [selectedElement, setSelectedElement] = useState<string>('ALL');
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<string>('ALL');
  const [showFilterDropdown, setShowFilterDropdown] = useState<boolean>(false);
  const [searchText, setSearchText] = useState<string>('');
  const [sortOrder, setSortOrder] = useState<'cost_asc' | 'cost_desc' | 'atk_desc'>('cost_asc');
  const [previewCard, setPreviewCard] = useState<Card | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2000);
  };

  // 長押しタイマー
  const longPressTimerRef = useRef<NodeJS.Timeout | number | null>(null);
  const isLongPressRef = useRef(false);

  // 初期ロード
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    const activeId = localStorage.getItem(ACTIVE_DECK_KEY);
    if (saved) {
      try {
        const parsed: UserDeck[] = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setDecks(parsed);
          setSelectedDeckId(activeId && parsed.some(d => d.id === activeId) ? activeId : parsed[0].id);
          return;
        }
      } catch (e) {
        console.error('デッキ読み込み失敗:', e);
      }
    }
    setDecks(DEFAULT_PRESET_DECKS);
    setSelectedDeckId(DEFAULT_PRESET_DECKS[0].id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(DEFAULT_PRESET_DECKS));
    localStorage.setItem(ACTIVE_DECK_KEY, DEFAULT_PRESET_DECKS[0].id);
  }, []);

  const currentSelectedDeck = decks.find(d => d.id === selectedDeckId) || decks[0] || DEFAULT_PRESET_DECKS[0];

  // 統計情報計算
  const getDeckStats = (deck: UserDeck) => {
    const totalCount = deck.cards.reduce((sum, c) => sum + c.count, 0);
    // マナカーブ: ~1, 2, 3, 4, 5, 6, 7, 8+
    const costCurve = [0, 0, 0, 0, 0, 0, 0, 0];
    const elementCounts: Record<'Light' | 'Water' | 'Dark' | 'Fire' | 'Earth' | 'Neutral', number> = {
      Light: 0, Water: 0, Dark: 0, Fire: 0, Earth: 0, Neutral: 0
    };
    let unitCount = 0;
    let spellCount = 0;
    let runeCount = 0;
    let domainCount = 0;
    let triggerCount = 0;

    deck.cards.forEach(entry => {
      const card = CARDS.find(c => c.id === entry.cardId);
      if (!card) return;
      const c = card.cost <= 1 ? 0 : card.cost >= 8 ? 7 : card.cost - 1;
      costCurve[c] += entry.count;

      const el = normalizeElement(card.element || card.system);
      elementCounts[el] += entry.count;

      const ct = (card.cardType || card.type || '').toUpperCase();
      if (ct === 'UNIT' || ct === 'EVOLUTION') unitCount += entry.count;
      else if (ct === 'SPELL') spellCount += entry.count;
      else if (ct === 'RUNE') {
        runeCount += entry.count;
        triggerCount += entry.count;
      } else if (ct === 'DOMAIN') domainCount += entry.count;

      if (ct !== 'RUNE' && (card.effectText || '').includes('結界が破壊された時')) {
        triggerCount += entry.count;
      }
    });

    return { totalCount, costCurve, elementCounts, unitCount, spellCount, runeCount, domainCount, triggerCount };
  };

  const listStats = useMemo(() => getDeckStats(currentSelectedDeck), [currentSelectedDeck]);
  const editStats = useMemo(() => editingDeck ? getDeckStats(editingDeck) : listStats, [editingDeck, listStats]);

  // 新規作成
  const handleCreateNewDeck = () => {
    if (decks.length >= 30) {
      alert('デッキの作成上限（30個）に達しています。');
      return;
    }
    const newDeck: UserDeck = {
      id: 'deck_' + Date.now(),
      name: `デッキ${decks.length + 1}`,
      keyCardId: 'BR-01',
      cards: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    setEditingDeck(newDeck);
    setViewMode('EDIT');
  };

  // 編集開始
  const handleStartEdit = (targetDeck?: UserDeck) => {
    const deckToEdit = targetDeck || currentSelectedDeck;
    setEditingDeck(JSON.parse(JSON.stringify(deckToEdit)));
    setViewMode('EDIT');
  };

  // デッキ削除
  const handleDeleteDeck = (deckId: string) => {
    if (decks.length <= 1) {
      alert('最低1つのデッキを保持する必要があります。');
      return;
    }
    const target = decks.find(d => d.id === deckId);
    if (!confirm(`デッキ「${target?.name || '選択デッキ'}」を削除しますか？`)) return;

    const updated = decks.filter(d => d.id !== deckId);
    setDecks(updated);
    setSelectedDeckId(updated[0].id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    localStorage.setItem(ACTIVE_DECK_KEY, updated[0].id);
  };

  // デッキ保存
  const handleSaveDeck = () => {
    if (!editingDeck) return;
    if (editStats.totalCount !== 40) {
      alert(`デッキ枚数はちょうど40枚である必要があります（現在: ${editStats.totalCount}枚）`);
      return;
    }
    const exists = decks.some(d => d.id === editingDeck.id);
    const updated = exists
      ? decks.map(d => d.id === editingDeck.id ? { ...editingDeck, updatedAt: Date.now() } : d)
      : [...decks, { ...editingDeck, updatedAt: Date.now() }];

    setDecks(updated);
    setSelectedDeckId(editingDeck.id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    localStorage.setItem(ACTIVE_DECK_KEY, editingDeck.id);
    setViewMode('LIST');
  };

  // デッキ名更新
  const handleConfirmRename = () => {
    if (!editingNameDeckId) return;
    const name = editingNameValue.trim() || '名称未設定デッキ';
    const updated = decks.map(d => d.id === editingNameDeckId ? { ...d, name, updatedAt: Date.now() } : d);
    setDecks(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    setEditingNameDeckId(null);
  };

  // カードプールフィルタ＆ソート
  const filteredPool = useMemo(() => {
    return CARDS.filter(card => {
      if (selectedElement !== 'ALL') {
        const el = normalizeElement(card.element || card.system);
        if (el !== selectedElement) return false;
      }
      if (selectedTypeFilter !== 'ALL') {
        const ct = (card.cardType || card.type || '').toUpperCase();
        if (selectedTypeFilter === 'UNIT' && ct !== 'UNIT' && ct !== 'EVOLUTION') return false;
        if (selectedTypeFilter === 'SPELL' && ct !== 'SPELL') return false;
        if (selectedTypeFilter === 'RUNE' && ct !== 'RUNE') return false;
        if (selectedTypeFilter === 'DOMAIN' && ct !== 'DOMAIN') return false;
      }
      if (searchText.trim()) {
        const query = searchText.toLowerCase();
        const matchesName = card.name.toLowerCase().includes(query);
        const matchesEffect = (card.effectText || '').toLowerCase().includes(query);
        const matchesType = (card.type || '').toLowerCase().includes(query);
        if (!matchesName && !matchesEffect && !matchesType) return false;
      }
      return true;
    }).sort((a, b) => {
      if (sortOrder === 'cost_asc') {
        if (a.cost !== b.cost) return a.cost - b.cost;
        return (b.atk ?? 0) - (a.atk ?? 0);
      } else if (sortOrder === 'cost_desc') {
        if (a.cost !== b.cost) return b.cost - a.cost;
        return (b.atk ?? 0) - (a.atk ?? 0);
      } else {
        return (b.atk ?? 0) - (a.atk ?? 0);
      }
    });
  }, [selectedElement, selectedTypeFilter, searchText, sortOrder]);

  // オススメ自動補充機能（デュエプレの「オススメ」機能再現）
  const handleRecommend = () => {
    if (!editingDeck) return;
    const currentTotal = editStats.totalCount;
    if (currentTotal >= 40) {
      triggerToast('デッキはすでに40枚揃っています');
      return;
    }

    // 主要属性を特定
    let dominantElement: 'Light' | 'Water' | 'Dark' | 'Fire' | 'Earth' | 'Neutral' = 'Fire';
    let maxElCount = -1;
    const elKeys = Object.keys(editStats.elementCounts) as Array<'Light' | 'Water' | 'Dark' | 'Fire' | 'Earth' | 'Neutral'>;
    elKeys.forEach(el => {
      if (editStats.elementCounts[el] > maxElCount) {
        maxElCount = editStats.elementCounts[el];
        dominantElement = el;
      }
    });

    // 属性に合ったカードプールから適したカードを抽出
    const candidates = CARDS.filter(c => {
      const el = normalizeElement(c.element || c.system);
      return el === dominantElement || el === 'Neutral';
    }).sort((a, b) => a.cost - b.cost);

    let newCards = [...editingDeck.cards];
    let addedCount = 0;
    const needed = 40 - currentTotal;

    for (const cand of candidates) {
      if (addedCount >= needed) break;
      const existing = newCards.find(c => c.cardId === cand.id);
      const cur = existing ? existing.count : 0;
      const canAdd = Math.min(4 - cur, needed - addedCount);
      if (canAdd > 0) {
        if (existing) {
          newCards = newCards.map(c => c.cardId === cand.id ? { ...c, count: c.count + canAdd } : c);
        } else {
          newCards.push({ cardId: cand.id, count: canAdd });
        }
        addedCount += canAdd;
      }
    }

    setEditingDeck({
      ...editingDeck,
      cards: newCards,
    });
    triggerToast(`オススメカードを ${addedCount}枚 追加しました！`);
  };

  // カード追加・削除
  const handleAddCardToEdit = (card: Card) => {
    if (!editingDeck) return;
    if (editStats.totalCount >= 40) return;
    const currentEntry = editingDeck.cards.find(c => c.cardId === card.id);
    if (currentEntry && currentEntry.count >= 4) return;

    let newCards = [...editingDeck.cards];
    if (currentEntry) {
      newCards = newCards.map(c => c.cardId === card.id ? { ...c, count: c.count + 1 } : c);
    } else {
      newCards.push({ cardId: card.id, count: 1 });
    }
    // 初めてのカードならキーカードにする
    const keyId = editingDeck.keyCardId || card.id;
    setEditingDeck({ ...editingDeck, cards: newCards, keyCardId: keyId });
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

  // 長押しプレビュー
  const handlePointerDownCard = (card: Card) => {
    isLongPressRef.current = false;
    longPressTimerRef.current = setTimeout(() => {
      isLongPressRef.current = true;
      setPreviewCard(card);
    }, 400);
  };

  const handlePointerUpOrLeaveCard = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current as NodeJS.Timeout);
      longPressTimerRef.current = null;
    }
  };

  // キーカードデータ取得
  const getKeyCard = (deck: UserDeck) => {
    if (deck.keyCardId) {
      const found = CARDS.find(c => c.id === deck.keyCardId);
      if (found) return found;
    }
    if (deck.cards.length > 0) {
      // 最もコストが高いカードをデフォルトのキーカードとする
      const sorted = [...deck.cards]
        .map(entry => CARDS.find(c => c.id === entry.cardId))
        .filter((c): c is Card => c !== undefined)
        .sort((a, b) => b.cost - a.cost);
      if (sorted[0]) return sorted[0];
    }
    return CARDS[0];
  };

  const currentKeyCard = getKeyCard(viewMode === 'EDIT' && editingDeck ? editingDeck : currentSelectedDeck);

  return (
    <div 
      className="fixed inset-0 w-screen h-screen bg-[#060b1c] text-white select-none overflow-hidden font-sans flex flex-col"
      style={{
        backgroundImage: 'radial-gradient(ellipse at 50% 20%, #0d214d 0%, #060b1c 85%)',
        touchAction: 'none'
      }}
    >
      {/* 詳細HUDプレビュー */}
      <FloatingCardPreview card={previewCard} onClose={() => setPreviewCard(null)} />

      {/* ================================================================= */}
      {/* 画面1：【デッキ一覧画面（画像1枚目完全再現）】 */}
      {/* ================================================================= */}
      {viewMode === 'LIST' && (
        <div className="flex-1 flex flex-col h-full overflow-hidden">
          {/* 1. 最上部ヘッダー */}
          <div className="h-14 px-5 flex items-center justify-between border-b border-cyan-900/60 bg-[#07132e]/90 backdrop-blur-md shadow-lg shrink-0">
            <div className="flex items-center gap-4">
              {/* デュエプレ風 赤いメタリック台形「戻る」ボタン */}
              <button
                type="button"
                onClick={() => onBackToBattle(currentSelectedDeck)}
                className="relative px-5 py-1.5 bg-gradient-to-b from-red-500 via-red-600 to-red-800 hover:from-red-400 hover:to-red-700 text-white font-black italic rounded-lg shadow-[0_0_12px_rgba(239,68,68,0.5)] border-2 border-red-300/60 text-sm tracking-wider active:scale-95 transition-all cursor-pointer flex items-center gap-1"
                style={{ clipPath: 'polygon(8% 0%, 92% 0%, 100% 50%, 92% 100%, 8% 100%, 0% 50%)' }}
              >
                <span className="px-1">戻る</span>
              </button>

              <div className="flex items-baseline gap-2">
                <span className="text-xl font-black italic tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-cyan-200 to-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
                  SCRIPTIA デッキ一覧
                </span>
                <span className="text-xs font-bold text-cyan-400/80 font-mono">Ver 0.07</span>
              </div>
            </div>

            {/* 作成デッキカウンター */}
            <div className="flex items-center gap-3">
              <div className="px-3.5 py-1 rounded-full bg-slate-900/90 border border-cyan-700/60 flex items-center gap-1.5 text-xs font-bold shadow-inner">
                <span className="text-slate-400">作成デッキ</span>
                <span className="text-cyan-300 font-mono text-sm font-black">{decks.length}</span>
                <span className="text-slate-500">/ 30</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  // ソート反転などのギミック
                  setDecks([...decks].reverse());
                }}
                className="px-3 py-1 rounded-full bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white text-xs font-bold flex items-center gap-1 transition-all cursor-pointer"
              >
                <span>新しい順</span>
                <RefreshCw size={11} className="text-cyan-400" />
              </button>
            </div>
          </div>

          {/* メインエリア（2カラム：左デッキグリッド ＋ 右詳細プレビュー） */}
          <div className="flex-1 flex p-4 gap-4 overflow-hidden min-h-0">
            {/* 左側：デッキグリッド（2列） */}
            <div className="flex-1 flex flex-col bg-[#08132b]/80 border border-cyan-900/50 rounded-2xl p-3.5 shadow-2xl overflow-hidden">
              {/* グリッドヘッダー */}
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-cyan-900/40 shrink-0">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-4 bg-gradient-to-b from-cyan-400 to-blue-600 rounded-xs" />
                  <span className="text-xs font-black text-cyan-300 tracking-wider">デッキ選択</span>
                </div>
                <span className="text-[11px] text-slate-400">クリックで選択 / 詳細表示</span>
              </div>

              {/* デッキタイル一覧 */}
              <div className="flex-1 grid grid-cols-2 gap-3 overflow-y-auto pr-1.5 custom-scrollbar content-start">
                {/* 1. 先頭枠：「＋ 新規作成」タイル */}
                <div
                  onClick={handleCreateNewDeck}
                  className="h-28 rounded-xl border-2 border-dashed border-cyan-500/50 hover:border-cyan-300 bg-[#0a1838]/60 hover:bg-cyan-950/30 flex flex-col items-center justify-center cursor-pointer transition-all group shadow-md hover:shadow-[0_0_20px_rgba(6,182,212,0.3)] active:scale-[0.98]"
                >
                  <div className="w-10 h-10 rounded-full bg-cyan-950/80 border border-cyan-400/60 flex items-center justify-center text-cyan-300 text-2xl font-black group-hover:scale-110 group-hover:bg-cyan-500 group-hover:text-black transition-all mb-1 shadow">
                    ＋
                  </div>
                  <span className="text-xs font-black text-cyan-200 tracking-wider group-hover:text-white">
                    新規作成
                  </span>
                </div>

                {/* 2. 各デッキタイル */}
                {decks.map(deck => {
                  const isSelected = deck.id === currentSelectedDeck.id;
                  const stats = getDeckStats(deck);
                  const keyCard = getKeyCard(deck);
                  const el = normalizeElement(keyCard.element || keyCard.system);
                  const elStyle = ELEMENT_ICONS[el];

                  return (
                    <div
                      key={deck.id}
                      onClick={() => setSelectedDeckId(deck.id)}
                      className={`h-28 rounded-xl p-2.5 flex flex-col justify-between cursor-pointer transition-all border-2 relative overflow-hidden group select-none shadow-md ${
                        isSelected
                          ? 'border-amber-400 bg-gradient-to-r from-[#112959] to-[#0c1f45] shadow-[0_0_25px_rgba(245,158,11,0.5)] scale-[1.01]'
                          : 'border-cyan-900/60 bg-[#09152e] hover:border-cyan-500/70 hover:bg-[#0c1c3f]'
                      }`}
                    >
                      {/* 背景イラスト（薄い切り抜き） */}
                      <div className="absolute right-0 top-0 bottom-0 w-36 opacity-25 group-hover:opacity-35 pointer-events-none transition-opacity bg-gradient-to-l from-transparent via-[#0a1838] to-[#09152e] flex items-center justify-end overflow-hidden">
                        <div className="w-full h-full flex items-center justify-center font-black text-4xl text-cyan-400/10 italic">
                          {keyCard.name.slice(0, 4)}
                        </div>
                      </div>

                      {/* 上部：デッキ名 ＆ 枚数バッジ */}
                      <div className="flex items-center justify-between z-10 gap-1">
                        <div className="flex items-center gap-1.5 overflow-hidden">
                          <span className={`w-2 h-2 rounded-full ${elStyle.bg} shadow-sm shrink-0`} />
                          <span className="font-black text-xs text-white truncate drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)] group-hover:text-cyan-200">
                            {deck.name}
                          </span>
                        </div>
                        <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded shrink-0 ${
                          stats.totalCount === 40 ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-700/60' : 'bg-amber-950/80 text-amber-300 border border-amber-700/60'
                        }`}>
                          {stats.totalCount}/40
                        </span>
                      </div>

                      {/* 中央：キーカード名 */}
                      <div className="z-10 text-[10px] text-cyan-400/80 font-bold truncate">
                        Key: {keyCard.name}
                      </div>

                      {/* 下部：6系統のアイコン別枚数（画像1枚目再現：光 水 闇 火 地 無） */}
                      <div className="z-10 flex items-center justify-between pt-1 border-t border-cyan-900/40 text-[10px] font-mono">
                        <div className="flex items-center gap-2">
                          <span className="flex items-center gap-0.5 text-amber-300" title="光">
                            <span className="text-[9px]">◎</span>{stats.elementCounts.Light}
                          </span>
                          <span className="flex items-center gap-0.5 text-cyan-300" title="水">
                            <span className="text-[9px]">≈</span>{stats.elementCounts.Water}
                          </span>
                          <span className="flex items-center gap-0.5 text-purple-300" title="闇">
                            <span className="text-[9px]">Ψ</span>{stats.elementCounts.Dark}
                          </span>
                          <span className="flex items-center gap-0.5 text-red-400" title="火">
                            <span className="text-[9px]">⚙</span>{stats.elementCounts.Fire}
                          </span>
                          <span className="flex items-center gap-0.5 text-emerald-300" title="地">
                            <span className="text-[9px]">※</span>{stats.elementCounts.Earth}
                          </span>
                        </div>
                        {stats.elementCounts.Neutral > 0 && (
                          <span className="text-slate-400">◇{stats.elementCounts.Neutral}</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 右側：選択デッキの詳細プレビューパネル（画像1枚目右側完全再現） */}
            <div className="w-[430px] bg-[#091530]/95 border-2 border-cyan-800/80 rounded-2xl p-4 flex flex-col justify-between shadow-2xl shrink-0 overflow-hidden">
              <div className="space-y-3">
                {/* 1. キーカードのワイドなイラストバナー枠 */}
                <div className="relative w-full h-32 rounded-xl bg-gradient-to-br from-slate-900 via-[#0e214d] to-slate-950 border-2 border-cyan-600/60 overflow-hidden shadow-inner flex items-center justify-between p-3 group">
                  {/* 「キーカード」リボンバッジ */}
                  <div className="absolute top-0 left-0 bg-gradient-to-r from-amber-500 to-yellow-400 text-black font-black text-[10px] px-3 py-0.5 rounded-br-lg shadow-md z-10 flex items-center gap-1">
                    <Sparkles size={10} />
                    <span>キーカード</span>
                  </div>

                  <div className="z-10 mt-3 max-w-[240px]">
                    <div className="text-xs font-black text-amber-300 drop-shadow">
                      ★ {currentKeyCard.cost} COST • {currentKeyCard.type || currentKeyCard.cardType}
                    </div>
                    <div className="text-base font-black text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.9)] truncate mt-0.5">
                      {currentKeyCard.name}
                    </div>
                    <div className="text-[10px] text-cyan-200/90 line-clamp-2 mt-1 drop-shadow leading-tight">
                      {currentKeyCard.effectText || '通常ユニット。強靭な意志で戦場を切り拓く。'}
                    </div>
                  </div>

                  {/* キーカードのスタッツバッジ */}
                  <div className="z-10 flex flex-col items-end shrink-0 gap-1">
                    <div className="w-10 h-10 rounded-full bg-amber-500/90 border-2 border-amber-300 flex items-center justify-center font-black text-base text-black shadow-lg">
                      {currentKeyCard.cost}
                    </div>
                    {(currentKeyCard.atk !== undefined) && (
                      <div className="bg-slate-950/80 px-2 py-0.5 rounded text-[10px] font-bold border border-slate-700 text-red-300">
                        ATK {currentKeyCard.atk} / DEF {currentKeyCard.def}
                      </div>
                    )}
                  </div>
                </div>

                {/* 2. 系統別枚数アイコン行（光・水・闇・火・地・無） */}
                <div className="flex items-center justify-between bg-slate-950/80 px-3 py-1.5 rounded-lg border border-cyan-900/60 text-xs font-mono font-bold">
                  <span className="flex items-center gap-1 text-amber-300">
                    <span className="w-3.5 h-3.5 rounded-full bg-amber-400/20 border border-amber-400 text-[10px] flex items-center justify-center">◎</span>
                    {listStats.elementCounts.Light}
                  </span>
                  <span className="flex items-center gap-1 text-cyan-300">
                    <span className="w-3.5 h-3.5 rounded-full bg-cyan-400/20 border border-cyan-400 text-[10px] flex items-center justify-center">≈</span>
                    {listStats.elementCounts.Water}
                  </span>
                  <span className="flex items-center gap-1 text-purple-300">
                    <span className="w-3.5 h-3.5 rounded-full bg-purple-400/20 border border-purple-400 text-[10px] flex items-center justify-center">Ψ</span>
                    {listStats.elementCounts.Dark}
                  </span>
                  <span className="flex items-center gap-1 text-red-400">
                    <span className="w-3.5 h-3.5 rounded-full bg-red-400/20 border border-red-400 text-[10px] flex items-center justify-center">⚙</span>
                    {listStats.elementCounts.Fire}
                  </span>
                  <span className="flex items-center gap-1 text-emerald-300">
                    <span className="w-3.5 h-3.5 rounded-full bg-emerald-400/20 border border-emerald-400 text-[10px] flex items-center justify-center">※</span>
                    {listStats.elementCounts.Earth}
                  </span>
                  <span className="flex items-center gap-1 text-slate-400">
                    <span className="w-3.5 h-3.5 rounded-full bg-slate-400/20 border border-slate-400 text-[10px] flex items-center justify-center">◇</span>
                    {listStats.elementCounts.Neutral}
                  </span>
                </div>

                {/* 3. マナカーブ棒グラフ（オレンジ色の棒グラフ：~1〜8+ ＆ ルーン/トリガー） */}
                <div className="bg-slate-950/80 p-2.5 rounded-xl border border-cyan-900/60">
                  <div className="flex items-center justify-between text-[10px] text-slate-400 font-bold mb-1">
                    <span>マナカーブ</span>
                    <span className="text-amber-400">⚡ ルーン/トリガー: {listStats.triggerCount}枚</span>
                  </div>
                  <div className="flex items-end justify-between h-14 px-1">
                    {[1, 2, 3, 4, 5, 6, 7, 8].map((cost, idx) => {
                      const count = listStats.costCurve[idx];
                      const maxC = Math.max(...listStats.costCurve, 8);
                      const barHeight = Math.min(100, Math.max(6, (count / maxC) * 100));
                      return (
                        <div key={cost} className="flex flex-col items-center gap-0.5 w-6">
                          <span className="text-[9px] font-bold text-amber-400 font-mono">
                            {count > 0 ? count : ''}
                          </span>
                          <div
                            style={{ height: `${count === 0 ? 3 : barHeight}%` }}
                            className={`w-3.5 rounded-t-sm transition-all ${
                              count > 0
                                ? 'bg-gradient-to-t from-orange-600 via-amber-500 to-amber-300 shadow-[0_0_8px_rgba(245,158,11,0.5)]'
                                : 'bg-slate-800'
                            }`}
                          />
                          <span className="text-[8.5px] text-slate-400 font-mono">{cost === 8 ? '8~' : cost === 1 ? '~1' : cost}</span>
                        </div>
                      );
                    })}
                    {/* 右端：⚡トリガー/ルーン棒 */}
                    <div className="flex flex-col items-center gap-0.5 w-6 border-l border-slate-800 pl-1">
                      <span className="text-[9px] font-bold text-yellow-300 font-mono">{listStats.triggerCount || ''}</span>
                      <div
                        style={{ height: `${Math.min(100, Math.max(6, (listStats.triggerCount / 10) * 100))}%` }}
                        className="w-3.5 rounded-t-sm bg-gradient-to-t from-yellow-600 to-yellow-300 shadow-[0_0_8px_rgba(234,179,8,0.5)]"
                      />
                      <span className="text-[8.5px] text-yellow-400 font-bold">⚡</span>
                    </div>
                  </div>
                </div>

                {/* 4. デッキ名 ＆ 編集ペンシル ＆ 種別内訳 ＆ 総枚数 */}
                <div className="flex items-center justify-between gap-2 bg-slate-900/80 p-2.5 rounded-xl border border-cyan-900/60">
                  <div className="flex-1 overflow-hidden">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-black text-white truncate">{currentSelectedDeck.name}</span>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingNameDeckId(currentSelectedDeck.id);
                          setEditingNameValue(currentSelectedDeck.name);
                        }}
                        className="p-1 text-cyan-400 hover:text-white rounded hover:bg-cyan-950/60 transition-colors"
                        title="デッキ名を変更"
                      >
                        <Edit2 size={13} />
                      </button>
                    </div>
                    <div className="flex items-center gap-3 text-[10px] text-slate-400 font-bold mt-0.5">
                      <span>ユニット {listStats.unitCount}</span>
                      <span>スペル {listStats.spellCount}</span>
                      <span>ルーン {listStats.runeCount}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 bg-slate-950 px-2.5 py-1.5 rounded-lg border border-cyan-800/60 font-mono">
                    <Layers size={14} className="text-cyan-400" />
                    <span className={`text-xs font-black ${listStats.totalCount === 40 ? 'text-emerald-400' : 'text-amber-400'}`}>
                      {listStats.totalCount}/40
                    </span>
                  </div>
                </div>

                {/* 5. プレイマット / プロテクト プレビューエリア（画像1枚目再現） */}
                <div className="border border-cyan-900/60 rounded-xl p-2.5 bg-slate-950/70">
                  <div className="flex items-center justify-between text-[10px] text-cyan-300/80 font-bold mb-1.5">
                    <span>プレイマット / プロテクト</span>
                    <button
                      type="button"
                      onClick={() => setPlaymatIdx((playmatIdx + 1) % PLAYMAT_LIST.length)}
                      className="text-cyan-400 hover:text-white flex items-center gap-1 cursor-pointer"
                    >
                      <span>変更</span>
                      <RefreshCw size={10} />
                    </button>
                  </div>
                  <div className="flex gap-2 h-14">
                    {/* プレイマットプレビュー */}
                    <div className={`flex-1 rounded-lg bg-gradient-to-r ${PLAYMAT_LIST[playmatIdx].color} border border-cyan-700/40 flex items-center justify-center text-xs font-black text-amber-300/90 shadow-inner`}>
                      {PLAYMAT_LIST[playmatIdx].name}
                    </div>
                    {/* プロテクト（スリーブ裏面） */}
                    <div className="w-10 h-full rounded-lg bg-gradient-to-b from-blue-700 to-indigo-950 border-2 border-cyan-400 flex items-center justify-center text-[9px] font-black text-cyan-200 shadow-md">
                      SCRIPTIA
                    </div>
                  </div>
                </div>
              </div>

              {/* 下部アクションボタン（画像1枚目再現：デッキ削除・デッキ確認・デッキ編成） */}
              <div className="flex gap-2.5 pt-3 border-t border-cyan-900/60 shrink-0">
                {/* デッキ削除ボタン */}
                <button
                  type="button"
                  onClick={() => handleDeleteDeck(currentSelectedDeck.id)}
                  className="px-3.5 py-2.5 bg-gradient-to-b from-red-600 to-red-900 hover:from-red-500 hover:to-red-800 text-white font-bold rounded-xl border border-red-400/50 shadow-md text-xs active:scale-95 transition-all cursor-pointer flex items-center gap-1 shrink-0"
                >
                  <Trash2 size={13} />
                  <span>デッキ削除</span>
                </button>

                {/* デッキ確認ボタン */}
                <button
                  type="button"
                  onClick={() => {
                    setConfirmTargetDeck(currentSelectedDeck);
                    setShowDeckConfirmModal(true);
                  }}
                  className="px-4 py-2.5 bg-gradient-to-b from-slate-200 to-slate-400 hover:from-white hover:to-slate-300 text-slate-900 font-black rounded-xl border border-white/80 shadow-md text-xs active:scale-95 transition-all cursor-pointer flex items-center gap-1 shrink-0"
                >
                  <Eye size={13} />
                  <span>デッキ確認</span>
                </button>

                {/* デッキ編成ボタン */}
                <button
                  type="button"
                  onClick={() => handleStartEdit(currentSelectedDeck)}
                  className="flex-1 py-2.5 bg-gradient-to-r from-blue-600 via-cyan-500 to-blue-600 hover:from-blue-500 hover:to-cyan-400 text-white font-black rounded-xl border border-cyan-300/60 shadow-[0_0_20px_rgba(6,182,212,0.6)] text-sm tracking-wider active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Edit2 size={14} />
                  <span>デッキ編成</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* 画面2：【デッキ編成画面（画像2枚目完全再現）】 */}
      {/* ================================================================= */}
      {viewMode === 'EDIT' && editingDeck && (
        <div className="flex-1 flex flex-col h-full overflow-hidden">
          {/* 1. 最上部ステータスバー（画像2枚目完全再現） */}
          <div className="h-14 px-4 bg-[#07132e]/95 border-b border-cyan-900/60 flex items-center justify-between gap-3 shadow-md shrink-0">
            {/* 左端：赤い立体「戻る」ボタン */}
            <button
              type="button"
              onClick={() => {
                if (editStats.totalCount !== 40) {
                  if (!confirm('デッキが40枚揃っていません。編集を破棄して一覧へ戻りますか？')) return;
                }
                setViewMode('LIST');
              }}
              className="relative px-4 py-1.5 bg-gradient-to-b from-red-500 via-red-600 to-red-800 hover:from-red-400 hover:to-red-700 text-white font-black italic rounded-lg shadow-[0_0_12px_rgba(239,68,68,0.5)] border-2 border-red-300/60 text-xs tracking-wider active:scale-95 transition-all cursor-pointer flex items-center gap-1 shrink-0"
              style={{ clipPath: 'polygon(8% 0%, 92% 0%, 100% 50%, 92% 100%, 8% 100%, 0% 50%)' }}
            >
              <span className="px-1">戻る</span>
            </button>

            {/* 検索ボックス（Enter text... ＋ 虫眼鏡アイコン） */}
            <div className="relative flex items-center">
              <input
                type="text"
                placeholder="Enter text..."
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                className="w-36 md:w-44 h-8 bg-slate-900/90 border border-cyan-700/60 rounded-full pl-3 pr-8 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 shadow-inner"
              />
              <Search size={13} className="absolute right-2.5 text-cyan-400/80 pointer-events-none" />
            </div>

            {/* ソート切り替え */}
            <button
              type="button"
              onClick={() => {
                if (sortOrder === 'cost_asc') setSortOrder('cost_desc');
                else if (sortOrder === 'cost_desc') setSortOrder('atk_desc');
                else setSortOrder('cost_asc');
              }}
              className="px-2.5 py-1.5 bg-slate-900 hover:bg-slate-800 border border-cyan-800/60 rounded-lg text-xs font-bold text-cyan-200 flex items-center gap-1 shadow transition-all shrink-0 cursor-pointer"
              title="ソート切り替え"
            >
              <ArrowUpDown size={12} className="text-cyan-400" />
              <span>
                {sortOrder === 'cost_asc' ? 'コスト (昇順)' : sortOrder === 'cost_desc' ? 'コスト (降順)' : 'ATK順'}
              </span>
            </button>

            {/* 系統別枚数ミニバッジ（光 水 闇 火 地 無） */}
            <div className="hidden lg:flex items-center gap-2 bg-slate-950/90 px-2.5 py-1 rounded-lg border border-slate-800 text-[11px] font-mono font-bold shrink-0">
              <span className="text-amber-300">◎ {editStats.elementCounts.Light}</span>
              <span className="text-cyan-300">≈ {editStats.elementCounts.Water}</span>
              <span className="text-purple-300">Ψ {editStats.elementCounts.Dark}</span>
              <span className="text-red-400">⚙ {editStats.elementCounts.Fire}</span>
              <span className="text-emerald-300">※ {editStats.elementCounts.Earth}</span>
            </div>

            {/* マナカーブミニバー */}
            <div className="hidden md:flex items-end gap-1 h-8 px-2 bg-slate-950/90 rounded border border-slate-800 shrink-0">
              {editStats.costCurve.map((count, i) => (
                <div key={i} className="flex flex-col items-center w-2.5">
                  <div
                    style={{ height: `${Math.min(100, Math.max(8, count * 12))}%` }}
                    className={`w-2 rounded-t-xs ${count > 0 ? 'bg-amber-400 shadow-[0_0_4px_rgba(245,158,11,0.6)]' : 'bg-slate-800'}`}
                  />
                </div>
              ))}
              <div className="w-2.5 flex flex-col items-center border-l border-slate-800 pl-0.5">
                <div
                  style={{ height: `${Math.min(100, Math.max(8, editStats.triggerCount * 12))}%` }}
                  className="w-2 rounded-t-xs bg-yellow-400"
                />
              </div>
            </div>

            {/* デッキ名 ＆ 枚数カウンター */}
            <div className="flex items-center gap-3 shrink-0 ml-auto">
              <div className="text-right">
                <div className="flex items-center gap-1 justify-end">
                  <span className="text-xs font-black text-cyan-200 truncate max-w-[120px]">{editingDeck.name}</span>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingNameDeckId(editingDeck.id);
                      setEditingNameValue(editingDeck.name);
                    }}
                    className="text-cyan-400 hover:text-white"
                  >
                    <Edit2 size={11} />
                  </button>
                </div>
                <div className="text-[10px] text-slate-400 font-bold">
                  ユニット {editStats.unitCount} / 呪文 {editStats.spellCount + editStats.runeCount}
                </div>
              </div>

              {/* カード束アイコン ＋ X/40 */}
              <div className={`px-2.5 py-1 rounded-lg border font-mono font-black text-xs flex items-center gap-1 shadow-inner ${
                editStats.totalCount === 40 ? 'bg-emerald-950/90 border-emerald-500 text-emerald-300' : 'bg-slate-950/90 border-amber-500/70 text-amber-300'
              }`}>
                <Layers size={13} />
                <span>{editStats.totalCount}/40</span>
              </div>
            </div>
          </div>

          {/* 2. メイン編集エリア（3カラム：左縦タブ ＋ 中央カードプール ＋ 右マイデッキ） */}
          <div className="flex-1 flex overflow-hidden min-h-0">
            {/* 2-1. 左端：縦並び系統切り替えタブ（画像2枚目左側再現） */}
            <div className="w-16 bg-[#050c1f] border-r border-cyan-900/50 flex flex-col items-center py-2.5 gap-1.5 shrink-0 z-10">
              {[
                { id: 'ALL', label: 'ALL', icon: 'ALL', bg: 'bg-gradient-to-br from-slate-600 to-slate-800 text-white' },
                { id: 'Light', label: '光', icon: '◎', bg: 'bg-gradient-to-br from-amber-400 to-yellow-500 text-black shadow-amber-400/40' },
                { id: 'Water', label: '水', icon: '≈', bg: 'bg-gradient-to-br from-cyan-400 to-blue-600 text-black shadow-cyan-400/40' },
                { id: 'Dark', label: '闇', icon: 'Ψ', bg: 'bg-gradient-to-br from-purple-600 to-indigo-900 text-white shadow-purple-500/40' },
                { id: 'Fire', label: '火', icon: '⚙', bg: 'bg-gradient-to-br from-red-500 to-red-700 text-white shadow-red-500/40' },
                { id: 'Earth', label: '地', icon: '※', bg: 'bg-gradient-to-br from-emerald-500 to-teal-700 text-white shadow-emerald-500/40' },
                { id: 'Neutral', label: '無', icon: '◇', bg: 'bg-gradient-to-br from-slate-400 to-slate-600 text-black' },
              ].map(tab => {
                const isActive = selectedElement === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setSelectedElement(tab.id)}
                    className={`relative w-12 h-10 rounded-md flex flex-col items-center justify-center transition-all cursor-pointer font-black ${
                      isActive
                        ? `${tab.bg} scale-105 shadow-[0_0_14px_rgba(255,255,255,0.4)] border border-white/80 z-10`
                        : 'bg-slate-900/90 text-slate-400 hover:text-white border border-slate-800/80 hover:bg-slate-800'
                    }`}
                    style={{ clipPath: 'polygon(15% 0%, 100% 0%, 85% 100%, 0% 100%)' }}
                    title={`${tab.label}系統`}
                  >
                    <span className="text-[11px] font-black">{tab.label}</span>
                  </button>
                );
              })}
            </div>

            {/* 2-2. 中央：カード一覧（Card Pool Browser：4列×2行等、画像2枚目中央再現） */}
            <div className="flex-1 flex flex-col bg-[#071129] border-r border-cyan-900/50 overflow-hidden">
              {/* オレンジのヘッダーバー（「カード一覧」「すべて」「フィルタ」：画像2枚目完全再現） */}
              <div className="h-9 bg-gradient-to-r from-orange-600 via-amber-600 to-orange-600 px-4 flex items-center justify-between text-xs font-black shadow shrink-0 relative z-20">
                <div className="flex items-center gap-2">
                  <span className="text-white tracking-wider drop-shadow">カード一覧</span>
                  <span className="text-[10px] bg-black/40 px-2 py-0.5 rounded-full text-amber-200 font-mono">
                    全 {filteredPool.length} 種
                  </span>
                </div>
                <div className="flex items-center gap-2 relative">
                  {/* 「すべて」ボタン */}
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedElement('ALL');
                      setSelectedTypeFilter('ALL');
                      setSearchText('');
                    }}
                    className="px-3 py-0.5 rounded-full bg-slate-900/80 hover:bg-slate-800 text-[11px] text-white font-bold border border-white/40 shadow transition-all cursor-pointer"
                  >
                    すべて
                  </button>

                  {/* 「フィルタ」ボタン */}
                  <button
                    type="button"
                    onClick={() => setShowFilterDropdown(!showFilterDropdown)}
                    className="px-3 py-0.5 rounded-full bg-slate-900/80 hover:bg-slate-800 text-[11px] text-amber-200 font-bold border border-amber-400/50 shadow transition-all cursor-pointer flex items-center gap-1"
                  >
                    <span>フィルタ</span>
                    <ChevronDown size={12} className={`transition-transform ${showFilterDropdown ? 'rotate-180' : ''}`} />
                  </button>

                  {/* フィルタドロップダウン */}
                  {showFilterDropdown && (
                    <div className="absolute top-8 right-0 bg-[#0a1838] border-2 border-cyan-500 rounded-xl p-2 shadow-2xl z-50 w-44 flex flex-col gap-1">
                      <div className="text-[10px] text-slate-400 font-bold px-2 py-0.5">種別フィルタ</div>
                      {[
                        { id: 'ALL', label: 'すべての種別' },
                        { id: 'UNIT', label: 'ユニット / 進化' },
                        { id: 'SPELL', label: 'スペル (呪文)' },
                        { id: 'RUNE', label: 'ルーン (結界発動)' },
                        { id: 'DOMAIN', label: 'ドメイン (領域)' },
                      ].map(typeItem => (
                        <button
                          key={typeItem.id}
                          type="button"
                          onClick={() => {
                            setSelectedTypeFilter(typeItem.id);
                            setShowFilterDropdown(false);
                          }}
                          className={`px-2 py-1 rounded text-left text-xs font-bold transition-colors ${
                            selectedTypeFilter === typeItem.id
                              ? 'bg-cyan-600 text-white'
                              : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                          }`}
                        >
                          {typeItem.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* カードグリッド（4列） */}
              <div className="flex-1 p-3 overflow-y-auto grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5 content-start custom-scrollbar">
                {filteredPool.map(card => {
                  const inDeckCount = editingDeck.cards.find(c => c.cardId === card.id)?.count || 0;
                  const isMax = inDeckCount >= 4;
                  const isDeckFull = editStats.totalCount >= 40;
                  const el = normalizeElement(card.element || card.system);
                  const elBorder = 
                    el === 'Fire' ? 'border-red-600/60' :
                    el === 'Water' ? 'border-cyan-600/60' :
                    el === 'Earth' ? 'border-emerald-600/60' :
                    el === 'Light' ? 'border-amber-500/60' :
                    el === 'Dark' ? 'border-purple-600/60' : 'border-slate-600/60';

                  return (
                    <div
                      key={card.id}
                      onClick={() => {
                        if (!isLongPressRef.current) {
                          handleAddCardToEdit(card);
                        }
                      }}
                      onPointerDown={() => handlePointerDownCard(card)}
                      onPointerUp={handlePointerUpOrLeaveCard}
                      onPointerLeave={handlePointerUpOrLeaveCard}
                      onContextMenu={(e) => { e.preventDefault(); setPreviewCard(card); }}
                      className={`h-36 rounded-xl border p-2 flex flex-col justify-between cursor-pointer select-none transition-all relative group ${
                        isMax || isDeckFull
                          ? 'bg-slate-950/40 border-slate-800 opacity-60'
                          : `bg-[#0c1836] hover:bg-[#10224d] ${elBorder} hover:border-cyan-400 shadow-md hover:shadow-[0_0_15px_rgba(6,182,212,0.4)] active:scale-95`
                      }`}
                      title="クリックでデッキに追加 / 長押し・右クリックで詳細"
                    >
                      {/* 上部：所持/投入枚数バッジ ＆ コストバブル */}
                      <div className="flex justify-between items-center z-10">
                        {/* 丸いコストバッジ（画像2枚目再現） */}
                        <div className="w-6 h-6 rounded-full bg-gradient-to-br from-amber-300 via-amber-400 to-orange-500 text-black font-black text-xs flex items-center justify-center shadow-md border border-amber-200">
                          {card.cost}
                        </div>

                        {/* 所持/投入枚数バッジ（x4, x1等） */}
                        <span className={`text-[10px] font-mono font-black px-1.5 py-0.5 rounded shadow ${
                          isMax ? 'bg-red-600 text-white' : inDeckCount > 0 ? 'bg-cyan-500 text-black' : 'bg-slate-900 text-slate-400'
                        }`}>
                          x{inDeckCount}
                        </span>
                      </div>

                      {/* 中央：カード名 & 系統メタ */}
                      <div className="z-10 my-1 overflow-hidden">
                        <div className="font-black text-xs text-white truncate drop-shadow group-hover:text-cyan-200">
                          {card.name}
                        </div>
                        <div className="text-[9.5px] text-cyan-400/80 truncate mt-0.5">
                          {formatCardMetaJapanese(card)}
                        </div>
                      </div>

                      {/* 下部：スタッツ（ATK/DEF/BRK）または種別 */}
                      {(card.cardType === 'UNIT' || card.type === 'Unit' || card.cardType === 'EVOLUTION' || card.type === 'Evolution') ? (
                        <div className="z-10 flex justify-between items-center bg-slate-950/90 rounded px-1.5 py-0.5 text-[9.5px] font-bold border border-slate-800">
                          <span className="text-red-400">⚔ {card.atk ?? 0}</span>
                          <span className="text-amber-400">⚡ {card.brk ?? 1}</span>
                          <span className="text-cyan-400">🛡 {card.def ?? 0}</span>
                        </div>
                      ) : (
                        <div className="z-10 text-[9px] text-slate-400 italic py-0.5 text-center bg-slate-950/60 rounded border border-slate-800">
                          {card.type || card.cardType}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 2-3. 右側：マイデッキ（デュエプレ特有の横長カードバーリスト：画像2枚目右側完全再現） */}
            <div className="w-[370px] bg-[#07122b] flex flex-col shrink-0 shadow-2xl overflow-hidden">
              {/* 青いヘッダーバー（「マイデッキ」「オススメ」：画像2枚目再現） */}
              <div className="h-9 bg-gradient-to-r from-blue-700 via-cyan-600 to-blue-700 px-4 flex items-center justify-between text-xs font-black shadow shrink-0">
                <span className="text-white tracking-wider drop-shadow">マイデッキ</span>
                <div className="flex items-center gap-2">
                  <span className={`font-mono text-xs ${editStats.totalCount === 40 ? 'text-emerald-300' : 'text-amber-300'}`}>
                    {editStats.totalCount} / 40
                  </span>
                  <button
                    type="button"
                    onClick={handleRecommend}
                    className="text-[11px] bg-cyan-950/70 hover:bg-cyan-800/80 px-2.5 py-0.5 rounded-full text-cyan-200 border border-cyan-400/50 shadow transition-all cursor-pointer font-bold active:scale-95"
                    title="同系統のカードを自動で40枚までオススメ補充します"
                  >
                    オススメ
                  </button>
                </div>
              </div>

              {/* 横長カードバーリスト（クリックで1枚除外） */}
              <div className="flex-1 p-2.5 overflow-y-auto space-y-1.5 custom-scrollbar min-h-0">
                {editingDeck.cards.map(entry => {
                  const card = CARDS.find(c => c.id === entry.cardId);
                  if (!card) return null;
                  const el = normalizeElement(card.element || card.system);
                  const isUnit = (card.cardType === 'UNIT' || card.type === 'Unit' || card.cardType === 'EVOLUTION' || card.type === 'Evolution');

                  return (
                    <div
                      key={card.id}
                      onClick={() => handleRemoveCardFromEdit(card.id)}
                      className="h-10 rounded-lg bg-gradient-to-r from-[#0d1f42] to-[#091630] hover:bg-red-950/40 border border-cyan-800/60 hover:border-red-500/70 flex items-center justify-between px-2.5 cursor-pointer transition-all group shadow-sm relative overflow-hidden"
                      title="クリックで1枚除外"
                    >
                      {/* 左：丸いコストバッジ ＋ スタッツ */}
                      <div className="flex items-center gap-2 overflow-hidden flex-1 z-10">
                        <span className="w-6 h-6 rounded-full bg-gradient-to-br from-amber-400 to-orange-600 text-white font-black text-xs flex items-center justify-center shrink-0 shadow border border-amber-300">
                          {card.cost}
                        </span>

                        {isUnit && (
                          <span className="text-[11px] font-mono font-bold text-red-300 shrink-0">
                            {card.atk}0+
                          </span>
                        )}

                        <div className="overflow-hidden flex flex-col">
                          <span className="text-xs font-black text-slate-100 truncate group-hover:text-red-300">
                            {card.name}
                          </span>
                        </div>
                      </div>

                      {/* 右端：デッキ内投入枚数バッジ（黒地に白文字「1」「2」「4」） */}
                      <div className="z-10 ml-2">
                        <span className="text-xs font-mono font-black text-cyan-200 bg-black/80 px-2 py-0.5 rounded border border-cyan-900/60 shadow">
                          {entry.count}
                        </span>
                      </div>
                    </div>
                  );
                })}

                {editingDeck.cards.length === 0 && (
                  <div className="h-44 flex flex-col items-center justify-center text-slate-500 text-xs italic text-center p-4 border border-dashed border-slate-800 rounded-xl">
                    <Layers size={24} className="mb-2 text-slate-600" />
                    <span>左のカード一覧からカードを追加してください</span>
                    <span className="text-[10px] text-slate-600 mt-1">（40枚で構築完了）</span>
                  </div>
                )}
              </div>

              {/* 最下部アクションボタン（デッキ確認 ＆ 青紫に光るデッキ保存） */}
              <div className="p-3 border-t border-cyan-900/60 bg-[#061026] flex gap-2.5 shrink-0">
                {/* デッキ確認 */}
                <button
                  type="button"
                  onClick={() => {
                    setConfirmTargetDeck(editingDeck);
                    setShowDeckConfirmModal(true);
                  }}
                  className="px-3.5 py-2.5 bg-gradient-to-b from-slate-200 to-slate-400 hover:from-white hover:to-slate-300 text-slate-900 font-black rounded-xl border border-white/80 shadow-md text-xs active:scale-95 transition-all cursor-pointer flex items-center gap-1 shrink-0"
                >
                  <Eye size={13} />
                  <span>デッキ確認</span>
                </button>

                {/* 青紫に光るデッキ保存ボタン */}
                <button
                  type="button"
                  onClick={handleSaveDeck}
                  disabled={editStats.totalCount !== 40}
                  className={`flex-1 py-2.5 rounded-xl font-black text-xs tracking-wider transition-all flex items-center justify-center gap-1.5 ${
                    editStats.totalCount === 40
                      ? 'bg-gradient-to-r from-blue-600 via-indigo-500 to-cyan-400 hover:from-blue-500 hover:to-cyan-300 text-white shadow-[0_0_22px_rgba(99,102,241,0.6)] cursor-pointer active:scale-95 border border-cyan-300/80 animate-pulse'
                      : 'bg-slate-900 text-slate-500 cursor-not-allowed border border-slate-800'
                  }`}
                >
                  {editStats.totalCount === 40 ? (
                    <>
                      <Sparkles size={14} className="text-yellow-300" />
                      <span>デッキ保存 (40枚完了)</span>
                    </>
                  ) : (
                    <span>40枚必要です ({editStats.totalCount}/40)</span>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* デッキ確認モーダル（Deck Confirm Modal） */}
      {/* ================================================================= */}
      {showDeckConfirmModal && confirmTargetDeck && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md flex items-center justify-center z-[9999] p-4">
          <div className="w-full max-w-4xl bg-[#091530] border-2 border-cyan-500/80 rounded-2xl p-4 flex flex-col max-h-[90vh] shadow-[0_0_30px_rgba(6,182,212,0.5)]">
            <div className="flex items-center justify-between pb-3 border-b border-cyan-800/60 shrink-0">
              <div className="flex items-center gap-2">
                <Layers className="text-cyan-400" size={18} />
                <span className="text-base font-black text-white">{confirmTargetDeck.name} - カード構成</span>
                <span className="text-xs text-amber-300 font-mono">({confirmTargetDeck.cards.reduce((s, c) => s + c.count, 0)}/40枚)</span>
              </div>
              <button
                type="button"
                onClick={() => setShowDeckConfirmModal(false)}
                className="w-7 h-7 rounded-lg bg-slate-800 hover:bg-slate-700 text-white flex items-center justify-center cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto py-4 grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-2.5 custom-scrollbar">
              {confirmTargetDeck.cards.map(entry => {
                const card = CARDS.find(c => c.id === entry.cardId);
                if (!card) return null;
                return (
                  <div key={card.id} className="p-2 rounded-lg bg-slate-900/90 border border-cyan-800/50 flex flex-col justify-between">
                    <div className="flex justify-between items-center mb-1">
                      <span className="w-5 h-5 rounded-full bg-amber-500 text-black font-black text-[11px] flex items-center justify-center">
                        {card.cost}
                      </span>
                      <span className="text-xs font-mono font-black text-cyan-300">x{entry.count}</span>
                    </div>
                    <div className="text-xs font-bold text-white truncate">{card.name}</div>
                    <div className="text-[10px] text-cyan-400/80 truncate">{formatCardMetaJapanese(card)}</div>
                  </div>
                );
              })}
            </div>

            <div className="pt-3 border-t border-cyan-800/60 flex justify-end shrink-0">
              <button
                type="button"
                onClick={() => setShowDeckConfirmModal(false)}
                className="px-6 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 text-white font-black rounded-xl text-xs shadow cursor-pointer"
              >
                閉じる
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* デッキ名編集モーダル */}
      {/* ================================================================= */}
      {editingNameDeckId && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[9999] p-4">
          <div className="w-full max-w-sm bg-[#091530] border-2 border-cyan-500/80 rounded-2xl p-4 shadow-2xl">
            <h3 className="text-sm font-black text-cyan-200 mb-3">デッキ名の変更</h3>
            <input
              type="text"
              value={editingNameValue}
              onChange={(e) => setEditingNameValue(e.target.value)}
              placeholder="デッキ名を入力"
              className="w-full px-3 py-2 bg-slate-950 border border-cyan-700/60 rounded-xl text-sm font-bold text-white focus:outline-none focus:border-cyan-400 mb-4"
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditingNameDeckId(null)}
                className="px-4 py-1.5 bg-slate-800 text-slate-300 font-bold rounded-lg text-xs"
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={handleConfirmRename}
                className="px-4 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-black font-black rounded-lg text-xs"
              >
                保存
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* トースト通知（オススメ補充等） */}
      {/* ================================================================= */}
      {toastMessage && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-gradient-to-r from-blue-700 via-cyan-600 to-blue-700 text-white font-black text-xs px-5 py-2.5 rounded-full shadow-[0_0_20px_rgba(6,182,212,0.8)] border border-cyan-300 z-[99999] animate-bounce">
          {toastMessage}
        </div>
      )}
    </div>
  );
};
