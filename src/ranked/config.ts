export const RANKED_CONFIG = {
  initialRating: 1000,
  kFactor: 32,
  initialRange: 150,
  expandedRange: 300,
  expansionAfterSeconds: 10,
  expansionStepSeconds: 10,
  expansionStepRating: 150,
  queueTimeoutSeconds: 30,
  disconnectTimeoutSeconds: 25,
  pollIntervalMs: 3000,
  heartbeatIntervalMs: 5000,
  usernameMin: 3,
  usernameMax: 16,
  rankingLimit: 100,
} as const

export const RANK_TIERS = [
  { name: 'BRONZE', minimum: 0 },
  { name: 'SILVER', minimum: 900 },
  { name: 'GOLD', minimum: 1100 },
  { name: 'PLATINUM', minimum: 1300 },
  { name: 'DIAMOND', minimum: 1500 },
  { name: 'MASTER', minimum: 1700 },
] as const

export type RankTier = typeof RANK_TIERS[number]['name']
