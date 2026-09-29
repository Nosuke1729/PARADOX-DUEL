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
  { kind: 'weapon', id: 'spear', name: WEAPONS.spear.name, anyOf: [{ type: 'level', level: 3 }], hint: 'レベル3で使えます' },
  { kind: 'character', id: 'light', name: CHARACTERS.light.name, anyOf: [{ type: 'boss', id: 'light' }], hint: 'ステージ2のLIGHTに勝つ' },
  { kind: 'skill', id: 'shield', name: SKILLS.shield.name, anyOf: [{ type: 'level', level: 7 }], hint: 'レベル7で使えます' },
  { kind: 'attack', id: 'heavy_slash', name: ATTACKS.heavy_slash.name, anyOf: [{ type: 'level', level: 10 }, { type: 'mastery', character: 'standard', level: 3 }], hint: 'レベル10かSTANDARDの熟練度3' },
  { kind: 'weapon', id: 'blaster', name: WEAPONS.blaster.name, anyOf: [{ type: 'level', level: 12 }], hint: 'レベル12で使えます' },
  { kind: 'character', id: 'heavy', name: CHARACTERS.heavy.name, anyOf: [{ type: 'boss', id: 'heavy' }, { type: 'level', level: 15 }], hint: 'ステージ4のHEAVYに勝つか、レベル15' },
  { kind: 'skill', id: 'shockwave', name: SKILLS.shockwave.name, anyOf: [{ type: 'level', level: 18 }], hint: 'レベル18で使えます' },
  { kind: 'skill', id: 'echo_swap', name: SKILLS.echo_swap.name, anyOf: [{ type: 'chapter', chapter: 5 }], hint: 'ステージ5をクリア' },
  { kind: 'attack', id: 'upper_slash', name: ATTACKS.upper_slash.name, anyOf: [{ type: 'mastery', character: 'standard', level: 4 }], hint: 'STANDARDの熟練度4' },
  { kind: 'attack', id: 'spear_thrust', name: ATTACKS.spear_thrust.name, anyOf: [{ type: 'weapon', weapon: 'spear' }], hint: 'SPEARを使えるようになる' },
  { kind: 'attack', id: 'blaster_shot', name: ATTACKS.blaster_shot.name, anyOf: [{ type: 'weapon', weapon: 'blaster' }], hint: 'BLASTERを使えるようになる' },
  { kind: 'color', id: 'arc_cyan', name: 'ARC CYAN', anyOf: [{ type: 'mastery', character: 'standard', level: 2 }], hint: 'STANDARDの熟練度2' },
  { kind: 'weapon', id: 'dagger', name: WEAPONS.dagger.name, anyOf: [{ type: 'chapter', chapter: 6 }], hint: 'ステージ6をクリア' },
  { kind: 'weapon', id: 'hammer', name: WEAPONS.hammer.name, anyOf: [{ type: 'chapter', chapter: 7 }], hint: 'ステージ7をクリア' },
  { kind: 'attack', id: 'spear_sweep', name: ATTACKS.spear_sweep.name, anyOf: [{ type: 'chapter', chapter: 6 }], hint: 'ステージ6をクリア' },
  { kind: 'attack', id: 'charged_shot', name: ATTACKS.charged_shot.name, anyOf: [{ type: 'chapter', chapter: 7 }], hint: 'ステージ7をクリア' },
  { kind: 'attack', id: 'dagger_stab', name: ATTACKS.dagger_stab.name, anyOf: [{ type: 'weapon', weapon: 'dagger' }], hint: 'DAGGERを使えるようになる' },
  { kind: 'attack', id: 'dagger_lunge', name: ATTACKS.dagger_lunge.name, anyOf: [{ type: 'chapter', chapter: 8 }], hint: 'ステージ8をクリア' },
  { kind: 'attack', id: 'hammer_smash', name: ATTACKS.hammer_smash.name, anyOf: [{ type: 'weapon', weapon: 'hammer' }], hint: 'HAMMERを使えるようになる' },
  { kind: 'attack', id: 'hammer_upper', name: ATTACKS.hammer_upper.name, anyOf: [{ type: 'chapter', chapter: 8 }], hint: 'ステージ8をクリア' },
  { kind: 'color', id: 'mint', name: 'ミント', anyOf: [], hint: 'ショップで購入' },
  { kind: 'color', id: 'peach', name: 'もも', anyOf: [], hint: 'ショップで購入' },
  { kind: 'color', id: 'lemon', name: 'レモン', anyOf: [], hint: 'ショップで購入' },
  { kind: 'color', id: 'grape', name: 'ぶどう', anyOf: [], hint: 'カプセルから入手' },
  { kind: 'color', id: 'soda', name: 'ソーダ', anyOf: [], hint: 'カプセルから入手' },
  { kind: 'color', id: 'sunset', name: '夕焼け', anyOf: [], hint: 'カプセルから入手' },
  { kind: 'color', id: 'star', name: 'きらきら', anyOf: [], hint: 'カプセルから入手' },
]

export const STARTER_UNLOCKS = {
  character: ['standard'] as Character[], weapon: ['sword'] as Weapon[], skill: ['blink'] as Skill[],
  attack: ['basic_slash'] as AttackStyle[], color: ['default'] as string[],
}

export const COLORS: Record<string, { name: string; hex: number; description: string }> = {
  default: { name: 'SIGNAL CYAN', hex: 0x58e5e1, description: '標準のシアン。' },
  arc_cyan: { name: 'ARC CYAN', hex: 0x9cfaff, description: 'NORMAL Mastery Lv.2で解放される高輝度カラー。' },
  mint: { name: 'ミント', hex: 0x83efd0, description: 'ショップで買える、さわやかなミント色。' },
  peach: { name: 'もも', hex: 0xffb6a5, description: 'ショップで買える、やさしいピンク色。' },
  lemon: { name: 'レモン', hex: 0xfbe88a, description: 'ショップで買える、明るい黄色。' },
  grape: { name: 'ぶどう', hex: 0xbda7ff, description: 'カプセルから出る紫色。' },
  soda: { name: 'ソーダ', hex: 0x83c9ff, description: 'カプセルから出る青色。' },
  sunset: { name: '夕焼け', hex: 0xff9c82, description: 'カプセルから出るオレンジ色。' },
  star: { name: 'きらきら', hex: 0xffdd6f, description: 'カプセルから出る金色。' },
}

export function unlockRule(kind: UnlockKind, id: string): UnlockRule | undefined {
  return UNLOCK_RULES.find(rule => rule.kind === kind && rule.id === id)
}
