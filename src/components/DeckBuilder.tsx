import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Card } from '../types';
import { UserDeck } from '../types/deck';
import { CARDS, getCard } from '../data/cards';
import { FloatingCardPreview } from './FloatingCardPreview';
import { formatCardMetaJapanese } from '../utils/cardFormatter';
import { Trash2, Plus, Sparkles, AlertCircle, CheckCircle2, ChevronRight, Layers, ArrowLeft } from 'lucide-react';

interface DeckBuilderProps {
  onBackToBattle: (selectedDeck?: UserDeck) => void;
}

export const STORAGE_KEY = 'scriptia_saved_decks';
export const ACTIVE_DECK_KEY = 'scriptia_active_deck_id';

// 公式スターターデッキ（火単ランページ 40枚）
export const STARTER_DECK_FIRE: UserDeck = {
  id: 'starter_fire',
  name: '紅蓮の突撃軍（火単スターター）',
  cards: [
    { cardId: 'BR-01', count: 4 }, // レクス
    { cardId: 'BR-02', count: 4 }, // ダンク
    { cardId: 'BR-03', count: 4 }, // ゼルガン
    { cardId: 'BR-04', count: 4 }, // ラグナ
    { cardId: 'BR-05', count: 4 }, // タルカス
    { cardId: 'BR-07', count: 4 }, // キース(速攻)
    { cardId: 'BR-08', count: 4 }, // クリムゾン・ドラゴン
    { cardId: 'BR-11', count: 4 }, // グレンバーン(進化)
    { cardId: 'BR-12', count: 4 }, // フレイム・ダーツ
    { cardId: 'BR-14', count: 4 }, // インフェルノ・トラップ
  ],
  createdAt: 1700000000000,
  updatedAt: 1700000000000,
};

// 公式スターターデッキ2（水・光コントロール 40枚）
export const STARTER_DECK_CONTROL: UserDeck = {
  id: 'starter_water_light',
  name: '蒼天の聖域（水光コントロール）',
  cards: [
    { cardId: 'BB-01', count: 4 }, // コルネ
    { cardId: 'BB-02', count: 4 }, // ミュート
    { cardId: 'BB-04', count: 4 }, // アクア・ナイト
    { cardId: 'BB-12', count: 4 }, // ハイドロ・スパイラル
    { cardId: 'BB-14', count: 4 }, // ディープ・バリア
    { cardId: 'BW-01', count: 4 }, // クラーク
    { cardId: 'BW-02', count: 4 }, // ピュリティ
    { cardId: 'BW-04', count: 4 }, // エルサ
    { cardId: 'BW-12', count: 4 }, // ホーリー・ジャッジ
    { cardId: 'BW-14', count: 4 }, // ヘブンズ・シールド
  ],
  createdAt: 1700000001000,
  updatedAt: 1700000001000,
};

