import React from 'react';
import { Check, Palette, BookOpen, Flame, Droplet, Mountain, Sun, Moon } from 'lucide-react';
import { Modal } from './ui/Modal';

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
  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      fixed
      zIndex={95}
      width={560}
      eyebrow="Playmat"
      title="プレイマット"
      icon={<Palette size={18} />}
      footer={
        <button type="button" onClick={onClose} className="sc-btn sc-btn--primary">
          完了
        </button>
      }
    >
      <div className="grid grid-cols-2 gap-2.5">
        {PLAYMAT_THEMES.map(theme => {
          const isSelected = currentTheme === theme.id;
          return (
            <button
              type="button"
              key={theme.id}
              aria-pressed={isSelected}
              onClick={() => {
                onSelectTheme(theme.id);
                try {
                  localStorage.setItem('scriptia_playmat', theme.id);
                } catch {
                  // ignore localStorage errors
                }
              }}
              className="text-left rounded-xl p-2 transition-all active:scale-[0.98]"
              style={{
                border: `1px solid ${isSelected ? '#e6c77f' : 'rgba(210,171,95,0.2)'}`,
                background: isSelected ? 'rgba(58,50,34,0.55)' : 'rgba(6,7,13,0.5)',
                boxShadow: isSelected ? '0 0 14px rgba(230,199,127,0.3)' : undefined,
              }}
            >
              <div className="h-14 w-full rounded-lg mb-2 relative overflow-hidden flex items-center justify-center" style={{ ...theme.bgStyle, border: '1px solid rgba(255,255,255,0.08)' }}>
                <div className="w-8 h-8 rounded-full flex items-center justify-center bg-black/40">{theme.icon}</div>
                {isSelected && (
                  <span className="absolute top-1.5 right-1.5 px-1.5 h-[18px] rounded-full text-[10px] font-bold flex items-center gap-0.5" style={{ background: '#e6c77f', color: '#221806' }}>
                    <Check size={10} /> 使用中
                  </span>
                )}
              </div>
              <div className="text-[13px] font-bold text-parch-50">{theme.name}</div>
              <div className="text-[10.5px] text-parch-500 leading-snug mt-0.5 line-clamp-2">{theme.subtitle}</div>
            </button>
          );
        })}
      </div>
    </Modal>
  );
};
