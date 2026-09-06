import React from 'react';
import { X, Check, Palette, Sparkles, BookOpen, Flame, Droplet, Mountain, Sun, Moon } from 'lucide-react';

export type PlaymatThemeId = 'library' | 'volcano' | 'temple' | 'jungle' | 'cathedral' | 'underworld';

export interface PlaymatTheme {
  id: PlaymatThemeId;
  name: string;
  subtitle: string;
  system: string;
  icon: React.ReactNode;
  previewGradient: string;
  borderColor: string;
  ambientGlow: string;
  bgStyle: React.CSSProperties;
}

export const PLAYMAT_THEMES: PlaymatTheme[] = [
  {
    id: 'library',
    name: '魔導図書館',
    subtitle: '原初のアカシックレコードが眠る静謐の殿堂',
    system: '無・全系統 (デフォルト)',
    icon: <BookOpen size={16} className="text-cyan-400" />,
    previewGradient: 'from-slate-900 via-indigo-950 to-slate-950',
    borderColor: 'border-cyan-500/30',
    ambientGlow: 'rgba(6, 182, 212, 0.15)',
    bgStyle: {
      backgroundColor: '#030712',
      backgroundImage: `
        radial-gradient(ellipse at 50% 50%, rgba(30, 41, 59, 0.75) 0%, rgba(15, 23, 42, 0.92) 50%, rgba(2, 6, 23, 1) 100%),
        radial-gradient(circle at 50% 50%, transparent 40%, rgba(56, 189, 248, 0.05) 41%, transparent 42%),
        radial-gradient(circle at 50% 50%, transparent 65%, rgba(99, 102, 241, 0.04) 66%, transparent 67%)
      `,
    }
  },
  {
    id: 'volcano',
    name: '紅蓮の火山',
    subtitle: '灼熱のマグマと爆炎が渦巻く竜血の活火山',
    system: '火系統 (Rampage / Dragon)',
    icon: <Flame size={16} className="text-red-400" />,
    previewGradient: 'from-red-950 via-stone-900 to-amber-950',
    borderColor: 'border-red-500/40',
    ambientGlow: 'rgba(239, 68, 68, 0.2)',
    bgStyle: {
      backgroundColor: '#0c0a09',
      backgroundImage: `
        radial-gradient(ellipse at 50% 50%, rgba(127, 29, 29, 0.45) 0%, rgba(69, 10, 10, 0.75) 55%, rgba(12, 10, 9, 1) 100%),
        radial-gradient(circle at 50% 30%, rgba(249, 115, 22, 0.1) 0%, transparent 50%),
        radial-gradient(circle at 50% 50%, transparent 45%, rgba(239, 68, 68, 0.06) 46%, transparent 47%)
      `,
    }
  },
  {
    id: 'temple',
    name: '深海の神殿',
    subtitle: '青藍の深淵に沈む古のマーフォーク海底神殿',
    system: '水系統 (Merfolk / Leviathan)',
    icon: <Droplet size={16} className="text-blue-400" />,
    previewGradient: 'from-cyan-950 via-sky-950 to-blue-950',
    borderColor: 'border-blue-500/40',
    ambientGlow: 'rgba(59, 130, 246, 0.2)',
    bgStyle: {
      backgroundColor: '#020617',
      backgroundImage: `
        radial-gradient(ellipse at 50% 50%, rgba(14, 116, 144, 0.35) 0%, rgba(12, 74, 96, 0.65) 55%, rgba(2, 6, 23, 1) 100%),
        radial-gradient(circle at 50% 60%, rgba(6, 182, 212, 0.08) 0%, transparent 60%),
        radial-gradient(circle at 50% 50%, transparent 48%, rgba(59, 130, 246, 0.05) 49%, transparent 50%)
      `,
    }
  },
  {
    id: 'jungle',
    name: '原初の密林',
    subtitle: '巨樹と古代甲虫が息づく常緑の太古聖域',
    system: '地系統 (Bestia / Insect / Titan)',
    icon: <Mountain size={16} className="text-emerald-400" />,
    previewGradient: 'from-emerald-950 via-zinc-900 to-green-950',
    borderColor: 'border-emerald-500/40',
    ambientGlow: 'rgba(16, 185, 129, 0.2)',
    bgStyle: {
      backgroundColor: '#05140c',
      backgroundImage: `
        radial-gradient(ellipse at 50% 50%, rgba(20, 83, 45, 0.45) 0%, rgba(6, 78, 59, 0.7) 55%, rgba(4, 18, 12, 1) 100%),
        radial-gradient(circle at 30% 50%, rgba(34, 197, 94, 0.08) 0%, transparent 50%),
        radial-gradient(circle at 50% 50%, transparent 45%, rgba(16, 185, 129, 0.05) 46%, transparent 47%)
      `,
    }
  },
  {
    id: 'cathedral',
    name: '天空の大聖堂',
    subtitle: '黄金の光輪が照らす最高位熾天使の大聖堂',
    system: '光系統 (Guardian / Angel / Oracle)',
    icon: <Sun size={16} className="text-amber-300" />,
    previewGradient: 'from-amber-950 via-slate-900 to-yellow-950',
    borderColor: 'border-amber-400/50',
    ambientGlow: 'rgba(245, 158, 11, 0.2)',
    bgStyle: {
      backgroundColor: '#0c0a05',
      backgroundImage: `
        radial-gradient(ellipse at 50% 50%, rgba(217, 119, 6, 0.28) 0%, rgba(120, 53, 15, 0.5) 50%, rgba(12, 10, 6, 1) 100%),
        radial-gradient(circle at 50% 40%, rgba(251, 191, 36, 0.09) 0%, transparent 60%),
        radial-gradient(circle at 50% 50%, transparent 50%, rgba(245, 158, 11, 0.06) 51%, transparent 52%)
      `,
    }
  },
  {
    id: 'underworld',
    name: '常闇の冥府',
    subtitle: '紫紺の怨念と死霊が漂うネクロポリス深淵',
    system: '闇系統 (Parasite / Ghost / Demon)',
    icon: <Moon size={16} className="text-purple-400" />,
    previewGradient: 'from-purple-950 via-neutral-950 to-fuchsia-950',
    borderColor: 'border-purple-500/40',
    ambientGlow: 'rgba(168, 85, 247, 0.2)',
    bgStyle: {
      backgroundColor: '#08030e',
      backgroundImage: `
        radial-gradient(ellipse at 50% 50%, rgba(88, 28, 135, 0.45) 0%, rgba(59, 7, 100, 0.7) 55%, rgba(8, 3, 14, 1) 100%),
        radial-gradient(circle at 70% 50%, rgba(192, 132, 252, 0.08) 0%, transparent 50%),
        radial-gradient(circle at 50% 50%, transparent 46%, rgba(168, 85, 247, 0.06) 47%, transparent 48%)
      `,
    }
  },
];