export const DeckBuilder: React.FC<DeckBuilderProps> = ({ onBackToBattle }) => {
  const [decks, setDecks] = useState<UserDeck[]>([]);
  const [activeDeckId, setActiveDeckId] = useState<string>('');
  const [selectedElement, setSelectedElement] = useState<string>('ALL');
  const [selectedType, setSelectedType] = useState<string>('ALL');
  const [previewCard, setPreviewCard] = useState<Card | null>(null);

  // 長押しタイマー管理
  const longPressTimerRef = useRef<NodeJS.Timeout | number | null>(null);
  const isLongPressRef = useRef(false);

  // 初回読み込み
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed: UserDeck[] = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setDecks(parsed);
          const activeId = localStorage.getItem(ACTIVE_DECK_KEY) || parsed[0]?.id;
          setActiveDeckId(activeId);
          return;
        }
      } catch (e) {
        console.error("デッキデータの読み込みに失敗しました", e);
      }
    }
    // 初期設定
    const initialDecks = [STARTER_DECK_FIRE, STARTER_DECK_CONTROL];
    setDecks(initialDecks);
    setActiveDeckId(STARTER_DECK_FIRE.id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(initialDecks));
    localStorage.setItem(ACTIVE_DECK_KEY, STARTER_DECK_FIRE.id);
  }, []);

  const currentDeck = decks.find(d => d.id === activeDeckId) || decks[0] || STARTER_DECK_FIRE;

  // デッキ総枚数
  const totalCardsCount = useMemo(() => {
    return currentDeck.cards.reduce((sum, item) => sum + item.count, 0);
  }, [currentDeck]);

  // デッキ内カードの完全オブジェクト配列（コスト順）
  const deckCardsDetailed = useMemo(() => {
    return currentDeck.cards
      .map(entry => {
        const cardData = CARDS.find(c => c.id === entry.cardId);
        return { ...entry, card: cardData };
      })
      .filter((entry): entry is { cardId: string; count: number; card: Card } => entry.card !== undefined)
      .sort((a, b) => (a.card.cost - b.card.cost));
  }, [currentDeck]);

  // マナカーブ統計（1〜7+コスト）
  const manaCurve = useMemo(() => {
    const counts = [0, 0, 0, 0, 0, 0, 0, 0]; // index: 0=未使用, 1〜6, 7=7以上
    deckCardsDetailed.forEach(item => {
      const c = item.card.cost;
      const idx = c >= 7 ? 7 : c;
      counts[idx] += item.count;
    });
    return counts;
  }, [deckCardsDetailed]);

  // 系統統計
  const elementStats = useMemo(() => {
    const stats: Record<string, number> = { Fire: 0, Water: 0, Earth: 0, Light: 0, Dark: 0, Neutral: 0 };
    deckCardsDetailed.forEach(item => {
      const el = item.card.element || item.card.system || 'Neutral';
      const key = el === '火' ? 'Fire' : el === '水' ? 'Water' : el === '地' ? 'Earth' : el === '光' ? 'Light' : el === '闇' ? 'Dark' : el;
      stats[key] = (stats[key] || 0) + item.count;
    });
    return stats;
  }, [deckCardsDetailed]);

  // カードプールフィルタ
  const filteredPool = useMemo(() => {
    return CARDS.filter(c => {
      if (selectedElement !== 'ALL') {
        const el = c.element || c.system || 'Neutral';
        const elNorm = el === '火' ? 'Fire' : el === '水' ? 'Water' : el === '地' ? 'Earth' : el === '光' ? 'Light' : el === '闇' ? 'Dark' : el;
        if (elNorm !== selectedElement) return false;
      }
      if (selectedType !== 'ALL') {
        const ct = (c.cardType || c.type || '').toUpperCase();
        if (selectedType === 'UNIT' && ct !== 'UNIT') return false;
        if (selectedType === 'EVOLUTION' && ct !== 'EVOLUTION') return false;
        if (selectedType === 'SPELL' && ct !== 'SPELL') return false;
        if (selectedType === 'RUNE' && ct !== 'RUNE') return false;
        if (selectedType === 'DOMAIN' && ct !== 'DOMAIN') return false;
      }
      return true;
    });
  }, [selectedElement, selectedType]);

  // デッキ保存
  const saveDecks = (newDecks: UserDeck[]) => {
    setDecks(newDecks);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newDecks));
  };

  // デッキ名変更
  const handleRenameDeck = (newName: string) => {
    const updated = decks.map(d => d.id === currentDeck.id ? { ...d, name: newName, updatedAt: Date.now() } : d);
    saveDecks(updated);
  };

  // カード追加
  const handleAddCard = (card: Card) => {
    if (totalCardsCount >= 40) return; // 40枚上限
    const existing = currentDeck.cards.find(c => c.cardId === card.id);
    if (existing && existing.count >= 4) return; // 同名4枚上限

    let newCards = [...currentDeck.cards];
    if (existing) {
      newCards = newCards.map(c => c.cardId === card.id ? { ...c, count: c.count + 1 } : c);
    } else {
      newCards.push({ cardId: card.id, count: 1 });
    }

    const updated = decks.map(d => d.id === currentDeck.id ? { ...d, cards: newCards, updatedAt: Date.now() } : d);
    saveDecks(updated);
  };

  // カード削除
  const handleRemoveCard = (cardId: string) => {
    const existing = currentDeck.cards.find(c => c.cardId === cardId);
    if (!existing) return;

    let newCards = [...currentDeck.cards];
    if (existing.count > 1) {
      newCards = newCards.map(c => c.cardId === cardId ? { ...c, count: c.count - 1 } : c);
    } else {
      newCards = newCards.filter(c => c.cardId !== cardId);
    }

    const updated = decks.map(d => d.id === currentDeck.id ? { ...d, cards: newCards, updatedAt: Date.now() } : d);
    saveDecks(updated);
  };

  // 新規デッキ作成
  const handleCreateDeck = () => {
    const newDeck: UserDeck = {
      id: 'deck_' + Date.now(),
      name: `新規デッキ ${decks.length + 1}`,
      cards: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    const updated = [...decks, newDeck];
    saveDecks(updated);
    setActiveDeckId(newDeck.id);
    localStorage.setItem(ACTIVE_DECK_KEY, newDeck.id);
  };

  // デッキ削除
  const handleDeleteDeck = (deckId: string) => {
    if (decks.length <= 1) {
      alert('最低1つのデッキが必要です');
      return;
    }
    if (!confirm(`デッキ「${currentDeck.name}」を削除しますか？`)) return;
    const filtered = decks.filter(d => d.id !== deckId);
    saveDecks(filtered);
    setActiveDeckId(filtered[0].id);
    localStorage.setItem(ACTIVE_DECK_KEY, filtered[0].id);
  };

  // 長押しプレビュー開始
  const handlePointerDownCard = (card: Card) => {
    isLongPressRef.current = false;
    longPressTimerRef.current = setTimeout(() => {
      isLongPressRef.current = true;
      setPreviewCard(card);
    }, 450);
  };

  const handlePointerUpOrLeaveCard = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current as NodeJS.Timeout);
      longPressTimerRef.current = null;
    }
  };

  return (
    <div className="flex h-screen w-screen bg-[#050811] text-white select-none overflow-hidden font-sans">
      <FloatingCardPreview card={previewCard} onClose={() => setPreviewCard(null)} />

      {/* 左サイド：デッキ構成・統計パネル（幅420px） */}
      <div className="w-[420px] h-full flex flex-col border-r border-cyan-900/40 bg-[#0a0f1d]/95 backdrop-blur-md p-3.5 shrink-0 z-10">
        
        {/* トップバー：戻るボタン & デッキ選択セレクター */}
        <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-cyan-800/40">
          <button
            onClick={() => onBackToBattle()}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800/90 hover:bg-slate-700 text-cyan-300 text-xs font-bold transition-all border border-cyan-900/60"
            title="バトル画面へ戻る"
          >
            <ArrowLeft size={14} />
            <span>対戦へ戻る</span>
          </button>

          <div className="flex items-center gap-1.5 flex-1 max-w-[210px]">
            <select
              value={activeDeckId}
              onChange={(e) => {
                setActiveDeckId(e.target.value);
                localStorage.setItem(ACTIVE_DECK_KEY, e.target.value);
              }}
              className="bg-slate-900 border border-cyan-700/60 rounded-lg px-2 py-1 text-xs font-bold text-cyan-200 focus:outline-none focus:border-cyan-400 w-full truncate"
            >
              {decks.map(d => (
                <option key={d.id} value={d.id}>
                  {d.name} ({d.cards.reduce((s, c) => s + c.count, 0)}枚)
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={() => handleDeleteDeck(currentDeck.id)}
            className="p-1.5 rounded-lg bg-red-950/60 hover:bg-red-900/80 text-red-400 hover:text-red-200 border border-red-800/50 text-xs transition-all"
            title="現在のデッキを削除"
          >
            <Trash2 size={13} />
          </button>
        </div>

        {/* ヘッダー：デッキ名入力 & 枚数カウンター */}
        <div className="flex items-center justify-between gap-2 py-2 border-b border-cyan-900/40">
          <input
            type="text"
            value={currentDeck.name}
            onChange={(e) => handleRenameDeck(e.target.value)}
            placeholder="デッキ名を入力"
            className="bg-slate-900/90 border border-cyan-700/50 rounded-lg px-2.5 py-1 text-xs font-bold text-cyan-100 focus:outline-none focus:border-cyan-400 flex-1 truncate"
          />
          <div className={`px-2.5 py-1 rounded-full text-xs font-black shrink-0 flex items-center gap-1 ${totalCardsCount === 40 ? 'bg-emerald-600/90 text-white shadow-[0_0_12px_rgba(16,185,129,0.7)] border border-emerald-400/50 animate-pulse' : 'bg-slate-900 text-amber-400 border border-amber-500/40'}`}>
            {totalCardsCount === 40 ? <CheckCircle2 size={12} /> : <AlertCircle size={12} />}
            <span>{totalCardsCount} / 40枚</span>
          </div>
        </div>

        {/* 統計エリア：コストカーブ棒グラフ */}
        <div className="py-2 border-b border-cyan-900/40">
          <div className="text-[10px] text-slate-400 font-bold mb-1 flex justify-between">
            <span className="tracking-wider text-cyan-400/80">COST CURVE</span>
            <span>平均コスト: {(deckCardsDetailed.reduce((s, i) => s + (i.card.cost * i.count), 0) / (totalCardsCount || 1)).toFixed(1)}</span>
          </div>
          <div className="flex items-end justify-between h-12 px-2 bg-slate-950/70 rounded-lg border border-slate-800/80">
            {[1, 2, 3, 4, 5, 6, 7].map((cost) => {
              const count = manaCurve[cost];
              const maxCount = Math.max(...manaCurve.slice(1), 8);
              const barHeight = Math.min(100, Math.max(8, (count / maxCount) * 100));
              return (
                <div key={cost} className="flex flex-col items-center gap-0.5 w-6">
                  <span className="text-[8.5px] font-bold text-cyan-300">{count > 0 ? count : ''}</span>
                  <div
                    style={{ height: `${count === 0 ? 3 : barHeight}%` }}
                    className={`w-3.5 rounded-t-sm transition-all ${count > 0 ? 'bg-gradient-to-t from-cyan-600 to-cyan-400 shadow-[0_0_6px_rgba(6,182,212,0.6)]' : 'bg-slate-800'}`}
                  />
                  <span className="text-[8.5px] text-slate-500 font-mono">{cost === 7 ? '7+' : cost}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* 統計エリア：系統比率バー（火・水・地・光・闇・無） */}
        <div className="py-2 border-b border-cyan-900/40">
          <div className="text-[10px] text-slate-400 font-bold mb-1 flex justify-between">
            <span className="tracking-wider text-cyan-400/80">ELEMENT RATIO</span>
            <div className="flex gap-2 text-[9px]">
              {elementStats.Fire > 0 && <span className="text-red-400">火:{elementStats.Fire}</span>}
              {elementStats.Water > 0 && <span className="text-blue-400">水:{elementStats.Water}</span>}
              {elementStats.Earth > 0 && <span className="text-emerald-400">地:{elementStats.Earth}</span>}
              {elementStats.Light > 0 && <span className="text-amber-300">光:{elementStats.Light}</span>}
              {elementStats.Dark > 0 && <span className="text-purple-400">闇:{elementStats.Dark}</span>}
              {elementStats.Neutral > 0 && <span className="text-slate-400">無:{elementStats.Neutral}</span>}
            </div>
          </div>
          <div className="h-2 w-full bg-slate-900 rounded-full overflow-hidden flex border border-slate-800">
            {totalCardsCount > 0 ? (
              <>
                <div style={{ width: `${(elementStats.Fire / totalCardsCount) * 100}%` }} className="bg-red-500 h-full" title={`火: ${elementStats.Fire}枚`} />
                <div style={{ width: `${(elementStats.Water / totalCardsCount) * 100}%` }} className="bg-blue-500 h-full" title={`水: ${elementStats.Water}枚`} />
                <div style={{ width: `${(elementStats.Earth / totalCardsCount) * 100}%` }} className="bg-emerald-500 h-full" title={`地: ${elementStats.Earth}枚`} />
                <div style={{ width: `${(elementStats.Light / totalCardsCount) * 100}%` }} className="bg-amber-400 h-full" title={`光: ${elementStats.Light}枚`} />
                <div style={{ width: `${(elementStats.Dark / totalCardsCount) * 100}%` }} className="bg-purple-600 h-full" title={`闇: ${elementStats.Dark}枚`} />
                <div style={{ width: `${(elementStats.Neutral / totalCardsCount) * 100}%` }} className="bg-slate-400 h-full" title={`無: ${elementStats.Neutral}枚`} />
              </>
            ) : (
              <div className="w-full h-full bg-slate-800" />
            )}
          </div>
        </div>

        {/* デッキ内カード一覧（スクロールエリア） */}
        <div className="flex-1 overflow-y-auto pr-1 my-2 space-y-1.5 custom-scrollbar min-h-0">
          {deckCardsDetailed.map(({ card, count }) => {
            const el = card.element || card.system || 'Neutral';
            const elColor = 
              el === '火' || el === 'Fire' ? 'border-red-600/50 bg-red-950/20' :
              el === '水' || el === 'Water' ? 'border-blue-600/50 bg-blue-950/20' :
              el === '地' || el === 'Earth' ? 'border-emerald-600/50 bg-emerald-950/20' :
              el === '光' || el === 'Light' ? 'border-amber-400/50 bg-amber-950/20' :
              el === '闇' || el === 'Dark' ? 'border-purple-600/50 bg-purple-950/20' :
              'border-slate-700 bg-slate-900/40';

            return (
              <div
                key={card.id}
                onClick={() => {
                  if (!isLongPressRef.current) {
                    handleRemoveCard(card.id);
                  }
                }}
                onPointerDown={() => handlePointerDownCard(card)}
                onPointerUp={handlePointerUpOrLeaveCard}
                onPointerLeave={handlePointerUpOrLeaveCard}
                onContextMenu={(e) => { e.preventDefault(); setPreviewCard(card); }}
                className={`group flex items-center justify-between p-2 rounded-lg ${elColor} hover:bg-red-950/50 border hover:border-red-500/70 cursor-pointer transition-all shadow-sm`}
                title="タップで1枚削除 / 長押し・右クリックで詳細"
              >
                <div className="flex items-center gap-2 overflow-hidden flex-1">
                  <span className="w-5 h-5 rounded-full bg-slate-800 text-[11px] font-black text-amber-400 flex items-center justify-center shrink-0 border border-slate-700">
                    {card.cost}
                  </span>
                  <div className="overflow-hidden flex flex-col">
                    <span className="text-xs font-bold text-slate-100 truncate group-hover:text-red-300">
                      {card.name}
                    </span>
                    <span className="text-[9.5px] text-cyan-400/70 truncate">
                      {formatCardMetaJapanese(card)}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0 ml-2">
                  <span className="text-xs font-mono font-black text-cyan-300 bg-cyan-950/80 px-2 py-0.5 rounded border border-cyan-800/60 shadow-sm">
                    x{count}
                  </span>
                </div>
              </div>
            );
          })}
          {deckCardsDetailed.length === 0 && (
            <div className="h-40 flex flex-col items-center justify-center text-slate-500 text-xs italic text-center p-4 border border-dashed border-slate-800 rounded-xl">
              <Layers size={24} className="mb-2 text-slate-600" />
              <span>右のカードプールからカードを追加してください</span>
              <span className="text-[10px] text-slate-600 mt-1">（タップで追加 / 40枚で構築完了）</span>
            </div>
          )}
        </div>

        {/* フッター：対戦開始 & 新規作成ボタン */}
        <div className="pt-2 border-t border-cyan-800/40 flex gap-2 shrink-0">
          <button
            onClick={handleCreateDeck}
            className="py-2.5 px-3 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-bold transition-all border border-slate-700 flex items-center gap-1 cursor-pointer"
          >
            <Plus size={13} />
            <span>新規</span>
          </button>
          <button
            onClick={() => {
              if (totalCardsCount === 40) {
                localStorage.setItem(ACTIVE_DECK_KEY, currentDeck.id);
                onBackToBattle(currentDeck);
              }
            }}
            disabled={totalCardsCount !== 40}
            className={`flex-1 py-2.5 rounded-lg text-xs font-black transition-all flex items-center justify-center gap-1.5 ${
              totalCardsCount === 40
                ? 'bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white shadow-[0_0_20px_rgba(6,182,212,0.6)] cursor-pointer active:scale-95'
                : 'bg-slate-800/80 text-slate-500 cursor-not-allowed border border-slate-700'
            }`}
          >
            {totalCardsCount === 40 ? (
              <>
                <Sparkles size={14} className="text-yellow-300 animate-spin" />
                <span>このデッキで対戦へ！（40枚完了）</span>
              </>
            ) : (
              <span>40枚必要です ({totalCardsCount}/40)</span>
            )}
          </button>
        </div>
      </div>

      {/* 右サイド：全80枚カードプールブラウザ */}
      <div className="flex-1 h-full flex flex-col p-3.5 bg-[#050914] overflow-hidden">
        {/* フィルタバー */}
        <div className="flex flex-wrap items-center justify-between pb-2.5 border-b border-cyan-900/40 gap-3 shrink-0">
          {/* 系統フィルタ */}
          <div className="flex flex-wrap gap-1">
            {['ALL', 'Fire', 'Water', 'Earth', 'Light', 'Dark', 'Neutral'].map((el) => {
              const labelMap: Record<string, string> = { ALL: '全属性', Fire: '火', Water: '水', Earth: '地', Light: '光', Dark: '闇', Neutral: '無' };
              const colorMap: Record<string, string> = {
                Fire: 'border-red-500/60 text-red-300',
                Water: 'border-blue-500/60 text-blue-300',
                Earth: 'border-emerald-500/60 text-emerald-300',
                Light: 'border-amber-400/60 text-amber-300',
                Dark: 'border-purple-500/60 text-purple-300',
                Neutral: 'border-slate-500/60 text-slate-300',
                ALL: '',
              };
              return (
                <button
                  key={el}
                  onClick={() => setSelectedElement(el)}
                  className={`px-2.5 py-1 rounded-md text-xs font-bold transition-all cursor-pointer ${
                    selectedElement === el
                      ? 'bg-cyan-500 text-black shadow-[0_0_12px_rgba(6,182,212,0.6)] font-black'
                      : `bg-slate-900/90 text-slate-300 hover:text-white border border-slate-800 ${colorMap[el]}`
                  }`}
                >
                  {labelMap[el]}
                </button>
              );
            })}
          </div>

          {/* タイプフィルタ */}
          <div className="flex flex-wrap gap-1">
            {['ALL', 'UNIT', 'EVOLUTION', 'SPELL', 'RUNE', 'DOMAIN'].map((tp) => {
              const typeLabels: Record<string, string> = { ALL: '全種別', UNIT: 'ユニット', EVOLUTION: '進化', SPELL: 'スペル', RUNE: 'ルーン', DOMAIN: 'ドメイン' };
              return (
                <button
                  key={tp}
                  onClick={() => setSelectedType(tp)}
                  className={`px-2 py-1 rounded-md text-xs font-bold transition-all cursor-pointer ${
                    selectedType === tp
                      ? 'bg-amber-500 text-black shadow-[0_0_12px_rgba(245,158,11,0.6)] font-black'
                      : 'bg-slate-900/90 text-slate-400 hover:text-white border border-slate-800'
                  }`}
                >
                  {typeLabels[tp]}
                </button>
              );
            })}
          </div>

          <button
            onClick={() => onBackToBattle()}
            className="px-3.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-md text-xs font-bold border border-slate-700 cursor-pointer ml-auto"
          >
            ✕ 閉じる
          </button>
        </div>

        {/* カードプールグリッド */}
        <div className="flex-1 overflow-y-auto p-1.5 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2.5 custom-scrollbar min-h-0">
          {filteredPool.map((card) => {
            const currentCount = currentDeck.cards.find(c => c.cardId === card.id)?.count || 0;
            const isMax = currentCount >= 4;
            const isDeckFull = totalCardsCount >= 40;
            const canAdd = !isMax && !isDeckFull;

            const el = card.element || card.system || 'Neutral';
            const elBorder = 
              el === '火' || el === 'Fire' ? 'border-red-800/60 hover:border-red-400' :
              el === '水' || el === 'Water' ? 'border-blue-800/60 hover:border-blue-400' :
              el === '地' || el === 'Earth' ? 'border-emerald-800/60 hover:border-emerald-400' :
              el === '光' || el === 'Light' ? 'border-amber-700/60 hover:border-amber-300' :
              el === '闇' || el === 'Dark' ? 'border-purple-800/60 hover:border-purple-400' :
              'border-slate-800 hover:border-slate-500';

            return (
              <div
                key={card.id}
                onClick={() => {
                  if (!isLongPressRef.current) {
                    handleAddCard(card);
                  }
                }}
                onPointerDown={() => handlePointerDownCard(card)}
                onPointerUp={handlePointerUpOrLeaveCard}
                onPointerLeave={handlePointerUpOrLeaveCard}
                onContextMenu={(e) => { e.preventDefault(); setPreviewCard(card); }}
                className={`relative rounded-xl border p-2 flex flex-col justify-between transition-all select-none group ${
                  isMax || isDeckFull
                    ? 'bg-slate-950/40 opacity-60 cursor-not-allowed border-slate-800'
                    : `bg-slate-900/80 hover:bg-slate-850 ${elBorder} shadow-md hover:shadow-[0_0_14px_rgba(6,182,212,0.3)] cursor-pointer active:scale-95`
                }`}
                title="タップでデッキに追加 / 長押し・右クリックで詳細"
              >
                {/* コスト & 枚数バッジ */}
                <div className="flex items-center justify-between mb-1">
                  <div className="w-5 h-5 rounded-full bg-gradient-to-br from-amber-400 to-orange-600 flex items-center justify-center font-black text-[11px] text-white shadow">
                    {card.cost}
                  </div>
                  <span className={`text-[9px] font-mono font-black px-1.5 py-0.5 rounded ${
                    currentCount >= 4
                      ? 'bg-red-500 text-white'
                      : currentCount > 0
                        ? 'bg-cyan-500 text-black'
                        : 'bg-slate-800 text-slate-500'
                  }`}>
                    {currentCount}/4
                  </span>
                </div>

                {/* カード名 & メタ */}
                <div className="my-0.5 overflow-hidden">
                  <div className="text-[11px] font-bold text-white leading-tight truncate group-hover:text-cyan-300">
                    {card.name}
                  </div>
                  <div className="text-[9px] text-cyan-400/80 font-medium truncate mt-0.5">
                    {formatCardMetaJapanese(card)}
                  </div>
                </div>

                {/* スタッツ */}
                {(card.cardType === 'UNIT' || card.type === 'Unit' || card.cardType === 'EVOLUTION' || card.type === 'Evolution') ? (
                  <div className="flex justify-between items-center bg-slate-950/80 rounded px-1.5 py-0.5 text-[9.5px] font-bold border border-slate-800/80 mt-1">
                    <span className="text-red-400">⚔ {card.atk ?? 0}</span>
                    <span className="text-amber-400">⚡ {card.brk ?? 1}</span>
                    <span className="text-cyan-400">🛡 {card.def ?? 0}</span>
                  </div>
                ) : (
                  <div className="text-[9px] text-slate-500 italic py-0.5 mt-1 text-center bg-slate-950/50 rounded border border-slate-800/50">
                    {card.type || card.cardType}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
