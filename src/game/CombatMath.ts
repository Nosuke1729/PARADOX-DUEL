import { attackFor } from './balance'
import type { AttackStyle, Weapon } from './types'

export interface Rect { x: number; y: number; width: number; height: number }
export function attackRect(x: number, y: number, facing: -1 | 1, weapon: Weapon = 'sword', style?: AttackStyle): Rect {
  const config = attackFor(weapon, style)
  return {
    x: facing > 0 ? x + 15 : x - 15 - config.reach,
    y: y - config.height / 2 - (weapon === 'spear' ? 5 : 9) + (config.verticalOffset ?? 0),
    width: config.reach,
    height: config.height,
  }
}
export function hurtRect(x: number, y: number): Rect { return { x: x - 17, y: y - 28, width: 34, height: 56 } }
export function projectileRect(x: number, y: number): Rect { return { x: x - 8, y: y - 7, width: 16, height: 14 } }
export function overlaps(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y
}
export class HitLedger {
  private seen = new Set<string>()
  claim(id: string, attack: Rect, hurt: Rect, invulnerable: boolean): boolean {
    if (invulnerable || this.seen.has(id) || !overlaps(attack, hurt)) return false
    this.seen.add(id)
    return true
  }
  acceptRemote(id: string): boolean {
    if (this.seen.has(id)) return false
    this.seen.add(id)
    return true
  }
  clear(): void { this.seen.clear() }
}
