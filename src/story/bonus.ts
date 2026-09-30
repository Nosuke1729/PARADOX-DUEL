import type { StoryChapter } from './chapters'

export const BONUS_CONFIG = {
  minChapter: 5,
  spawnChance: 0.08,
  pityAfter: 12,
  attempts: 3,
  pulseFirst: 240,
  pulseInterval: 420,
  pulseWarning: 60,
  pulseRadius: 285,
  pulseDamage: 16,
} as const

export const BONUS_REWARDS = [
  { kind: 'character', id: 'shade', name: 'SHADE' },
  { kind: 'weapon', id: 'scythe', name: 'SCYTHE' },
  { kind: 'skill', id: 'echo_charge', name: 'ECHO CHARGE' },
] as const
export type BonusRewardId = typeof BONUS_REWARDS[number]['id']

export const BONUS_CHAPTER: StoryChapter = {
  id: 0, bonus: true, title: 'ふらっと現れた強敵', subtitle: 'まれに現れるボーナス戦',
  briefing: '大鎌の一撃と、予兆のあとに地面を走る衝撃波に注意。跳ぶか間合いを離してよけよう。勝つと特別な装備を1つ入手できます。',
  enemyName: 'SHADE',
  enemy: { character: 'shade', weapon: 'scythe', skill: 'echo_charge', attack: 'scythe_sweep', color: 'grape' },
  difficulty: 'hard', boss: { id: 'bonus_shade', hpMultiplier: 2.45, phaseAt: 0.45, special: 'ground_pulse' },
  rewardXp: 650, rewardCoins: 300,
  arena: { platformX: 357, platformY: 317, platformWidth: 246, accent: 0xb9a3ed },
}

export function eligibleForBonus(chapterId: number, attempts: number, dryStreak: number,
  remainingRewards: number, roll: number): boolean {
  return chapterId >= BONUS_CONFIG.minChapter && attempts === 0 && remainingRewards > 0 &&
    (dryStreak + 1 >= BONUS_CONFIG.pityAfter || roll < BONUS_CONFIG.spawnChance)
}

export function groundPulseHits(playerX: number, playerY: number, originX: number, floorY: number): boolean {
  return Math.abs(playerX - originX) < BONUS_CONFIG.pulseRadius && playerY > floorY - 98
}
