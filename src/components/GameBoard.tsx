import React, { useState } from 'react';
import { GameState, GameAction, PlayerState, UnitState, CardInstance } from '../types';
import { CardView } from './CardView';
import { HandTray } from './HandTray';
import { getCard } from '../data/cards';
import { calculateUnitStats } from '../engine/engineUtils';
import { Shield, Droplet, Flame, Mountain, Sun, Moon, Hexagon, History, X, ChevronRight, Zap, Palette, Archive, Sparkles, Loader2 } from 'lucide-react';
import { PlaymatSelector, PlaymatThemeId, PLAYMAT_THEMES } from './PlaymatSelector';
import { ZoneViewerModal, ZoneSelectionConfig } from './ZoneViewerModal';

interface Props {
  state: GameState;
  dispatch: React.Dispatch<GameAction>;
  onInspect: (card: any) => void;
}

const SystemIcon: React.FC<{ sys: string }> = ({ sys }) => {
  switch (sys) {
    case 'Fire': return <Flame size={13} className="text-red-400" />;
    case 'Water': return <Droplet size={13} className="text-blue-400" />;
    case 'Earth': return <Mountain size={13} className="text-emerald-400" />;
    case 'Light': return <Sun size={13} className="text-amber-300" />;
    case 'Dark': return <Moon size={13} className="text-purple-400" />;
    default: return <Hexagon size={13} className="text-slate-400" />;
  }
};

