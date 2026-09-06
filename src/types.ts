export type System = 'Fire' | 'Water' | 'Earth' | 'Light' | 'Dark' | 'Neutral';
export type CardType = 'Unit' | 'Spell' | 'Rune' | 'Domain' | 'Evolution';
export type Lineage = 'Rampage' | 'Mechanoid' | 'Dragon' | 'Merfolk' | 'Aquatica' | 'Leviathan' | 'Bestia' | 'Insect' | 'Titan' | 'Guardian' | 'Oracle' | 'Angel' | 'Parasite' | 'Ghost' | 'Demon' | 'Neutral' | 'None';

export type Keyword = 'Guard' | 'Rush' | 'Lethal' | 'CannotAttackPlayer' | 'CannotBeGuarded';

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
  keywords?: Keyword[];
  effectText?: string;
  targetReq?: 'opponent_unit' | 'own_unit' | 'any_unit' | 'opponent_rune' | 'archive_spell_rune' | 'archive_dark' | 'opponent_domain';
}

export interface CardInstance {
  instanceId: string;
  cardId: string;
}

export interface UnitModifier {
  sourceId: string;
  atk: number;
  def: number;
  brk: number;
  duration: 'UNTIL_TURN_END' | 'UNTIL_NEXT_TURN_END' | 'PERMANENT';
  cannotUntapUntilNextOpponentTurnEnd?: boolean;
}

export interface UnitState {
  instanceId: string;
  cards: CardInstance[];
  isRested: boolean;
  hasSummoningSickness: boolean;
  modifiers: UnitModifier[];
}

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

export type Phase = 'TURN_START' | 'DRAW' | 'ARCANA_PLACEMENT' | 'ACTION' | 'END';

export interface PromptState {
  type: 'GUARD' | 'TRIGGER' | 'RUNE_TRIGGER';
  playerId: string;
  attackerId?: string;
  sourceId?: string;
  targetId?: string;
  message?: string;
  validTargets?: string[];
}

export interface GameState {
  player1: PlayerState;
  player2: PlayerState;
  currentPlayer: 'player1' | 'player2';
  turnCount: number;
  phase: Phase;
  log: string[];
  prompt: PromptState | null;
  winner: string | null;
  flags: {
    hasPlacedArcanaThisTurn: boolean;
    domain15Used: boolean;
  };
}

export type GameAction = 
  | { type: 'START_GAME' }
  | { type: 'NEXT_PHASE' }
  | { type: 'PLACE_ARCANA'; instanceId: string }
  | { type: 'PLAY_CARD'; instanceId: string; targetId?: string; evolutionTargetId?: string }
  | { type: 'DECLARE_ATTACK'; attackerId: string; targetId?: string } 
  | { type: 'RESOLVE_GUARD'; guarderId?: string }
  | { type: 'RESOLVE_TRIGGER'; apply: boolean; targetId?: string }
  ;
