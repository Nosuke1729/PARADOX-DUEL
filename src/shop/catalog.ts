import { ATTACKS, SKILLS, WEAPONS } from '../game/balance'
import { COLORS, GEAR_CAPSULE_ITEMS, type GearCapsuleItem } from '../progression/catalog'
import { canUse, syncUnlocks, type PlayerProgress } from '../progression/progress'

export const SHOP_COLORS = [
  { id: 'mint', price: 140 },
  { id: 'peach', price: 140 },
  { id: 'lemon', price: 180 },
] as const

export const CAPSULE_COLORS = ['grape', 'soda', 'sunset', 'star'] as const
export const CAPSULE_PRICE = 90
export const GEAR_CAPSULE_PRICE = 220

export type ShopResult = { ok: true; color: string } | { ok: false; reason: string }

function grantColor(progress: PlayerProgress, color: string): ShopResult {
  progress.ownedCosmetics.push(color)
  if (!progress.unlockedColors.includes(color)) progress.unlockedColors.push(color)
  return { ok: true, color }
}

export function buyColor(progress: PlayerProgress, color: string): ShopResult {
  const item = SHOP_COLORS.find(item => item.id === color)
  if (!item) return { ok: false, reason: 'この色はショップで買えません。' }
  if (progress.unlockedColors.includes(color)) return { ok: false, reason: 'もう持っています。' }
  if (progress.coins < item.price) return { ok: false, reason: 'コインが足りません。' }
  progress.coins -= item.price
  return grantColor(progress, color)
}

export function drawCapsule(progress: PlayerProgress, random = Math.random): ShopResult {
  const available = CAPSULE_COLORS.filter(color => !progress.unlockedColors.includes(color))
  if (!available.length) return { ok: false, reason: 'カプセルの色は全部そろっています。' }
  if (progress.coins < CAPSULE_PRICE) return { ok: false, reason: 'コインが足りません。' }
  const pick = Math.min(available.length - 1, Math.max(0, Math.floor(random() * available.length)))
  progress.coins -= CAPSULE_PRICE
  return grantColor(progress, available[pick])
}

export function colorName(id: string): string { return COLORS[id]?.name ?? id }

export type GearResult = { ok: true; item: GearCapsuleItem } | { ok: false; reason: string }

export function gearCapsuleCandidates(progress: PlayerProgress): GearCapsuleItem[] {
  return GEAR_CAPSULE_ITEMS.filter(item => !canUse(progress, item.kind, item.id) &&
    (item.kind !== 'attack' || canUse(progress, 'weapon', ATTACKS[item.id as keyof typeof ATTACKS].weapon)))
}

export function drawGearCapsule(progress: PlayerProgress, random = Math.random): GearResult {
  const available = gearCapsuleCandidates(progress)
  if (!available.length) return { ok: false, reason: '装備カプセルの中身は全部そろっています。' }
  if (progress.coins < GEAR_CAPSULE_PRICE) return { ok: false, reason: 'コインが足りません。' }
  const pick = Math.min(available.length - 1, Math.max(0, Math.floor(random() * available.length)))
  const item = available[pick]
  progress.coins -= GEAR_CAPSULE_PRICE
  progress.ownedGear.push(`${item.kind}:${item.id}`)
  syncUnlocks(progress)
  return { ok: true, item }
}

export function gearName(item: GearCapsuleItem): string {
  return item.kind === 'weapon' ? WEAPONS[item.id as keyof typeof WEAPONS].name
    : item.kind === 'attack' ? ATTACKS[item.id as keyof typeof ATTACKS].name
      : SKILLS[item.id as keyof typeof SKILLS].name
}
