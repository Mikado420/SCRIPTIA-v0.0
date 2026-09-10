import React from 'react';
import { CardTemplate } from '../types';
import { X, Shield, Swords, Flame, Droplet, Mountain, Sun, Moon, Hexagon, Zap, Sparkles } from 'lucide-react';

interface Props {
  card: CardTemplate;
  onClose: () => void;
}

const typeMap: Record<string, string> = {
  Unit: 'ユニット',
  Spell: 'スペル',
  Rune: 'ルーン',
  Domain: 'ドメイン',
  Evolution: '進化ユニット',
};

const systemNameMap: Record<string, string> = {
  Fire: '火',
  Water: '水',
  Earth: '地',
  Light: '光',
  Dark: '闇',
  Neutral: '無',
};

const lineageMap: Record<string, string> = {
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
  Neutral: 'ニュートラル',
  None: '',
};

const keywordMap: Record<string, { label: string; color: string; desc: string }> = {
  Guard: { label: '守護', color: 'bg-blue-600/80 border-blue-400 text-blue-100', desc: '身代わりとなって味方や結界への攻撃を防ぐ' },
  Rush: { label: '速攻', color: 'bg-red-600/80 border-red-400 text-red-100', desc: '召喚されたターンに召喚酔いなく攻撃できる' },
  Lethal: { label: '必殺', color: 'bg-purple-600/80 border-purple-400 text-purple-100', desc: 'バトルした相手ユニットをパワーに関わらず破壊する' },
  Evolution: { label: '進化', color: 'bg-amber-600/80 border-amber-400 text-amber-100', desc: '指定の系譜ユニットに重ねて即座に攻撃可能' },
  CannotAttackPlayer: { label: '対者攻撃不可', color: 'bg-slate-700 border-slate-500 text-slate-300', desc: '相手プレイヤー（結界）を攻撃できない' },
};

