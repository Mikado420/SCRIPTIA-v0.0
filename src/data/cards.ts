import { CardTemplate } from '../types';

const rawCards: CardTemplate[] = [
  // Fire
  { id: 'BR-01', name: '斬込隊長 レクス', cost: 2, system: 'Fire', type: 'Unit', lineage: 'Rampage', atk: 20, def: 20, brk: 1 },
  { id: 'BR-02', name: '紅蓮の拳 ダンク', cost: 2, system: 'Fire', type: 'Unit', lineage: 'Rampage', atk: 30, def: 10, brk: 1 },
  { id: 'BR-03', name: '即応兵 ゼルガン', cost: 2, system: 'Fire', type: 'Unit', lineage: 'Mechanoid', atk: 10, def: 10, brk: 1, effectText: 'On Barrier Broken: Summon from hand' },
  { id: 'BR-04', name: '紅蓮の戦士 ラグナ', cost: 3, system: 'Fire', type: 'Unit', lineage: 'Rampage', atk: 30, def: 30, brk: 1 },
  { id: 'BR-05', name: '烈火兵 タルカス', cost: 3, system: 'Fire', type: 'Unit', lineage: 'Mechanoid', atk: 20, def: 30, brk: 1, effectText: 'If another Fire unit on field: ATK+20' },
  { id: 'BR-06', name: '掃討兵 バルカン', cost: 4, system: 'Fire', type: 'Unit', lineage: 'Mechanoid', atk: 50, def: 30, brk: 1 },
  { id: 'BR-07', name: '韋駄天の キース', cost: 4, system: 'Fire', type: 'Unit', lineage: 'Rampage', atk: 20, def: 20, brk: 1, keywords: ['Rush'] },
  { id: 'BR-08', name: 'クリムゾン・ドラゴン', cost: 5, system: 'Fire', type: 'Unit', lineage: 'Dragon', atk: 30, def: 30, brk: 1, requiresTarget: 'opponent_unit', effectText: 'On Summon: Destroy opponent unit with DEF <= 40' },
  { id: 'BR-09', name: '孤高の狩人 クロウ', cost: 5, system: 'Fire', type: 'Unit', lineage: 'Rampage', atk: 50, def: 30, brk: 1, effectText: 'Can attack active opponent units' },
  { id: 'BR-10', name: 'ボルカノ・ドラゴン', cost: 6, system: 'Fire', type: 'Unit', lineage: 'Dragon', atk: 60, def: 60, brk: 2, effectText: 'ATK +10 per Fire unit in own Archive' },
  { id: 'BR-11', name: '超甲機神 グレンバーン', cost: 4, system: 'Fire', type: 'Evolution', lineage: 'Rampage', atk: 60, def: 60, brk: 2, evolutionTarget: 'Rampage', requiresTarget: 'own_unit', effectText: 'Other Rampage units get ATK+10' },
  { id: 'BR-12', name: 'フレイム・ダーツ', cost: 2, system: 'Fire', type: 'Spell', requiresTarget: 'opponent_unit', effectText: 'Destroy 1 opponent unit with DEF <= 20' },
  { id: 'BR-13', name: '熱狂の咆哮', cost: 3, system: 'Fire', type: 'Spell', effectText: 'All own units ATK+20 until end of turn' },
  { id: 'BR-14', name: 'インフェルノ・トラップ', cost: 4, system: 'Fire', type: 'Rune', effectText: 'On Barrier Broken: Destroy all opponent units with DEF <= 20' },
  { id: 'BR-15', name: '突撃前線', cost: 3, system: 'Fire', type: 'Domain', effectText: 'Once per turn: When breaking opponent barrier, draw 1 card' },

  // Water
  { id: 'BB-01', name: 'アクア・シールド', cost: 1, system: 'Water', type: 'Unit', lineage: 'Merfolk', atk: 20, def: 20, brk: 1, keywords: ['Guard', 'CannotAttackPlayer'] },
  { id: 'BB-02', name: 'アクア・スカウト', cost: 2, system: 'Water', type: 'Unit', lineage: 'Merfolk', atk: 20, def: 20, brk: 1 },
  { id: 'BB-03', name: 'ソードギル・シーカー', cost: 2, system: 'Water', type: 'Unit', lineage: 'Aquatica', atk: 10, def: 10, brk: 1, effectText: 'On Attack: Draw 1' },
  { id: 'BB-04', name: 'アクア・スカラー', cost: 3, system: 'Water', type: 'Unit', lineage: 'Merfolk', atk: 20, def: 20, brk: 1, effectText: 'On Summon: Draw 1' },
  { id: 'BB-05', name: 'アクア・ミラージュ', cost: 3, system: 'Water', type: 'Unit', lineage: 'Merfolk', atk: 20, def: 10, brk: 1, effectText: 'Replacement: Return to hand instead of destroyed' },
  { id: 'BB-06', name: 'ハードシェル・クラブ', cost: 4, system: 'Water', type: 'Unit', lineage: 'Aquatica', atk: 40, def: 40, brk: 1 },
  { id: 'BB-07', name: 'アクア・ランサー', cost: 4, system: 'Water', type: 'Unit', lineage: 'Merfolk', atk: 30, def: 30, brk: 1, keywords: ['Guard'] },
  { id: 'BB-08', name: 'キング・オルカ', cost: 5, system: 'Water', type: 'Unit', lineage: 'Leviathan', atk: 50, def: 50, brk: 1 },
  { id: 'BB-09', name: 'アクア・タイド', cost: 5, system: 'Water', type: 'Unit', lineage: 'Merfolk', atk: 30, def: 30, brk: 1, requiresTarget: 'opponent_unit', effectText: 'On Summon: Bounce 1 opponent unit to hand' },
  { id: 'BB-10', name: 'キング・タイダル', cost: 6, system: 'Water', type: 'Unit', lineage: 'Leviathan', atk: 50, def: 50, brk: 2, keywords: ['CannotBeGuarded'] },
  { id: 'BB-11', name: 'ルミナス・トライデント', cost: 6, system: 'Water', type: 'Evolution', lineage: 'Merfolk', atk: 60, def: 60, brk: 2, evolutionTarget: 'Merfolk', requiresTarget: 'own_unit', effectText: 'Return to hand instead of destroyed' },
  { id: 'BB-12', name: 'サージ・スパイラル', cost: 2, system: 'Water', type: 'Spell', requiresTarget: 'opponent_unit', effectText: 'Bounce 1 opponent unit with Cost <= 5' },
  { id: 'BB-13', name: '魔導の探求', cost: 3, system: 'Water', type: 'Spell', effectText: 'Draw 2 cards' },
  { id: 'BB-14', name: '反転の水鏡', cost: 4, system: 'Water', type: 'Rune', effectText: 'On Barrier Broken: Bounce 1 opponent unit to hand' },
  { id: 'BB-15', name: '知恵の回廊', cost: 3, system: 'Water', type: 'Domain', effectText: 'Once per turn: When opponent unit bounced, draw 1 card' },

  // Earth
  { id: 'BG-01', name: '翡翠の牙', cost: 2, system: 'Earth', type: 'Unit', lineage: 'Bestia', atk: 20, def: 20, brk: 1 },
  { id: 'BG-02', name: '黒鉄の棍棒', cost: 2, system: 'Earth', type: 'Unit', lineage: 'Bestia', atk: 30, def: 10, brk: 1 },
  { id: 'BG-03', name: 'ブロンズ・ビートル', cost: 3, system: 'Earth', type: 'Unit', lineage: 'Insect', atk: 30, def: 30, brk: 1 },
  { id: 'BG-04', name: '黄金の首飾り', cost: 3, system: 'Earth', type: 'Unit', lineage: 'Bestia', atk: 20, def: 20, brk: 1, effectText: 'On Summon: Put top deck to Arcana' },
  { id: 'BG-05', name: 'アシッド・マンティス', cost: 4, system: 'Earth', type: 'Unit', lineage: 'Insect', atk: 40, def: 40, brk: 1 },
  { id: 'BG-06', name: '巨岩の大盾', cost: 4, system: 'Earth', type: 'Unit', lineage: 'Bestia', atk: 10, def: 30, brk: 1, effectText: 'ATK +10 per own barrier' },
  { id: 'BG-07', name: 'グランド・ヘラクレス', cost: 5, system: 'Earth', type: 'Unit', lineage: 'Insect', atk: 60, def: 40, brk: 2 },
  { id: 'BG-08', name: 'シャドウ・スティンガー', cost: 5, system: 'Earth', type: 'Unit', lineage: 'Insect', atk: 50, def: 30, brk: 1, effectText: 'On Barrier Broken: Summon from hand' },
  { id: 'BG-09', name: '夜明けの巨人', cost: 6, system: 'Earth', type: 'Unit', lineage: 'Titan', atk: 80, def: 60, brk: 2, keywords: ['CannotAttackPlayer'] },
  { id: 'BG-10', name: '日没の巨人', cost: 7, system: 'Earth', type: 'Unit', lineage: 'Titan', atk: 60, def: 60, brk: 2, effectText: 'If own Arcana >= 9: ATK+20, DEF+20' },
  { id: 'BG-11', name: '万虫覇王 アトラスロード', cost: 6, system: 'Earth', type: 'Evolution', lineage: 'Insect', atk: 60, def: 60, brk: 2, evolutionTarget: 'Insect', requiresTarget: 'own_unit', effectText: 'Other Insect units BRK+1' },
  { id: 'BG-12', name: '大地の息吹', cost: 2, system: 'Earth', type: 'Spell', effectText: 'Put top deck to Arcana' },
  { id: 'BG-13', name: 'ガイア・バインド', cost: 3, system: 'Earth', type: 'Spell', requiresTarget: 'opponent_unit', effectText: 'Send opponent unit with DEF <= 60 to opponent Arcana' },
  { id: 'BG-14', name: '地縛の茨', cost: 4, system: 'Earth', type: 'Rune', effectText: 'On Barrier Broken: Send 1 opponent unit to opponent Arcana' },
  { id: 'BG-15', name: '獣王の狩場', cost: 3, system: 'Earth', type: 'Domain', effectText: 'Once per turn: When own unit destroys opponent unit by battle, draw 1 card' },

  // Light
  { id: 'BW-01', name: '蒼天の守護者 ア・ルクス', cost: 1, system: 'Light', type: 'Unit', lineage: 'Guardian', atk: 20, def: 20, brk: 1, keywords: ['Guard', 'CannotAttackPlayer'] },
  { id: 'BW-02', name: '白雲の守護者 ク・ラリス', cost: 2, system: 'Light', type: 'Unit', lineage: 'Guardian', atk: 20, def: 20, brk: 1 },
  { id: 'BW-03', name: '陽光の守護者 ガ・ルディス', cost: 2, system: 'Light', type: 'Unit', lineage: 'Guardian', atk: 30, def: 30, brk: 1, keywords: ['Guard', 'CannotAttackPlayer'] },
  { id: 'BW-04', name: '晴天の守護者 レ・パコス', cost: 3, system: 'Light', type: 'Unit', lineage: 'Guardian', atk: 30, def: 30, brk: 1 },
  { id: 'BW-05', name: '雷光の守護者 ザ・クエル', cost: 4, system: 'Light', type: 'Unit', lineage: 'Guardian', atk: 30, def: 30, brk: 1, requiresTarget: 'opponent_unit', effectText: 'On Summon: Rest 1 opponent unit' },
  { id: 'BW-06', name: '予言者 エルピス', cost: 4, system: 'Light', type: 'Unit', lineage: 'Oracle', atk: 30, def: 30, brk: 1, effectText: 'On Barrier Broken: Summon from hand' },
  { id: 'BW-07', name: '叡智の使徒 ソフィア', cost: 4, system: 'Light', type: 'Unit', lineage: 'Angel', atk: 30, def: 30, brk: 1, effectText: 'On Summon: Draw 1' },
  { id: 'BW-08', name: '予言者 アナスタシア', cost: 5, system: 'Light', type: 'Unit', lineage: 'Oracle', atk: 30, def: 40, brk: 1, effectText: 'On Summon: Can return 1 Spell/Rune from Archive to hand' },
  { id: 'BW-09', name: '光翼の使徒 ミカエル', cost: 6, system: 'Light', type: 'Unit', lineage: 'Angel', atk: 60, def: 60, brk: 2, effectText: 'At own turn end: Untap/Active this unit' },
  { id: 'BW-10', name: '聖壁の使徒 ウリエル', cost: 7, system: 'Light', type: 'Unit', lineage: 'Angel', atk: 70, def: 90, brk: 2 },
  { id: 'BW-11', name: '天聖護神 ソル・アイギス', cost: 5, system: 'Light', type: 'Evolution', lineage: 'Guardian', atk: 70, def: 70, brk: 2, evolutionTarget: 'Guardian', requiresTarget: 'own_unit', keywords: ['Guard'] },
  { id: 'BW-12', name: 'フラッシュ・バインド', cost: 1, system: 'Light', type: 'Spell', requiresTarget: 'opponent_unit', effectText: 'Rest 1 opponent unit' },
  { id: 'BW-13', name: '聖者の祈り', cost: 2, system: 'Light', type: 'Spell', effectText: 'Return 1 other Spell/Rune from Archive to hand' },
  { id: 'BW-14', name: '眩惑の聖壁', cost: 4, system: 'Light', type: 'Rune', effectText: 'On Barrier Broken: Rest 2 opponent units' },
  { id: 'BW-15', name: '加護の聖域', cost: 3, system: 'Light', type: 'Domain', effectText: 'Once per turn: When own unit performs Guard, draw 1 card' },

  // Dark
  { id: 'BD-01', name: 'ポイズン・ペスト', cost: 2, system: 'Dark', type: 'Unit', lineage: 'Parasite', atk: 20, def: 20, brk: 1 },
  { id: 'BD-02', name: '未練の霊 マリー', cost: 2, system: 'Dark', type: 'Unit', lineage: 'Ghost', atk: 20, def: 40, brk: 1, keywords: ['Guard', 'CannotAttackPlayer'], effectText: 'Destroyed after guarding' },
  { id: 'BD-03', name: 'デス・ペスト', cost: 3, system: 'Dark', type: 'Unit', lineage: 'Parasite', atk: 10, def: 10, brk: 1, keywords: ['Lethal'] },
  { id: 'BD-04', name: 'マインド・ペスト', cost: 3, system: 'Dark', type: 'Unit', lineage: 'Parasite', atk: 20, def: 20, brk: 1, effectText: 'On Attack: Opponent discards 1 random card' },
  { id: 'BD-05', name: 'パニック・ペスト', cost: 3, system: 'Dark', type: 'Unit', lineage: 'Parasite', atk: 30, def: 30, brk: 1, effectText: 'On Barrier Broken: Summon from hand' },
  { id: 'BD-06', name: '怨みの霊 ハイド', cost: 4, system: 'Dark', type: 'Unit', lineage: 'Ghost', atk: 30, def: 30, brk: 1, effectText: 'On Summon: Opponent discards 1 random card' },
  { id: 'BD-07', name: 'グレイブ・ペスト', cost: 4, system: 'Dark', type: 'Unit', lineage: 'Parasite', atk: 20, def: 40, brk: 1, effectText: 'If 5+ Dark units in Archive: ATK+30' },
  { id: 'BD-08', name: '絶望の霊 ダンテ', cost: 5, system: 'Dark', type: 'Unit', lineage: 'Ghost', atk: 50, def: 50, brk: 1 },
  { id: 'BD-09', name: '暗黒の悪魔 バールゼブル', cost: 6, system: 'Dark', type: 'Unit', lineage: 'Demon', atk: 70, def: 60, brk: 2 },
  { id: 'BD-10', name: '常闇の悪魔 バグラザード', cost: 7, system: 'Dark', type: 'Unit', lineage: 'Demon', atk: 60, def: 60, brk: 2, effectText: 'On Summon: Can return 2 Dark cards from Archive to hand' },
  { id: 'BD-11', name: '傀儡魔王 ネクロシア', cost: 6, system: 'Dark', type: 'Evolution', lineage: 'Parasite', atk: 70, def: 60, brk: 2, evolutionTarget: 'Parasite', requiresTarget: 'own_unit', effectText: 'On Summon: Destroy 1 opponent unit with DEF <= 80' },
  { id: 'BD-12', name: '悪夢の囁き', cost: 2, system: 'Dark', type: 'Spell', effectText: 'Opponent discards 1 random card' },
  { id: 'BD-13', name: '腐食の呪詛', cost: 3, system: 'Dark', type: 'Spell', requiresTarget: 'opponent_unit', effectText: 'Target opponent unit DEF-30 until turn end. If DEF <= 0, destroy' },
  { id: 'BD-14', name: 'デス・ジャッジメント', cost: 5, system: 'Dark', type: 'Rune', effectText: 'On Barrier Broken: Destroy 1 opponent unit' },
  { id: 'BD-15', name: '死霊の祭壇', cost: 3, system: 'Dark', type: 'Domain', effectText: 'Once per turn: When own unit destroyed, 1 opponent unit DEF-20 until next turn end' },

  // Neutral
  { id: 'BN-01', name: '古代の石像兵', cost: 2, system: 'Neutral', type: 'Unit', lineage: 'Neutral', atk: 20, def: 20, brk: 1, keywords: ['Guard', 'CannotAttackPlayer'] },
  { id: 'BN-02', name: 'ルーン・ゴーレム', cost: 4, system: 'Neutral', type: 'Unit', lineage: 'Neutral', atk: 40, def: 30, brk: 1 },
  { id: 'BN-03', name: 'ドメイン・ブレイク', cost: 3, system: 'Neutral', type: 'Spell', effectText: 'Destroy opponent Domain' },
  { id: 'BN-04', name: 'ルーン・ディスペル', cost: 2, system: 'Neutral', type: 'Spell', requiresTarget: 'opponent_rune', effectText: 'Return opponent set Rune to hand' },
  { id: 'BN-05', name: '停滞の刻印', cost: 2, system: 'Neutral', type: 'Rune', effectText: 'When opponent summons unit: Rest it and it cannot untap until opponent next turn end' },
];

export const CARDS: Record<string, CardTemplate> = rawCards.reduce((acc, card) => {
  acc[card.id] = card;
  return acc;
}, {} as Record<string, CardTemplate>);

export const getCard = (id: string): CardTemplate => CARDS[id];
