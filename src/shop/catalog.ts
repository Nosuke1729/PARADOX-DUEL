import { COLORS } from '../progression/catalog'
import type { PlayerProgress } from '../progression/progress'

export const SHOP_COLORS = [
  { id: 'mint', price: 140 },
  { id: 'peach', price: 140 },
  { id: 'lemon', price: 180 },
] as const

export const CAPSULE_COLORS = ['grape', 'soda', 'sunset', 'star'] as const
export const CAPSULE_PRICE = 90

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
