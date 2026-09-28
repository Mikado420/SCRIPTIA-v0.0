import React from 'react';
import { Flame, Droplet, Leaf, Sun, Moon, Hexagon } from 'lucide-react';
import { System } from '../../types';

export type ElementId = System;

export interface ElementMeta {
  id: ElementId;
  label: string;
  /** 属性の基調色（CSS color） */
  color: string;
  /** 明るい文字用 */
  light: string;
  /** カード内部の暗い下地 */
  deep: string;
  Icon: React.ComponentType<{ size?: number; className?: string; strokeWidth?: number }>;
}

export const ELEMENTS: Record<ElementId, ElementMeta> = {
  Fire: { id: 'Fire', label: '火', color: '#e5573f', light: '#ffb4a3', deep: '#2a0d0a', Icon: Flame },
  Water: { id: 'Water', label: '水', color: '#3f93ea', light: '#a9d2ff', deep: '#08182b', Icon: Droplet },
  Earth: { id: 'Earth', label: '地', color: '#43ad6d', light: '#a9e6bf', deep: '#0a1d12', Icon: Leaf },
  Light: { id: 'Light', label: '光', color: '#e8c350', light: '#fff0b8', deep: '#241c07', Icon: Sun },
  Dark: { id: 'Dark', label: '闇', color: '#a068e8', light: '#dcc3ff', deep: '#170b28', Icon: Moon },
  Neutral: { id: 'Neutral', label: '無', color: '#a2a8bb', light: '#e3e6ee', deep: '#15171f', Icon: Hexagon },
};

export const ELEMENT_ORDER: ElementId[] = ['Light', 'Water', 'Dark', 'Fire', 'Earth', 'Neutral'];

export const elementOf = (el: string | undefined): ElementMeta => {
  if (!el) return ELEMENTS.Neutral;
  const map: Record<string, ElementId> = {
    Fire: 'Fire', 火: 'Fire',
    Water: 'Water', 水: 'Water',
    Earth: 'Earth', 地: 'Earth', 自然: 'Earth',
    Light: 'Light', 光: 'Light',
    Dark: 'Dark', 闇: 'Dark',
  };
  return ELEMENTS[map[el] ?? 'Neutral'];
};

export const TYPE_LABEL: Record<string, string> = {
  Unit: 'ユニット',
  Spell: 'スペル',
  Rune: 'ルーン',
  Domain: 'ドメイン',
  Evolution: '進化',
};

export const LINEAGE_LABEL: Record<string, string> = {
  Rampage: 'ランページ', Mechanoid: 'メカノイド', Dragon: 'ドラゴン',
  Merfolk: 'マーフォーク', Aquatica: 'アクアティカ', Leviathan: 'リヴァイアサン',
  Bestia: 'ベスティア', Insect: 'インセクト', Titan: 'タイタン',
  Guardian: 'ガーディアン', Oracle: 'オラクル', Angel: 'エンジェル',
  Parasite: 'パラサイト', Ghost: 'ゴースト', Demon: 'デーモン',
  Neutral: 'ニュートラル', None: '',
};

/** キーワード能力の短い名前と説明（カード詳細・盤面アイコン用） */
export const KEYWORD_INFO: Record<string, { label: string; desc: string }> = {
  Guard: { label: '守護', desc: '相手の攻撃を代わりに受け止められる。' },
  Rush: { label: '速攻', desc: '召喚したターンから攻撃できる。' },
  Lethal: { label: '必殺', desc: '戦闘したユニットを破壊する。' },
  CannotAttackPlayer: { label: 'プレイヤー攻撃不可', desc: '相手プレイヤー（結界）を攻撃できない。' },
  CannotBeGuarded: { label: '守護無視', desc: 'この攻撃は守護されない。' },
  CanAttackActive: { label: 'アクティブ攻撃', desc: '起きている（アクティブの）ユニットも攻撃できる。' },
};

/**
 * 属性の魔法陣。カードに絵が無い代わりの「アート」として使う。
 * 二重円・古代文字の刻み・属性アイコンで構成し、発光はしない。
 */
export const ElementSigil: React.FC<{ element: string | undefined; size?: number; className?: string; iconScale?: number }> = ({
  element,
  size = 40,
  className = '',
  iconScale = 0.42,
}) => {
  const el = elementOf(element);
  const ticks = Array.from({ length: 12 });
  return (
    <div className={`relative shrink-0 ${className}`} style={{ width: size, height: size }} aria-hidden>
      <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full">
        <defs>
          <radialGradient id={`sg-${el.id}`} cx="50%" cy="45%" r="60%">
            <stop offset="0%" stopColor={el.color} stopOpacity="0.45" />
            <stop offset="70%" stopColor={el.color} stopOpacity="0.08" />
            <stop offset="100%" stopColor={el.color} stopOpacity="0" />
          </radialGradient>
        </defs>
        <circle cx="50" cy="50" r="48" fill={`url(#sg-${el.id})`} />
        <circle cx="50" cy="50" r="44" fill="none" stroke={el.color} strokeOpacity="0.75" strokeWidth="2" />
        <circle cx="50" cy="50" r="36" fill="none" stroke={el.light} strokeOpacity="0.35" strokeWidth="1" strokeDasharray="3 4" />
        {ticks.map((_, i) => {
          const a = (i / ticks.length) * Math.PI * 2;
          const x1 = 50 + Math.cos(a) * 40;
          const y1 = 50 + Math.sin(a) * 40;
          const x2 = 50 + Math.cos(a) * 44;
          const y2 = 50 + Math.sin(a) * 44;
          return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke={el.color} strokeOpacity="0.8" strokeWidth="2" />;
        })}
        <polygon
          points="50,18 77.7,66 22.3,66"
          fill="none"
          stroke={el.light}
          strokeOpacity="0.28"
          strokeWidth="1.2"
        />
        <polygon
          points="50,82 22.3,34 77.7,34"
          fill="none"
          stroke={el.light}
          strokeOpacity="0.28"
          strokeWidth="1.2"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center" style={{ color: el.light }}>
        <el.Icon size={Math.round(size * iconScale)} strokeWidth={2.2} />
      </div>
    </div>
  );
};

/** 属性の小さな丸印 */
export const ElementDot: React.FC<{ element: string | undefined; size?: number; active?: boolean; title?: string }> = ({
  element,
  size = 16,
  active = true,
  title,
}) => {
  const el = elementOf(element);
  return (
    <span
      title={title ?? `${el.label}属性`}
      className="inline-flex items-center justify-center rounded-full shrink-0 transition-opacity"
      style={{
        width: size,
        height: size,
        background: active ? `radial-gradient(circle at 35% 30%, ${el.light}, ${el.color} 55%, ${el.deep})` : 'rgba(22,26,41,0.9)',
        border: `1px solid ${active ? el.light : 'rgba(162,168,187,0.25)'}`,
        opacity: active ? 1 : 0.6,
        color: active ? el.deep : 'rgba(162,168,187,0.6)',
      }}
    >
      <el.Icon size={Math.round(size * 0.6)} strokeWidth={2.6} />
    </span>
  );
};
