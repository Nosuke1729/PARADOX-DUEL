import Phaser from 'phaser'
import { Echo } from './Echo'
import { Fighter } from './Fighter'
import { HitLedger, attackRect, hurtRect, projectileRect } from './CombatMath'
import { attackFor, CHARACTERS, SKILLS, WEAPONS, damageFor, winnerByHealth } from './balance'
import { InputManager } from './InputManager'
import { soundFX } from './SoundFX'
import { EMPTY_CONTROLS, RULES, WORLD, type AttackStyle, type Controls, type EchoPacket, type FighterState, type Loadout, type MatchEvent, type Phase, type ProjectileState, type Slot, type Snapshot } from './types'
import type { InputPacket, RoomManager } from '../network/RoomManager'
import { StoryAI } from '../story/StoryAI'
import type { StoryChapter } from '../story/chapters'

export interface BattleOptions {
  mode: 'practice' | 'online' | 'story'
  story?: StoryChapter
  room?: RoomManager
  playerNames?: [string, string]
  loadouts: [Loadout, Loadout]
  onMatchEnd: (message: string, result: 'win' | 'loss' | 'draw') => void
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
  private hud!: Phaser.GameObjects.Graphics
  private attacks!: Phaser.GameObjects.Graphics
  private topText!: Phaser.GameObjects.Text
  private centerText!: Phaser.GameObjects.Text
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

  constructor(options: BattleOptions) {
    super('Battle')
    this.options = options
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#090d17')
    this.focusCanvas()
    this.physics.world.setBounds(0, 0, WORLD.width, WORLD.height)
    this.drawStage()
    this.createFighterTexture()
    this.fighters = [new Fighter(this, 1, this.options.loadouts[0]),
      new Fighter(this, 2, this.options.loadouts[1], this.options.story?.boss?.hpMultiplier ?? 1)]
    if (this.options.story) this.storyAI = new StoryAI(this.options.story.difficulty, this.options.story.boss)
    const floor = this.add.rectangle(WORLD.width / 2, WORLD.floorY + 22, WORLD.width, 44, 0x152234)
    this.physics.add.existing(floor, true)
    for (const fighter of this.fighters) {
      this.physics.add.collider(fighter.sprite, floor)
      this.physics.add.collider(fighter.sprite, this.platform, undefined, () => {
        const body = fighter.body
        return fighter.dropFrames === 0 && body.velocity.y >= 0 &&
          body.prev.y + body.height <= WORLD.platformY + 8
      })
    }
    this.physics.add.collider(this.fighters[0].sprite, this.fighters[1].sprite)
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
    const g = this.add.graphics()
    g.lineStyle(1, 0x20334b, 0.35)
    for (let x = 0; x <= WORLD.width; x += 48) g.lineBetween(x, 0, x, WORLD.floorY)
    for (let y = 0; y <= WORLD.floorY; y += 48) g.lineBetween(0, y, WORLD.width, y)
    g.fillStyle(0x101b2a).fillRect(0, WORLD.floorY, WORLD.width, WORLD.height - WORLD.floorY)
    g.lineStyle(3, 0x4b6984).lineBetween(0, WORLD.floorY, WORLD.width, WORLD.floorY)
    g.fillStyle(0x213549).fillRoundedRect(WORLD.platformX, WORLD.platformY, WORLD.platformWidth, 13, 3)
    g.lineStyle(2, 0x5e8da6).lineBetween(WORLD.platformX, WORLD.platformY, WORLD.platformX + WORLD.platformWidth, WORLD.platformY)
    g.lineStyle(1, 0x335572, 0.65).lineBetween(480, 76, 480, WORLD.floorY)
    this.platform = this.add.rectangle(WORLD.platformX + WORLD.platformWidth / 2, WORLD.platformY + 6.5, WORLD.platformWidth, 13, 0x213549, 0)
    this.physics.add.existing(this.platform, true)
  }

