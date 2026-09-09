import { CardTemplate } from '../types';

/**
 * 日本語変換用ヘルパー関数
 * 実在する全16系譜の英語→日本語完全マッピング辞書など
 */
export const formatCardMetaJapanese = (card: CardTemplate | any): string => {
  // 属性
  const elementMap: Record<string, string> = {
    Fire: '火', Water: '水', Earth: '地', Light: '光', Dark: '闇', Neutral: '無',
    火: '火', 水: '水', 地: '地', 光: '光', 闇: '闇', 無: '無'
  };
  const elementKey = (card as any).element || card.system || '';
  const elementStr = `${elementMap[elementKey] || '無'}属性`;

  // カードタイプ
  const typeMap: Record<string, string> = {
    UNIT: 'ユニット',
    SPELL: 'スペル',
    RUNE: 'ルーン',
    DOMAIN: 'ドメイン',
    EVOLUTION: '進化ユニット',
    Unit: 'ユニット',
    Spell: 'スペル',
    Rune: 'ルーン',
    Domain: 'ドメイン',
    Evolution: '進化ユニット'
  };
  const rawType = (card as any).cardType || card.type;
  const typeStr = typeMap[rawType] || rawType;

  // 実在する全16系譜の英語→日本語完全マッピング辞書
  const lineageMap: Record<string, string> = {
    // 火系統
    Rampage: 'ランページ',
    Mechanoid: 'メカノイド',
    Dragon: 'ドラゴン',
    // 水系統
    Merfolk: 'マーフォーク',
    Aquatica: 'アクアティカ',
    Leviathan: 'リヴァイアサン',
    // 地系統
    Bestia: 'ベスティア',
    Insect: 'インセクト',
    Titan: 'タイタン',
    // 光系統
    Guardian: 'ガーディアン',
    Oracle: 'オラクル',
    Angel: 'エンジェル',
    // 闇系統
    Parasite: 'パラサイト',
    Ghost: 'ゴースト',
    Demon: 'デーモン',
    // 無系統
    Neutral: 'ニュートラル',
    None: ''
  };

  let lineageStr = '';
  const subtypes = (card as any).subtypes;
  if (subtypes && subtypes.length > 0) {
    lineageStr = subtypes.map((s: string) => lineageMap[s] || s).join('/');
  } else if (card.lineage && card.lineage !== 'None') {
    const key = String(card.lineage);
    lineageStr = lineageMap[key] || key;
  }

  // 表示フォーマット例: 「火属性 • ユニット • メカノイド」
  return [elementStr, typeStr, lineageStr].filter(Boolean).join(' • ');
};