export const CardDetailModal: React.FC<Props> = ({ card, onClose }) => {
  const isUnit = card.type === 'Unit' || card.type === 'Evolution';

  const systemIcon = () => {
    switch (card.system) {
      case 'Fire': return <Flame size={16} className="text-red-400" />;
      case 'Water': return <Droplet size={16} className="text-blue-400" />;
      case 'Earth': return <Mountain size={16} className="text-emerald-400" />;
      case 'Light': return <Sun size={16} className="text-amber-300" />;
      case 'Dark': return <Moon size={16} className="text-purple-400" />;
      default: return <Hexagon size={16} className="text-slate-400" />;
    }
  };

  const sysColor = {
    Fire: 'border-red-500/80 bg-[#160a0a] shadow-[0_0_30px_rgba(239,68,68,0.3)]',
    Water: 'border-cyan-500/80 bg-[#071322] shadow-[0_0_30px_rgba(6,182,212,0.3)]',
    Earth: 'border-emerald-500/80 bg-[#0a180f] shadow-[0_0_30px_rgba(16,185,129,0.3)]',
    Light: 'border-amber-400/80 bg-[#1c1808] shadow-[0_0_30px_rgba(251,191,36,0.3)]',
    Dark: 'border-purple-500/80 bg-[#14081c] shadow-[0_0_30px_rgba(168,85,247,0.3)]',
    Neutral: 'border-slate-500/80 bg-[#0f172a] shadow-[0_0_30px_rgba(148,163,184,0.2)]',
  }[card.system];

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-md p-4 pointer-events-auto"
      onClick={onClose}
    >
      <div
        className={`w-full max-w-sm rounded-2xl border-2 p-4 flex flex-col relative overflow-hidden max-h-[92vh] text-white ${sysColor}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/70 hover:bg-black text-white/80 hover:text-white flex items-center justify-center z-20 border border-white/20 transition-transform active:scale-95"
          aria-label="閉じる"
        >
          <X size={18} />
        </button>

        {/* Header: コスト + カード名 + 属性/タイプ */}
        <div className="flex items-center space-x-3 mb-3 pr-8">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-400 via-amber-600 to-amber-800 border-2 border-amber-200 flex flex-col items-center justify-center font-black text-white shadow-lg shrink-0">
            <span className="text-[9px] text-amber-200 uppercase leading-none font-bold">コスト</span>
            <span className="text-base leading-none drop-shadow">{card.cost}</span>
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-black text-white truncate tracking-wide drop-shadow">{card.name}</h2>
            <div className="flex items-center flex-wrap gap-1.5 text-xs text-amber-300 font-bold mt-1">
              <span className="inline-flex items-center gap-1 bg-black/50 px-2 py-0.5 rounded border border-white/10">
                {systemIcon()}
                <span>{systemNameMap[card.system] || card.system}</span>
              </span>
              <span className="bg-black/50 px-2 py-0.5 rounded border border-white/10 text-cyan-200">
                {typeMap[card.type] || card.type}
              </span>
              {card.lineage && card.lineage !== 'None' && (
                <span className="bg-black/50 px-2 py-0.5 rounded border border-white/10 text-slate-300">
                  {lineageMap[card.lineage] || card.lineage}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* カードビジュアル */}
        <div className="w-full h-32 rounded-xl bg-gradient-to-b from-black/40 via-black/70 to-black/90 border border-white/10 flex items-center justify-center relative overflow-hidden mb-3">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.08)_0%,transparent_70%)]" />
          <div className="flex flex-col items-center justify-center z-10">
            <div className="w-14 h-14 rounded-2xl border border-white/30 flex items-center justify-center bg-black/50 backdrop-blur-sm shadow-inner">
              {systemIcon()}
            </div>
            <span className="text-[11px] text-amber-300/80 font-bold tracking-wider mt-1.5">
              {systemNameMap[card.system] || card.system}属性
            </span>
            <span className="text-[10px] text-slate-400 font-mono tracking-widest">{card.id}</span>
          </div>
        </div>

        {/* 能力キーワードバッジ */}
        {card.keywords && card.keywords.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-2.5">
            {card.keywords.map((kw) => {
              const info = keywordMap[kw] || { label: kw, color: 'bg-slate-700 border-slate-500 text-slate-200', desc: '' };
              return (
                <div
                  key={kw}
                  className={`px-2 py-0.5 rounded border text-[11px] font-black flex items-center gap-1 shadow-sm ${info.color}`}
                  title={info.desc}
                >
                  <Sparkles size={11} />
                  <span>{info.label}</span>
                </div>
              );
            })}
            {card.type === 'Evolution' && card.evolutionTarget && (
              <div className="px-2 py-0.5 rounded border text-[11px] font-black flex items-center gap-1 bg-amber-900/60 border-amber-500 text-amber-200">
                <Zap size={11} />
                <span>進化元: {lineageMap[card.evolutionTarget] || card.evolutionTarget}</span>
              </div>
            )}
          </div>
        )}

        {/* 効果説明テキスト */}
        <div className="flex-1 overflow-y-auto bg-black/60 border border-white/10 rounded-xl p-3 mb-3 text-xs leading-relaxed text-slate-200 custom-scrollbar">
          <div className="text-[10px] font-bold text-slate-400 mb-1 tracking-wider uppercase">効果テキスト</div>
          {card.effectText ? (
            <div className="whitespace-pre-wrap font-medium">
              {card.effectText}
            </div>
          ) : (
            <div className="text-slate-400 italic text-center py-3">（通常ユニット / 特殊効果なし）</div>
          )}
        </div>

        {/* 戦闘ステータス：攻撃力・ブレイク・防御値 */}
        {isUnit && (
          <div className="flex justify-around items-center bg-black/90 border border-white/15 rounded-xl py-2 px-3 shadow-inner">
            <div className="flex items-center space-x-2">
              <Swords size={18} className="text-red-400" />
              <div className="flex flex-col">
                <span className="text-[9px] text-slate-400 font-bold leading-none">攻撃力</span>
                <span className="text-base font-black text-red-400 leading-none">{card.atk ?? 0}</span>
              </div>
            </div>

            <div className="h-6 w-px bg-white/20" />

            <div className="flex items-center space-x-2">
              <Shield size={18} className="text-amber-400" />
              <div className="flex flex-col">
                <span className="text-[9px] text-slate-400 font-bold leading-none">ブレイク</span>
                <span className="text-base font-black text-amber-400 leading-none">{card.brk ?? 1}</span>
              </div>
            </div>

            <div className="h-6 w-px bg-white/20" />

            <div className="flex items-center space-x-2">
              <Shield size={18} className="text-cyan-400" />
              <div className="flex flex-col">
                <span className="text-[9px] text-slate-400 font-bold leading-none">防御値</span>
                <span className="text-base font-black text-cyan-400 leading-none">{card.def ?? 0}</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