export const GameBoard: React.FC<Props> = ({ state, dispatch, onInspect }) => {
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [arcanaMode, setArcanaMode] = useState(false);
  const [showLog, setShowLog] = useState(false);

  // Playmat Theme State (persisted in localStorage)
  const [playmatTheme, setPlaymatTheme] = useState<PlaymatThemeId>(() => {
    try {
      const saved = localStorage.getItem('scriptia_playmat');
      if (saved && PLAYMAT_THEMES.some(t => t.id === saved)) {
        return saved as PlaymatThemeId;
      }
    } catch (e) {
      // ignore localStorage errors
    }
    return 'library';
  });
  const [showPlaymatSelector, setShowPlaymatSelector] = useState(false);

  // Zone Viewer Modal State
  const [zoneModal, setZoneModal] = useState<{
    isOpen: boolean;
    title: string;
    zoneType: 'arcana' | 'archive';
    cards: CardInstance[];
    isOpponent?: boolean;
    selectionMode?: ZoneSelectionConfig | null;
  }>({
    isOpen: false,
    title: '',
    zoneType: 'arcana',
    cards: [],
  });

  const me = state.player1;
  const opp = state.player2;
  const isMyTurn = state.currentPlayer === 'player1';
  const currentTheme = PLAYMAT_THEMES.find(t => t.id === playmatTheme) || PLAYMAT_THEMES[0];

  // Deselect on empty click
  const handleBoardClick = () => {
    setSelectedCardId(null);
    setArcanaMode(false);
  };

  // Click on a hand or field card
  const handleCardClick = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();

    if (!isMyTurn) return;

    // Arcana Placement Phase
    if (state.phase === 'ARCANA_PLACEMENT') {
      const inHand = me.hand.find(c => c.instanceId === id);
      if (inHand) {
        if (arcanaMode || selectedCardId === id) {
          dispatch({ type: 'PLACE_ARCANA', instanceId: id });
          setArcanaMode(false);
          setSelectedCardId(null);
        } else {
          setSelectedCardId(id);
        }
      }
      return;
    }

    // Action Phase
    if (state.phase === 'ACTION') {
      const inHand = me.hand.find(c => c.instanceId === id);
      if (inHand) {
        const tpl = getCard(inHand.cardId);

        // Recovery Effect Hook for BW-13 (聖者の祈り)
        if (tpl.id === 'BW-13' && me.archive.some(c => ['Spell', 'Rune'].includes(getCard(c.cardId).type))) {
          setZoneModal({
            isOpen: true,
            title: '【聖者の祈り】回収するスペルまたはルーンを選択',
            zoneType: 'archive',
            cards: me.archive,
            isOpponent: false,
            selectionMode: {
              promptText: '手札に戻すカードを選んでください',
              canSelect: (cTpl) => cTpl.type === 'Spell' || cTpl.type === 'Rune',
              onSelect: (chosenId) => {
                dispatch({ type: 'PLAY_CARD', instanceId: inHand.instanceId, targetId: chosenId });
                setSelectedCardId(null);
              },
            },
          });
          return;
        }

        // Recovery Effect Hook for BW-08 (予言者 アナスタシア)
        if (tpl.id === 'BW-08' && me.archive.some(c => ['Spell', 'Rune'].includes(getCard(c.cardId).type))) {
          setZoneModal({
            isOpen: true,
            title: '【予言者 アナスタシア】登場時効果：回収カードを選択',
            zoneType: 'archive',
            cards: me.archive,
            isOpponent: false,
            selectionMode: {
              promptText: '召喚と同時に手札に戻すスペルまたはルーンを選択',
              canSelect: (cTpl) => cTpl.type === 'Spell' || cTpl.type === 'Rune',
              onSelect: (chosenId) => {
                dispatch({ type: 'PLAY_CARD', instanceId: inHand.instanceId, targetId: chosenId });
                setSelectedCardId(null);
              },
            },
          });
          return;
        }

        // Recovery Effect Hook for BD-10 (常闇の悪魔 バグラザード)
        if (tpl.id === 'BD-10' && me.archive.some(c => getCard(c.cardId).system === 'Dark')) {
          setZoneModal({
            isOpen: true,
            title: '【常闇の悪魔 バグラザード】登場時効果：闇カード回収',
            zoneType: 'archive',
            cards: me.archive,
            isOpponent: false,
            selectionMode: {
              promptText: '手札に戻す闇のカードを選択',
              canSelect: (cTpl) => cTpl.system === 'Dark',
              onSelect: (chosenId) => {
                dispatch({ type: 'PLAY_CARD', instanceId: inHand.instanceId, targetId: chosenId });
                setSelectedCardId(null);
              },
            },
          });
          return;
        }

        setSelectedCardId(id === selectedCardId ? null : id);
        return;
      }

      // Friendly Unit clicked
      const inField = me.field.find(c => c.instanceId === id);
      if (inField) {
        // If an evolution card is currently selected in hand, evolve it onto this unit!
        if (selectedCardId) {
          const selHand = me.hand.find(c => c.instanceId === selectedCardId);
          if (selHand && getCard(selHand.cardId).type === 'Evolution') {
            dispatch({ type: 'PLAY_CARD', instanceId: selectedCardId, evolutionTargetId: id });
            setSelectedCardId(null);
            return;
          }
        }

        // Otherwise, select friendly unit as attacker (if active)
        if (!inField.isRested && !inField.hasSummoningSickness) {
          setSelectedCardId(id === selectedCardId ? null : id);
          return;
        }
      }

      // Opponent Unit clicked
      const inOppField = opp.field.find(c => c.instanceId === id);
      if (inOppField && selectedCardId) {
        const selHand = me.hand.find(c => c.instanceId === selectedCardId);
        if (selHand) {
          dispatch({ type: 'PLAY_CARD', instanceId: selectedCardId, targetId: id });
        } else {
          // Attacking opponent unit
          dispatch({ type: 'DECLARE_ATTACK', attackerId: selectedCardId, targetId: id });
        }
        setSelectedCardId(null);
        return;
      }

      // Opponent Domain or Rune target
      const oppRune = opp.runes.find(c => c.instanceId === id);
      if (oppRune && selectedCardId) {
        dispatch({ type: 'PLAY_CARD', instanceId: selectedCardId, targetId: id });
        setSelectedCardId(null);
        return;
      }

      if (opp.domain?.instanceId === id && selectedCardId) {
        dispatch({ type: 'PLAY_CARD', instanceId: selectedCardId, targetId: id });
        setSelectedCardId(null);
        return;
      }
    }
  };

  // Direct attack to opponent
  const handleOpponentDirectAttack = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isMyTurn && state.phase === 'ACTION' && selectedCardId) {
      const selHand = me.hand.find(c => c.instanceId === selectedCardId);
      if (!selHand) {
        // Friendly unit attacking opponent player
        dispatch({ type: 'DECLARE_ATTACK', attackerId: selectedCardId });
        setSelectedCardId(null);
      }
    }
  };

  // Play unit to field on empty space click
  const handlePlayToField = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isMyTurn && state.phase === 'ACTION' && selectedCardId) {
      const selHand = me.hand.find(c => c.instanceId === selectedCardId);
      if (selHand) {
        const template = getCard(selHand.cardId);
        if (template.type !== 'Evolution') {
          dispatch({ type: 'PLAY_CARD', instanceId: selectedCardId });
          setSelectedCardId(null);
        }
      }
    }
  };

  // Charge Arcana Button Handler
  const handleArcanaChargeBtn = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isMyTurn || state.flags.hasPlacedArcanaThisTurn) return;

    if (state.phase === 'ARCANA_PLACEMENT') {
      if (selectedCardId && me.hand.some(c => c.instanceId === selectedCardId)) {
        dispatch({ type: 'PLACE_ARCANA', instanceId: selectedCardId });
        setSelectedCardId(null);
        setArcanaMode(false);
      } else {
        setArcanaMode(!arcanaMode);
      }
    }
  };

  const handlePrompt = (apply: boolean, targetId?: string) => {
    dispatch({ type: 'RESOLVE_TRIGGER', apply, targetId });
  };

  const handleGuardPrompt = (guarderId?: string) => {
    dispatch({ type: 'RESOLVE_GUARD', guarderId });
  };

  // Render a field unit in clean 62px x 88px size
  const renderUnitSlot = (p: PlayerState, u?: UnitState, slotIndex?: number) => {
    if (!u) {
      return (
        <div
          key={`empty-${slotIndex}`}
          onClick={p.id === 'player1' ? handlePlayToField : undefined}
          className="w-[62px] h-[88px] rounded-md border border-dashed border-white/10 bg-black/20 flex items-center justify-center shrink-0"
        >
          <span className="text-[10px] text-white/10 font-black">#{(slotIndex ?? 0) + 1}</span>
        </div>
      );
    }

    const isSelected = selectedCardId === u.instanceId;
    const isAttackerTargetable =
      isMyTurn &&
      selectedCardId &&
      !me.hand.some(c => c.instanceId === selectedCardId) &&
      p.id === 'player2';

    return (
      <div
        key={u.instanceId}
        className={`w-[62px] h-[88px] flex items-center justify-center relative shrink-0 ${
          isAttackerTargetable ? 'cursor-crosshair animate-pulse' : ''
        }`}
      >
        <CardView
          instance={u.cards[0]}
          size="field"
          computedStats={calculateUnitStats(state, p.id, u)}
          selected={isSelected}
          isRested={u.isRested}
          hasSummoningSickness={u.hasSummoningSickness}
          evoCount={u.cards.length}
          onClick={(e) => handleCardClick(u.instanceId, e)}
          onContextMenu={(e) => {
            e.preventDefault();
            onInspect(getCard(u.cards[0].cardId));
          }}
          onInspect={() => onInspect(getCard(u.cards[0].cardId))}
        />
      </div>
    );
  };

  // Selected card guidance text
  const getGuidanceText = () => {
    if (!isMyTurn) return '相手のターン中...';
    if (state.phase === 'ARCANA_PLACEMENT') {
      if (state.flags.hasPlacedArcanaThisTurn) return 'アルカナ配置済み。行動フェーズへ進んでください。';
      return arcanaMode ? '手札のカードを選択してアルカナに配置' : '手札を選んで「アルカナ配置」またはフェーズ進行';
    }
    if (selectedCardId) {
      const inHand = me.hand.find(c => c.instanceId === selectedCardId);
      if (inHand) {
        const t = getCard(inHand.cardId);
        if (t.type === 'Evolution') return `【${t.name}】を進化させる味方ユニットを選択`;
        return `【${t.name}】を召喚 / 発動（フィールドまたは対象をタップ）`;
      }
      const inField = me.field.find(c => c.instanceId === selectedCardId);
      if (inField) {
        const t = getCard(inField.cards[0].cardId);
        return `【${t.name}】で攻撃！相手ユニットまたは相手プレイヤーをタップ`;
      }
    }
    return '手札を選択してプレイ、または自軍ユニットを選択して攻撃';
  };

  return (
    <div
      className="relative w-full h-full text-slate-100 font-sans select-none overflow-hidden flex flex-col justify-between transition-colors duration-500"
      style={currentTheme.bgStyle}
      onClick={handleBoardClick}
    >
      {/* Decorative Center Arcana Glyph */}
      <div 
        className="absolute inset-0 pointer-events-none flex items-center justify-center opacity-30"
        style={{
          boxShadow: `inset 0 0 100px ${currentTheme.ambientGlow}`,
        }}
      >
        <div className="w-[380px] h-[380px] rounded-full border border-white/5 flex items-center justify-center">
          <div className="w-[280px] h-[280px] rounded-full border border-dashed border-white/10" />
        </div>
      </div>

      {/* ========================================================================= */}
      {/* TOP TIER: Opponent HUD & Hand (approx 16% height)                          */}
      {/* ========================================================================= */}
      <div className="relative h-[16%] w-full flex items-center justify-between px-3 z-30 border-b border-white/5 bg-black/40">
        {/* Left: Opponent Info & Barrier */}
        <div
          onClick={handleOpponentDirectAttack}
          className={`flex items-center space-x-2 px-2.5 py-1 rounded-lg border transition-all cursor-pointer ${
            selectedCardId && !me.hand.some(c => c.instanceId === selectedCardId)
              ? 'border-red-500 bg-red-950/50 shadow-lg shadow-red-500/20'
              : 'border-white/10 bg-slate-900/60'
          }`}
          title={selectedCardId ? '相手プレイヤーを直接攻撃！' : '相手プレイヤー'}
        >
          {/* Avatar / Crown */}
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-red-900 to-slate-950 border border-red-500/50 flex items-center justify-center shadow">
            <span className="text-xs font-black text-red-200">OPP</span>
          </div>

          <div className="flex flex-col">
            <div className="flex items-center space-x-2">
              <span className="text-[10px] font-black text-slate-300">OPPONENT</span>

              {/* Arcana Widget (Clickable to open Zone Viewer) */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setZoneModal({
                    isOpen: true,
                    title: '相手のアルカナゾーン',
                    zoneType: 'arcana',
                    cards: opp.arcana,
                    isOpponent: true,
                  });
                }}
                title="相手のアルカナ一覧を確認"
                className="flex items-center space-x-1 bg-black/60 hover:bg-slate-800 px-1.5 py-0.5 rounded text-[10px] border border-blue-500/40 hover:border-blue-400 transition-colors cursor-pointer shadow"
              >
                <span className="text-blue-400 font-bold">ARCANA</span>
                <span className="font-mono font-black text-white">{opp.currentArcana}/{opp.maxArcana}</span>
                <div className="flex space-x-0.5 ml-1">
                  {Array.from(new Set(opp.arcana.map(a => getCard(a.cardId).system))).map(sys => (
                    <SystemIcon key={sys as string} sys={sys as string} />
                  ))}
                </div>
              </button>

              {/* Archive / 墓地 Widget (Clickable to open Zone Viewer) */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setZoneModal({
                    isOpen: true,
                    title: '相手のアーカイブ（墓地）',
                    zoneType: 'archive',
                    cards: opp.archive,
                    isOpponent: true,
                  });
                }}
                title="相手のアーカイブを確認"
                className="flex items-center space-x-1 bg-black/60 hover:bg-slate-800 px-1.5 py-0.5 rounded text-[10px] border border-purple-500/40 hover:border-purple-400 text-purple-300 font-bold transition-colors cursor-pointer shadow"
              >
                <Archive size={11} />
                <span>墓地</span>
                <span className="font-mono font-black text-white">{opp.archive.length}</span>
              </button>
            </div>

            {/* Barrier Gems */}
            <div className="flex items-center space-x-1 mt-0.5">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center justify-center">
                  <Shield
                    size={13}
                    className={
                      i < opp.barrier
                        ? 'text-yellow-400 fill-yellow-400 drop-shadow-[0_0_4px_rgba(250,204,21,0.8)]'
                        : 'text-slate-700'
                    }
                  />
                </div>
              ))}
              <span className="text-[9px] font-bold text-yellow-500/80 ml-1">({opp.barrier}/5)</span>
            </div>
          </div>
        </div>

        {/* Center: Opponent Hand (docked strictly to top-0) */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 flex items-start justify-center -space-x-2 pt-0.5 pointer-events-none">
          {opp.hand.map(c => (
            <CardView key={c.instanceId} size="opponent-hand" isFaceDown />
          ))}
        </div>

        {/* Right: Opponent Runes and Domain */}
        <div className="flex items-center space-x-2">
          {/* Runes */}
          <div className="flex space-x-1 bg-black/40 p-1 rounded border border-white/5">
            <div className="text-[8px] font-bold text-slate-400 uppercase flex items-center pr-1">RUNE</div>
            {opp.runes[0] ? (
              <CardView isFaceDown size="compact" onClick={(e) => handleCardClick(opp.runes[0].instanceId, e)} />
            ) : (
              <div className="w-[50px] h-[36px] border border-dashed border-white/10 rounded flex items-center justify-center text-[8px] text-white/20">空</div>
            )}
            {opp.runes[1] ? (
              <CardView isFaceDown size="compact" onClick={(e) => handleCardClick(opp.runes[1].instanceId, e)} />
            ) : (
              <div className="w-[50px] h-[36px] border border-dashed border-white/10 rounded flex items-center justify-center text-[8px] text-white/20">空</div>
            )}
          </div>

          {/* Domain */}
          <div className="bg-black/40 p-1 rounded border border-white/5 flex items-center space-x-1">
            <span className="text-[8px] font-bold text-slate-400 uppercase">DOM</span>
            {opp.domain ? (
              <CardView
                instance={opp.domain}
                size="compact"
                onClick={(e) => handleCardClick(opp.domain!.instanceId, e)}
                onInspect={() => onInspect(getCard(opp.domain!.cardId))}
              />
            ) : (
              <div className="w-[50px] h-[36px] border border-dashed border-white/10 rounded flex items-center justify-center text-[8px] text-white/20">空</div>
            )}
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* CENTER BATTLE ZONE: 56% height (6 vs 6 Unit Slots)                        */}
      {/* ========================================================================= */}
      <div className="relative h-[56%] w-full flex flex-col justify-between py-1 px-4 z-20">
        {/* Opponent Field Row (6 slots) */}
        <div className="flex items-center justify-center space-x-2 sm:space-x-3 w-full h-[45%]">
          {Array.from({ length: 6 }).map((_, idx) => renderUnitSlot(opp, opp.field[idx], idx))}
        </div>

        {/* Center Battle Line & Guidance Banner */}
        <div className="flex items-center justify-center px-4 pointer-events-none">
          <div className="h-px flex-1 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
          <div className="mx-3 px-3 py-0.5 rounded-full bg-slate-900/80 border border-white/10 text-[10px] font-bold text-slate-300 shadow-sm flex items-center space-x-1.5">
            <Zap size={11} className={isMyTurn ? 'text-yellow-400' : 'text-slate-500'} />
            <span>{getGuidanceText()}</span>
          </div>
          <div className="h-px flex-1 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
        </div>

        {/* Player Field Row (6 slots) */}
        <div
          onClick={handlePlayToField}
          className="flex items-center justify-center space-x-2 sm:space-x-3 w-full h-[45%]"
        >
          {Array.from({ length: 6 }).map((_, idx) => renderUnitSlot(me, me.field[idx], idx))}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* BOTTOM TIER: Player HUD, Hand & Controls (approx 28% height)              */}
      {/* ========================================================================= */}
      <div className="relative h-[28%] w-full flex items-end justify-between px-3 pb-1.5 z-30 border-t border-white/5 bg-black/40">
        {/* Left Side: Player Barriers, Arcana, Runes & Domain */}
        <div className="flex flex-col justify-end space-y-1.5 shrink-0 z-20 pb-0.5">
          {/* Player Barriers & Arcana */}
          <div className="flex items-center space-x-2 bg-slate-900/80 px-2.5 py-1 rounded-lg border border-white/10 shadow">
            {/* Barrier Gems */}
            <div className="flex items-center space-x-1">
              {Array.from({ length: 5 }).map((_, i) => (
                <Shield
                  key={i}
                  size={14}
                  className={
                    i < me.barrier
                      ? 'text-yellow-400 fill-yellow-400 drop-shadow-[0_0_4px_rgba(250,204,21,0.8)]'
                      : 'text-slate-700'
                  }
                />
              ))}
              <span className="text-[10px] font-black text-yellow-400 ml-1">結界 {me.barrier}/5</span>
            </div>

            <div className="h-3.5 w-px bg-white/20" />

            {/* Arcana Widget (Clickable to open Zone Viewer) */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setZoneModal({
                  isOpen: true,
                  title: '自分のアルカナゾーン',
                  zoneType: 'arcana',
                  cards: me.arcana,
                  isOpponent: false,
                });
              }}
              title="自分のアルカナ一覧を確認"
              className="flex items-center space-x-1 bg-black/60 hover:bg-slate-800 px-2 py-0.5 rounded text-[10px] border border-blue-500/40 hover:border-blue-400 transition-colors cursor-pointer shadow"
            >
              <span className="text-[10px] font-bold text-blue-400">ARCANA</span>
              <span className="font-mono font-black text-sm text-white">
                {me.currentArcana}/{me.maxArcana}
              </span>
              <div className="flex space-x-0.5 ml-1">
                {Array.from(new Set(me.arcana.map(a => getCard(a.cardId).system))).map(sys => (
                  <SystemIcon key={sys as string} sys={sys as string} />
                ))}
              </div>
            </button>

            {/* Player Archive / 墓地 Widget (Clickable to open Zone Viewer) */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setZoneModal({
                  isOpen: true,
                  title: '自分のアーカイブ（墓地）',
                  zoneType: 'archive',
                  cards: me.archive,
                  isOpponent: false,
                });
              }}
              title="自分のアーカイブを確認"
              className="flex items-center space-x-1 bg-black/60 hover:bg-slate-800 px-1.5 py-0.5 rounded text-[10px] border border-purple-500/40 hover:border-purple-400 text-purple-300 font-bold transition-colors cursor-pointer shadow"
            >
              <Archive size={11} />
              <span>墓地</span>
              <span className="font-mono font-black text-white">{me.archive.length}</span>
            </button>
          </div>

          {/* Player Runes and Domain Slots */}
          <div className="flex space-x-2 items-center">
            {/* Runes */}
            <div className="flex space-x-1 bg-black/50 p-1 rounded border border-white/10">
              <span className="text-[8px] font-bold text-slate-400 uppercase flex items-center pr-0.5">RUNE</span>
              {me.runes[0] ? (
                <CardView
                  isFaceDown
                  size="compact"
                  onInspect={() => onInspect(getCard(me.runes[0].cardId))}
                />
              ) : (
                <div className="w-[50px] h-[34px] border border-dashed border-white/15 rounded flex items-center justify-center text-[8px] text-white/30">空</div>
              )}
              {me.runes[1] ? (
                <CardView
                  isFaceDown
                  size="compact"
                  onInspect={() => onInspect(getCard(me.runes[1].cardId))}
                />
              ) : (
                <div className="w-[50px] h-[34px] border border-dashed border-white/15 rounded flex items-center justify-center text-[8px] text-white/30">空</div>
              )}
            </div>

            {/* Domain */}
            <div className="bg-black/50 p-1 rounded border border-white/10 flex items-center space-x-1">
              <span className="text-[8px] font-bold text-slate-400 uppercase">DOM</span>
              {me.domain ? (
                <CardView
                  instance={me.domain}
                  size="compact"
                  onInspect={() => onInspect(getCard(me.domain!.cardId))}
                />
              ) : (
                <div className="w-[50px] h-[34px] border border-dashed border-white/15 rounded flex items-center justify-center text-[8px] text-white/30">空</div>
              )}
            </div>
          </div>
        </div>

        {/* Center: Player Hand Tray (strictly inside bottom tier, z-20) */}
        <div className="flex-1 h-full flex items-end justify-center px-1 overflow-visible">
          <HandTray
            hand={me.hand}
            state={state}
            dispatch={dispatch}
            selectedCard={selectedCardId}
            onSelect={(id) => handleCardClick(id, { stopPropagation: () => {} } as any)}
            onInspect={onInspect}
          />
        </div>

        {/* Right Side: Action Controls & Buttons */}
        <div className="flex flex-col items-end space-y-1.5 shrink-0 z-30 pb-0.5">
          {/* Top small action row: Turn Info, Playmat Customizer & Combat Log Toggle */}
          <div className="flex items-center space-x-1.5">
            <span className="text-[10px] font-black text-slate-400 bg-black/60 px-2 py-0.5 rounded border border-white/10">
              TURN {state.turnCount}
            </span>

            <button
              onClick={() => setShowPlaymatSelector(true)}
              title="プレイマット戦場カスタマイズ"
              className="px-2 py-1 bg-slate-900 hover:bg-slate-800 text-amber-300 hover:text-amber-200 rounded border border-amber-400/30 flex items-center space-x-1 text-[10px] font-bold shadow active:scale-95 transition-colors"
            >
              <Palette size={12} />
              <span>MAT</span>
            </button>

            <button
              onClick={() => setShowLog(!showLog)}
              title="対戦履歴ログ"
              className="px-2 py-1 bg-slate-900 hover:bg-slate-800 text-slate-300 rounded border border-white/15 flex items-center space-x-1 text-[10px] font-bold shadow active:scale-95"
            >
              <History size={12} />
              <span>LOG</span>
            </button>
          </div>

          {/* Action Buttons Row */}
          <div className="flex items-center space-x-2">
            {/* Arcana Placement Button */}
            {state.phase === 'ARCANA_PLACEMENT' && isMyTurn && !state.flags.hasPlacedArcanaThisTurn && (
              <button
                onClick={handleArcanaChargeBtn}
                className={`px-3 py-2 rounded-lg font-black text-xs transition-all shadow-lg active:scale-95 flex items-center space-x-1 ${
                  arcanaMode || (selectedCardId && me.hand.some(c => c.instanceId === selectedCardId))
                    ? 'bg-blue-500 text-white ring-2 ring-blue-300 animate-pulse'
                    : 'bg-blue-900/80 hover:bg-blue-800 text-blue-200 border border-blue-400/50'
                }`}
              >
                <Zap size={13} />
                <span>{selectedCardId ? 'アルカナチャージ' : 'アルカナ配置'}</span>
              </button>
            )}

            {/* Turn End / Next Phase Main Button */}
            <button
              onClick={() => {
                if (!isMyTurn || !!state.prompt) return;
                dispatch({ type: 'NEXT_PHASE' });
                setArcanaMode(false);
                setSelectedCardId(null);
              }}
              disabled={!isMyTurn || !!state.prompt}
              className={`px-4 sm:px-5 py-2.5 rounded-lg font-black tracking-wider text-xs sm:text-sm transition-all shadow-xl active:scale-95 flex items-center space-x-1.5 ${
                isMyTurn && !state.prompt
                  ? state.phase === 'ARCANA_PLACEMENT'
                    ? 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-blue-500/20'
                    : 'bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-500 text-slate-950 hover:brightness-110 shadow-amber-500/30 ring-2 ring-yellow-300'
                  : 'bg-slate-900/90 text-slate-400 border border-slate-700/80 cursor-wait'
              }`}
            >
              {!isMyTurn ? (
                <>
                  <Loader2 size={13} className="animate-spin text-amber-400" />
                  <span>相手の思考中...</span>
                </>
              ) : (
                <>
                  <span>{state.phase === 'ARCANA_PLACEMENT' ? '行動フェーズへ' : 'ターン終了'}</span>
                  <ChevronRight size={15} />
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* Combat Log Slide-in Drawer (Right)                                       */}
      {/* ========================================================================= */}
      {showLog && (
        <div className="absolute top-0 right-0 bottom-0 w-72 bg-slate-950/95 border-l border-white/10 z-50 flex flex-col shadow-2xl backdrop-blur-md animate-in slide-in-from-right duration-200">
          <div className="p-3 border-b border-white/10 flex justify-between items-center bg-black/40">
            <div className="flex items-center space-x-1.5 text-xs font-black text-amber-300">
              <History size={14} />
              <span>対戦ログ履歴</span>
            </div>
            <button
              onClick={() => setShowLog(false)}
              className="w-6 h-6 rounded-full bg-slate-800 hover:bg-slate-700 text-white flex items-center justify-center"
            >
              <X size={14} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-3 text-[11px] font-medium text-slate-300 space-y-1.5 flex flex-col-reverse">
            {[...state.log].reverse().map((msg, i) => (
              <div key={i} className="p-1.5 rounded bg-black/30 border border-white/5 leading-snug">
                {msg}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* Prompt / Interrupt Overlay                                               */}
      {/* ========================================================================= */}
      {state.prompt && (
        <div className="absolute inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-600 rounded-xl p-5 shadow-2xl max-w-sm w-full text-center">
            <h2 className="text-base font-black text-yellow-400 mb-2">
              {state.prompt.type === 'GUARD' ? '◆ 相手の直接攻撃 ◆' : '◆ 効果発動 ◆'}
            </h2>
            <p className="text-xs text-slate-300 mb-4 font-medium leading-relaxed">
              {state.prompt.message ||
                (state.prompt.type === 'GUARD' ? '守護ユニットで攻撃を防ぎますか？' : '効果を解決しますか？')}
            </p>

            {state.prompt.type === 'GUARD' && state.prompt.playerId === 'player1' && (
              <div className="flex flex-col space-y-2">
                <div className="flex flex-wrap justify-center gap-1.5">
                  {me.field
                    .filter(u => !u.isRested && getCard(u.cards[0].cardId).keywords?.includes('Guard'))
                    .map(u => (
                      <button
                        key={u.instanceId}
                        onClick={() => handleGuardPrompt(u.instanceId)}
                        className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-black py-1.5 px-3 rounded shadow"
                      >
                        【{getCard(u.cards[0].cardId).name}】で守護
                      </button>
                    ))}
                </div>
                <button
                  onClick={() => handleGuardPrompt()}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold py-1.5 px-3 rounded"
                >
                  守護しない (直接ダメージを許容)
                </button>
              </div>
            )}

            {/* Opponent Prompt Auto-handler / Skip for local sandbox */}
            {state.prompt.playerId === 'player2' && (
              <div className="flex justify-center space-x-3 mt-2">
                <button
                  onClick={() => {
                    if (state.prompt?.type === 'GUARD') handleGuardPrompt();
                    else handlePrompt(false);
                  }}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold py-1.5 px-4 rounded shadow"
                >
                  [P2] スキップ
                </button>
                {state.prompt.type !== 'GUARD' && (
                  <button
                    onClick={() => handlePrompt(true)}
                    className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold py-1.5 px-4 rounded shadow"
                  >
                    [P2] 発動する
                  </button>
                )}
                {state.prompt.type === 'GUARD' &&
                  opp.field.some(u => !u.isRested && getCard(u.cards[0].cardId).keywords?.includes('Guard')) && (
                    <button
                      onClick={() => {
                        const g = opp.field.find(
                          u => !u.isRested && getCard(u.cards[0].cardId).keywords?.includes('Guard')
                        );
                        handleGuardPrompt(g!.instanceId);
                      }}
                      className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold py-1.5 px-4 rounded shadow"
                    >
                      [P2] 守護
                    </button>
                  )}
              </div>
            )}

            {(state.prompt.type === 'TRIGGER' || state.prompt.type === 'RUNE_TRIGGER') &&
              state.prompt.playerId === 'player1' && (
                <div className="flex justify-center space-x-3">
                  <button
                    onClick={() => handlePrompt(true)}
                    className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold py-1.5 px-5 rounded shadow"
                  >
                    発動する
                  </button>
                  <button
                    onClick={() => handlePrompt(false)}
                    className="bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold py-1.5 px-5 rounded"
                  >
                    キャンセル
                  </button>
                </div>
              )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* Game Over Screen                                                         */}
      {/* ========================================================================= */}
      {state.winner && (
        <div className="absolute inset-0 bg-black/90 z-[100] flex flex-col items-center justify-center p-4">
          <h1 className="text-4xl sm:text-6xl font-black text-transparent bg-clip-text bg-gradient-to-b from-yellow-300 to-yellow-600 mb-6 drop-shadow-[0_0_30px_rgba(250,204,21,0.5)]">
            {state.winner === 'player1' ? 'VICTORY' : 'DEFEAT'}
          </h1>
          <button
            onClick={() => dispatch({ type: 'START_GAME' })}
            className="bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 font-black py-2.5 px-8 rounded-full shadow-xl text-sm"
          >
            もう一度プレイする
          </button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* Zone Viewer Modal (Arcana / Archive / Recovery Selection)                  */}
      {/* ========================================================================= */}
      <ZoneViewerModal
        isOpen={zoneModal.isOpen}
        onClose={() => setZoneModal(prev => ({ ...prev, isOpen: false, selectionMode: null }))}
        title={zoneModal.title}
        zoneType={zoneModal.zoneType}
        cards={zoneModal.cards}
        isOpponent={zoneModal.isOpponent}
        selectionMode={zoneModal.selectionMode}
        onInspect={onInspect}
      />

      {/* ========================================================================= */}
      {/* Playmat & Arena Customizer Modal                                          */}
      {/* ========================================================================= */}
      <PlaymatSelector
        isOpen={showPlaymatSelector}
        onClose={() => setShowPlaymatSelector(false)}
        currentTheme={playmatTheme}
        onSelectTheme={(themeId) => setPlaymatTheme(themeId)}
      />
    </div>
  );
};
