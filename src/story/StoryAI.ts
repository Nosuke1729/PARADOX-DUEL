import { EMPTY_CONTROLS, type Controls, type Weapon } from '../game/types'
import type { BossConfig, Difficulty } from './chapters'

export interface AICombatant {
  x: number; y: number; hp: number; maxHp: number; attackFrame: number; grounded: boolean
  loadout: { weapon: Weapon }; echoCooldown: number; skillCooldown: number
  recorder: { ready(): boolean }
}
export const AI_DIFFICULTY = {
  easy: { reactionDelay: 22, aggression: 0.65, dodgeChance: 0.08, echoUsage: 0.12, skillUsage: 0.15 },
  normal: { reactionDelay: 13, aggression: 0.82, dodgeChance: 0.24, echoUsage: 0.38, skillUsage: 0.42 },
  hard: { reactionDelay: 7, aggression: 0.96, dodgeChance: 0.45, echoUsage: 0.68, skillUsage: 0.65 },
} as const

export class StoryAI {
  private move = 0
  private lastAttack = -200
  private lastDash = -200
  private lastJump = -200
  private lastEcho = -1000
  private lastSkill = -1000
  constructor(readonly difficulty: Difficulty, readonly boss?: BossConfig, private readonly random = Math.random) {}

  phase(bot: AICombatant): 1 | 2 { return this.boss && bot.hp / bot.maxHp <= this.boss.phaseAt ? 2 : 1 }

  input(bot: AICombatant, player: AICombatant, tick: number): { held: Controls; pressed: Controls } {
    const base = AI_DIFFICULTY[this.difficulty]
    const secondPhase = this.phase(bot) === 2
    const reaction = Math.max(4, Math.round(base.reactionDelay * (secondPhase ? 0.65 : 1)))
    const distance = player.x - bot.x
    const toward = Math.sign(distance) || 1
    const range = bot.loadout.weapon === 'blaster' ? 265 : bot.loadout.weapon === 'whip' ? 132 :
      bot.loadout.weapon === 'spear' ? 122 : bot.loadout.weapon === 'yoyo' ? 93 :
        bot.loadout.weapon === 'dagger' ? 51 : bot.loadout.weapon === 'fan' ? 56 : 72
    const retreating = bot.hp / bot.maxHp < 0.28 && !secondPhase
    if (tick % reaction === 0) {
      this.move = Math.abs(distance) > range + 15 ? toward : Math.abs(distance) < range - 35 || retreating ? -toward : 0
    }
    const targetInRange = Math.abs(distance) < (bot.loadout.weapon === 'blaster' ? 550 :
      bot.loadout.weapon === 'whip' ? 167 : bot.loadout.weapon === 'spear' ? 150 :
        bot.loadout.weapon === 'yoyo' ? 120 : bot.loadout.weapon === 'dagger' ? 75 :
          bot.loadout.weapon === 'fan' ? 85 : 105) &&
      Math.abs(player.y - bot.y) < (bot.loadout.weapon === 'fan' || bot.loadout.weapon === 'whip' ? 95 : 74)
    const attackInterval = Math.round((this.difficulty === 'easy' ? 94 : this.difficulty === 'normal' ? 71 : 54) / (secondPhase ? 1.25 : 1))
    const attack = targetInRange && tick - this.lastAttack >= attackInterval && this.random() < Math.min(1, base.aggression + (secondPhase ? 0.12 : 0))
    const dodge = player.attackFrame > 0 && Math.abs(distance) < 165 && this.random() < base.dodgeChance / reaction
    const dash = tick - this.lastDash > (secondPhase && this.boss?.special === 'dash_burst' ? 105 : 175) &&
      (dodge || Math.abs(distance) > range + 145 && this.random() < (secondPhase ? 0.18 : 0.08))
    const jump = bot.grounded && tick - this.lastJump > 130 && (player.y < bot.y - 65 || this.random() < 0.004)
    const echo = bot.recorder.ready() && bot.echoCooldown === 0 && tick - this.lastEcho > 260 &&
      this.random() < (this.boss?.special === 'echo_pressure' ? 0.065 : base.echoUsage / 170)
    const skill = bot.skillCooldown === 0 && tick - this.lastSkill > 160 &&
      this.random() < (this.boss?.special === 'iron_guard' && secondPhase ? 0.1 : base.skillUsage / 90)
    if (attack) this.lastAttack = tick
    if (dash) this.lastDash = tick
    if (jump) this.lastJump = tick
    if (echo) this.lastEcho = tick
    if (skill) this.lastSkill = tick
    const held: Controls = { ...EMPTY_CONTROLS, left: this.move < 0, right: this.move > 0,
      attack, dash, jump, echo, skill }
    return { held, pressed: { ...held, left: false, right: false } }
  }
}
