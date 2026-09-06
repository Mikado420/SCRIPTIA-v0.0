import React from 'react';
import { CardInstance, CardTemplate, System } from '../types';
import { getCard } from '../data/cards';
import { CardView } from './CardView';
import { X, Layers, Flame, Droplet, Mountain, Sun, Moon, Hexagon, Sparkles, Check } from 'lucide-react';

export interface ZoneSelectionConfig {
  promptText: string;
  canSelect: (card: CardTemplate) => boolean;
  onSelect: (instanceId: string) => void;
}

interface ZoneViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  zoneType: 'arcana' | 'archive';
  cards: CardInstance[];
  isOpponent?: boolean;
  selectionMode?: ZoneSelectionConfig | null;
  onInspectCard?: (card: CardTemplate) => void;
  onInspect?: (card: CardTemplate) => void;
}

const SystemBadge: React.FC<{ sys: System; count: number }> = ({ sys, count }) => {
  const getIcon = () => {
    switch (sys) {
      case 'Fire': return <Flame size={12} className="text-red-400" />;
      case 'Water': return <Droplet size={12} className="text-blue-400" />;
      case 'Earth': return <Mountain size={12} className="text-emerald-400" />;
      case 'Light': return <Sun size={12} className="text-amber-300" />;
      case 'Dark': return <Moon size={12} className="text-purple-400" />;
      default: return <Hexagon size={12} className="text-slate-400" />;
    }
  };

  const getBg = () => {
    switch (sys) {
      case 'Fire': return 'bg-red-950/60 border-red-500/40 text-red-200';
      case 'Water': return 'bg-blue-950/60 border-blue-500/40 text-blue-200';
      case 'Earth': return 'bg-emerald-950/60 border-emerald-500/40 text-emerald-200';
      case 'Light': return 'bg-amber-950/60 border-amber-500/40 text-amber-200';
      case 'Dark': return 'bg-purple-950/60 border-purple-500/40 text-purple-200';
      default: return 'bg-slate-800 border-slate-600 text-slate-200';
    }
  };

  return (
    <div className={`flex items-center space-x-1 px-2 py-0.5 rounded-full border text-[10px] font-bold ${getBg()}`}>
      {getIcon()}
      <span>{sys}</span>
      <span className="font-mono font-black ml-0.5 opacity-80">×{count}</span>
    </div>
  );
};

export const ZoneViewerModal: React.FC<ZoneViewerModalProps> = ({
  isOpen,
  onClose,
  title,
  zoneType,
  cards,
  isOpponent = false,
  selectionMode,
  onInspectCard,
  onInspect,
}) => {
  if (!isOpen) return null;

  const handleInspect = onInspectCard || onInspect || (() => {});

  // Elemental affinity breakdown for Arcana
  const affinityCounts: Record<string, number> = {};
  cards.forEach(c => {
    const sys = getCard(c.cardId).system;
    affinityCounts[sys] = (affinityCounts[sys] || 0) + 1;
  });

  // Type breakdown for Archive
  const typeCounts: Record<string, number> = {};
  cards.forEach(c => {
    const t = getCard(c.cardId).type;
    typeCounts[t] = (typeCounts[t] || 0) + 1;
  });

  return (
    <div 
      className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[90] flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div 
        className="bg-slate-950 border border-slate-700/80 rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-3.5 sm:p-4 border-b border-white/10 flex items-center justify-between bg-black/50">
          <div className="flex items-center space-x-2.5">
            <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${
              zoneType === 'arcana' 
                ? 'bg-blue-600/30 border border-blue-400 text-blue-300' 
                : 'bg-purple-600/30 border border-purple-400 text-purple-300'
            }`}>
              <Layers size={16} />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-sm sm:text-base font-black text-white tracking-wide">{title}</h3>
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-white/10 text-slate-300 font-mono">
                  {cards.length} 枚
                </span>
                {isOpponent && (
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-red-900/60 border border-red-500/40 text-red-300">
                    相手
                  </span>
                )}
              </div>
              <p className="text-[10px] text-slate-400">
                {zoneType === 'arcana' 
                  ? 'アルカナとして配置されているカードと解放されている属性系統一覧' 
                  : 'これまでに破壊・使用されたカードの集積所'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Selection prompt banner if in effect recovery mode */}
        {selectionMode && (
          <div className="bg-gradient-to-r from-amber-500/20 via-yellow-500/20 to-amber-500/20 border-b border-amber-400/40 px-4 py-2 flex items-center justify-between text-amber-200">
            <div className="flex items-center space-x-2 text-xs font-bold">
              <Sparkles size={14} className="text-yellow-400 animate-spin" />
              <span>{selectionMode.promptText}</span>
            </div>
            <span className="text-[10px] bg-amber-400/20 px-2 py-0.5 rounded border border-amber-400/40 font-bold">
              カードをタップして選択
            </span>
          </div>
        )}

        {/* Zone Summary Badges */}
        <div className="px-4 py-2 bg-slate-900/60 border-b border-white/5 flex flex-wrap items-center gap-1.5">
          {zoneType === 'arcana' ? (
            Object.entries(affinityCounts).map(([sys, count]) => (
              <SystemBadge key={sys} sys={sys as System} count={count} />
            ))
          ) : (
            Object.entries(typeCounts).map(([type, count]) => (
              <div 
                key={type} 
                className="flex items-center space-x-1 px-2 py-0.5 rounded-full bg-slate-800/80 border border-white/10 text-[10px] font-bold text-slate-300"
              >
                <span>{type}</span>
                <span className="font-mono font-black opacity-70">×{count}</span>
              </div>
            ))
          )}
        </div>

        {/* Card Grid Container */}
        <div className="flex-1 overflow-y-auto p-4 max-h-[60vh]">
          {cards.length === 0 ? (
            <div className="h-44 flex flex-col items-center justify-center text-slate-500 space-y-2">
              <Layers size={32} className="opacity-30" />
              <p className="text-xs font-medium">現在カードは存在しません</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3 justify-items-center">
              {cards.map((cardInstance) => {
                const template = getCard(cardInstance.cardId);
                const isSelectable = selectionMode ? selectionMode.canSelect(template) : false;

                return (
                  <div
                    key={cardInstance.instanceId}
                    className={`relative group flex flex-col items-center transition-all ${
                      isSelectable 
                        ? 'cursor-pointer transform hover:-translate-y-1' 
                        : selectionMode 
                          ? 'opacity-40 grayscale cursor-not-allowed' 
                          : 'cursor-pointer hover:scale-105'
                    }`}
                    onClick={() => {
                      if (selectionMode && isSelectable) {
                        selectionMode.onSelect(cardInstance.instanceId);
                        onClose();
                      } else {
                        handleInspect(template);
                      }
                    }}
                  >
                    <div className={`relative rounded-md ${
                      isSelectable ? 'ring-2 ring-yellow-400 shadow-lg shadow-yellow-500/30' : ''
                    }`}>
                      <CardView
                        instance={cardInstance}
                        size="hand"
                        onInspect={() => handleInspect(template)}
                      />
                      {isSelectable && (
                        <div className="absolute top-1 right-1 bg-yellow-400 text-slate-950 w-5 h-5 rounded-full flex items-center justify-center shadow font-black animate-pulse">
                          <Check size={12} />
                        </div>
                      )}
                    </div>
                    <span className="text-[9px] font-bold text-slate-300 mt-1 truncate max-w-[74px] text-center">
                      {template.name}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-white/10 bg-black/40 flex justify-between items-center text-[10px] text-slate-400">
          <span>右クリックまたは詳細アイコンで詳細ステータスを確認できます</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs transition-colors"
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
};
