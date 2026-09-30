import type { Slot } from '../game/types'

export type StoryMechanic =
  | { kind: 'echo_only'; enemyHpMultiplier: number; enemyDamageMultiplier: number }
  | { kind: 'duo'; enemyHpMultiplier: number; enemyDamageMultiplier: number }

export function canDamageStoryEnemy(mechanic: StoryMechanic | undefined, owner: Slot, source: 'body' | 'echo'): boolean {
  return !(mechanic?.kind === 'echo_only' && owner === 1 && source === 'body')
}

// Special stages require their actual objective. Timeout cannot count as a clear.
export function specialStageWinner(playerHp: number, enemyHps: readonly number[]): Slot | undefined {
  if (playerHp <= 0) return 2
  if (enemyHps.length > 0 && enemyHps.every(hp => hp <= 0)) return 1
  return undefined
}
