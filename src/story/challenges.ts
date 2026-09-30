export type EchoChallengeKind = 'summon' | 'echo_hit' | 'paired_hits'
export interface EchoChallenge {
  chapterId: number
  id: string
  title: string
  objective: string
  kind: EchoChallengeKind
  bonusCoins: number
}

// Optional objectives use the existing Echo action and never block story progress.
export const ECHO_CHALLENGES: readonly EchoChallenge[] = [
  { chapterId: 1, id: 'first_echo', title: '分身デビュー', objective: '分身を出して勝つ', kind: 'summon', bonusCoins: 30 },
  { chapterId: 3, id: 'echo_strike', title: '分身の一撃', objective: '分身の攻撃を当てて勝つ', kind: 'echo_hit', bonusCoins: 50 },
  { chapterId: 5, id: 'echo_partner', title: '息ぴったり', objective: '本体と分身の攻撃を2秒以内に当てて勝つ', kind: 'paired_hits', bonusCoins: 80 },
]

export function challengeFor(chapterId: number): EchoChallenge | undefined {
  return ECHO_CHALLENGES.find(challenge => challenge.chapterId === chapterId)
}
export function titleFor(id: string): EchoChallenge | undefined {
  return ECHO_CHALLENGES.find(challenge => challenge.id === id)
}

export class EchoChallengeTracker {
  complete = false
  private lastBodyHit?: number
  private lastEchoHit?: number

  constructor(readonly challenge: EchoChallenge) {}

  recordEchoSummon(): void {
    if (this.challenge.kind === 'summon') this.complete = true
  }

  recordHit(source: 'body' | 'echo', tick: number): void {
    if (source === 'echo' && this.challenge.kind === 'echo_hit') this.complete = true
    if (this.challenge.kind !== 'paired_hits') return
    if (source === 'body') this.lastBodyHit = tick
    else this.lastEchoHit = tick
    if (this.lastBodyHit !== undefined && this.lastEchoHit !== undefined &&
      Math.abs(this.lastBodyHit - this.lastEchoHit) <= 120) this.complete = true
  }

  reset(): void {
    this.complete = false
    this.lastBodyHit = undefined
    this.lastEchoHit = undefined
  }
}