  private createFighterTexture(): void {
    for (const character of ['standard', 'light', 'heavy'] as const) {
      if (this.textures.exists(`fighter-${character}`)) continue
      const g = this.make.graphics({ x: 0, y: 0 })
      g.fillStyle(0xffffff)
      if (character === 'light') {
        g.fillRoundedRect(9, 3, 18, 20, 6).fillRoundedRect(7, 23, 22, 25, 5)
        g.fillRect(9, 47, 7, 9).fillRect(21, 47, 7, 9)
        g.fillStyle(0x09101a).fillRect(19, 11, 8, 3)
      } else if (character === 'heavy') {
        g.fillRoundedRect(6, 3, 24, 20, 3).fillRoundedRect(1, 22, 34, 29, 3)
        g.fillRect(4, 49, 11, 7).fillRect(21, 49, 11, 7)
        g.fillStyle(0x09101a).fillRect(18, 11, 12, 5)
      } else {
        g.fillRoundedRect(7, 3, 22, 22, 4).fillRoundedRect(3, 24, 30, 26, 3)
        g.fillRect(6, 48, 9, 8).fillRect(21, 48, 9, 8)
        g.fillStyle(0x09101a).fillRect(20, 12, 10, 4)
      }
      g.generateTexture(`fighter-${character}`, 36, 56)
      g.destroy()
    }
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
      const other = this.options.mode === 'story' ? this.storyAI!.input(this.fighters[1], this.fighters[0], this.tick) :
        this.options.mode === 'practice' ? this.botInput() : {
        held: this.latestRemote,
        pressed: this.remotePressed,
      }
      if (local.pressed.attack || other.pressed.attack) soundFX.play('attack')
      if (local.pressed.dash || other.pressed.dash) soundFX.play('dash')
      if (local.pressed.skill || other.pressed.skill) soundFX.play('skill')
      this.fighters[0].step(local.held, local.pressed)
      this.fighters[1].step(other.held, other.pressed)
      if (local.pressed.skill) this.activateSkill(this.fighters[0], this.fighters[1], true)
      if (other.pressed.skill) this.activateSkill(this.fighters[1], this.fighters[0], true)
      this.remotePressed = { ...EMPTY_CONTROLS }
      for (const fighter of this.fighters) {
        if (fighter.dropFrames === 0 && fighter.grounded && local.held.down && fighter.slot === 1 &&
          Math.abs(fighter.y + 28 - WORLD.platformY) < 12) {
          fighter.dropFrames = 16
          fighter.sprite.y += 8
          fighter.body.updateFromGameObject()
          fighter.body.setVelocityY(110)
        }
        if (fighter.slot === 2 && other.held.down && fighter.grounded && fighter.dropFrames === 0 &&
          Math.abs(fighter.y + 28 - WORLD.platformY) < 12) {
          fighter.dropFrames = 16
          fighter.sprite.y += 8
          fighter.body.updateFromGameObject()
          fighter.body.setVelocityY(110)
        }
        fighter.record()
      }
      this.tryEcho(this.fighters[0], local.pressed.echo)
      this.tryEcho(this.fighters[1], other.pressed.echo)
      for (const echo of this.echoes) echo.step()
      this.spawnProjectiles()
      this.resolveCombat()
      this.stepProjectiles()
      this.cleanupEchoes()
      this.effects.forEach(effect => effect.frames--)
      this.effects = this.effects.filter(effect => effect.frames > 0)
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
    const preferred = bot.loadout.weapon === 'spear' ? 120 : bot.loadout.weapon === 'blaster' ? 260 : 77
    const move = Math.abs(distance) > preferred ? toward : Math.abs(distance) < preferred - 35 ? -toward : 0
    const held: Controls = {
      ...EMPTY_CONTROLS,
      left: move < 0,
      right: move > 0,
      attack: Math.abs(distance) < (bot.loadout.weapon === 'blaster' ? 500 : bot.loadout.weapon === 'spear' ? 155 : 98) && Math.abs(player.y - bot.y) < 62 && this.tick % 95 < 2,
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
    if (!pressed || fighter.echoCooldown > 0 || !fighter.recorder.ready() ||
      this.echoes.some(echo => echo.owner === fighter.slot)) return
    const packet: EchoPacket = {
      matchId: this.matchId, round: this.round, owner: fighter.slot,
      echoId: this.tick, startTick: this.tick, frames: fighter.recorder.capture(),
    }
    fighter.echoCooldown = RULES.echoCooldown
    this.echoes.push(new Echo(this, packet, fighter.loadout.weapon, fighter.loadout.character, fighter.loadout.attack))
    soundFX.play('echo')
    this.options.room?.sendEvent({ kind: 'echo', echo: packet })
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
      if (authoritative && Math.hypot(fighter.x - other.x, (fighter.y - other.y) * 1.5) < 155 && other.hurtCooldown === 0) {
        const id = `${this.round}:${fighter.slot}:shockwave:${this.tick}:${other.slot}`
        const direction: -1 | 1 = other.x >= fighter.x ? 1 : -1
        const knock = other.hit(3, direction, 1.5)
        this.options.room?.sendEvent({ kind: 'hit', matchId: this.matchId, round: this.round, id,
          target: other.slot, hp: other.hp, knockbackX: knock.x, knockbackY: knock.y, blocked: knock.blocked })
        soundFX.play(knock.blocked ? 'skill' : 'hit')
        if (other.hp <= 0) this.endRound()
      }
    } else if (skill === 'echo_swap') {
      if (!echo) return
      fighter.teleport(echo.x, echo.y)
      echo.relocate(beforeX, beforeY)
      this.effects.push({ x: fighter.x, y: fighter.y, radius: 45, frames: 18, color: fighter.color })
    }
    fighter.skillCooldown = SKILLS[skill].cooldown
    if (authoritative) this.options.room?.sendEvent({ kind: 'skill', matchId: this.matchId, round: this.round,
      slot: fighter.slot, skill, x: fighter.x, y: fighter.y, echoId: echo?.packet.echoId, echoX: echo?.x, echoY: echo?.y })
  }

