import { ATTACKS, SKILLS, WEAPONS } from '../game/balance'
import { COLORS, GEAR_CAPSULE_ITEMS, HATS, type GearCapsuleItem } from '../progression/catalog'
import { canUse, syncUnlocks, type PlayerProgress } from '../progression/progress'

export const SHOP_COLORS = [
  { id: 'mint', price: 140 },
  { id: 'peach', price: 140 },
  { id: 'lemon', price: 180 },
] as const

export const CAPSULE_COLORS = ['grape', 'soda', 'sunset', 'star'] as const
export const CAPSULE_PRICE = 90
export const GEAR_CAPSULE_PRICE = 220
export const DUPLICATE_REFUND_PERCENT = 50
const refundFor = (price: number): number => Math.floor(price * DUPLICATE_REFUND_PERCENT / 100)

export type ShopResult = { ok: true; color: string; duplicate: boolean; refund: number } | { ok: false; reason: string }

function grantColor(progress: PlayerProgress, color: string): ShopResult {
  progress.ownedCosmetics.push(color)
  if (!progress.unlockedColors.includes(color)) progress.unlockedColors.push(color)
  return { ok: true, color, duplicate: false, refund: 0 }
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
  if (progress.coins < CAPSULE_PRICE) return { ok: false, reason: 'コインが足りません。' }
  const pick = Math.min(CAPSULE_COLORS.length - 1, Math.max(0, Math.floor(random() * CAPSULE_COLORS.length)))
  const color = CAPSULE_COLORS[pick]
  progress.coins -= CAPSULE_PRICE
  if (!progress.unlockedColors.includes(color)) return grantColor(progress, color)
  const refund = refundFor(CAPSULE_PRICE)
  progress.coins += refund
  return { ok: true, color, duplicate: true, refund }
}

export function colorName(id: string): string { return COLORS[id]?.name ?? id }

export function buyHat(progress: PlayerProgress, hat: string): { ok: true; hat: string } | { ok: false; reason: string } {
  if (!Object.hasOwn(HATS, hat) || hat === 'none') return { ok: false, reason: 'この帽子はショップで買えません。' }
  const item = HATS[hat]
  if (canUse(progress, 'hat', hat)) return { ok: false, reason: 'もう持っています。' }
  if (progress.coins < item.price) return { ok: false, reason: 'コインが足りません。' }
  progress.coins -= item.price
  progress.ownedCosmetics.push(`hat:${hat}`)
  return { ok: true, hat }
}

export type GearResult = { ok: true; item: GearCapsuleItem; duplicate: boolean; refund: number } | { ok: false; reason: string }

export function gearCapsulePool(progress: PlayerProgress): GearCapsuleItem[] {
  return GEAR_CAPSULE_ITEMS.filter(item => item.kind !== 'attack' ||
    canUse(progress, 'weapon', ATTACKS[item.id as keyof typeof ATTACKS].weapon))
}

export function drawGearCapsule(progress: PlayerProgress, random = Math.random): GearResult {
  if (progress.coins < GEAR_CAPSULE_PRICE) return { ok: false, reason: 'コインが足りません。' }
  const pool = gearCapsulePool(progress)
  const pick = Math.min(pool.length - 1, Math.max(0, Math.floor(random() * pool.length)))
  const item = pool[pick]
  progress.coins -= GEAR_CAPSULE_PRICE
  if (canUse(progress, item.kind, item.id)) {
    const refund = refundFor(GEAR_CAPSULE_PRICE)
    progress.coins += refund
    return { ok: true, item, duplicate: true, refund }
  }
  progress.ownedGear.push(`${item.kind}:${item.id}`)
  syncUnlocks(progress)
  return { ok: true, item, duplicate: false, refund: 0 }
}

export function gearName(item: GearCapsuleItem): string {
  return item.kind === 'weapon' ? WEAPONS[item.id as keyof typeof WEAPONS].name
    : item.kind === 'attack' ? ATTACKS[item.id as keyof typeof ATTACKS].name
      : SKILLS[item.id as keyof typeof SKILLS].name
}
