import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Card } from '../types';
import { UserDeck } from '../types/deck';
import { CARDS, getCard } from '../data/cards';
import { FloatingCardPreview } from './FloatingCardPreview';
import { CardView } from './CardView';
import { Modal, ConfirmDialog } from './ui/Modal';
import { Toast } from './ui/Toast';
import { ElementSigil, ElementDot, ELEMENTS, ELEMENT_ORDER, elementOf } from './ui/elements';
import { Trash2, Plus, Minus, Check, Edit2, Search, X, Layers, ArrowUpDown, Eye, Sparkles, RefreshCw, ChevronLeft, ChevronDown, BookOpen } from 'lucide-react';

const TYPE_FILTERS = [
  { id: 'ALL', label: '全種別' },
  { id: 'UNIT', label: 'ユニット' },
  { id: 'SPELL', label: 'スペル' },
  { id: 'RUNE', label: 'ルーン' },
  { id: 'DOMAIN', label: 'ドメイン' },
];

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

export const DeckManager: React.FC<{
  /** 選択デッキで新しく対戦を始める */
  onBackToBattle: (deck: UserDeck) => void;
  /** 対戦を始め直さずに対戦画面へ戻る */
  onBack?: () => void;
}> = ({ onBackToBattle, onBack }) => {
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
  const [toastMessage, setToastMessage] = useState<{ text: string; tone: 'info' | 'warn' | 'success'; key: number } | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const triggerToast = (msg: string, tone: 'info' | 'warn' | 'success' = 'info') => {
    setToastMessage({ text: msg, tone, key: Date.now() });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastMessage(null), 1900);
  };
  const [costFilter, setCostFilter] = useState<number | 'ALL'>('ALL');
  const poolRef = useRef<HTMLDivElement>(null);
  const [typeMenuPos, setTypeMenuPos] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [confirmLeaveEdit, setConfirmLeaveEdit] = useState(false);
  const [savedSealKey, setSavedSealKey] = useState<number | null>(null);
  const [activeDeckId, setActiveDeckId] = useState<string | null>(() => {
    try {
      return localStorage.getItem(ACTIVE_DECK_KEY);
    } catch {
      return null;
    }
  });

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
      triggerToast('デッキは30個まで作成できます', 'warn');
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
      triggerToast('最後のデッキは削除できません', 'warn');
      return;
    }
    setPendingDeleteId(deckId);
  };

  const performDeleteDeck = (deckId: string) => {
    setPendingDeleteId(null);
    const updated = decks.filter(d => d.id !== deckId);
    setDecks(updated);
    setSelectedDeckId(updated[0].id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    localStorage.setItem(ACTIVE_DECK_KEY, updated[0].id);
    setActiveDeckId(updated[0].id);
    triggerToast('デッキを削除しました', 'info');
  };

  // デッキ保存
  const handleSaveDeck = () => {
    if (!editingDeck) return;
    if (editStats.totalCount !== 40) {
      triggerToast(`デッキは40枚ちょうどで保存できます（現在 ${editStats.totalCount}枚）`, 'warn');
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
    setActiveDeckId(editingDeck.id);
    setViewMode('LIST');
    setSavedSealKey(Date.now());
    setTimeout(() => setSavedSealKey(null), 1300);
    triggerToast('デッキを保存しました', 'success');
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
      if (costFilter !== 'ALL') {
        if (costFilter >= 6 ? card.cost < 6 : card.cost !== costFilter) return false;
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
  }, [selectedElement, selectedTypeFilter, searchText, sortOrder, costFilter]);

  // オススメ自動補充機能（デュエプレの「オススメ」機能再現）
  const handleRecommend = () => {
    if (!editingDeck) return;
    const currentTotal = editStats.totalCount;
    if (currentTotal >= 40) {
      triggerToast('デッキはすでに40枚揃っています', 'info');
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
    triggerToast(`オススメから ${addedCount}枚 追加しました`, 'success');
  };

  // カード追加・削除
  const handleAddCardToEdit = (card: Card) => {
    if (!editingDeck) return;
    if (editStats.totalCount >= 40) {
      triggerToast('デッキは40枚までです', 'warn');
      return;
    }
    const currentEntry = editingDeck.cards.find(c => c.cardId === card.id);
    if (currentEntry && currentEntry.count >= 4) {
      triggerToast('同じカードは4枚までです', 'warn');
      return;
    }

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

  const fmtDate = (t?: number) => {
    if (!t) return '';
    const d = new Date(t);
    return `${d.getMonth() + 1}/${d.getDate()} 更新`;
  };
  const deckElements = (stats: ReturnType<typeof getDeckStats>) =>
    ELEMENT_ORDER.filter(el => stats.elementCounts[el] > 0).map(el => ({ el, n: stats.elementCounts[el] }));

  const ElementBar = ({ stats }: { stats: ReturnType<typeof getDeckStats> }) => {
    const total = Math.max(1, stats.totalCount);
    const parts = deckElements(stats);
    return (
      <div>
        <div className="flex h-2 rounded-full overflow-hidden" style={{ background: 'rgba(45,51,77,0.6)' }}>
          {parts.map(({ el, n }) => (
            <div key={el} style={{ width: `${(n / total) * 100}%`, background: ELEMENTS[el].color }} />
          ))}
        </div>
        <div className="flex flex-wrap gap-x-2.5 gap-y-1 mt-1.5">
          {parts.length === 0 && <span className="text-[11px] text-parch-500">カードがありません</span>}
          {parts.map(({ el, n }) => (
            <span key={el} className="flex items-center gap-1 text-[11px] font-bold text-parch-100">
              <ElementDot element={el} size={13} />
              {ELEMENTS[el].label} <span className="sc-num">{n}</span>
            </span>
          ))}
        </div>
      </div>
    );
  };

  const ManaCurve = ({ stats, height = 56 }: { stats: ReturnType<typeof getDeckStats>; height?: number }) => {
    const maxC = Math.max(...stats.costCurve, 4);
    return (
      <div className="flex items-end gap-1.5" style={{ height }}>
        {stats.costCurve.map((count, idx) => (
          <div key={idx} className="flex-1 flex flex-col items-center justify-end h-full gap-0.5">
            <span className="sc-num text-[10px] text-brass-200 leading-none">{count || ''}</span>
            <div
              className="w-full max-w-[16px] rounded-t-[3px]"
              style={{
                height: `${count === 0 ? 2 : Math.max(8, (count / maxC) * 100)}%`,
                background: count > 0 ? 'linear-gradient(180deg, #f2dea6, #ad8744)' : 'rgba(45,51,77,0.7)',
              }}
            />
            <span className="sc-num text-[9.5px] text-parch-500 leading-none">{idx === 7 ? '8+' : idx === 0 ? '1' : idx + 1}</span>
          </div>
        ))}
      </div>
    );
  };

  const header = (left: React.ReactNode, center: React.ReactNode, right: React.ReactNode) => (
    <div
      className="h-[52px] shrink-0 flex items-center gap-3 px-3"
      style={{
        background: 'linear-gradient(180deg, #161a29, #0b0d17)',
        borderBottom: '1px solid rgba(210,171,95,0.35)',
        paddingLeft: 'max(12px, env(safe-area-inset-left))',
        paddingRight: 'max(12px, env(safe-area-inset-right))',
      }}
    >
      {left}
      <div className="flex-1 min-w-0 flex items-center gap-3">{center}</div>
      {right}
    </div>
  );

  const pendingDeleteDeck = decks.find(d => d.id === pendingDeleteId);
  const isCurrentActive = currentSelectedDeck.id === activeDeckId;

  return (
    <div
      className="fixed inset-0 w-screen h-screen text-parch-100 select-none overflow-hidden flex flex-col"
      style={{
        background: 'radial-gradient(ellipse at 50% 0%, #1a1f33 0%, #0b0d17 55%, #06070d 100%)',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
    >
      {/* ================================================================= */}
      {/* デッキ一覧                                                          */}
      {/* ================================================================= */}
      {viewMode === 'LIST' && (
        <div className="flex-1 flex flex-col min-h-0">
          {header(
            <button type="button" className="sc-btn sc-btn--ghost sc-btn--sm" onClick={() => (onBack ? onBack() : onBackToBattle(currentSelectedDeck))}>
              <ChevronLeft size={16} /> 戻る
            </button>,
            <div className="flex items-baseline gap-2 min-w-0">
              <span className="sc-title text-[18px] whitespace-nowrap">デッキ</span>
              <span className="sc-eyebrow hidden sm:inline">Grimoire Library</span>
            </div>,
            <div className="flex items-center gap-2 shrink-0">
              <span className="sc-chip">
                <Layers size={12} className="text-brass-300" />
                <span className="sc-num text-[12px]">{decks.length}</span>
                <span className="text-parch-500">/ 30</span>
              </span>
              <button type="button" className="sc-btn sc-btn--ghost sc-btn--sm" onClick={() => setDecks([...decks].reverse())}>
                <ArrowUpDown size={13} /> 並び替え
              </button>
            </div>,
          )}

          <div className="flex-1 flex min-h-0 gap-3 p-3" style={{ paddingLeft: 'max(12px, env(safe-area-inset-left))', paddingRight: 'max(12px, env(safe-area-inset-right))' }}>
            {/* デッキタイル */}
            <div className="flex-1 min-w-0 sc-scroll pr-1">
              <div className="grid gap-2.5" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))' }}>
                <button
                  type="button"
                  onClick={handleCreateNewDeck}
                  className="h-[96px] rounded-xl flex items-center justify-center gap-3 transition-all active:scale-[0.98]"
                  style={{ border: '1.5px dashed rgba(210,171,95,0.45)', background: 'rgba(22,26,41,0.5)' }}
                >
                  <span className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: 'linear-gradient(180deg,#f3dc9b,#a57c36)', color: '#221806' }}>
                    <Plus size={20} strokeWidth={3} />
                  </span>
                  <span className="text-left">
                    <span className="block text-[14px] font-bold text-parch-50">新しいデッキ</span>
                    <span className="block text-[11px] text-parch-500">カードを選んで40枚で完成</span>
                  </span>
                </button>

                {decks.map(deck => {
                  const isSelected = deck.id === currentSelectedDeck.id;
                  const isActive = deck.id === activeDeckId;
                  const stats = getDeckStats(deck);
                  const keyCard = getKeyCard(deck);
                  const el = elementOf(keyCard.element || keyCard.system);
                  const complete = stats.totalCount === 40;
                  return (
                    <button
                      type="button"
                      key={deck.id}
                      onClick={() => setSelectedDeckId(deck.id)}
                      onDoubleClick={() => handleStartEdit(deck)}
                      aria-pressed={isSelected}
                      className="relative h-[96px] rounded-xl flex items-stretch overflow-hidden text-left transition-all active:scale-[0.98]"
                      style={{
                        border: `1px solid ${isSelected ? '#e6c77f' : 'rgba(210,171,95,0.22)'}`,
                        background: `linear-gradient(100deg, ${el.deep} 0%, #10131f 55%)`,
                        boxShadow: isSelected ? '0 0 0 1px #e6c77f, 0 0 18px rgba(230,199,127,0.35)' : '0 4px 10px rgba(0,0,0,0.35)',
                      }}
                    >
                      <div className="w-[76px] shrink-0 flex items-center justify-center relative" style={{ background: `radial-gradient(circle, ${el.color}33, transparent 70%)` }}>
                        <ElementSigil element={keyCard.system} size={58} />
                      </div>
                      <div className="flex-1 min-w-0 py-2 pr-2.5 flex flex-col">
                        <div className="text-[13.5px] font-bold text-parch-50 leading-tight line-clamp-2">{deck.name}</div>
                        <div className="text-[10.5px] text-parch-500 truncate mt-0.5">{keyCard.name}</div>
                        <div className="mt-auto flex items-center gap-1.5">
                          <div className="flex items-center gap-0.5">
                            {deckElements(stats).map(({ el: e }) => (
                              <ElementDot key={e} element={e} size={12} />
                            ))}
                          </div>
                          <span className="ml-auto sc-num text-[11px]" style={{ color: complete ? '#86ecdc' : '#f39a90' }}>
                            {stats.totalCount}/40
                          </span>
                        </div>
                      </div>
                      {isActive && (
                        <span className="absolute top-1.5 right-1.5 px-1.5 h-[17px] rounded-full text-[9.5px] font-bold flex items-center" style={{ background: '#e6c77f', color: '#221806' }}>
                          使用中
                        </span>
                      )}
                      {savedSealKey && deck.id === selectedDeckId && (
                        <span key={savedSealKey} className="absolute bottom-1.5 right-1.5 w-7 h-7 rounded-full flex items-center justify-center sc-anim-seal" style={{ background: 'radial-gradient(circle at 35% 30%, #f39a90, #7d2320)', border: '1.5px solid #f2dea6' }}>
                          <Check size={14} className="text-brass-100" strokeWidth={3} />
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 選択デッキの詳細 */}
            <div className="sc-panel shrink-0 flex flex-col min-h-0" style={{ width: 'clamp(280px, 40vw, 340px)' }}>
              <div className="sc-scroll flex-1 min-h-0 p-3 space-y-3">
                <div className="flex gap-3">
                  <button type="button" className="shrink-0 self-start active:scale-95 transition-transform" onClick={() => setPreviewCard(currentKeyCard)} aria-label="キーカードの詳細">
                    <CardView template={currentKeyCard} size="grid" />
                  </button>
                  <div className="flex-1 min-w-0 flex flex-col">
                    <div className="flex items-start gap-1">
                      <div className="sc-title text-[15px] leading-snug flex-1 min-w-0 line-clamp-2">{currentSelectedDeck.name}</div>
                      <button
                        type="button"
                        className="sc-btn sc-btn--ghost sc-btn--icon shrink-0"
                        style={{ minHeight: 30, width: 30 }}
                        onClick={() => {
                          setEditingNameDeckId(currentSelectedDeck.id);
                          setEditingNameValue(currentSelectedDeck.name);
                        }}
                        aria-label="デッキ名を変更"
                      >
                        <Edit2 size={13} />
                      </button>
                    </div>
                    <div className="text-[11px] text-parch-500 mt-0.5">キーカード：{currentKeyCard.name}</div>
                    <div className="flex flex-wrap gap-1 mt-auto pt-2">
                      <span className="sc-chip">ユニット {listStats.unitCount}</span>
                      <span className="sc-chip">スペル {listStats.spellCount}</span>
                      {listStats.runeCount > 0 && <span className="sc-chip">ルーン {listStats.runeCount}</span>}
                      {listStats.domainCount > 0 && <span className="sc-chip">ドメイン {listStats.domainCount}</span>}
                    </div>
                  </div>
                </div>

                <div>
                  <div className="sc-eyebrow mb-1.5">Elements</div>
                  <ElementBar stats={listStats} />
                </div>

                <div>
                  <div className="flex items-baseline justify-between mb-1">
                    <span className="sc-eyebrow">Cost Curve</span>
                    <span className="text-[10.5px] text-parch-500">結界トリガー {listStats.triggerCount}枚</span>
                  </div>
                  <ManaCurve stats={listStats} />
                </div>

                <div className="flex items-center gap-2">
                  <div className={`flex-1 h-10 rounded-lg bg-gradient-to-r ${PLAYMAT_LIST[playmatIdx].color} flex items-center px-3 text-[11.5px] font-bold text-brass-200`} style={{ border: '1px solid rgba(210,171,95,0.25)' }}>
                    {PLAYMAT_LIST[playmatIdx].name}
                  </div>
                  <button type="button" className="sc-btn sc-btn--ghost sc-btn--sm" onClick={() => setPlaymatIdx((playmatIdx + 1) % PLAYMAT_LIST.length)}>
                    <RefreshCw size={12} /> 変更
                  </button>
                </div>
              </div>

              <div className="sc-divider mx-3" />
              <div className="p-3 space-y-2 shrink-0">
                <div className="flex gap-2">
                  <button type="button" className="sc-btn sc-btn--danger sc-btn--icon" onClick={() => handleDeleteDeck(currentSelectedDeck.id)} aria-label="デッキを削除">
                    <Trash2 size={15} />
                  </button>
                  <button
                    type="button"
                    className="sc-btn flex-1"
                    onClick={() => {
                      setConfirmTargetDeck(currentSelectedDeck);
                      setShowDeckConfirmModal(true);
                    }}
                  >
                    <Eye size={14} /> 確認
                  </button>
                  <button type="button" className="sc-btn sc-btn--confirm flex-1" onClick={() => handleStartEdit(currentSelectedDeck)}>
                    <Edit2 size={14} /> 編集
                  </button>
                </div>
                <button
                  type="button"
                  className="sc-btn sc-btn--primary sc-btn--lg sc-btn--block"
                  disabled={listStats.totalCount !== 40}
                  onClick={() => {
                    setActiveDeckId(currentSelectedDeck.id);
                    onBackToBattle(currentSelectedDeck);
                  }}
                >
                  <BookOpen size={17} />
                  {listStats.totalCount !== 40 ? `あと${40 - listStats.totalCount}枚で対戦できます` : isCurrentActive ? 'このデッキで対戦' : 'このデッキで対戦開始'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* デッキ編成                                                          */}
      {/* ================================================================= */}
      {viewMode === 'EDIT' && editingDeck && (
        <div className="flex-1 flex flex-col min-h-0">
          {header(
            <button
              type="button"
              className="sc-btn sc-btn--ghost sc-btn--sm"
              onClick={() => {
                if (editStats.totalCount !== 40) {
                  setConfirmLeaveEdit(true);
                  return;
                }
                setViewMode('LIST');
              }}
            >
              <ChevronLeft size={16} /> 戻る
            </button>,
            <div className="relative flex-1 max-w-[260px] min-w-[120px]">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-brass-400 pointer-events-none" />
              <input
                type="text"
                placeholder="カード名・効果で検索"
                value={searchText}
                onChange={e => setSearchText(e.target.value)}
                className="sc-input w-full pl-8 pr-8"
              />
              {searchText && (
                <button type="button" className="absolute right-1.5 top-1/2 -translate-y-1/2 w-6 h-6 flex items-center justify-center text-parch-500" onClick={() => setSearchText('')} aria-label="検索をクリア">
                  <X size={14} />
                </button>
              )}
            </div>,
            <div className="flex items-center gap-2 shrink-0 min-w-0">
              <button
                type="button"
                className="flex items-center gap-1 min-w-0 max-w-[180px] text-left"
                onClick={() => {
                  setEditingNameDeckId(editingDeck.id);
                  setEditingNameValue(editingDeck.name);
                }}
              >
                <span className="text-[13px] font-bold text-parch-50 truncate">{editingDeck.name}</span>
                <Edit2 size={12} className="text-brass-400 shrink-0" />
              </button>
            </div>,
          )}

          <div className="flex-1 flex min-h-0" style={{ paddingLeft: 'env(safe-area-inset-left)', paddingRight: 'env(safe-area-inset-right)' }}>
            {/* 属性タブ */}
            <div className="w-[58px] shrink-0 flex flex-col items-center gap-1.5 py-2 sc-scroll" style={{ background: 'rgba(6,7,13,0.6)', borderRight: '1px solid rgba(210,171,95,0.2)' }}>
              {(['ALL', ...ELEMENT_ORDER] as const).map(id => {
                const active = selectedElement === id;
                return (
                  <button
                    key={id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setSelectedElement(id)}
                    className="w-[46px] h-[42px] rounded-lg flex flex-col items-center justify-center gap-0.5 transition-all active:scale-95 shrink-0"
                    style={{
                      background: active ? 'linear-gradient(180deg,#3a3222,#231d12)' : 'rgba(22,26,41,0.6)',
                      border: `1px solid ${active ? '#e6c77f' : 'rgba(210,171,95,0.15)'}`,
                    }}
                    aria-label={id === 'ALL' ? 'すべての属性' : `${ELEMENTS[id].label}属性`}
                  >
                    {id === 'ALL' ? <Layers size={15} className={active ? 'text-brass-100' : 'text-parch-500'} /> : <ElementDot element={id} size={16} active={active || selectedElement === 'ALL'} />}
                    <span className={`text-[10px] font-bold ${active ? 'text-brass-100' : 'text-parch-500'}`}>{id === 'ALL' ? '全て' : ELEMENTS[id].label}</span>
                  </button>
                );
              })}
            </div>

            {/* カードプール */}
            <div ref={poolRef} className="relative flex-1 min-w-0 flex flex-col">
              <div className="shrink-0 flex items-center gap-2 px-2.5 py-2 overflow-x-auto" style={{ borderBottom: '1px solid rgba(210,171,95,0.15)' }}>
                <div className="sc-seg shrink-0" role="group" aria-label="コスト">
                  {(['ALL', 1, 2, 3, 4, 5, 6] as const).map(c => (
                    <button key={c} type="button" aria-pressed={costFilter === c} onClick={() => setCostFilter(c)}>
                      {c === 'ALL' ? 'コスト' : c === 6 ? '6+' : c}
                    </button>
                  ))}
                </div>
                <div className="relative shrink-0">
                  <button
                    type="button"
                    className={`sc-btn sc-btn--sm ${selectedTypeFilter !== 'ALL' ? 'is-selected' : 'sc-btn--ghost'}`}
                    style={{ minHeight: 32 }}
                    onClick={e => {
                      const r = e.currentTarget.getBoundingClientRect();
                      const base = poolRef.current?.getBoundingClientRect();
                      setTypeMenuPos({ x: r.left - (base?.left ?? 0), y: r.bottom - (base?.top ?? 0) + 4 });
                      setShowFilterDropdown(!showFilterDropdown);
                    }}
                    aria-expanded={showFilterDropdown}
                  >
                    {TYPE_FILTERS.find(t => t.id === selectedTypeFilter)?.label ?? '全種別'}
                    <ChevronDown size={13} className={`transition-transform ${showFilterDropdown ? 'rotate-180' : ''}`} />
                  </button>
                </div>
                <button
                  type="button"
                  className="sc-btn sc-btn--ghost sc-btn--sm shrink-0"
                  style={{ minHeight: 32 }}
                  onClick={() => setSortOrder(sortOrder === 'cost_asc' ? 'cost_desc' : sortOrder === 'cost_desc' ? 'atk_desc' : 'cost_asc')}
                >
                  <ArrowUpDown size={12} />
                  {sortOrder === 'cost_asc' ? 'コスト↑' : sortOrder === 'cost_desc' ? 'コスト↓' : '攻撃力'}
                </button>
                <span className="text-[10.5px] text-parch-500 shrink-0 ml-auto pl-1 whitespace-nowrap">{filteredPool.length}種 ・ 長押しで詳細</span>
              </div>

              {showFilterDropdown && (
                <div className="absolute inset-0 z-40" onClick={() => setShowFilterDropdown(false)}>
                  <div className="sc-panel sc-anim-pop absolute p-1.5 flex flex-col gap-1 w-[140px]" style={{ top: typeMenuPos.y, left: typeMenuPos.x }} onClick={e => e.stopPropagation()}>
                    {TYPE_FILTERS.map(t => (
                      <button
                        key={t.id}
                        type="button"
                        aria-pressed={selectedTypeFilter === t.id}
                        className={`sc-btn sc-btn--sm justify-start ${selectedTypeFilter === t.id ? '' : 'sc-btn--ghost'}`}
                        onClick={() => {
                          setSelectedTypeFilter(t.id);
                          setShowFilterDropdown(false);
                        }}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div className="sc-scroll flex-1 min-h-0 p-2.5">
                {filteredPool.length === 0 ? (
                  <div className="h-40 flex flex-col items-center justify-center gap-2 text-parch-500">
                    <Search size={24} className="opacity-50" />
                    <span className="text-[12px]">条件に合うカードがありません</span>
                    <button
                      type="button"
                      className="sc-btn sc-btn--ghost sc-btn--sm"
                      onClick={() => {
                        setSelectedElement('ALL');
                        setSelectedTypeFilter('ALL');
                        setCostFilter('ALL');
                        setSearchText('');
                      }}
                    >
                      条件をリセット
                    </button>
                  </div>
                ) : (
                  <div className="grid gap-x-2 gap-y-3 justify-items-center" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(92px, 1fr))' }}>
                    {filteredPool.map(card => {
                      const inDeckCount = editingDeck.cards.find(c => c.cardId === card.id)?.count || 0;
                      const isMax = inDeckCount >= 4;
                      const isDeckFull = editStats.totalCount >= 40;
                      return (
                        <div
                          key={card.id}
                          className={`relative flex flex-col items-center cursor-pointer transition-transform active:scale-95 ${isMax || isDeckFull ? 'opacity-50' : ''}`}
                          onClick={() => {
                            if (!isLongPressRef.current) handleAddCardToEdit(card);
                          }}
                          onPointerDown={() => handlePointerDownCard(card)}
                          onPointerUp={handlePointerUpOrLeaveCard}
                          onPointerLeave={handlePointerUpOrLeaveCard}
                          onContextMenu={e => {
                            e.preventDefault();
                            setPreviewCard(card);
                          }}
                          title="タップで追加 / 長押しで詳細"
                        >
                          <CardView template={card} size="grid" selected={inDeckCount > 0 && !isMax} />
                          <div
                            key={inDeckCount}
                            className="mt-1 h-[18px] px-2 rounded-full flex items-center gap-1 text-[10.5px] font-bold sc-anim-pop"
                            style={{
                              background: inDeckCount > 0 ? (isMax ? '#e6c77f' : 'rgba(58,50,34,0.9)') : 'rgba(22,26,41,0.8)',
                              color: isMax ? '#221806' : inDeckCount > 0 ? '#fbf0d2' : '#948a76',
                              border: `1px solid ${inDeckCount > 0 ? '#d2ab5f' : 'rgba(210,171,95,0.15)'}`,
                            }}
                          >
                            {isMax ? '上限 4/4' : inDeckCount > 0 ? `投入 ${inDeckCount}/4` : '＋ 追加'}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* マイデッキ */}
            <div className="shrink-0 flex flex-col min-h-0" style={{ width: 'clamp(224px, 32vw, 280px)', background: 'rgba(11,13,23,0.85)', borderLeft: '1px solid rgba(210,171,95,0.25)' }}>
              <div className="shrink-0 px-3 pt-2.5 pb-2">
                <div className="flex items-center justify-between">
                  <span className="sc-title text-[14px]">デッキ</span>
                  <button type="button" className="sc-btn sc-btn--ghost sc-btn--sm" style={{ minHeight: 28 }} onClick={handleRecommend} title="主属性のカードで40枚まで自動補充">
                    <Sparkles size={12} /> おまかせ補充
                  </button>
                </div>
                <div className="flex items-center gap-2 mt-1.5">
                  <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(45,51,77,0.7)' }}>
                    <div
                      className="h-full rounded-full transition-all duration-300"
                      style={{ width: `${Math.min(100, (editStats.totalCount / 40) * 100)}%`, background: editStats.totalCount === 40 ? 'linear-gradient(90deg,#25b3a1,#86ecdc)' : 'linear-gradient(90deg,#ad8744,#f2dea6)' }}
                    />
                  </div>
                  <span className="sc-num text-[13px]" style={{ color: editStats.totalCount === 40 ? '#86ecdc' : '#f2dea6' }}>
                    {editStats.totalCount}/40
                  </span>
                </div>
              </div>
              <div className="sc-divider mx-2" />

              <div className="sc-scroll flex-1 min-h-0 p-2 space-y-1">
                {[...editingDeck.cards]
                  .map(entry => ({ entry, card: CARDS.find(c => c.id === entry.cardId) }))
                  .filter((x): x is { entry: typeof x.entry; card: Card } => !!x.card)
                  .sort((a, b) => a.card.cost - b.card.cost)
                  .map(({ entry, card }) => {
                    const el = elementOf(card.element || card.system);
                    return (
                      <div
                        key={card.id}
                        className="h-[38px] rounded-lg flex items-center gap-2 pl-0 pr-1 overflow-hidden"
                        style={{ background: `linear-gradient(90deg, ${el.deep}, #10131f 70%)`, border: '1px solid rgba(210,171,95,0.18)' }}
                      >
                        <span className="w-[4px] self-stretch shrink-0" style={{ background: el.color }} />
                        <span
                          className="w-[22px] h-[22px] rounded-full flex items-center justify-center sc-num text-[12px] shrink-0"
                          style={{ background: `radial-gradient(circle at 35% 30%, ${el.light}, ${el.color} 50%, ${el.deep})`, color: el.id === 'Light' ? '#2a1f04' : '#fff', border: '1px solid #f2dea6' }}
                        >
                          {card.cost}
                        </span>
                        <button type="button" className="flex-1 min-w-0 text-left" onClick={() => setPreviewCard(card)}>
                          <span className="block text-[12px] font-bold text-parch-50 truncate">{card.name}</span>
                        </button>
                        <span className="sc-num text-[12px] text-brass-200 w-[22px] text-center shrink-0">×{entry.count}</span>
                        <button type="button" className="w-7 h-7 rounded-md flex items-center justify-center shrink-0 active:scale-90 transition-transform" style={{ background: 'rgba(125,35,32,0.5)', border: '1px solid rgba(227,102,92,0.5)', color: '#ffd9d4' }} onClick={() => handleRemoveCardFromEdit(card.id)} aria-label={`${card.name}を1枚減らす`}>
                          <Minus size={13} strokeWidth={3} />
                        </button>
                        <button
                          type="button"
                          className="w-7 h-7 rounded-md flex items-center justify-center shrink-0 active:scale-90 transition-transform disabled:opacity-30"
                          style={{ background: 'rgba(20,95,87,0.5)', border: '1px solid rgba(134,236,220,0.5)', color: '#c9fbf2' }}
                          onClick={() => handleAddCardToEdit(card)}
                          disabled={entry.count >= 4 || editStats.totalCount >= 40}
                          aria-label={`${card.name}を1枚増やす`}
                        >
                          <Plus size={13} strokeWidth={3} />
                        </button>
                      </div>
                    );
                  })}
                {editingDeck.cards.length === 0 && (
                  <div className="h-40 flex flex-col items-center justify-center text-center gap-1.5 text-parch-500 px-3" style={{ border: '1px dashed rgba(210,171,95,0.25)', borderRadius: 12 }}>
                    <Layers size={22} className="opacity-60" />
                    <span className="text-[12px]">左のカードをタップして追加</span>
                    <span className="text-[10.5px]">同じカードは4枚まで・合計40枚で完成</span>
                  </div>
                )}
              </div>

              <div className="sc-divider mx-2" />
              <div className="p-2.5 flex gap-2 shrink-0">
                <button
                  type="button"
                  className="sc-btn sc-btn--icon"
                  onClick={() => {
                    setConfirmTargetDeck(editingDeck);
                    setShowDeckConfirmModal(true);
                  }}
                  aria-label="デッキを確認"
                >
                  <Eye size={15} />
                </button>
                <button type="button" onClick={handleSaveDeck} disabled={editStats.totalCount !== 40} className="sc-btn sc-btn--primary flex-1">
                  {editStats.totalCount === 40 ? (
                    <>
                      <Check size={15} strokeWidth={3} /> 保存する
                    </>
                  ) : (
                    `あと${40 - editStats.totalCount}枚`
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* カード詳細 */}
      <FloatingCardPreview
        card={previewCard}
        onClose={() => setPreviewCard(null)}
        actions={
          viewMode === 'EDIT' && previewCard && editingDeck ? (
            <>
              <button type="button" className="sc-btn sc-btn--ghost flex-1" onClick={() => handleRemoveCardFromEdit(previewCard.id)} disabled={!editingDeck.cards.some(c => c.cardId === previewCard.id)}>
                <Minus size={14} /> 1枚減らす
              </button>
              <button type="button" className="sc-btn sc-btn--confirm flex-1" onClick={() => handleAddCardToEdit(previewCard)}>
                <Plus size={14} /> 1枚追加
              </button>
            </>
          ) : undefined
        }
      />

      {/* デッキ確認 */}
      <Modal
        open={showDeckConfirmModal && !!confirmTargetDeck}
        onClose={() => setShowDeckConfirmModal(false)}
        fixed
        zIndex={90}
        width={720}
        eyebrow="Deck List"
        title={
          confirmTargetDeck && (
            <span className="flex items-center gap-2">
              {confirmTargetDeck.name}
              <span className="sc-chip">{confirmTargetDeck.cards.reduce((sum, c) => sum + c.count, 0)}/40</span>
            </span>
          )
        }
        icon={<Layers size={18} />}
      >
        {confirmTargetDeck && (
          <>
            <div className="grid grid-cols-[1fr_220px] gap-4 mb-3">
              <ElementBar stats={getDeckStats(confirmTargetDeck)} />
              <ManaCurve stats={getDeckStats(confirmTargetDeck)} height={48} />
            </div>
            <div className="grid gap-x-2 gap-y-3 justify-items-center" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(92px, 1fr))' }}>
              {[...confirmTargetDeck.cards]
                .map(entry => ({ entry, card: CARDS.find(c => c.id === entry.cardId) }))
                .filter((x): x is { entry: typeof x.entry; card: Card } => !!x.card)
                .sort((a, b) => a.card.cost - b.card.cost)
                .map(({ entry, card }) => (
                  <button type="button" key={card.id} className="relative active:scale-95 transition-transform" onClick={() => setPreviewCard(card)}>
                    <CardView template={card} size="grid" />
                    <span className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 px-2 h-[18px] rounded-full sc-num text-[11px] flex items-center" style={{ background: '#e6c77f', color: '#221806' }}>
                      ×{entry.count}
                    </span>
                  </button>
                ))}
            </div>
          </>
        )}
      </Modal>

      {/* デッキ名 */}
      <Modal
        open={!!editingNameDeckId}
        onClose={() => setEditingNameDeckId(null)}
        fixed
        zIndex={95}
        width={340}
        title="デッキ名の変更"
        icon={<Edit2 size={16} />}
        footer={
          <>
            <button type="button" className="sc-btn sc-btn--cancel" onClick={() => setEditingNameDeckId(null)}>
              キャンセル
            </button>
            <button
              type="button"
              className="sc-btn sc-btn--primary"
              onClick={() => {
                if (editingDeck && editingNameDeckId === editingDeck.id) {
                  setEditingDeck({ ...editingDeck, name: editingNameValue.trim() || '名称未設定デッキ' });
                }
                handleConfirmRename();
              }}
            >
              決定
            </button>
          </>
        }
      >
        <input
          type="text"
          value={editingNameValue}
          onChange={e => setEditingNameValue(e.target.value)}
          placeholder="デッキ名を入力"
          maxLength={24}
          className="sc-input w-full"
          autoFocus
        />
      </Modal>

      <ConfirmDialog
        open={!!pendingDeleteId}
        title="デッキを削除"
        message={
          <>
            「{pendingDeleteDeck?.name}」を削除します。
            <br />
            <span className="text-parch-500 text-[12px]">この操作は取り消せません。</span>
          </>
        }
        confirmLabel="削除する"
        danger
        onCancel={() => setPendingDeleteId(null)}
        onConfirm={() => pendingDeleteId && performDeleteDeck(pendingDeleteId)}
      />

      <ConfirmDialog
        open={confirmLeaveEdit}
        title="編集をやめますか？"
        message={
          <>
            デッキが{editStats.totalCount}枚で、40枚に届いていません。
            <br />
            保存せずに一覧へ戻ると、この編集内容は失われます。
          </>
        }
        confirmLabel="保存せず戻る"
        cancelLabel="編集を続ける"
        danger
        onCancel={() => setConfirmLeaveEdit(false)}
        onConfirm={() => {
          setConfirmLeaveEdit(false);
          setViewMode('LIST');
        }}
      />

      {toastMessage && <Toast key={toastMessage.key} text={toastMessage.text} tone={toastMessage.tone} fixed top={60} />}
    </div>
  );
};