  private spawnProjectiles(): void {
    for (const fighter of this.fighters) {
      if (fighter.firesProjectile) this.addProjectile(fighter.slot, fighter.x, fighter.y, fighter.facing,
        `${this.round}:${fighter.slot}:body:${fighter.attackId}`)
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
      const target = this.fighters[projectile.owner === 1 ? 1 : 0]
      if (!this.hitLedger.claim(`${projectile.id}:${target.slot}`, projectileRect(projectile.x, projectile.y),
        hurtRect(target.x, target.y), target.hurtCooldown > 0)) return true
      this.landHit(target, projectile.owner, Math.sign(projectile.vx) as -1 | 1,
        `${projectile.id}:${target.slot}`)
      return false
    })
    this.projectiles = this.phase === 'playing' ? survivors : []
  }

  private landHit(target: Fighter, owner: Slot, facing: -1 | 1, id: string): void {
    const loadout = this.fighters[owner - 1].loadout
    const damage = damageFor(loadout, this.options.mode === 'practice' && owner === 2)
    const knock = target.hit(damage, facing, (loadout.weapon === 'blaster' ? 0.7 : 1) *
      (attackFor(loadout.weapon, loadout.attack).knockback ?? 1))
    soundFX.play(knock.blocked ? 'skill' : 'hit')
    if (!knock.blocked) this.cameras.main.shake(65, 0.003)
    this.options.room?.sendEvent({ kind: 'hit', matchId: this.matchId, round: this.round, id,
      target: target.slot, hp: target.hp, knockbackX: knock.x, knockbackY: knock.y, blocked: knock.blocked })
    if (target.hp <= 0) this.endRound()
  }

  private resolveCombat(): void {
    const attackers = [
      ...this.fighters.map(fighter => ({ owner: fighter.slot, x: fighter.x, y: fighter.y, facing: fighter.facing,
        attackId: fighter.attackId, active: fighter.isAttacking, source: 'body', weapon: fighter.loadout.weapon, attack: fighter.loadout.attack })),
      ...this.echoes.map(echo => ({ owner: echo.owner, x: echo.x, y: echo.y, facing: echo.facing,
        attackId: echo.attackId, active: echo.isAttacking, source: `echo:${echo.packet.echoId}`, weapon: echo.weapon, attack: echo.attack })),
    ]
    for (const attacker of attackers) {
      if (!attacker.active || attacker.weapon === 'blaster') continue
      const target = this.fighters[attacker.owner === 1 ? 1 : 0]
      const id = `${this.round}:${attacker.owner}:${attacker.source}:${attacker.attackId}:${target.slot}`
      if (!this.hitLedger.claim(id, attackRect(attacker.x, attacker.y, attacker.facing, attacker.weapon, attacker.attack),
        hurtRect(target.x, target.y), target.hurtCooldown > 0)) continue
      this.landHit(target, attacker.owner, attacker.facing, id)
      if (this.phase !== 'playing') break
    }
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
    const winner = winnerByHealth([p1.hp, p2.hp], [p1.loadout, p2.loadout], [p1.maxHp, p2.maxHp])
    if (winner) this.wins[winner - 1]++
    this.phaseFrames = 120
    const nextPhase = this.options.mode === 'story' || this.wins.some(wins => wins >= 2) ? 'match_end' : 'round_end'
    soundFX.play(nextPhase === 'match_end' ? 'match' : 'round')
    this.setPhase(nextPhase, winner)
    if (nextPhase === 'match_end') {
      const local = this.options.room?.slot ?? 1
      const message = winner === local ? '勝利' : winner ? '敗北' : '引き分け'
      this.options.onMatchEnd(message, winner === local ? 'win' : winner ? 'loss' : 'draw')
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
    for (const fighter of this.fighters) fighter.reset()
    this.setPhase('countdown')
  }

  private setPhase(phase: Phase, winner?: Slot): void {
    this.phase = phase
    this.options.room?.sendEvent({ kind: 'phase', matchId: this.matchId, round: this.round,
      phase, timer: this.timer, wins: [...this.wins], winner })
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
      const echo = new Echo(this, packet, owner.loadout.weapon, owner.loadout.character, owner.loadout.attack)
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
      if (event.skill === 'echo_swap' && event.echoId !== undefined) {
        const echo = this.echoes.find(item => item.owner === event.slot && item.packet.echoId === event.echoId)
        if (echo && event.echoX !== undefined && event.echoY !== undefined) echo.relocate(event.echoX, event.echoY)
      }
      fighter.skillCooldown = SKILLS[event.skill].cooldown
    } else if (event.kind === 'phase' && event.matchId === this.matchId) {
      this.phase = event.phase
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
    this.options.onMatchEnd(won ? '勝利' : '敗北', won ? 'win' : 'loss')
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
    this.rematchReady.clear()
    this.announcedMatchEnd = false
    this.lastSnapshotTick = -1
    this.inputSeq = 0
    this.remoteSeq = 0
    for (const echo of this.echoes) echo.destroy()
    this.echoes = []
    this.projectiles = []
    this.effects = []
    for (const fighter of this.fighters) fighter.reset()
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
    if (this.storyAI && this.options.story?.boss) this.rightText.setText(`${this.options.story.enemyName} / PHASE ${this.storyAI.phase(p2)}`)
    for (let n = 0; n < this.wins[0]; n++) this.hud.fillStyle(p1.color).fillCircle(44 + n * 18, 80, 6)
    for (let n = 0; n < this.wins[1]; n++) this.hud.fillStyle(p2.color).fillCircle(916 - n * 18, 80, 6)
    this.topText.setText(`${Math.ceil(this.timer / 60)}`)
    const local = this.fighters[(this.options.room?.slot ?? 1) - 1]
    const echoLabel = !local.recorder.ready()
      ? `記録中 ${Math.ceil(local.recorder.remaining() / 60)}s`
      : local.echoCooldown ? `ECHO ${Math.ceil(local.echoCooldown / 60)}s` : 'ECHO READY'
    const skillName = SKILLS[local.loadout.skill].name
    const skillLabel = local.skillCooldown ? `${skillName} ${Math.ceil(local.skillCooldown / 60)}s` :
      local.loadout.skill === 'echo_swap' && !this.echoes.some(echo => echo.owner === local.slot) ? `${skillName} / Echo必要` : `${skillName} READY`
    this.bottomText.setText(this.connectionLost ? '接続が切れました。再接続しています…' :
      `${echoLabel}    •    ${skillLabel}    •    A/D 移動  SPACE ジャンプ  S 降下  J 攻撃  K ダッシュ  L Echo  I Skill`)
    if (this.phase === 'countdown') this.centerText.setText(this.matchId ? `${Math.max(1, Math.ceil(this.phaseFrames / 60))}` : '接続中')
    else if (this.phase === 'round_end') this.centerText.setText('ROUND END')
    else if (this.phase === 'match_end') this.centerText.setText('MATCH END')
    else this.centerText.setText('')
    for (const fighter of this.fighters) {
      if (fighter.shieldFrames > 0) this.attacks.lineStyle(3, fighter.color, 0.8).strokeCircle(fighter.x, fighter.y, 42)
      if (fighter.loadout.weapon !== 'blaster' && fighter.isAttacking) this.drawAttack(fighter.x, fighter.y, fighter.facing, fighter.loadout.weapon, fighter.color, 0.45, fighter.loadout.attack)
      else if (fighter.loadout.weapon !== 'blaster' && fighter.attackFrame > 0 && fighter.attackFrame <= fighter.weapon.startup)
        this.drawAttack(fighter.x, fighter.y, fighter.facing, fighter.loadout.weapon, fighter.color, 0.07, fighter.loadout.attack)
    }
    for (const echo of this.echoes) if (echo.isAttacking && echo.weapon !== 'blaster') this.drawAttack(echo.x, echo.y, echo.facing, echo.weapon,
      echo.owner === 1 ? 0x58e5e1 : 0xff6b6f, 0.22, echo.attack)
    for (const projectile of this.projectiles) {
      const color = projectile.owner === 1 ? 0x58e5e1 : 0xff6b6f
      this.attacks.fillStyle(color, 0.18).fillCircle(projectile.x, projectile.y, 14)
      this.attacks.fillStyle(color, 0.95).fillCircle(projectile.x, projectile.y, 7)
    }
    for (const effect of this.effects) this.attacks.lineStyle(3, effect.color, effect.frames / 20)
      .strokeCircle(effect.x, effect.y, effect.radius * (1 - effect.frames / 30))
  }

  private drawBar(x: number, y: number, hp: number, maxHp: number, color: number, reverse: boolean): void {
    this.hud.fillStyle(0x263448).fillRoundedRect(x, y, 260, 21, 4)
    this.hud.fillStyle(color).fillRoundedRect(reverse ? x + 260 - 260 * hp / maxHp : x,
      y, 260 * hp / maxHp, 21, 4)
  }

  private drawAttack(x: number, y: number, facing: -1 | 1, weapon: 'sword' | 'spear', color: number, alpha: number, attack?: AttackStyle): void {
    const rect = attackRect(x, y, facing, weapon, attack)
    this.attacks.fillStyle(color, alpha).fillRoundedRect(rect.x, rect.y, rect.width, rect.height, 8)
    this.attacks.lineStyle(2, color, alpha + 0.35).strokeRoundedRect(rect.x, rect.y, rect.width, rect.height, 8)
  }
}
