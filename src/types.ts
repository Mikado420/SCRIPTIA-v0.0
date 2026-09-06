export type System = 'Fire' | 'Water' | 'Earth' | 'Light' | 'Dark' | 'Neutral';
export type CardType = 'Unit' | 'Spell' | 'Rune' | 'Domain' | 'Evolution';
export type Lineage = 'Rampage' | 'Mechanoid' | 'Dragon' | 'Merfolk' | 'Aquatica' | 'Leviathan' | 'Bestia' | 'Insect' | 'Titan' | 'Guardian' | 'Oracle' | 'Angel' | 'Parasite' | 'Ghost' | 'Demon' | 'Neutral' | 'None';

export type TargetRequirement = 'opponent_unit' | 'own_unit' | 'any_unit' | 'archive_spell_rune' | 'opponent_rune';

export interface CardTemplate {
  id: string;
  name: string;
  cost: number;
  system: System;
  type: CardType;
  lineage?: Lineage;
  atk?: number;
  def?: number;
  brk?: number;
  evolutionTarget?: Lineage;
  keywords?: string[]; // 'Guard', 'Rush', 'Lethal', 'CannotAttackPlayer', 'CannotBeGuarded'
  effectText?: string;
  requiresTarget?: TargetRequirement;
}

export interface CardInstance {
  instanceId: string;
  cardId: string;
}

export interface UnitState {
  instanceId: string; 
  cards: CardInstance[]; // index 0 is top card
  isRested: boolean;
  hasSummoningSickness: boolean;
  modifiers: { atk: number; def: number; brk: number };
}

export type Phase = 'TURN_START' | 'DRAW' | 'ARCANA_PLACEMENT' | 'ACTION' | 'END';

export interface PlayerState {
  id: string;
  deck: CardInstance[];
  hand: CardInstance[];
  arcana: CardInstance[];
  maxArcana: number;
  currentArcana: number;
  barrier: number;
  field: UnitState[];
  runes: CardInstance[];
  domain: CardInstance | null;
  archive: CardInstance[];
}

export interface Prompt {
  type: 'GUARD' | 'SELECT_TARGET';
  playerId: string;
  attackerId?: string;
  sourceId?: string;
  validTargets?: string[];
}

export interface GameState {
  player1: PlayerState;
  player2: PlayerState;
  currentPlayer: 'player1' | 'player2';
  turnCount: number;
  phase: Phase;
  log: string[];
  prompt: Prompt | null;
  winner: string | null;
  hasPlacedArcanaThisTurn: boolean;
}

export type GameAction = 
  | { type: 'NEXT_PHASE' }
  | { type: 'PLACE_ARCANA'; instanceId: string }
  | { type: 'PLAY_CARD'; instanceId: string; targetId?: string }
  | { type: 'DECLARE_ATTACK'; attackerId: string; targetId?: string } 
  | { type: 'RESOLVE_GUARD'; guarderId?: string } 
  | { type: 'TRIGGER_RUNE'; runeInstanceId: string; targetId?: string }
  | { type: 'DEBUG_DRAW'; playerId: string }
  ;
