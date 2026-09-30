import { RULES, type AttackStyle, type Character, type Loadout, type Skill, type Slot, type Weapon } from './types'
import { HATS } from './cosmetics'

export interface CharacterConfig {
  name: string; subtitle: string; description: string; hp: number; moveSpeed: number
  airSpeed: number; jumpSpeed: number; dashSpeed: number; power: number; knockback: number
  attackRecoveryFrames: number; airJumps: number; ratings: string
  echoCooldownMultiplier?: number
}
export interface WeaponConfig {
  name: string; subtitle: string; description: string; startup: number; active: number
  total: number; damage: number; reach: number; height: number; projectileSpeed?: number
}
export interface SkillConfig { name: string; subtitle: string; description: string; cooldown: number }
export interface AttackConfig extends WeaponConfig { weapon: Weapon; verticalOffset?: number; knockback?: number }

export const CHARACTERS: Record<Character, CharacterConfig> = {
  standard: { name: 'STANDARD', subtitle: '均衡型', description: '速度・耐久・攻撃力のバランスがよい。どの武器やSkillとも組み合わせやすい。', hp: 100, moveSpeed: 330, airSpeed: 300, jumpSpeed: 700, dashSpeed: 820, power: 1, knockback: 1, attackRecoveryFrames: 0, airJumps: 0, ratings: 'HP ★★★ / SPEED ★★★ / POWER ★★★ / MOBILITY ★★★' },
  light: { name: 'LIGHT', subtitle: '高速型', description: '低HP・低威力の代わりに移動、ジャンプ、ダッシュが速い。Echoとの位置調整に強い。', hp: 78, moveSpeed: 395, airSpeed: 360, jumpSpeed: 780, dashSpeed: 930, power: 0.8, knockback: 1.2, attackRecoveryFrames: 0, airJumps: 0, ratings: 'HP ★★ / SPEED ★★★★★ / POWER ★★ / MOBILITY ★★★★★' },
  heavy: { name: 'HEAVY', subtitle: '重量型', description: '高HPで吹き飛びにくい。攻撃は少し強いが、動きと攻撃後の立て直しが遅い。', hp: 118, moveSpeed: 285, airSpeed: 250, jumpSpeed: 650, dashSpeed: 700, power: 1.1, knockback: 0.8, attackRecoveryFrames: 10, airJumps: 0, ratings: 'HP ★★★★ / SPEED ★★ / POWER ★★★ / MOBILITY ★★' },
  hopper: { name: 'HOPPER', subtitle: '二段ジャンプ型', description: '空中でもう一度ジャンプできる。地上の速さと攻撃力は控えめなので、上からの位置取りが得意。', hp: 90, moveSpeed: 305, airSpeed: 350, jumpSpeed: 690, dashSpeed: 790, power: 0.9, knockback: 1.1, attackRecoveryFrames: 0, airJumps: 1, ratings: 'HP ★★ / SPEED ★★★ / POWER ★★ / MOBILITY ★★★★★' },
  shade: { name: 'SHADE', subtitle: '分身特化', description: '分身を約7秒でまた出せる。HPと通常攻撃の威力が低く、本体だけでの殴り合いは苦手。', hp: 74, moveSpeed: 350, airSpeed: 330, jumpSpeed: 735, dashSpeed: 830, power: 0.88, knockback: 1.18, attackRecoveryFrames: 0, airJumps: 0, echoCooldownMultiplier: 0.7, ratings: 'HP ★★ / SPEED ★★★★ / POWER ★★ / ECHO ★★★★★' },
}
export const WEAPONS: Record<Weapon, WeaponConfig> = {
  sword: { name: 'SWORD', subtitle: '近距離', description: '発生が速く扱いやすい斬撃。射程は短い。', startup: 7, active: 6, total: 27, damage: 13, reach: 70, height: 44 },
  spear: { name: 'SPEAR', subtitle: '中距離', description: '長いリーチで間合いを支配する突き。発生はSwordより遅い。', startup: 12, active: 5, total: 37, damage: 15, reach: 124, height: 30 },
  blaster: { name: 'BLASTER', subtitle: '遠距離', description: '弾を発射して遠くから攻撃する。威力が低く、接近戦では発生の遅さが弱点。', startup: 15, active: 1, total: 41, damage: 8, reach: 0, height: 0, projectileSpeed: 610 },
  dagger: { name: 'DAGGER', subtitle: '近距離・速攻', description: '短いリーチの代わりに、すばやく続けて攻撃できる短剣。', startup: 4, active: 5, total: 17, damage: 8, reach: 47, height: 39 },
  hammer: { name: 'HAMMER', subtitle: '近距離・一撃', description: '振りは遅いけれど、当たると大きく吹き飛ばすハンマー。', startup: 20, active: 7, total: 53, damage: 24, reach: 75, height: 51 },
  fan: { name: 'FAN', subtitle: '対空・広め', description: '扇で広くはたく。ジャンプした相手に強いが、威力と正面の射程は控えめ。', startup: 13, active: 8, total: 35, damage: 10, reach: 58, height: 79 },
  yoyo: { name: 'YO-YO', subtitle: '中距離・牽制', description: '中距離まで伸びるヨーヨー。威力は低いが、長めの攻撃時間で相手の進路をふさげる。', startup: 9, active: 8, total: 31, damage: 9, reach: 91, height: 38 },
  whip: { name: 'WHIP', subtitle: '遠め・広範囲', description: '遠くまで届き、上下にも当てやすいムチ。振り始めと空振り後の隙が大きい。', startup: 18, active: 5, total: 48, damage: 10, reach: 139, height: 58 },
  scythe: { name: 'SCYTHE', subtitle: '広い一撃', description: '広い範囲を強く払う大鎌。振り始めが遅く、外すと長く無防備になる。', startup: 27, active: 6, total: 67, damage: 21, reach: 108, height: 68 },
}
export const SKILLS: Record<Skill, SkillConfig> = {
  blink: { name: 'BLINK', subtitle: '8秒', description: '向いている方向へ短距離瞬間移動。回避、接近、Echoとの位置合わせに使う。', cooldown: 480 },
  shield: { name: 'SHIELD', subtitle: '10秒', description: '約0.8秒間ダメージとノックバックを防ぐ。攻撃を読んで使う。', cooldown: 600 },
  shockwave: { name: 'SHOCKWAVE', subtitle: '12秒', description: '周囲の敵を吹き飛ばす衝撃波。ダメージより位置操作を重視する。', cooldown: 720 },
  echo_swap: { name: 'ECHO SWAP', subtitle: '10秒', description: '自分のEchoが出ている間だけ、本体とEchoの位置を入れ替える。', cooldown: 600 },
  spring: { name: 'SPRING', subtitle: '10秒', description: '上へ大きくジャンプ。空中でも使えるが、飛んでいる間は攻撃を受ける。', cooldown: 600 },
  echo_charge: { name: 'ECHO CHARGE', subtitle: '26秒', description: '記録がたまっていて分身がいないとき、分身の待ち時間を無視してもう一度呼ぶ。再使用までは長い。', cooldown: 1560 },
}
export const ATTACKS: Record<AttackStyle, AttackConfig> = {
  basic_slash: { ...WEAPONS.sword, weapon: 'sword', name: 'BASIC SLASH', subtitle: '標準', description: '素早く振るう標準の斬撃。' },
  heavy_slash: { ...WEAPONS.sword, weapon: 'sword', name: 'HEAVY SLASH', subtitle: '強撃', description: '振り始めがかなり遅く、外すと大きな隙。当てれば強く吹き飛ばす。', startup: 21, active: 5, total: 54, damage: 18, reach: 82, knockback: 1.3 },
  upper_slash: { ...WEAPONS.sword, weapon: 'sword', name: 'UPPER SLASH', subtitle: '対空', description: '頭上の敵を捉える縦方向の斬撃。', startup: 10, active: 6, total: 34, damage: 12, reach: 53, height: 88, verticalOffset: -27 },
  spear_thrust: { ...WEAPONS.spear, weapon: 'spear', name: 'SPEAR THRUST', subtitle: '標準', description: '長いリーチの突き。距離を保って戦う。' },
  spear_sweep: { ...WEAPONS.spear, weapon: 'spear', name: 'SPEAR SWEEP', subtitle: '広め', description: '槍を横に払う。突きより短いけれど上下に当てやすい。', startup: 15, active: 8, total: 43, damage: 12, reach: 96, height: 68 },
  blaster_shot: { ...WEAPONS.blaster, weapon: 'blaster', name: 'BLASTER SHOT', subtitle: '標準', description: '遠くまで飛ぶ低威力の弾を放つ。' },
  charged_shot: { ...WEAPONS.blaster, weapon: 'blaster', name: 'CHARGED SHOT', subtitle: 'ため撃ち', description: '撃つまで時間がかかる代わりに、強い弾を飛ばす。', startup: 27, total: 62, damage: 16, projectileSpeed: 700, knockback: 1.25 },
  dagger_stab: { ...WEAPONS.dagger, weapon: 'dagger', name: 'QUICK STAB', subtitle: '標準', description: '短い距離をすばやく突く。' },
  dagger_lunge: { ...WEAPONS.dagger, weapon: 'dagger', name: 'LONG STAB', subtitle: '踏み込み', description: '少し遅いけれど、遠めまで届く短剣の突き。', startup: 12, total: 32, damage: 12, reach: 91 },
  hammer_smash: { ...WEAPONS.hammer, weapon: 'hammer', name: 'HAMMER SMASH', subtitle: '標準', description: '大きく振り下ろして、相手を吹き飛ばす。', knockback: 1.4 },
  hammer_upper: { ...WEAPONS.hammer, weapon: 'hammer', name: 'UPPER HAMMER', subtitle: '対空', description: '上に向かって振る。ジャンプした相手にも当てやすい。', startup: 22, active: 7, total: 56, damage: 20, reach: 55, height: 93, verticalOffset: -23, knockback: 1.55 },
  fan_swat: { ...WEAPONS.fan, weapon: 'fan', name: 'FAN SWAT', subtitle: '標準', description: '広い縦の当たり判定で、跳ぶ相手をはたく。威力は低め。', verticalOffset: -10 },
  fan_gust: { ...WEAPONS.fan, weapon: 'fan', name: 'FAN GUST', subtitle: '押し出し', description: 'ゆっくり振って遠めの相手を押す。ダメージは小さく、外すと隙が大きい。', startup: 21, active: 7, total: 52, damage: 7, reach: 103, height: 56, knockback: 1.45 },
  yoyo_toss: { ...WEAPONS.yoyo, weapon: 'yoyo', name: 'YO-YO TOSS', subtitle: '標準', description: '少し離れた相手へ投げる。届いている時間が長いが、一発の威力は低い。' },
  yoyo_high: { ...WEAPONS.yoyo, weapon: 'yoyo', name: 'HIGH TOSS', subtitle: '対空', description: '上へヨーヨーを放る。正面の距離は短くなるので、跳んだ相手を読む技。', startup: 14, active: 7, total: 39, damage: 10, reach: 72, height: 86, verticalOffset: -24 },
  whip_snap: { ...WEAPONS.whip, weapon: 'whip', name: 'WHIP SNAP', subtitle: '標準', description: '広い範囲を一度はたく。遠くまで届く反面、外した後は反撃されやすい。' },
  whip_sweep: { ...WEAPONS.whip, weapon: 'whip', name: 'LOW SWEEP', subtitle: '押し出し', description: '近くの広い範囲を払う。射程と威力を減らして、相手を押し返す。', startup: 21, active: 7, total: 51, damage: 8, reach: 99, height: 76, knockback: 1.3 },
  scythe_sweep: { ...WEAPONS.scythe, weapon: 'scythe', name: 'SCYTHE SWEEP', subtitle: '広い一撃', description: 'ゆっくり大きく払う。先に動きを読めば強いが、空振りの隙はかなり大きい。', verticalOffset: -6, knockback: 1.2 },
}
export const DEFAULT_ATTACK: Record<Weapon, AttackStyle> = { sword: 'basic_slash', spear: 'spear_thrust', blaster: 'blaster_shot', dagger: 'dagger_stab', hammer: 'hammer_smash', fan: 'fan_swat', yoyo: 'yoyo_toss', whip: 'whip_snap', scythe: 'scythe_sweep' }
export function attackFor(weapon: Weapon, attack?: AttackStyle): AttackConfig {
  return attack && ATTACKS[attack]?.weapon === weapon ? ATTACKS[attack] : ATTACKS[DEFAULT_ATTACK[weapon]]
}
export function attackCycleFrames(loadout: Pick<Loadout, 'character' | 'weapon' | 'attack'>): number {
  return attackFor(loadout.weapon, loadout.attack).total + CHARACTERS[loadout.character].attackRecoveryFrames
}
export function echoCooldownFrames(character: Character): number {
  return Math.round(RULES.echoCooldown * (CHARACTERS[character].echoCooldownMultiplier ?? 1))
}
export function nextAirJumpUse(character: Character, grounded: boolean, used: number): number | undefined {
  if (grounded) return 0
  return used < CHARACTERS[character].airJumps ? used + 1 : undefined
}
export function isLoadout(value: unknown): value is Loadout {
  if (!value || typeof value !== 'object') return false
  const input = value as Record<string, unknown>
  return typeof input.character === 'string' && input.character in CHARACTERS &&
    typeof input.weapon === 'string' && input.weapon in WEAPONS &&
    typeof input.skill === 'string' && input.skill in SKILLS &&
    (input.hat === undefined || typeof input.hat === 'string' && Object.hasOwn(HATS, input.hat)) &&
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
