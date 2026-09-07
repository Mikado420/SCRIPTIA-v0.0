export type System = 'Fire' | 'Water' | 'Earth' | 'Light' | 'Dark' | 'Neutral';
export type CardType = 'Unit' | 'Spell' | 'Rune' | 'Domain' | 'Evolution';
export type Lineage = 'Rampage' | 'Mechanoid' | 'Dragon' | 'Merfolk' | 'Aquatica' | 'Leviathan' | 'Bestia' | 'Insect' | 'Titan' | 'Guardian' | 'Oracle' | 'Angel' | 'Parasite' | 'Ghost' | 'Demon' | 'Neutral' | 'None';

export type Keyword = 'Guard' | 'Rush' | 'Lethal' | 'CannotAttackPlayer' | 'CannotBeGuarded' | 'CanAttackActive';

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
  // Compatibility fields for AI engine
  element?: System | string;
  cardType?: CardType | string;
  restrictions?: {
    cannotAttackPlayer?: boolean;
    cannotBeGuarded?: boolean;
    canAttackActive?: boolean;
  };
}

export type Card = CardTemplate;

export interface CardInstance {
  instanceId: string;
  cardId: string;
  element?: System | string;
  cost?: number;
  name?: string;
  card?: CardTemplate;
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
  card?: CardTemplate;
  currentAtk?: number;
  currentDef?: number;
  currentBrk?: number;
}

export interface BoardUnit extends UnitState {
  card: CardTemplate;
  currentAtk?: number;
  currentDef?: number;
  currentBrk?: number;
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
  pendingCard?: CardInstance | null;
}

export type Phase = 'TURN_START' | 'DRAW' | 'ARCANA_PLACEMENT' | 'ACTION' | 'END';

export interface PromptState {
  type: 'GUARD' | 'TRIGGER' | 'RUNE_TRIGGER' | 'TARGET_SELECTION';
  playerId: string;
  attackerId?: string;
  sourceId?: string;
  targetId?: string;
  message?: string;
  text?: string;
  validTargets?: string[];
  spellCardId?: string;
}

export interface GameState {
  player1: PlayerState;
  player2: PlayerState;
  player?: PlayerState;
  opponent?: PlayerState;
  turnPlayer?: 'player' | 'opponent' | 'player1' | 'player2';
  gameOver?: boolean;
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
  | { type: 'START_SPELL_CAST'; instanceId: string }
  | { type: 'CANCEL_SPELL_CAST' }
  | { type: 'RESOLVE_SPELL_TARGET'; targetId: string }
  | { type: 'DECLARE_ATTACK'; attackerId: string; targetId?: string } 
  | { type: 'RESOLVE_GUARD'; guarderId?: string }
  | { type: 'RESOLVE_TRIGGER'; apply: boolean; targetId?: string }
  | { type: 'RETRIEVE_FROM_ARCHIVE'; instanceId: string }
  ;
