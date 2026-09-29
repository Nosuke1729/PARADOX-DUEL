import { ATTACKS, CHARACTERS, SKILLS, WEAPONS } from '../game/balance'
import type { AttackStyle, Character, Skill, Weapon } from '../game/types'

export type UnlockKind = 'character' | 'weapon' | 'skill' | 'attack' | 'color'
export type UnlockCondition =
  | { type: 'level'; level: number }
  | { type: 'chapter'; chapter: number }
  | { type: 'boss'; id: string }
  | { type: 'mastery'; character: Character; level: number }
  | { type: 'weapon'; weapon: Weapon }

export interface UnlockRule {
  kind: UnlockKind
  id: string
  name: string
  anyOf: UnlockCondition[]
  hint: string
}

// Conditions are ORed. Initial equipment is handled by STARTER_UNLOCKS.
export const UNLOCK_RULES: readonly UnlockRule[] = [
  { kind: 'weapon', id: 'spear', name: WEAPONS.spear.name, anyOf: [{ type: 'level', level: 3 }], hint: 'Reach Player Lv.3' },
  { kind: 'character', id: 'light', name: CHARACTERS.light.name, anyOf: [{ type: 'boss', id: 'light' }], hint: 'Defeat LIGHT in Chapter 2' },
  { kind: 'skill', id: 'shield', name: SKILLS.shield.name, anyOf: [{ type: 'level', level: 7 }], hint: 'Reach Player Lv.7' },
  { kind: 'attack', id: 'heavy_slash', name: ATTACKS.heavy_slash.name, anyOf: [{ type: 'level', level: 10 }, { type: 'mastery', character: 'standard', level: 3 }], hint: 'Reach Lv.10 or NORMAL Mastery Lv.3' },
  { kind: 'weapon', id: 'blaster', name: WEAPONS.blaster.name, anyOf: [{ type: 'level', level: 12 }], hint: 'Reach Player Lv.12' },
  { kind: 'character', id: 'heavy', name: CHARACTERS.heavy.name, anyOf: [{ type: 'boss', id: 'heavy' }, { type: 'level', level: 15 }], hint: 'Defeat HEAVY in Chapter 4 or reach Lv.15' },
  { kind: 'skill', id: 'shockwave', name: SKILLS.shockwave.name, anyOf: [{ type: 'level', level: 18 }], hint: 'Reach Player Lv.18' },
  { kind: 'skill', id: 'echo_swap', name: SKILLS.echo_swap.name, anyOf: [{ type: 'chapter', chapter: 5 }], hint: 'Clear Chapter 5' },
  { kind: 'attack', id: 'upper_slash', name: ATTACKS.upper_slash.name, anyOf: [{ type: 'mastery', character: 'standard', level: 4 }], hint: 'NORMAL Mastery Lv.4' },
  { kind: 'attack', id: 'spear_thrust', name: ATTACKS.spear_thrust.name, anyOf: [{ type: 'weapon', weapon: 'spear' }], hint: 'Unlock SPEAR' },
  { kind: 'attack', id: 'blaster_shot', name: ATTACKS.blaster_shot.name, anyOf: [{ type: 'weapon', weapon: 'blaster' }], hint: 'Unlock BLASTER' },
  { kind: 'color', id: 'arc_cyan', name: 'ARC CYAN', anyOf: [{ type: 'mastery', character: 'standard', level: 2 }], hint: 'NORMAL Mastery Lv.2' },
]

export const STARTER_UNLOCKS = {
  character: ['standard'] as Character[], weapon: ['sword'] as Weapon[], skill: ['blink'] as Skill[],
  attack: ['basic_slash'] as AttackStyle[], color: ['default'] as string[],
}

export const COLORS: Record<string, { name: string; hex: number; description: string }> = {
  default: { name: 'SIGNAL CYAN', hex: 0x58e5e1, description: '標準のシアン。' },
  arc_cyan: { name: 'ARC CYAN', hex: 0x9cfaff, description: 'NORMAL Mastery Lv.2で解放される高輝度カラー。' },
}

export function unlockRule(kind: UnlockKind, id: string): UnlockRule | undefined {
  return UNLOCK_RULES.find(rule => rule.kind === kind && rule.id === id)
}
