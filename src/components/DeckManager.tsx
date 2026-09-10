import React, { useState, useEffect, useMemo } from 'react';
import { CardTemplate } from '../types';
import { UserDeck } from '../types/deck';
import { CARDS, getCard } from '../data/cards';
import { DeckBuilder } from './DeckBuilder';
import { CardDetailModal } from './CardDetailModal';
import { 
  Trash2, Plus, Check, Edit2, X, 
  Layers, ArrowLeft, Eye, Shield, Sparkles, RefreshCw,
  Flame, Droplet, Mountain, Sun, Moon, Hexagon
} from 'lucide-react';

export const STORAGE_KEY = 'scriptia_user_decks_v1';
export const ACTIVE_DECK_KEY = 'scriptia_active_deck_id';

// =====================================================================
// SCRIPTIA初期プリセット：各システム ベーシックデッキ（全40枚完成デッキ）
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

// システム属性の定義
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
  // 画面モード: LIST (デッキ一覧画面) | EDIT (デッキ編成画面)
  const [viewMode, setViewMode] = useState<'LIST' | 'EDIT'>('LIST');

  // デッキリスト & 選択中デッキID
  const [decks, setDecks] = useState<UserDeck[]>([]);
  const [selectedDeckId, setSelectedDeckId] = useState<string>('');

  // 編集中のデッキデータ
  const [editingDeck, setEditingDeck] = useState<UserDeck | null>(null);

  // デッキ確認モーダル
  const [showDeckConfirmModal, setShowDeckConfirmModal] = useState<boolean>(false);
  const [confirmTargetDeck, setConfirmTargetDeck] = useState<UserDeck | null>(null);

  // カード詳細確認モーダル
  const [detailCard, setDetailCard] = useState<CardTemplate | null>(null);

  // デッキ名編集モーダル
  const [editingNameDeckId, setEditingNameDeckId] = useState<string | null>(null);
  const [editingNameValue, setEditingNameValue] = useState<string>('');

  // プレイマット選択
  const [playmatIdx, setPlaymatIdx] = useState<number>(0);

  // トースト通知
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2000);
  };

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

  const currentSelectedDeck = useMemo(() => {
    return decks.find(d => d.id === selectedDeckId) || decks[0] || DEFAULT_PRESET_DECKS[0];
  }, [decks, selectedDeckId]);

  // 統計情報計算
  const getDeckStats = (deck: UserDeck) => {
    const totalCount = deck.cards.reduce((sum, c) => sum + c.count, 0);
    const costCurve = [0, 0, 0, 0, 0, 0, 0, 0];
    const elementCounts: Record<'Light' | 'Water' | 'Dark' | 'Fire' | 'Earth' | 'Neutral', number> = {
      Light: 0, Water: 0, Dark: 0, Fire: 0, Earth: 0, Neutral: 0
    };
    let unitCount = 0;
    let spellCount = 0;
    let runeCount = 0;
    let domainCount = 0;

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
      else if (ct === 'RUNE') runeCount += entry.count;
      else if (ct === 'DOMAIN') domainCount += entry.count;
    });

    return { totalCount, costCurve, elementCounts, unitCount, spellCount, runeCount, domainCount };
  };

  const listStats = useMemo(() => getDeckStats(currentSelectedDeck), [currentSelectedDeck]);

  const currentKeyCard = useMemo(() => {
    if (currentSelectedDeck.keyCardId) {
      const found = CARDS.find(c => c.id === currentSelectedDeck.keyCardId);
      if (found) return found;
    }
    if (currentSelectedDeck.cards.length > 0) {
      const first = CARDS.find(c => c.id === currentSelectedDeck.cards[0].cardId);
      if (first) return first;
    }
    return CARDS[0];
  }, [currentSelectedDeck]);

  // デッキ選択処理
  const handleSelectDeck = (deckId: string) => {
    setSelectedDeckId(deckId);
    localStorage.setItem(ACTIVE_DECK_KEY, deckId);
  };

  // デッキ新規作成
  const handleCreateNewDeck = () => {
    if (decks.length >= 30) {
      triggerToast('作成可能なデッキは最大30個までです');
      return;
    }
    const newDeck: UserDeck = {
      id: `deck_${Date.now()}`,
      name: `新規デッキ ${decks.length + 1}`,
      cards: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    const updated = [...decks, newDeck];
    setDecks(updated);
    setSelectedDeckId(newDeck.id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    localStorage.setItem(ACTIVE_DECK_KEY, newDeck.id);

    // そのまま編成画面へ遷移
    setEditingDeck(newDeck);
    setViewMode('EDIT');
  };

  // デッキ削除
  const handleDeleteDeck = (deckId: string) => {
    if (decks.length <= 1) {
      triggerToast('デッキは最低1つ必要です');
      return;
    }
    const target = decks.find(d => d.id === deckId);
    if (!target) return;
    if (!confirm(`デッキ「${target.name}」を削除しますか？`)) return;

    const updated = decks.filter(d => d.id !== deckId);
    setDecks(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));

    if (selectedDeckId === deckId) {
      const nextId = updated[0].id;
      setSelectedDeckId(nextId);
      localStorage.setItem(ACTIVE_DECK_KEY, nextId);
    }
    triggerToast('デッキを削除しました');
  };

  // デッキ名更新
  const handleSaveDeckName = () => {
    if (!editingNameDeckId) return;
    const clean = editingNameValue.trim() || '無題デッキ';
    const updated = decks.map(d => d.id === editingNameDeckId ? { ...d, name: clean, updatedAt: Date.now() } : d);
    setDecks(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    setEditingNameDeckId(null);
    triggerToast('デッキ名を変更しました');
  };

  // デッキ編成画面の開始
  const handleStartEdit = (deck: UserDeck) => {
    setEditingDeck(deck);
    setViewMode('EDIT');
  };

  // DeckBuilderからの保存コールバック
  const handleSaveEditedDeck = (savedDeck: UserDeck) => {
    const updated = decks.map(d => d.id === savedDeck.id ? savedDeck : d);
    setDecks(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    setSelectedDeckId(savedDeck.id);
    localStorage.setItem(ACTIVE_DECK_KEY, savedDeck.id);
    setViewMode('LIST');
    triggerToast('デッキを保存しました！');
  };

  // =====================================================================
  // 画面2：DeckBuilder (デッキ編成画面)
  // =====================================================================
  if (viewMode === 'EDIT' && editingDeck) {
    return (
      <DeckBuilder
        initialDeck={editingDeck}
        onSave={handleSaveEditedDeck}
        onCancel={() => setViewMode('LIST')}
      />
    );
  }

  // =====================================================================
  // 画面1：DeckManager (デッキ一覧画面：2ペイン構成)
  // =====================================================================
  return (
    <div className="w-full h-full flex flex-col bg-[#040a17] text-white overflow-hidden select-none font-sans relative">
      {/* 1. 最上部ヘッダーバー */}
      <header className="h-14 bg-gradient-to-r from-[#071328] via-[#0d2146] to-[#071328] border-b border-cyan-800/60 px-4 md:px-6 flex items-center justify-between shadow-lg shrink-0 z-10">
        <div className="flex items-center gap-3">
          {/* バトルへ戻るボタン */}
          <button
            type="button"
            onClick={() => onBackToBattle(currentSelectedDeck)}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-gradient-to-b from-slate-700 to-slate-900 hover:from-slate-600 hover:to-slate-800 border border-slate-500/60 text-xs font-black shadow transition-all active:scale-95 cursor-pointer"
          >
            <ArrowLeft size={14} />
            <span>バトルへ戻る</span>
          </button>

          <div className="flex items-baseline gap-2">
            <h1 className="text-base md:text-lg font-black tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 via-white to-blue-300 drop-shadow">
              SCRIPTIA デッキ一覧
            </h1>
            <span className="text-[11px] text-cyan-400/80 font-bold hidden sm:inline">
              Deck Selection & Management
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* 作成デッキ数インジケーター */}
          <div className="flex items-center gap-1 bg-black/50 border border-cyan-700/60 rounded-lg px-3 py-1 font-mono text-xs">
            <span className="text-slate-400 font-bold text-[10px] hidden sm:inline">保有数</span>
            <span className="text-cyan-300 font-black">{decks.length}</span>
            <span className="text-slate-500">/</span>
            <span className="text-slate-400">30</span>
          </div>
        </div>
      </header>

      {/* 2. メインコンテンツ（2ペイン構成：左=デッキ一覧、右=選択デッキ詳細） */}
      <div className="flex-1 flex flex-col md:flex-row p-3 md:p-4 gap-3 md:gap-4 overflow-hidden">
        {/* ------------------------------------------------------------- */}
        {/* 左ペイン：デッキ一覧（新規作成タイル ＋ デッキタイルグリッド） */}
        {/* ------------------------------------------------------------- */}
        <section className="flex-1 flex flex-col bg-[#061024]/90 border border-cyan-900/60 rounded-2xl overflow-hidden shadow-2xl">
          {/* デッキ一覧ヘッダーバー */}
          <div className="h-9 bg-gradient-to-r from-blue-900 via-cyan-900 to-blue-900 px-4 flex items-center justify-between text-xs font-black border-b border-cyan-800/60 shrink-0">
            <div className="flex items-center gap-2">
              <span className="text-cyan-200">マイデッキ一覧</span>
              <span className="text-[10px] bg-black/40 px-2 py-0.5 rounded-full text-slate-300 font-mono">
                {decks.length} 件
              </span>
            </div>
            <span className="text-[10px] text-slate-400">選択中のデッキでバトルを開始できます</span>
          </div>

          {/* デッキタイル一覧（スクロール可能エリア） */}
          <div className="flex-1 overflow-y-auto p-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 content-start custom-scrollbar">
            {/* 「＋ 新規作成」タイル */}
            <div
              onClick={handleCreateNewDeck}
              className="h-28 rounded-xl border-2 border-dashed border-cyan-600/50 hover:border-cyan-400 bg-[#071633]/60 hover:bg-[#0b214a]/80 flex flex-col items-center justify-center gap-1.5 transition-all cursor-pointer group select-none shadow-md active:scale-98"
            >
              <div className="w-9 h-9 rounded-full bg-cyan-950 border border-cyan-400/60 flex items-center justify-center text-cyan-300 group-hover:scale-110 group-hover:border-cyan-300 transition-all shadow-[0_0_10px_rgba(6,182,212,0.4)]">
                <Plus size={18} />
              </div>
              <span className="text-xs font-black text-cyan-200 group-hover:text-white transition-colors">
                新規デッキ作成
              </span>
              <span className="text-[9px] text-slate-400 font-mono">({decks.length}/30)</span>
            </div>

            {/* 保存済みデッキタイル一覧 */}
            {decks.map(d => {
              const isSelected = d.id === selectedDeckId;
              const stats = getDeckStats(d);
              const keyCard = d.keyCardId ? CARDS.find(c => c.id === d.keyCardId) : (d.cards[0] ? CARDS.find(c => c.id === d.cards[0].cardId) : null);

              return (
                <div
                  key={d.id}
                  onClick={() => handleSelectDeck(d.id)}
                  className={`relative h-28 rounded-xl border-2 flex flex-col justify-between p-2.5 transition-all cursor-pointer select-none overflow-hidden group shadow-lg ${
                    isSelected
                      ? 'border-amber-400 bg-gradient-to-br from-[#12284e] to-[#0a1835] shadow-[0_0_18px_rgba(245,158,11,0.5)] ring-2 ring-amber-400/50'
                      : 'border-cyan-900/70 hover:border-cyan-400/70 bg-[#07142d]/80 hover:bg-[#0a1c3f]'
                  }`}
                >
                  {/* 背景キーカード透かし装飾 */}
                  <div className="absolute right-0 top-0 bottom-0 w-28 bg-gradient-to-l from-black/60 to-transparent pointer-events-none flex items-center justify-end pr-2 overflow-hidden opacity-25 group-hover:opacity-40 transition-opacity">
                    {keyCard && (
                      <span className="text-4xl font-black text-cyan-300 font-mono">
                        {keyCard.cost}
                      </span>
                    )}
                  </div>

                  {/* タイル上部：選択バッジ ＆ デッキ名 ＆ 枚数 */}
                  <div className="flex items-start justify-between gap-1 z-10">
                    <div className="flex items-center gap-1.5 min-w-0 flex-1">
                      {isSelected && (
                        <span className="w-4 h-4 rounded-full bg-amber-400 text-black flex items-center justify-center shrink-0 shadow">
                          <Check size={11} strokeWidth={3} />
                        </span>
                      )}
                      <span className="text-xs font-black text-white truncate group-hover:text-cyan-200 transition-colors drop-shadow">
                        {d.name}
                      </span>
                    </div>

                    <div className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-black shrink-0 ${
                      stats.totalCount === 40 ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/60' : 'bg-black/60 text-amber-300 border border-amber-500/40'
                    }`}>
                      {stats.totalCount}/40
                    </div>
                  </div>

                  {/* タイル中央：キーカード情報プレビュー */}
                  <div className="z-10 text-[10px] text-cyan-200/80 font-bold truncate">
                    {keyCard ? `★ ${keyCard.name}` : 'カード未編成'}
                  </div>

                  {/* タイル下部：システム構成アイコン */}
                  <div className="flex items-center justify-between z-10 pt-1 border-t border-white/10 text-[10px] font-mono font-bold">
                    <div className="flex items-center gap-2 text-slate-300">
                      {stats.elementCounts.Fire > 0 && <span className="text-red-400">⚙{stats.elementCounts.Fire}</span>}
                      {stats.elementCounts.Water > 0 && <span className="text-cyan-400">≈{stats.elementCounts.Water}</span>}
                      {stats.elementCounts.Earth > 0 && <span className="text-emerald-400">※{stats.elementCounts.Earth}</span>}
                      {stats.elementCounts.Light > 0 && <span className="text-amber-300">◎{stats.elementCounts.Light}</span>}
                      {stats.elementCounts.Dark > 0 && <span className="text-purple-400">Ψ{stats.elementCounts.Dark}</span>}
                      {stats.elementCounts.Neutral > 0 && <span className="text-slate-400">◇{stats.elementCounts.Neutral}</span>}
                    </div>

                    <div className="flex items-center gap-1.5 text-[9px] text-slate-400">
                      <span>ユ:{stats.unitCount}</span>
                      <span>ス:{stats.spellCount}</span>
                      <span>ル:{stats.runeCount}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* ------------------------------------------------------------- */}
        {/* 右ペイン：選択デッキ詳細 (Selected Deck Details Panel) */}
        {/* ------------------------------------------------------------- */}
        <aside className="w-full md:w-96 lg:w-[410px] bg-[#07142d]/95 border-2 border-cyan-800/80 rounded-2xl p-4 flex flex-col justify-between shadow-2xl shrink-0 overflow-hidden">
          <div className="space-y-3">
            {/* 1. キーカードのイラストバナー */}
            <div 
              onClick={() => setDetailCard(currentKeyCard)}
              className="relative w-full h-28 rounded-xl bg-gradient-to-br from-slate-950 via-[#0e214d] to-slate-950 border-2 border-cyan-600/60 overflow-hidden shadow-inner flex items-center justify-between p-3 cursor-pointer group select-none"
              title="タップしてキーカードの詳細を確認"
            >
              <div className="absolute top-0 left-0 bg-gradient-to-r from-amber-500 to-yellow-400 text-black font-black text-[10px] px-2.5 py-0.5 rounded-br-lg shadow-md z-10 flex items-center gap-1">
                <Sparkles size={10} />
                <span>キーカード</span>
              </div>

              <div className="z-10 mt-3 max-w-[240px]">
                <div className="text-[11px] font-black text-amber-300 drop-shadow">
                  ★ コスト {currentKeyCard.cost} • {currentKeyCard.type || currentKeyCard.cardType}
                </div>
                <div className="text-sm font-black text-white drop-shadow truncate mt-0.5 group-hover:text-cyan-300 transition-colors">
                  {currentKeyCard.name}
                </div>
                <div className="text-[10px] text-cyan-200/90 line-clamp-2 mt-0.5 leading-tight">
                  {currentKeyCard.effectText || '通常ユニット。戦場を制圧する要。'}
                </div>
              </div>

              <div className="z-10 flex flex-col items-end shrink-0 gap-1">
                <div className="w-9 h-9 rounded-full bg-amber-500 border-2 border-amber-200 flex flex-col items-center justify-center font-black text-black shadow-lg">
                  <span className="text-[8px] leading-none uppercase">コスト</span>
                  <span className="text-sm leading-none">{currentKeyCard.cost}</span>
                </div>
                {currentKeyCard.atk !== undefined && (
                  <div className="bg-black/70 px-2 py-0.5 rounded text-[10px] font-mono font-bold text-red-300 border border-slate-700">
                    {currentKeyCard.atk} / {currentKeyCard.def}
                  </div>
                )}
              </div>
            </div>

            {/* 2. デッキ名 ＆ 編集ペンシル ＆ 種別構成 ＆ 総枚数 */}
            <div className="bg-slate-900/80 p-2.5 rounded-xl border border-cyan-900/60 flex items-center justify-between gap-2">
              <div className="flex-1 overflow-hidden">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-black text-white truncate">{currentSelectedDeck.name}</span>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingNameDeckId(currentSelectedDeck.id);
                      setEditingNameValue(currentSelectedDeck.name);
                    }}
                    className="p-1 text-cyan-400 hover:text-white rounded hover:bg-cyan-950/60 transition-colors cursor-pointer"
                    title="デッキ名を変更"
                  >
                    <Edit2 size={13} />
                  </button>
                </div>
                <div className="flex items-center gap-2.5 text-[10px] text-slate-300 font-bold mt-0.5">
                  <span>ユニット: <strong className="text-cyan-300">{listStats.unitCount}</strong></span>
                  <span>スペル: <strong className="text-blue-300">{listStats.spellCount}</strong></span>
                  <span>ルーン: <strong className="text-amber-300">{listStats.runeCount}</strong></span>
                  {listStats.domainCount > 0 && <span>ドメイン: <strong className="text-emerald-300">{listStats.domainCount}</strong></span>}
                </div>
              </div>

              <div className="flex items-center gap-1 bg-slate-950 px-2.5 py-1.5 rounded-lg border border-cyan-800/60 font-mono shrink-0">
                <Layers size={14} className="text-cyan-400" />
                <span className={`text-xs font-black ${listStats.totalCount === 40 ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {listStats.totalCount} / 40
                </span>
              </div>
            </div>

            {/* 3. システム構成アイコン行 */}
            <div className="flex items-center justify-between bg-slate-950/80 px-3 py-1.5 rounded-lg border border-cyan-900/60 text-xs font-mono font-bold">
              <span className="flex items-center gap-1 text-red-400" title="火">
                <span>⚙</span>{listStats.elementCounts.Fire}
              </span>
              <span className="flex items-center gap-1 text-cyan-300" title="水">
                <span>≈</span>{listStats.elementCounts.Water}
              </span>
              <span className="flex items-center gap-1 text-emerald-300" title="地">
                <span>※</span>{listStats.elementCounts.Earth}
              </span>
              <span className="flex items-center gap-1 text-amber-300" title="光">
                <span>◎</span>{listStats.elementCounts.Light}
              </span>
              <span className="flex items-center gap-1 text-purple-300" title="闇">
                <span>Ψ</span>{listStats.elementCounts.Dark}
              </span>
              <span className="flex items-center gap-1 text-slate-400" title="無">
                <span>◇</span>{listStats.elementCounts.Neutral}
              </span>
            </div>

            {/* 4. コスト分布グラフ（SCRIPTIA仕様：~1〜8+） */}
            <div className="bg-slate-950/80 p-2.5 rounded-xl border border-cyan-900/60">
              <div className="flex items-center justify-between text-[10px] text-slate-400 font-bold mb-1">
                <span>コスト分布</span>
                <span className="text-amber-400 font-mono">ルーン投入数: {listStats.runeCount}枚</span>
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
              </div>
            </div>

            {/* 5. プレイマット / プロテクト設定 */}
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
              <div className="flex gap-2 h-12">
                <div className={`flex-1 rounded-lg bg-gradient-to-r ${PLAYMAT_LIST[playmatIdx].color} border border-cyan-700/40 flex items-center justify-center text-xs font-black text-amber-300/90 shadow-inner`}>
                  {PLAYMAT_LIST[playmatIdx].name}
                </div>
                <div className="w-9 h-full rounded-lg bg-gradient-to-b from-blue-700 to-indigo-950 border-2 border-cyan-400 flex items-center justify-center text-[8px] font-black text-cyan-200 shadow-md">
                  SCRIPTIA
                </div>
              </div>
            </div>
          </div>

          {/* 下部アクションボタン群（デッキ削除、デッキ確認、デッキ編成） */}
          <div className="flex gap-2.5 pt-3 border-t border-cyan-900/60 shrink-0">
            <button
              type="button"
              onClick={() => handleDeleteDeck(currentSelectedDeck.id)}
              className="px-3.5 py-2.5 bg-gradient-to-b from-red-600 to-red-900 hover:from-red-500 hover:to-red-800 text-white font-bold rounded-xl border border-red-400/50 shadow-md text-xs active:scale-95 transition-all cursor-pointer flex items-center gap-1 shrink-0"
            >
              <Trash2 size={13} />
              <span>デッキ削除</span>
            </button>

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

            <button
              type="button"
              onClick={() => handleStartEdit(currentSelectedDeck)}
              className="flex-1 py-2.5 bg-gradient-to-r from-blue-600 via-cyan-500 to-blue-600 hover:from-blue-500 hover:to-cyan-400 text-white font-black rounded-xl border border-cyan-300/60 shadow-[0_0_20px_rgba(6,182,212,0.6)] text-sm tracking-wider active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-1.5"
            >
              <Edit2 size={14} />
              <span>デッキ編成</span>
            </button>
          </div>
        </aside>
      </div>

      {/* ================================================================= */}
      {/* デッキ確認モーダル */}
      {/* ================================================================= */}
      {showDeckConfirmModal && confirmTargetDeck && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
          onClick={() => setShowDeckConfirmModal(false)}
        >
          <div
            className="w-full max-w-2xl bg-[#091530] border-2 border-cyan-500 rounded-2xl p-4 flex flex-col shadow-2xl max-h-[85vh] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-cyan-800 pb-2 mb-3">
              <div className="flex items-center gap-2">
                <Eye size={18} className="text-cyan-400" />
                <span className="font-black text-sm text-white">デッキ内容確認 : {confirmTargetDeck.name}</span>
                <span className="text-xs text-cyan-300 font-mono">({getDeckStats(confirmTargetDeck).totalCount}枚)</span>
              </div>
              <button
                type="button"
                onClick={() => setShowDeckConfirmModal(false)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto grid grid-cols-2 sm:grid-cols-4 gap-2 p-1 custom-scrollbar">
              {confirmTargetDeck.cards.map(entry => {
                const card = getCard(entry.cardId);
                if (!card) return null;
                const sys = normalizeElement(card.system || card.element);
                const iconInfo = ELEMENT_ICONS[sys] || ELEMENT_ICONS.Neutral;

                return (
                  <div
                    key={card.id}
                    onClick={() => setDetailCard(card)}
                    className="p-2 rounded-lg border border-cyan-900 bg-black/50 hover:border-cyan-400 transition-colors flex items-center justify-between cursor-pointer"
                    title="タップして詳細を見る"
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <span className="w-5 h-5 rounded-full bg-amber-500 text-black text-[10px] font-black flex items-center justify-center shrink-0">
                        {card.cost}
                      </span>
                      <div className="truncate">
                        <div className="text-xs font-bold text-white truncate">{card.name}</div>
                        <div className={`text-[9px] ${iconInfo.text}`}>{iconInfo.label}属性</div>
                      </div>
                    </div>
                    <span className="px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-300 font-mono font-bold text-xs shrink-0">
                      ×{entry.count}
                    </span>
                  </div>
                );
              })}
            </div>

            <div className="pt-3 border-t border-cyan-900 mt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setShowDeckConfirmModal(false)}
                className="px-5 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-bold border border-slate-600"
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
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
          onClick={() => setEditingNameDeckId(null)}
        >
          <div
            className="w-full max-w-sm bg-[#091530] border-2 border-cyan-500 rounded-2xl p-4 flex flex-col shadow-2xl gap-3"
            onClick={(e) => e.stopPropagation()}
          >
            <span className="text-sm font-black text-white">デッキ名の変更</span>
            <input
              type="text"
              value={editingNameValue}
              onChange={(e) => setEditingNameValue(e.target.value)}
              maxLength={20}
              placeholder="デッキ名を入力…"
              className="px-3 py-2 bg-black/60 border border-cyan-700 rounded-lg text-sm text-white focus:outline-none focus:border-cyan-400"
              autoFocus
            />
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setEditingNameDeckId(null)}
                className="px-4 py-1.5 bg-slate-800 text-slate-300 rounded-lg text-xs font-bold"
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={handleSaveDeckName}
                className="px-4 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg text-xs font-black shadow"
              >
                決定
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {/* カード詳細モーダル */}
      {/* ================================================================= */}
      {detailCard && (
        <CardDetailModal
          card={detailCard}
          onClose={() => setDetailCard(null)}
        />
      )}

      {/* ================================================================= */}
      {/* トースト通知 */}
      {/* ================================================================= */}
      {toastMessage && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-gradient-to-r from-blue-700 via-cyan-600 to-blue-700 text-white font-black text-xs px-5 py-2.5 rounded-full shadow-[0_0_20px_rgba(6,182,212,0.8)] border border-cyan-300 z-[99999] animate-bounce">
          {toastMessage}
        </div>
      )}
    </div>
  );
};
