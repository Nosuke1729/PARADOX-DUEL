import Phaser from 'phaser'
import { Echo } from './Echo'
import { Fighter } from './Fighter'
import { HitLedger, attackRect, hurtRect, projectileRect } from './CombatMath'
import { attackFor, CHARACTERS, SKILLS, WEAPONS, damageFor, echoCooldownFrames, winnerByHealth } from './balance'
import { InputManager } from './InputManager'
import { soundFX } from './SoundFX'
import { EMPTY_CONTROLS, RULES, WORLD, type AttackStyle, type Controls, type EchoPacket, type FighterState, type Loadout, type MatchEvent, type Phase, type ProjectileState, type Slot, type Snapshot, type Weapon } from './types'
import type { InputPacket, RoomManager } from '../network/RoomManager'
import { StoryAI } from '../story/StoryAI'
import type { StoryChapter } from '../story/chapters'
import { challengeFor, EchoChallengeTracker } from '../story/challenges'
import { canDamageStoryEnemy, specialStageWinner } from '../story/mechanics'
import { BONUS_CONFIG, groundPulseHits } from '../story/bonus'
import { weaponPose } from './AttackVisual'

export interface BattleOptions {
  mode: 'practice' | 'online' | 'story'
  story?: StoryChapter
  room?: RoomManager
  playerNames?: [string, string]
  loadouts: [Loadout, Loadout]
  onMatchEnd: (message: string, result: 'win' | 'loss' | 'draw', challengeComplete: boolean) => void
  onNewMatch: () => void
  onDisconnect: () => void
  onReconnect?: () => void
}

export class BattleScene extends Phaser.Scene {
  private options: BattleOptions
  private fighters!: [Fighter, Fighter]
  private inputReader!: InputManager
  private echoes: Echo[] = []
  private projectiles: ProjectileState[] = []
  private effects: { x: number; y: number; radius: number; frames: number; color: number }[] = []
  private platform!: Phaser.GameObjects.Rectangle
  private platformTop: number = WORLD.platformY
  private hud!: Phaser.GameObjects.Graphics
  private attacks!: Phaser.GameObjects.Graphics
  private topText!: Phaser.GameObjects.Text
  private centerText!: Phaser.GameObjects.Text
  private challengeText!: Phaser.GameObjects.Text
  private bottomText!: Phaser.GameObjects.Text
  private leftText!: Phaser.GameObjects.Text
  private rightText!: Phaser.GameObjects.Text
  private phase: Phase = 'countdown'
  private round = 1
  private wins: [number, number] = [0, 0]
  private timer: number = RULES.roundFrames
  private phaseFrames: number = RULES.countdownFrames
  private tick = 0
  private matchId: string = crypto.randomUUID()
  private accumulator = 0
  private hitLedger = new HitLedger()
  private latestRemote: Controls = { ...EMPTY_CONTROLS }
  private remotePressed: Controls = { ...EMPTY_CONTROLS }
  private remoteSeq = 0
  private inputSeq = 0
  private remoteTarget?: FighterState
  private lastSnapshotTick = -1
  private announcedMatchEnd = false
  private rematchReady = new Set<Slot>()
  private botPrevious: Controls = { ...EMPTY_CONTROLS }
  private absenceTimer?: number
  private connectionLost = false
  private storyAI?: StoryAI
  private extraStoryEnemy?: Fighter
  private extraStoryAI?: StoryAI
  private challenge?: EchoChallengeTracker
  private challengeFlashFrames = 0
  private mechanicFlashFrames = 0
  private pulseCooldown: number = BONUS_CONFIG.pulseFirst
  private pulseWarning = 0
  private pulseFlashFrames = 0
  private pulseOriginX = 0

