import type { AttackStyle, Character, Loadout, Skill, Slot, Weapon } from './types'

export interface CharacterConfig {
  name: string; subtitle: string; description: string; hp: number; moveSpeed: number
  airSpeed: number; jumpSpeed: number; dashSpeed: number; power: number; knockback: number
  ratings: string
}
export interface WeaponConfig {
  name: string; subtitle: string; description: string; startup: number; active: number
  total: number; damage: number; reach: number; height: number; projectileSpeed?: number
}
export interface SkillConfig { name: string; subtitle: string; description: string; cooldown: number }
export interface AttackConfig extends WeaponConfig { weapon: Weapon; verticalOffset?: number; knockback?: number }

export const CHARACTERS: Record<Character, CharacterConfig> = {
  standard: { name: 'STANDARD', subtitle: '均衡型', description: '速度・耐久・攻撃力のバランスがよい。どの武器やSkillとも組み合わせやすい。', hp: 100, moveSpeed: 330, airSpeed: 300, jumpSpeed: 700, dashSpeed: 820, power: 1, knockback: 1, ratings: 'HP ★★★ / SPEED ★★★ / POWER ★★★ / MOBILITY ★★★' },
  light: { name: 'LIGHT', subtitle: '高速型', description: '低HP・低威力の代わりに移動、ジャンプ、ダッシュが速い。Echoとの位置調整に強い。', hp: 78, moveSpeed: 395, airSpeed: 360, jumpSpeed: 780, dashSpeed: 930, power: 0.8, knockback: 1.2, ratings: 'HP ★★ / SPEED ★★★★★ / POWER ★★ / MOBILITY ★★★★★' },
  heavy: { name: 'HEAVY', subtitle: '重量型', description: '高HP・高威力。移動は遅いが、攻撃を受けても吹き飛びにくい。', hp: 130, moveSpeed: 285, airSpeed: 250, jumpSpeed: 650, dashSpeed: 700, power: 1.25, knockback: 0.7, ratings: 'HP ★★★★★ / SPEED ★★ / POWER ★★★★ / MOBILITY ★★' },
}
export const WEAPONS: Record<Weapon, WeaponConfig> = {
  sword: { name: 'SWORD', subtitle: '近距離', description: '発生が速く扱いやすい斬撃。射程は短い。', startup: 7, active: 6, total: 27, damage: 13, reach: 70, height: 44 },
  spear: { name: 'SPEAR', subtitle: '中距離', description: '長いリーチで間合いを支配する突き。発生はSwordより遅い。', startup: 12, active: 5, total: 37, damage: 15, reach: 124, height: 30 },
  blaster: { name: 'BLASTER', subtitle: '遠距離', description: '弾を発射して遠くから攻撃する。威力が低く、接近戦では発生の遅さが弱点。', startup: 15, active: 1, total: 41, damage: 8, reach: 0, height: 0, projectileSpeed: 610 },
}
export const SKILLS: Record<Skill, SkillConfig> = {
  blink: { name: 'BLINK', subtitle: '8秒', description: '向いている方向へ短距離瞬間移動。回避、接近、Echoとの位置合わせに使う。', cooldown: 480 },
  shield: { name: 'SHIELD', subtitle: '10秒', description: '約0.8秒間ダメージとノックバックを防ぐ。攻撃を読んで使う。', cooldown: 600 },
  shockwave: { name: 'SHOCKWAVE', subtitle: '12秒', description: '周囲の敵を吹き飛ばす衝撃波。ダメージより位置操作を重視する。', cooldown: 720 },
  echo_swap: { name: 'ECHO SWAP', subtitle: '10秒', description: '自分のEchoが出ている間だけ、本体とEchoの位置を入れ替える。', cooldown: 600 },
}
export const ATTACKS: Record<AttackStyle, AttackConfig> = {
  basic_slash: { ...WEAPONS.sword, weapon: 'sword', name: 'BASIC SLASH', subtitle: '標準', description: '素早く振るう標準の斬撃。' },
  heavy_slash: { ...WEAPONS.sword, weapon: 'sword', name: 'HEAVY SLASH', subtitle: '強撃', description: '発生と硬直は長いが、威力と吹き飛ばしが強い。', startup: 17, active: 5, total: 48, damage: 22, reach: 82, knockback: 1.45 },
  upper_slash: { ...WEAPONS.sword, weapon: 'sword', name: 'UPPER SLASH', subtitle: '対空', description: '頭上の敵を捉える縦方向の斬撃。', startup: 10, active: 6, total: 34, damage: 12, reach: 53, height: 88, verticalOffset: -27 },
  spear_thrust: { ...WEAPONS.spear, weapon: 'spear', name: 'SPEAR THRUST', subtitle: '標準', description: '長いリーチの突き。距離を保って戦う。' },
  blaster_shot: { ...WEAPONS.blaster, weapon: 'blaster', name: 'BLASTER SHOT', subtitle: '標準', description: '遠くまで飛ぶ低威力の弾を放つ。' },
}
export const DEFAULT_ATTACK: Record<Weapon, AttackStyle> = { sword: 'basic_slash', spear: 'spear_thrust', blaster: 'blaster_shot' }
export function attackFor(weapon: Weapon, attack?: AttackStyle): AttackConfig {
  return attack && ATTACKS[attack]?.weapon === weapon ? ATTACKS[attack] : ATTACKS[DEFAULT_ATTACK[weapon]]
}
export function isLoadout(value: unknown): value is Loadout {
  if (!value || typeof value !== 'object') return false
  const input = value as Record<string, unknown>
  return typeof input.character === 'string' && input.character in CHARACTERS &&
    typeof input.weapon === 'string' && input.weapon in WEAPONS &&
    typeof input.skill === 'string' && input.skill in SKILLS &&
    (input.attack === undefined || typeof input.attack === 'string' && input.attack in ATTACKS && ATTACKS[input.attack as AttackStyle].weapon === input.weapon)
}
export function damageFor(loadout: Loadout, practiceBot = false): number {
  const value = Math.round(attackFor(loadout.weapon, loadout.attack).damage * CHARACTERS[loadout.character].power)
  return practiceBot ? Math.max(1, Math.round(value * 0.5)) : value
}

export function winnerByHealth(hp: [number, number], loadouts: [Loadout, Loadout], maxHp?: [number, number]): Slot | undefined {
  const first = hp[0] / (maxHp?.[0] ?? CHARACTERS[loadouts[0].character].hp)
  const second = hp[1] / (maxHp?.[1] ?? CHARACTERS[loadouts[1].character].hp)
  return Math.abs(first - second) < 0.0001 ? undefined : first > second ? 1 : 2
}
