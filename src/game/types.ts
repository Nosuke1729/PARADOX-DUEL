export type Slot = 1 | 2
export type Phase = 'menu' | 'lobby' | 'countdown' | 'playing' | 'round_end' | 'match_end'
export type Character = 'standard' | 'light' | 'heavy'
export type Weapon = 'sword' | 'spear' | 'blaster' | 'dagger' | 'hammer'
export type Skill = 'blink' | 'shield' | 'shockwave' | 'echo_swap'
export type AttackStyle = 'basic_slash' | 'heavy_slash' | 'upper_slash' | 'spear_thrust' | 'spear_sweep' | 'blaster_shot' | 'charged_shot' | 'dagger_stab' | 'dagger_lunge' | 'hammer_smash' | 'hammer_upper'

export interface Loadout { character: Character; weapon: Weapon; skill: Skill; attack?: AttackStyle; color?: string }
export const DEFAULT_LOADOUT: Loadout = { character: 'standard', weapon: 'sword', skill: 'blink', attack: 'basic_slash' }
export const BOT_LOADOUT: Loadout = { character: 'heavy', weapon: 'spear', skill: 'shield', attack: 'spear_thrust' }

export interface Controls {
  left: boolean; right: boolean; down: boolean; jump: boolean
  attack: boolean; dash: boolean; echo: boolean; skill: boolean
}
export const EMPTY_CONTROLS: Controls = {
  left: false, right: false, down: false, jump: false,
  attack: false, dash: false, echo: false, skill: false,
}
export interface Frame {
  x: number; y: number; vx: number; vy: number; facing: -1 | 1
  attackFrame: number; attackId: number; dash: boolean
}
export interface FighterState extends Frame {
  hp: number; hurtCooldown: number; echoCooldown: number; dashCooldown: number
  skillCooldown: number; shieldFrames: number; grounded: boolean
}
export interface ProjectileState {
  id: string; owner: Slot; x: number; y: number; vx: number; ttl: number
}
export interface Snapshot {
  matchId: string; round: number; tick: number; phase: Phase; timer: number; phaseFrames: number
  wins: [number, number]; fighters: [FighterState, FighterState]; projectiles: ProjectileState[]; ack: number
}
export interface EchoPacket {
  matchId: string; round: number; owner: Slot; echoId: number; startTick: number; frames: Frame[]
}
export type MatchEvent =
  | { kind: 'echo'; echo: EchoPacket }
  | { kind: 'hit'; matchId: string; round: number; id: string; target: Slot; hp: number; knockbackX: number; knockbackY: number; blocked?: boolean }
  | { kind: 'skill'; matchId: string; round: number; slot: Slot; skill: Skill; x: number; y: number; echoId?: number; echoX?: number; echoY?: number }
  | { kind: 'phase'; matchId: string; round: number; phase: Phase; timer: number; wins: [number, number]; winner?: Slot }
  | { kind: 'rematch'; matchId: string; slot: Slot }
export const WORLD = { width: 960, height: 540, floorY: 474, platformX: 360, platformY: 324, platformWidth: 240, gravity: 1100 } as const
export const RULES = {
  echoFrames: 240, echoCooldown: 600, dashFrames: 9, dashCooldown: 80,
  roundFrames: 4500, countdownFrames: 180,
} as const
