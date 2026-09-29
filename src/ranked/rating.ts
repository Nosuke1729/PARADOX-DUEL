import { RANKED_CONFIG, RANK_TIERS, type RankTier } from './config'

export function rankTier(rating: number): RankTier {
  for (let index = RANK_TIERS.length - 1; index >= 0; index--) {
    if (rating >= RANK_TIERS[index].minimum) return RANK_TIERS[index].name
  }
  return 'BRONZE'
}

export function eloResult(first: number, second: number, winner: 1 | 2 | 0, k = RANKED_CONFIG.kFactor): [number, number] {
  const expectedFirst = 1 / (1 + 10 ** ((second - first) / 400))
  const delta = Math.round(k * ((winner === 1 ? 1 : winner === 2 ? 0 : 0.5) - expectedFirst))
  return [Math.max(0, first + delta), Math.max(0, second - delta)]
}

export function ratingRange(waitSeconds: number): number {
  if (waitSeconds < RANKED_CONFIG.expansionAfterSeconds) return RANKED_CONFIG.initialRange
  const extra = Math.floor((waitSeconds - RANKED_CONFIG.expansionAfterSeconds) / RANKED_CONFIG.expansionStepSeconds)
  return RANKED_CONFIG.expandedRange + extra * RANKED_CONFIG.expansionStepRating
}

export function canMatch(selfId: string, otherId: string, firstRating: number, secondRating: number,
  firstWaitSeconds: number, secondWaitSeconds: number): boolean {
  return selfId !== otherId && Math.abs(firstRating - secondRating) <=
    Math.max(ratingRange(firstWaitSeconds), ratingRange(secondWaitSeconds))
}