  constructor(options: BattleOptions) {
    super('Battle')
    this.options = options
    const challenge = options.story && challengeFor(options.story.id)
    if (challenge) this.challenge = new EchoChallengeTracker(challenge)
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#090d17')
    this.focusCanvas()
    this.physics.world.setBounds(0, 0, WORLD.width, WORLD.height)
    this.drawStage()
    this.fighters = [new Fighter(this, 1, this.options.loadouts[0]),
      new Fighter(this, 2, this.options.loadouts[1],
        this.options.story?.boss?.hpMultiplier ?? this.options.story?.mechanic?.enemyHpMultiplier ?? 1)]
    if (this.options.story) this.storyAI = new StoryAI(this.options.story.difficulty, this.options.story.boss)
    if (this.options.story?.mechanic?.kind === 'duo') {
      this.extraStoryEnemy = new Fighter(this, 2, { ...this.options.loadouts[1], color: 'peach' },
        this.options.story.mechanic.enemyHpMultiplier)
      this.extraStoryEnemy.teleport(610, WORLD.floorY - 28)
      this.extraStoryAI = new StoryAI('easy')
    }
    const floor = this.add.rectangle(WORLD.width / 2, WORLD.floorY + 22, WORLD.width, 44, 0x152234)
    this.physics.add.existing(floor, true)
    for (const fighter of this.allFighters()) {
      this.physics.add.collider(fighter.sprite, floor)
      this.physics.add.collider(fighter.sprite, this.platform, undefined, () => {
        const body = fighter.body
        return fighter.dropFrames === 0 && body.velocity.y >= 0 &&
          body.prev.y + body.height <= this.platformTop + 8
      })
    }
    this.physics.add.collider(this.fighters[0].sprite, this.fighters[1].sprite)
    if (this.extraStoryEnemy) {
      this.physics.add.collider(this.fighters[0].sprite, this.extraStoryEnemy.sprite)
      this.physics.add.collider(this.fighters[1].sprite, this.extraStoryEnemy.sprite)
    }
    if (this.options.mode === 'online' && this.options.room?.slot === 2) {
      this.fighters[0].body.setAllowGravity(false).setImmovable(true)
      this.fighters[0].body.moves = false
      this.matchId = ''
    }
    this.inputReader = new InputManager(this)
    this.hud = this.add.graphics().setScrollFactor(0).setDepth(10)
    this.attacks = this.add.graphics().setDepth(5)
    const style = { fontFamily: 'monospace', color: '#eef4ff' }
    this.topText = this.add.text(480, 30, '', { ...style, fontSize: '24px', fontStyle: 'bold' }).setOrigin(0.5).setDepth(11)
    this.centerText = this.add.text(480, 230, '', { ...style, fontSize: '60px', fontStyle: 'bold' }).setOrigin(0.5).setDepth(11)
    this.challengeText = this.add.text(480, 112, '', { ...style, fontSize: '22px', color: '#f0e5a0' }).setOrigin(0.5).setDepth(12)
    this.bottomText = this.add.text(480, 515, '', { ...style, fontSize: '14px' }).setOrigin(0.5).setDepth(11)
    this.leftText = this.add.text(30, 9, '', { ...style, fontSize: '12px', color: '#70efeb' }).setDepth(11)
    this.rightText = this.add.text(930, 9, '', { ...style, fontSize: '12px', color: '#ff9094' }).setOrigin(1, 0).setDepth(11)
    this.leftText.setText(`${this.options.playerNames?.[0] ? this.options.playerNames[0] + ' / ' : ''}${CHARACTERS[this.fighters[0].loadout.character].name} / ${WEAPONS[this.fighters[0].loadout.weapon].name} / ${SKILLS[this.fighters[0].loadout.skill].name}`)
    this.rightText.setText(`${this.options.playerNames?.[1] ? this.options.playerNames[1] + ' / ' : ''}${CHARACTERS[this.fighters[1].loadout.character].name} / ${WEAPONS[this.fighters[1].loadout.weapon].name} / ${SKILLS[this.fighters[1].loadout.skill].name}`)
    if (this.options.room) {
      this.options.room.onInput = packet => this.onInput(packet)
      this.options.room.onSnapshot = snapshot => this.onSnapshot(snapshot)
      this.options.room.onEvent = event => this.onEvent(event)
      this.options.room.onPresence = roster => this.onPresence(Number(Boolean(roster[1])) + Number(Boolean(roster[2])))
      this.options.room.onConnection = connected => this.onConnection(connected)
      if (this.options.room.slot === 2) this.bottomText.setText('同期を待っています…')
    }
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      if (this.absenceTimer) window.clearTimeout(this.absenceTimer)
      for (const echo of this.echoes) echo.destroy()
      for (const fighter of this.allFighters()) fighter.destroy()
      if (this.options.room) {
        this.options.room.onInput = undefined
        this.options.room.onSnapshot = undefined
        this.options.room.onEvent = undefined
        this.options.room.onPresence = undefined
        this.options.room.onConnection = undefined
      }
    })
  }

  private drawStage(): void {
    const arena = this.options.story?.arena
    const platformX = arena?.platformX ?? WORLD.platformX
    const platformWidth = arena?.platformWidth ?? WORLD.platformWidth
    this.platformTop = arena?.platformY ?? WORLD.platformY
    const accent = arena?.accent ?? 0x5e8da6
    const g = this.add.graphics()
    g.lineStyle(1, 0x20334b, 0.35)
    for (let x = 0; x <= WORLD.width; x += 48) g.lineBetween(x, 0, x, WORLD.floorY)
    for (let y = 0; y <= WORLD.floorY; y += 48) g.lineBetween(0, y, WORLD.width, y)
    g.fillStyle(0x101b2a).fillRect(0, WORLD.floorY, WORLD.width, WORLD.height - WORLD.floorY)
    g.lineStyle(3, 0x4b6984).lineBetween(0, WORLD.floorY, WORLD.width, WORLD.floorY)
    g.fillStyle(0x213549).fillRoundedRect(platformX, this.platformTop, platformWidth, 13, 3)
    g.lineStyle(2, accent).lineBetween(platformX, this.platformTop, platformX + platformWidth, this.platformTop)
    if (arena) {
      g.lineStyle(2, accent, 0.55).strokeRoundedRect(40, 100, WORLD.width - 80, WORLD.floorY - 140, 18)
      g.fillStyle(accent, 0.12).fillCircle(480, 145, 105)
    }
    g.lineStyle(1, 0x335572, 0.65).lineBetween(480, 76, 480, WORLD.floorY)
    this.platform = this.add.rectangle(platformX + platformWidth / 2, this.platformTop + 6.5, platformWidth, 13, 0x213549, 0)
    this.physics.add.existing(this.platform, true)
  }

  update(_time: number, delta: number): void {
    this.accumulator = Math.min(this.accumulator + delta, 80)
    while (this.accumulator >= 1000 / 60) {
      this.accumulator -= 1000 / 60
      this.fixedStep()
    }
    this.renderHUD()
  }

  private fixedStep(): void {
    this.tick++
    if (this.challengeFlashFrames > 0) this.challengeFlashFrames--
    if (this.mechanicFlashFrames > 0) this.mechanicFlashFrames--
    const local = this.inputReader.read()
    const room = this.options.room
    if (room?.slot === 2) {
      if (this.matchId && (this.tick % 3 === 0 || Object.values(local.pressed).some(Boolean))) {
        room.sendInput({ matchId: this.matchId, round: this.round, seq: ++this.inputSeq, tick: this.tick, held: local.held, pressed: local.pressed })
      }
      if (this.phase === 'playing') {
        if (local.pressed.attack) soundFX.play('attack')
        if (local.pressed.dash) soundFX.play('dash')
        if (local.pressed.skill) soundFX.play('skill')
        this.fighters[1].step(local.held, local.pressed)
        if (local.pressed.skill) this.activateSkill(this.fighters[1], this.fighters[0], false)
        this.fighters[1].record()
        if (this.remoteTarget) this.fighters[0].interpolateTo(this.remoteTarget, 0.22)
      }
      for (const echo of this.echoes) echo.step()
      this.projectiles.forEach(projectile => { projectile.x += projectile.vx / 60; projectile.ttl-- })
      this.projectiles = this.projectiles.filter(projectile => projectile.ttl > 0)
      this.effects.forEach(effect => effect.frames--)
      this.effects = this.effects.filter(effect => effect.frames > 0)
      this.cleanupEchoes()
      return
    }

    if (this.phase === 'countdown') {
      if (this.phaseFrames % 60 === 0) soundFX.play('countdown')
      this.phaseFrames--
      if (this.phaseFrames <= 0) this.setPhase('playing')
    } else if (this.phase === 'round_end') {
      this.phaseFrames--
      if (this.phaseFrames <= 0) this.startNextRound()
    } else if (this.phase === 'playing') {
      const other = this.options.mode === 'story' ? this.fighters[1].hp > 0
        ? this.storyAI!.input(this.fighters[1], this.fighters[0], this.tick)
        : { held: { ...EMPTY_CONTROLS }, pressed: { ...EMPTY_CONTROLS } } :
        this.options.mode === 'practice' ? this.botInput() : {
        held: this.latestRemote,
        pressed: this.remotePressed,
      }
      // The two-fighter lesson stays readable: neither opponent creates more copies.
      if (this.extraStoryEnemy) { other.held.echo = false; other.pressed.echo = false }
      const side = this.extraStoryEnemy
      const sideInput = side && side.hp > 0 ? this.extraStoryAI!.input(side, this.fighters[0], this.tick) : undefined
      if (local.pressed.attack || other.pressed.attack || sideInput?.pressed.attack) soundFX.play('attack')
      if (local.pressed.dash || other.pressed.dash) soundFX.play('dash')
      if (local.pressed.skill || other.pressed.skill) soundFX.play('skill')
      this.fighters[0].step(local.held, local.pressed)
      this.fighters[1].step(other.held, other.pressed)
      if (side && sideInput) side.step(sideInput.held, sideInput.pressed)
      if (local.pressed.skill) this.activateSkill(this.fighters[0], this.fighters[1], true)
      if (other.pressed.skill) this.activateSkill(this.fighters[1], this.fighters[0], true)
      this.remotePressed = { ...EMPTY_CONTROLS }
      for (const fighter of this.fighters) {
        if (fighter.dropFrames === 0 && fighter.grounded && local.held.down && fighter.slot === 1 &&
          Math.abs(fighter.y + 28 - this.platformTop) < 12) {
          fighter.dropFrames = 16
          fighter.sprite.y += 8
          fighter.body.updateFromGameObject()
          fighter.body.setVelocityY(110)
        }
        if (fighter.slot === 2 && other.held.down && fighter.grounded && fighter.dropFrames === 0 &&
          Math.abs(fighter.y + 28 - this.platformTop) < 12) {
          fighter.dropFrames = 16
          fighter.sprite.y += 8
          fighter.body.updateFromGameObject()
          fighter.body.setVelocityY(110)
        }
        fighter.record()
      }
      if (side && side.hp > 0) side.record()
      this.tryEcho(this.fighters[0], local.pressed.echo)
      this.tryEcho(this.fighters[1], other.pressed.echo)
      for (const echo of this.echoes) echo.step()
      this.spawnProjectiles()
      this.resolveCombat()
      this.stepProjectiles()
      if (this.phase === 'playing' && this.options.story?.boss?.special === 'ground_pulse') this.stepGroundPulse()
      this.cleanupEchoes()
      this.effects.forEach(effect => effect.frames--)
      this.effects = this.effects.filter(effect => effect.frames > 0)
      if (this.pulseFlashFrames > 0) this.pulseFlashFrames--
      this.timer--
      if (this.timer <= 0) this.endRound()
    }
    if (room && this.tick % 3 === 0) room.sendSnapshot(this.snapshot())
  }

  private botInput(): { held: Controls; pressed: Controls } {
    const bot = this.fighters[1]
    const player = this.fighters[0]
    const distance = player.x - bot.x
    const toward = Math.sign(distance) || 1
    const preferred = bot.loadout.weapon === 'spear' ? 120 : bot.loadout.weapon === 'blaster' ? 260 : bot.loadout.weapon === 'dagger' ? 55 : bot.loadout.weapon === 'fan' ? 58 : 77
    const move = Math.abs(distance) > preferred ? toward : Math.abs(distance) < preferred - 35 ? -toward : 0
    const held: Controls = {
      ...EMPTY_CONTROLS,
      left: move < 0,
      right: move > 0,
      attack: Math.abs(distance) < (bot.loadout.weapon === 'blaster' ? 500 : bot.loadout.weapon === 'spear' ? 155 : bot.loadout.weapon === 'dagger' ? 72 : bot.loadout.weapon === 'fan' ? 86 : 105) && Math.abs(player.y - bot.y) < 62 && this.tick % 95 < 2,
      jump: this.tick % 190 < 2 && player.y < bot.y - 60,
      dash: Math.abs(distance) > 280 && this.tick % 210 < 2,
      echo: bot.recorder.ready() && bot.echoCooldown === 0 && this.tick % 780 < 2,
      skill: bot.loadout.skill === 'shield' ? Math.abs(distance) < 150 && player.attackFrame > 0 && this.tick % 30 < 2 : this.tick % 330 < 2,
      down: false,
    }
    const pressed = { ...EMPTY_CONTROLS }
    for (const key of Object.keys(held) as (keyof Controls)[]) pressed[key] = held[key] && !this.botPrevious[key]
    this.botPrevious = held
    return { held, pressed }
  }

  private tryEcho(fighter: Fighter, pressed: boolean): void {
    if (!pressed || fighter.hp <= 0 || fighter.echoCooldown > 0 || !fighter.recorder.ready() ||
      this.echoes.some(echo => echo.owner === fighter.slot)) return
    const packet: EchoPacket = {
      matchId: this.matchId, round: this.round, owner: fighter.slot,
      echoId: this.tick, startTick: this.tick, frames: fighter.recorder.capture(),
    }
    fighter.echoCooldown = echoCooldownFrames(fighter.loadout.character)
    this.echoes.push(new Echo(this, packet, fighter.loadout.weapon, fighter.loadout.character, fighter.loadout.attack, fighter.color, fighter.loadout.hat))
    if (fighter.slot === 1) this.trackChallenge(() => this.challenge?.recordEchoSummon())
    soundFX.play('echo')
    this.options.room?.sendEvent({ kind: 'echo', echo: packet })
  }

  private trackChallenge(action: () => void): void {
    if (!this.challenge || this.challenge.complete) return
    action()
    if (this.challenge.complete) this.challengeFlashFrames = 105
  }

  private activateSkill(fighter: Fighter, other: Fighter, authoritative: boolean): void {
    if (fighter.skillCooldown > 0 || fighter.hp <= 0 || fighter.stunFrames > 0) return
    const skill = fighter.loadout.skill
    const echo = this.echoes.find(item => item.owner === fighter.slot && !item.finished)
    const beforeX = fighter.x
    const beforeY = fighter.y
    if (skill === 'blink') {
      if (!fighter.blink(other)) return
      this.effects.push({ x: beforeX, y: beforeY, radius: 35, frames: 18, color: fighter.color })
    } else if (skill === 'shield') {
      fighter.shieldFrames = 48
    } else if (skill === 'shockwave') {
      this.effects.push({ x: fighter.x, y: fighter.y, radius: 155, frames: 20, color: fighter.color })
      for (const target of fighter.slot === 1 ? this.enemyTargets() : [other]) {
        if (!authoritative || Math.hypot(fighter.x - target.x, (fighter.y - target.y) * 1.5) >= 155 || target.hurtCooldown > 0) continue
        if (!canDamageStoryEnemy(this.options.story?.mechanic, fighter.slot, 'body')) {
          this.mechanicFlashFrames = 75
          soundFX.play('skill')
          continue
        }
        const id = `${this.round}:${fighter.slot}:shockwave:${this.tick}:${this.targetId(target)}`
        const direction: -1 | 1 = target.x >= fighter.x ? 1 : -1
        const knock = target.hit(3, direction, 1.5)
        this.options.room?.sendEvent({ kind: 'hit', matchId: this.matchId, round: this.round, id,
          target: target.slot, hp: target.hp, knockbackX: knock.x, knockbackY: knock.y, blocked: knock.blocked })
        soundFX.play(knock.blocked ? 'skill' : 'hit')
        if (target.hp <= 0) this.onFighterDefeated(target)
      }
    } else if (skill === 'echo_swap') {
      if (!echo) return
      fighter.teleport(echo.x, echo.y)
      echo.relocate(beforeX, beforeY)
      this.effects.push({ x: fighter.x, y: fighter.y, radius: 45, frames: 18, color: fighter.color })
    } else if (skill === 'spring') {
      fighter.body.setVelocityY(-780)
      this.effects.push({ x: fighter.x, y: fighter.y + 22, radius: 34, frames: 18, color: fighter.color })
    } else if (skill === 'echo_charge') {
      if (!fighter.recorder.ready() || echo) return
      fighter.echoCooldown = 0
      if (authoritative) this.tryEcho(fighter, true)
      this.effects.push({ x: fighter.x, y: fighter.y, radius: 65, frames: 22, color: fighter.color })
    }
    fighter.skillCooldown = SKILLS[skill].cooldown
    if (authoritative) this.options.room?.sendEvent({ kind: 'skill', matchId: this.matchId, round: this.round,
      slot: fighter.slot, skill, x: fighter.x, y: fighter.y, echoId: echo?.packet.echoId, echoX: echo?.x, echoY: echo?.y })
  }

  private spawnProjectiles(): void {
    for (const fighter of this.allFighters()) {
      if (fighter.firesProjectile) this.addProjectile(fighter.slot, fighter.x, fighter.y, fighter.facing,
        `${this.round}:${fighter.slot}:${fighter === this.extraStoryEnemy ? 'side' : 'body'}:${fighter.attackId}`)
    }
    for (const echo of this.echoes) {
      if (echo.firesProjectile) this.addProjectile(echo.owner, echo.x, echo.y, echo.facing,
        `${this.round}:${echo.owner}:echo:${echo.packet.echoId}:${echo.attackId}`)
    }
  }

  private addProjectile(owner: Slot, x: number, y: number, facing: -1 | 1, id: string): void {
    if (this.projectiles.some(projectile => projectile.id === id)) return
    this.projectiles.push({ id, owner, x: x + facing * 27, y: y - 8,
      vx: facing * attackFor('blaster', this.fighters[owner - 1].loadout.attack).projectileSpeed!, ttl: 90 })
  }

  private stepProjectiles(): void {
    const survivors = this.projectiles.filter(projectile => {
      projectile.x += projectile.vx / 60
      projectile.ttl--
      if (projectile.ttl <= 0 || projectile.x < 0 || projectile.x > WORLD.width) return false
      const targets = projectile.owner === 1 ? this.enemyTargets() : [this.fighters[0]]
      for (const target of targets) {
        const id = `${projectile.id}:${this.targetId(target)}`
        if (!this.hitLedger.claim(id, projectileRect(projectile.x, projectile.y),
          hurtRect(target.x, target.y), target.hurtCooldown > 0)) continue
        this.landHit(target, projectile.owner, Math.sign(projectile.vx) as -1 | 1,
          id, projectile.id.includes(':echo:') ? 'echo' : 'body')
        return false
      }
      return true
    })
    this.projectiles = this.phase === 'playing' ? survivors : []
  }

  private landHit(target: Fighter, owner: Slot, facing: -1 | 1, id: string, source: 'body' | 'echo'): void {
    if (!canDamageStoryEnemy(this.options.story?.mechanic, owner, source)) {
      this.mechanicFlashFrames = 75
      soundFX.play('skill')
      return
    }
    const loadout = this.fighters[owner - 1].loadout
    const baseDamage = damageFor(loadout, this.options.mode === 'practice' && owner === 2)
    const damage = owner === 2 && this.options.story?.mechanic
      ? Math.max(1, Math.round(baseDamage * this.options.story.mechanic.enemyDamageMultiplier)) : baseDamage
    const knock = target.hit(damage, facing, (loadout.weapon === 'blaster' ? 0.7 : 1) *
      (attackFor(loadout.weapon, loadout.attack).knockback ?? 1))
    soundFX.play(knock.blocked ? 'skill' : 'hit')
    if (!knock.blocked) this.cameras.main.shake(65, 0.003)
    if (!knock.blocked && owner === 1 && target.slot === 2) this.trackChallenge(() => this.challenge?.recordHit(source, this.tick))
    this.options.room?.sendEvent({ kind: 'hit', matchId: this.matchId, round: this.round, id,
      target: target.slot, hp: target.hp, knockbackX: knock.x, knockbackY: knock.y, blocked: knock.blocked })
    if (target.hp <= 0) this.onFighterDefeated(target)
  }

  private resolveCombat(): void {
    const attackers = [
      ...this.allFighters().map(fighter => ({ owner: fighter.slot, x: fighter.x, y: fighter.y, facing: fighter.facing,
        attackId: fighter.attackId, active: fighter.hp > 0 && fighter.isAttacking,
        source: fighter === this.extraStoryEnemy ? 'side' : 'body', weapon: fighter.loadout.weapon, attack: fighter.loadout.attack })),
      ...this.echoes.map(echo => ({ owner: echo.owner, x: echo.x, y: echo.y, facing: echo.facing,
        attackId: echo.attackId, active: echo.isAttacking, source: `echo:${echo.packet.echoId}`, weapon: echo.weapon, attack: echo.attack })),
    ]
    for (const attacker of attackers) {
      if (!attacker.active || attacker.weapon === 'blaster') continue
      for (const target of attacker.owner === 1 ? this.enemyTargets() : [this.fighters[0]]) {
        const id = `${this.round}:${attacker.owner}:${attacker.source}:${attacker.attackId}:${this.targetId(target)}`
        if (!this.hitLedger.claim(id, attackRect(attacker.x, attacker.y, attacker.facing, attacker.weapon, attacker.attack),
          hurtRect(target.x, target.y), target.hurtCooldown > 0)) continue
        this.landHit(target, attacker.owner, attacker.facing, id, attacker.source.startsWith('echo:') ? 'echo' : 'body')
        if (this.phase !== 'playing') break
      }
      if (this.phase !== 'playing') break
    }
  }

  private allFighters(): Fighter[] { return this.extraStoryEnemy ? [...this.fighters, this.extraStoryEnemy] : [...this.fighters] }
  private storyEnemies(): Fighter[] { return this.extraStoryEnemy ? [this.fighters[1], this.extraStoryEnemy] : [this.fighters[1]] }
  private enemyTargets(): Fighter[] { return this.storyEnemies().filter(fighter => fighter.hp > 0) }
  private targetId(target: Fighter): string { return target === this.extraStoryEnemy ? 'side' : String(target.slot) }

  private onFighterDefeated(target: Fighter): void {
    if ((this.options.story?.mechanic || this.options.story?.bonus) && target.slot === 2) {
      target.attackFrame = 0
      target.body.setVelocity(0, 0)
      target.body.enable = false
      target.sprite.setAlpha(0.22)
    }
    if ((!this.options.story?.mechanic && !this.options.story?.bonus) ||
      specialStageWinner(this.fighters[0].hp, this.storyEnemies().map(fighter => fighter.hp))) {
      this.endRound()
    }
  }

  private stepGroundPulse(): void {
    if (this.pulseWarning > 0) {
      this.pulseWarning--
      if (this.pulseWarning === 0) {
        const player = this.fighters[0]
        this.pulseFlashFrames = 18
        soundFX.play('skill')
        if (player.hurtCooldown === 0 && groundPulseHits(player.x, player.y, this.pulseOriginX, WORLD.floorY)) {
          const direction: -1 | 1 = player.x >= this.pulseOriginX ? 1 : -1
          const hit = player.hit(BONUS_CONFIG.pulseDamage, direction, 1.15)
          if (!hit.blocked) { soundFX.play('hit'); this.cameras.main.shake(110, 0.006) }
          if (player.hp <= 0) this.onFighterDefeated(player)
        }
        this.pulseCooldown = BONUS_CONFIG.pulseInterval
      }
      return
    }
    if (this.fighters[1].hp <= 0 || --this.pulseCooldown > 0) return
    this.pulseOriginX = this.fighters[1].x
    this.pulseWarning = BONUS_CONFIG.pulseWarning
    soundFX.play('skill')
  }

  private cleanupEchoes(): void {
    this.echoes = this.echoes.filter(echo => {
      if (!echo.finished) return true
      echo.destroy()
      return false
    })
  }

  private endRound(): void {
    if (this.phase !== 'playing') return
    const [p1, p2] = this.fighters
    const winner = this.options.story?.mechanic || this.options.story?.bonus
      ? specialStageWinner(p1.hp, this.storyEnemies().map(fighter => fighter.hp)) ?? 2
      : winnerByHealth([p1.hp, p2.hp], [p1.loadout, p2.loadout], [p1.maxHp, p2.maxHp])
    if (winner) this.wins[winner - 1]++
    this.phaseFrames = 120
    const nextPhase = this.options.mode === 'story' || this.wins.some(wins => wins >= 2) ? 'match_end' : 'round_end'
    soundFX.play(nextPhase === 'match_end' ? 'match' : 'round')
    this.setPhase(nextPhase, winner)
    if (nextPhase === 'match_end') {
      const local = this.options.room?.slot ?? 1
      const message = winner === local ? '勝利' : winner ? '敗北' : '引き分け'
      this.options.onMatchEnd(message, winner === local ? 'win' : winner ? 'loss' : 'draw', this.challenge?.complete ?? false)
    }
  }

  private startNextRound(): void {
    this.round++
    this.timer = RULES.roundFrames
    this.phaseFrames = RULES.countdownFrames
    this.hitLedger.clear()
    for (const echo of this.echoes) echo.destroy()
    this.echoes = []
    this.projectiles = []
    this.effects = []
    for (const fighter of this.allFighters()) fighter.reset()
    this.restoreExtraStoryEnemy()
    this.setPhase('countdown')
  }

  private setPhase(phase: Phase, winner?: Slot): void {
    this.phase = phase
    if (phase === 'round_end' || phase === 'match_end') this.stopRoundMotion()
    this.options.room?.sendEvent({ kind: 'phase', matchId: this.matchId, round: this.round,
      phase, timer: this.timer, wins: [...this.wins], winner })
  }

  private stopRoundMotion(): void {
    for (const fighter of this.allFighters()) fighter.stopRoundMotion()
  }

  private restoreExtraStoryEnemy(): void {
    if (!this.extraStoryEnemy) return
    this.extraStoryEnemy.body.enable = true
    this.extraStoryEnemy.teleport(610, WORLD.floorY - 28)
    this.extraStoryEnemy.sprite.setAlpha(1)
    this.extraStoryAI = new StoryAI('easy')
  }

  private snapshot(): Snapshot {
    return { matchId: this.matchId, round: this.round, tick: this.tick, phase: this.phase,
      timer: this.timer, phaseFrames: this.phaseFrames, wins: [...this.wins], fighters: [this.fighters[0].state(), this.fighters[1].state()],
      projectiles: this.projectiles.map(projectile => ({ ...projectile })), ack: this.remoteSeq }
  }

  private onInput(packet: InputPacket): void {
    if (this.options.room?.slot !== 1 || this.phase !== 'playing') return
    if (!packet || packet.matchId !== this.matchId || packet.round !== this.round ||
      !Number.isSafeInteger(packet.seq) || packet.seq <= this.remoteSeq || packet.seq > this.remoteSeq + 1000) return
    if (!packet.held || !packet.pressed) return
    this.remoteSeq = packet.seq
    for (const key of Object.keys(EMPTY_CONTROLS) as (keyof Controls)[]) {
      this.latestRemote[key] = packet.held[key] === true
      this.remotePressed[key] ||= packet.pressed[key] === true
    }
  }

  private onSnapshot(snapshot: Snapshot): void {
    if (this.options.room?.slot !== 2 || !snapshot?.fighters || !Array.isArray(snapshot.fighters) ||
      snapshot.fighters.length !== 2 || !Number.isFinite(snapshot.tick) ||
      typeof snapshot.matchId !== 'string' || !Array.isArray(snapshot.wins) || snapshot.wins.length !== 2 ||
      !Number.isFinite(snapshot.timer) || !Number.isFinite(snapshot.phaseFrames)) return
    if (snapshot.matchId === this.matchId && snapshot.tick < this.lastSnapshotTick) return
    if (this.matchId !== snapshot.matchId) {
      this.matchId = snapshot.matchId
      this.tick = snapshot.tick
      this.round = snapshot.round
      this.wins = [...snapshot.wins]
      this.hitLedger.clear()
      this.rematchReady.clear()
      this.announcedMatchEnd = false
      for (const echo of this.echoes) echo.destroy()
      this.echoes = []
      this.projectiles = []
      this.fighters[1].reset()
      this.options.onNewMatch()
      this.focusCanvas()
    }
    if (snapshot.round !== this.round) {
      this.round = snapshot.round
      this.fighters[1].reset()
      this.hitLedger.clear()
      for (const echo of this.echoes) echo.destroy()
      this.echoes = []
      this.projectiles = []
    }
    this.tick = Math.max(this.tick, snapshot.tick)
    this.lastSnapshotTick = snapshot.tick
    this.phase = snapshot.phase
    this.timer = snapshot.timer
    this.phaseFrames = snapshot.phaseFrames
    this.wins = [...snapshot.wins]
    this.projectiles = Array.isArray(snapshot.projectiles) ? snapshot.projectiles.map(projectile => ({ ...projectile })) : []
    this.remoteTarget = snapshot.fighters[0]
    const local = this.fighters[1]
    const state = snapshot.fighters[1]
    if (Math.abs(local.x - state.x) > 85 || Math.abs(local.y - state.y) > 85) {
      local.applyState(state, true)
    } else {
      local.sprite.setPosition(Phaser.Math.Linear(local.x, state.x, 0.12), Phaser.Math.Linear(local.y, state.y, 0.12))
      local.body.updateFromGameObject()
      local.hp = state.hp
      local.hurtCooldown = state.hurtCooldown
      local.echoCooldown = state.echoCooldown
      local.skillCooldown = state.skillCooldown
      local.shieldFrames = state.shieldFrames
      local.dashCooldown = state.dashCooldown
    }
    if (this.phase === 'round_end' || this.phase === 'match_end') this.stopRoundMotion()
    if (this.phase === 'match_end') this.announceMatchEnd()
  }

  private onEvent(event: MatchEvent): void {
    if (!event || !this.options.room) return
    if (event.kind === 'rematch') {
      if (this.options.room.slot === 1 && event.matchId === this.matchId && this.phase === 'match_end') {
        this.rematchReady.add(event.slot)
        this.startRematchIfReady()
      }
      return
    }
    if (this.options.room.slot !== 2) return
    if (event.kind === 'echo') {
      const packet = event.echo
      if (packet.matchId !== this.matchId || packet.round !== this.round ||
        packet.frames.length !== RULES.echoFrames || this.echoes.some(echo => echo.packet.echoId === packet.echoId)) return
      const owner = this.fighters[packet.owner - 1]
      const echo = new Echo(this, packet, owner.loadout.weapon, owner.loadout.character, owner.loadout.attack, owner.color, owner.loadout.hat)
      echo.seek(Math.max(0, this.tick - packet.startTick))
      this.echoes.push(echo)
      soundFX.play('echo')
    } else if (event.matchId === this.matchId && event.round === this.round && event.kind === 'hit') {
      if (!this.hitLedger.acceptRemote(event.id)) return
      this.fighters[event.target - 1].applyHit(event.hp, event.knockbackX, event.knockbackY, event.blocked)
      soundFX.play(event.blocked ? 'skill' : 'hit')
      if (!event.blocked) this.cameras.main.shake(65, 0.003)
    } else if (event.kind === 'skill' && event.matchId === this.matchId && event.round === this.round) {
      const fighter = this.fighters[event.slot - 1]
      if (event.skill === 'blink' || event.skill === 'echo_swap') fighter.teleport(event.x, event.y)
      if (event.skill === 'shield') fighter.shieldFrames = 48
      if (event.skill === 'shockwave') this.effects.push({ x: event.x, y: event.y, radius: 155, frames: 20, color: fighter.color })
      if (event.skill === 'spring') this.effects.push({ x: event.x, y: event.y + 22, radius: 34, frames: 18, color: fighter.color })
      if (event.skill === 'echo_charge') this.effects.push({ x: event.x, y: event.y, radius: 65, frames: 22, color: fighter.color })
      if (event.skill === 'echo_swap' && event.echoId !== undefined) {
        const echo = this.echoes.find(item => item.owner === event.slot && item.packet.echoId === event.echoId)
        if (echo && event.echoX !== undefined && event.echoY !== undefined) echo.relocate(event.echoX, event.echoY)
      }
      fighter.skillCooldown = SKILLS[event.skill].cooldown
    } else if (event.kind === 'phase' && event.matchId === this.matchId) {
      this.phase = event.phase
      if (event.phase === 'round_end' || event.phase === 'match_end') this.stopRoundMotion()
      this.timer = event.timer
      this.wins = [...event.wins]
      if (event.phase === 'match_end') soundFX.play('match')
      else if (event.phase === 'round_end') soundFX.play('round')
      if (event.phase === 'match_end') this.announceMatchEnd()
    }
  }

  private announceMatchEnd(): void {
    if (this.announcedMatchEnd) return
    this.announcedMatchEnd = true
    const won = this.wins[1] > this.wins[0]
    this.options.onMatchEnd(won ? '勝利' : '敗北', won ? 'win' : 'loss', false)
  }

  private onPresence(count: number): void {
    if (count >= 2) {
      if (this.absenceTimer) this.options.onReconnect?.()
      if (this.absenceTimer) window.clearTimeout(this.absenceTimer)
      this.absenceTimer = undefined
    } else if (!this.absenceTimer) {
      this.absenceTimer = window.setTimeout(() => this.options.onDisconnect(), 6000)
    }
  }

  private onConnection(connected: boolean): void {
    if (connected && this.connectionLost) this.options.onReconnect?.()
    this.connectionLost = !connected
    if (connected) {
      if (this.absenceTimer) window.clearTimeout(this.absenceTimer)
      this.absenceTimer = undefined
    } else if (!this.absenceTimer) {
      this.absenceTimer = window.setTimeout(() => this.options.onDisconnect(), 6000)
    }
  }

  requestRematch(): void {
    if (this.phase !== 'match_end') return
    const slot = this.options.room?.slot ?? 1
    this.rematchReady.add(slot)
    if (!this.options.room) { this.startFreshMatch(); return }
    this.options.room.sendEvent({ kind: 'rematch', matchId: this.matchId, slot })
    this.startRematchIfReady()
  }

  private startRematchIfReady(): void {
    if (this.options.room?.slot === 1 && this.rematchReady.has(1) && this.rematchReady.has(2)) {
      this.startFreshMatch()
    }
  }

  private startFreshMatch(): void {
    this.matchId = crypto.randomUUID()
    this.wins = [0, 0]
    this.round = 1
    this.timer = RULES.roundFrames
    this.phaseFrames = RULES.countdownFrames
    this.hitLedger.clear()
    this.challenge?.reset()
    this.challengeFlashFrames = 0
    this.mechanicFlashFrames = 0
    this.pulseCooldown = BONUS_CONFIG.pulseFirst
    this.pulseWarning = 0
    this.pulseFlashFrames = 0
    this.rematchReady.clear()
    this.announcedMatchEnd = false
    this.lastSnapshotTick = -1
    this.inputSeq = 0
    this.remoteSeq = 0
    for (const echo of this.echoes) echo.destroy()
    this.echoes = []
    this.projectiles = []
    this.effects = []
    for (const fighter of this.allFighters()) fighter.reset()
    this.restoreExtraStoryEnemy()
    this.setPhase('countdown')
    this.options.room?.sendSnapshot(this.snapshot())
    this.options.onNewMatch()
    this.focusCanvas()
  }

  private focusCanvas(): void {
    const canvas = this.game.canvas
    canvas.tabIndex = 0
    canvas.focus({ preventScroll: true })
  }

  private renderHUD(): void {
    if (!this.fighters) return
    this.hud.clear()
    this.attacks.clear()
    const [p1, p2] = this.fighters
    this.drawBar(30, 32, p1.hp, p1.maxHp, p1.color, false)
    this.drawBar(670, 32, p2.hp, p2.maxHp, p2.color, true)
    if (this.extraStoryEnemy) {
      this.drawBar(670, 62, this.extraStoryEnemy.hp, this.extraStoryEnemy.maxHp, this.extraStoryEnemy.color, true)
      this.rightText.setText(`${this.options.story?.enemyName} / 上:赤 下:桃`)
    }
    if (this.storyAI && this.options.story?.boss) this.rightText.setText(`${this.options.story.enemyName} / 後半 ${this.storyAI.phase(p2)}`)
    if (!this.extraStoryEnemy) {
      for (let n = 0; n < this.wins[0]; n++) this.hud.fillStyle(p1.color).fillCircle(44 + n * 18, 80, 6)
      for (let n = 0; n < this.wins[1]; n++) this.hud.fillStyle(p2.color).fillCircle(916 - n * 18, 80, 6)
    }
    this.topText.setText(`${Math.ceil(this.timer / 60)}`)
    this.challengeText.setText(this.pulseWarning > 0 ? '地面に衝撃波！ ジャンプでよけよう' :
      this.challengeFlashFrames > 0 ? `称号チャレンジ達成！  ${this.challenge?.challenge.title}` :
      this.mechanicFlashFrames > 0 ? '本体の攻撃は効かない！' :
        this.options.story?.mechanic?.kind === 'echo_only' ? '分身の攻撃だけが有効' :
          this.options.story?.mechanic?.kind === 'duo' ? '2人とも倒そう' : '')
    const local = this.fighters[(this.options.room?.slot ?? 1) - 1]
    const echoLabel = !local.recorder.ready()
      ? `記録中 ${Math.ceil(local.recorder.remaining() / 60)}s`
      : local.echoCooldown ? `分身 ${Math.ceil(local.echoCooldown / 60)}秒` : '分身 OK'
    const skillName = SKILLS[local.loadout.skill].name
    const skillLabel = local.skillCooldown ? `${skillName} ${Math.ceil(local.skillCooldown / 60)}s` :
      local.loadout.skill === 'echo_swap' && !this.echoes.some(echo => echo.owner === local.slot) ? `${skillName} / 分身が必要` : `${skillName} OK`
    this.bottomText.setText(this.connectionLost ? '接続が切れました。再接続しています…' :
      `${echoLabel}    •    ${skillLabel}    •    A/D 移動  SPACE ジャンプ  S 降下  J 攻撃  K ダッシュ  L 分身  I スキル`)
    if (this.phase === 'countdown') this.centerText.setText(this.matchId ? `${Math.max(1, Math.ceil(this.phaseFrames / 60))}` : '接続中')
    else if (this.phase === 'round_end') this.centerText.setText('ラウンド終了')
    else if (this.phase === 'match_end') this.centerText.setText('対戦終了')
    else this.centerText.setText('')
    for (const fighter of this.allFighters()) {
      if (fighter.shieldFrames > 0) this.attacks.lineStyle(3, fighter.color, 0.8).strokeCircle(fighter.x, fighter.y, 42)
      if (fighter.loadout.weapon !== 'blaster' && fighter.isAttacking) this.drawAttack(fighter.x, fighter.y, fighter.facing,
        fighter.loadout.weapon, fighter.color, 0.8, fighter.attackFrame, fighter.loadout.attack)
    }
    for (const echo of this.echoes) if (echo.isAttacking && echo.weapon !== 'blaster') this.drawAttack(echo.x, echo.y, echo.facing, echo.weapon,
      this.fighters[echo.owner - 1].color, 0.36, echo.attackFrame, echo.attack)
    for (const projectile of this.projectiles) {
      const color = this.fighters[projectile.owner - 1].color
      this.attacks.fillStyle(color, 0.18).fillCircle(projectile.x, projectile.y, 14)
      this.attacks.fillStyle(color, 0.95).fillCircle(projectile.x, projectile.y, 7)
    }
    for (const effect of this.effects) this.attacks.lineStyle(3, effect.color, effect.frames / 20)
      .strokeCircle(effect.x, effect.y, effect.radius * (1 - effect.frames / 30))
    if (this.pulseWarning > 0 || this.pulseFlashFrames > 0) {
      const left = Math.max(0, this.pulseOriginX - BONUS_CONFIG.pulseRadius)
      const right = Math.min(WORLD.width, this.pulseOriginX + BONUS_CONFIG.pulseRadius)
      const flashing = this.pulseFlashFrames > 0
      this.attacks.fillStyle(flashing ? 0xe3b2ff : 0xc97dff, flashing ? 0.4 : 0.14)
        .fillRect(left, WORLD.floorY - 67, right - left, 67)
      this.attacks.lineStyle(flashing ? 5 : 3, 0xe5b8ff, flashing ? 0.95 : 0.65)
        .lineBetween(left, WORLD.floorY - 67, right, WORLD.floorY - 67)
    }
  }

  private drawBar(x: number, y: number, hp: number, maxHp: number, color: number, reverse: boolean): void {
    this.hud.fillStyle(0x263448).fillRoundedRect(x, y, 260, 21, 4)
    this.hud.fillStyle(color).fillRoundedRect(reverse ? x + 260 - 260 * hp / maxHp : x,
      y, 260 * hp / maxHp, 21, 4)
  }

  private drawAttack(x: number, y: number, facing: -1 | 1, weapon: Weapon, color: number, alpha: number,
    frame: number, attack?: AttackStyle): void {
    const config = attackFor(weapon, attack)
    const progress = Math.min(1, Math.max(0, (frame - config.startup - 1) / Math.max(1, config.active - 1)))
    if (weapon === 'yoyo' && attack !== 'yoyo_high') {
      const distance = 55 + (config.reach - 55) * (0.6 + progress * 0.4)
      const tipX = x + facing * distance
      this.attacks.lineStyle(2, color, alpha * 0.8).lineBetween(x + facing * 28, y - 6, tipX, y - 6)
      this.attacks.lineStyle(4, color, alpha).strokeCircle(tipX, y - 6, 9)
      this.attacks.lineStyle(2, 0xffffff, alpha).strokeCircle(tipX, y - 6, 4)
      return
    }
    if (weapon === 'whip') {
      this.attacks.lineStyle(4, color, alpha).beginPath()
      for (let index = 0; index <= 8; index++) {
        const fraction = index / 8
        const px = x + facing * (24 + fraction * config.reach * (0.8 + progress * 0.2))
        const py = y - 7 + Math.sin(fraction * Math.PI * 2 - progress * Math.PI) * (11 + fraction * 12)
        if (index === 0) this.attacks.moveTo(px, py)
        else this.attacks.lineTo(px, py)
      }
      this.attacks.strokePath()
      return
    }
    if (weapon === 'spear' && attack !== 'spear_sweep' || weapon === 'dagger') {
      const near = weapon === 'spear' ? 38 : 26
      const far = near + (config.reach - near) * (0.7 + progress * 0.3)
      this.attacks.lineStyle(weapon === 'spear' ? 4 : 3, color, alpha)
        .lineBetween(x + facing * near, y - 5, x + facing * far, y - 5)
      this.attacks.fillStyle(0xffffff, alpha).fillTriangle(x + facing * (far + 10), y - 5,
        x + facing * (far - 4), y - 10, x + facing * (far - 4), y)
      return
    }
    const radius = weapon === 'scythe' ? 94 : weapon === 'hammer' ? 69 : weapon === 'fan' ? 53 : weapon === 'spear' ? 80 : weapon === 'yoyo' ? 77 :
      attack === 'heavy_slash' ? 73 : attack === 'upper_slash' ? 57 : 64
    const firstAngle = weaponPose(weapon, attack, config.startup + 1).rotation
    const lastAngle = weaponPose(weapon, attack, frame).rotation
    const trail = Math.max(0.15, Math.abs(lastAngle - firstAngle))
    const start = lastAngle - Math.sign(lastAngle - firstAngle || 1) * Math.min(trail, 0.65)
    const drawArc = (distance: number, width: number, opacity: number): void => {
      this.attacks.lineStyle(width, color, opacity).beginPath()
      for (let index = 0; index <= 8; index++) {
        const angle = start + (lastAngle - start) * index / 8
        const px = x + facing * (10 + Math.cos(angle) * distance)
        const py = y - 4 + Math.sin(angle) * distance
        if (index === 0) this.attacks.moveTo(px, py)
        else this.attacks.lineTo(px, py)
      }
      this.attacks.strokePath()
    }
    drawArc(radius, weapon === 'hammer' ? 7 : 5, alpha * 0.55)
    drawArc(radius + 5, 2, alpha)
    if (weapon === 'fan') { drawArc(radius - 13, 2, alpha * 0.75); drawArc(radius + 14, 2, alpha * 0.55) }
    if (weapon === 'hammer') {
      const tipX = x + facing * (10 + Math.cos(lastAngle) * radius)
      const tipY = y - 4 + Math.sin(lastAngle) * radius
      this.attacks.lineStyle(2, 0xffffff, alpha * 0.7).strokeCircle(tipX, tipY, 8 + progress * 10)
    }
  }
}