interface PlaymatSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  currentTheme: PlaymatThemeId;
  onSelectTheme: (themeId: PlaymatThemeId) => void;
}

export const PlaymatSelector: React.FC<PlaymatSelectorProps> = ({
  isOpen,
  onClose,
  currentTheme,
  onSelectTheme,
}) => {
  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[95] flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div 
        className="bg-slate-950 border border-slate-700/80 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-3.5 sm:p-4 border-b border-white/10 flex items-center justify-between bg-black/50">
          <div className="flex items-center space-x-2.5">
            <div className="w-7 h-7 rounded-lg bg-amber-500/20 border border-amber-400 text-amber-300 flex items-center justify-center">
              <Palette size={16} />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-black text-white tracking-wide">
                プレイマット・戦場カスタマイズ
              </h3>
              <p className="text-[10px] text-slate-400">
                デュエルアリーナの背景スタイルを各系統テーマへ瞬時に変更できます
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

        {/* Theme List Grid */}
        <div className="flex-1 overflow-y-auto p-4 grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[60vh]">
          {PLAYMAT_THEMES.map((theme) => {
            const isSelected = currentTheme === theme.id;

            return (
              <div
                key={theme.id}
                onClick={() => {
                  onSelectTheme(theme.id);
                  try {
                    localStorage.setItem('scriptia_playmat', theme.id);
                  } catch (e) {
                    // ignore localStorage errors
                  }
                }}
                className={`p-3.5 rounded-xl border-2 transition-all cursor-pointer relative flex flex-col justify-between select-none ${
                  isSelected
                    ? 'border-yellow-400 bg-slate-900/90 shadow-xl shadow-yellow-500/20 ring-1 ring-yellow-400/50'
                    : 'border-white/10 bg-black/40 hover:border-white/30 hover:bg-slate-900/50'
                }`}
              >
                {/* Visual Thumbnail */}
                <div 
                  className={`h-16 w-full rounded-lg mb-2.5 relative overflow-hidden border border-white/15 bg-gradient-to-br ${theme.previewGradient} flex items-center justify-center`}
                  style={theme.bgStyle}
                >
                  <div className="w-8 h-8 rounded-full border border-white/20 flex items-center justify-center bg-black/30 backdrop-blur-xs">
                    {theme.icon}
                  </div>
                  {isSelected && (
                    <div className="absolute top-1.5 right-1.5 bg-yellow-400 text-slate-950 px-1.5 py-0.5 rounded-full text-[9px] font-black flex items-center space-x-0.5 shadow">
                      <Check size={10} />
                      <span>適用中</span>
                    </div>
                  )}
                </div>

                {/* Information */}
                <div>
                  <div className="flex items-center justify-between mb-0.5">
                    <div className="flex items-center space-x-1.5">
                      <span className="text-xs sm:text-sm font-black text-white">{theme.name}</span>
                    </div>
                    <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-slate-300">
                      {theme.system}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400 leading-tight">
                    {theme.subtitle}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-white/10 bg-black/40 flex justify-between items-center text-[10px] text-slate-400">
          <div className="flex items-center space-x-1 text-amber-300">
            <Sparkles size={12} />
            <span>選択したプレイマットはブラウザに自動保存されます</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-yellow-500 hover:bg-yellow-400 text-slate-950 font-black text-xs transition-colors"
          >
            完了
          </button>
        </div>
      </div>
    </div>
  );
};
