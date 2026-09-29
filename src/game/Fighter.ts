import Phaser from 'phaser'
import { attackCycleFrames, attackFor, CHARACTERS, nextAirJumpUse } from './balance'
import { EchoRecorder } from './EchoRecorder'
import { WORLD, type Controls, type FighterState, type Frame, type Loadout, type Slot } from './types'
import { COLORS } from '../progression/catalog'
import { resetFighterBody } from './position'
import { ensureFighterArt } from './FighterArt'
import { placeWeapon } from './AttackVisual'

const WIDTH = 34
const HEIGHT = 56
export class Fighter {
  readonly sprite: Phaser.Physics.Arcade.Sprite
  private readonly weaponSprite: Phaser.GameObjects.Sprite
  private readonly hatSprite: Phaser.GameObjects.Sprite
  readonly recorder = new EchoRecorder()
  readonly slot: Slot
  readonly color: number
  readonly loadout: Loadout
  readonly maxHp: number
  hp: number
  facing: -1 | 1
  attackFrame = 0
  attackId = 0
  dashFrames = 0
  dashCooldown = 0
  echoCooldown = 0
  skillCooldown = 0
  shieldFrames = 0
  dropFrames = 0
  stunFrames = 0
  hurtCooldown = 0
  airJumpsUsed = 0

  constructor(scene: Phaser.Scene, slot: Slot, loadout: Loadout, hpMultiplier = 1) {
    this.slot = slot
    this.loadout = loadout
    this.maxHp = Math.round(CHARACTERS[loadout.character].hp * hpMultiplier)
    this.hp = this.maxHp
    this.color = loadout.color && loadout.color !== 'default' && COLORS[loadout.color]
      ? COLORS[loadout.color].hex : slot === 1 ? 0x58e5e1 : 0xff6b6f
    this.facing = slot === 1 ? 1 : -1
    const x = slot === 1 ? 210 : 750
    const art = ensureFighterArt(scene, loadout, this.color)
    this.sprite = scene.physics.add.sprite(x, WORLD.floorY - HEIGHT / 2, art.body)
    this.sprite.setDepth(4).setCollideWorldBounds(true).setDragX(0).setMaxVelocity(1000, 1000)
    this.sprite.body?.setSize(WIDTH, HEIGHT)
    this.weaponSprite = scene.add.sprite(x, this.sprite.y, art.weapon).setDepth(5)
    this.hatSprite = scene.add.sprite(x, this.sprite.y, art.hat).setDepth(6)
    scene.events.on(Phaser.Scenes.Events.POST_UPDATE, this.syncArt, this)
  }

  get body(): Phaser.Physics.Arcade.Body { return this.sprite.body as Phaser.Physics.Arcade.Body }
  get x(): number { return this.sprite.x }
  get y(): number { return this.sprite.y }
  get grounded(): boolean { return this.body.blocked.down || this.body.touching.down }
  get weapon() { return attackFor(this.loadout.weapon, this.loadout.attack) }
  get isAttacking(): boolean {
    return this.attackFrame >= this.weapon.startup + 1 && this.attackFrame <= this.weapon.startup + this.weapon.active
  }
  get firesProjectile(): boolean { return this.loadout.weapon === 'blaster' && this.attackFrame === this.weapon.startup + 1 }

  step(held: Controls, pressed: Controls): void {
    if (this.hp <= 0) { this.body.setVelocityX(0); return }
    this.dashCooldown = Math.max(0, this.dashCooldown - 1)
    this.echoCooldown = Math.max(0, this.echoCooldown - 1)
    this.skillCooldown = Math.max(0, this.skillCooldown - 1)
    this.shieldFrames = Math.max(0, this.shieldFrames - 1)
    this.dropFrames = Math.max(0, this.dropFrames - 1)
    this.stunFrames = Math.max(0, this.stunFrames - 1)
    this.hurtCooldown = Math.max(0, this.hurtCooldown - 1)
    if (this.attackFrame > 0) this.attackFrame = this.attackFrame >= attackCycleFrames(this.loadout) ? 0 : this.attackFrame + 1
    if (this.dashFrames > 0) this.dashFrames--
    const config = CHARACTERS[this.loadout.character]
    const grounded = this.grounded
    if (grounded) this.airJumpsUsed = 0
    const direction = Number(held.right) - Number(held.left)
    if (direction !== 0 && this.dashFrames === 0 && this.stunFrames === 0) this.facing = direction as -1 | 1
    if (this.stunFrames === 0) {
      if (pressed.dash && this.dashCooldown === 0) { this.dashFrames = 9; this.dashCooldown = 80 }
      this.body.setVelocityX(this.dashFrames > 0 ? this.facing * config.dashSpeed :
        direction * (grounded ? config.moveSpeed : config.airSpeed))
      if (pressed.jump && this.dropFrames === 0) {
        const nextJump = nextAirJumpUse(this.loadout.character, grounded, this.airJumpsUsed)
        if (nextJump !== undefined) {
          this.airJumpsUsed = nextJump
          this.body.setVelocityY(-config.jumpSpeed)
        }
      }
      if (pressed.attack && this.attackFrame === 0) { this.attackFrame = 1; this.attackId++ }
    }
    this.sprite.setFlipX(this.facing < 0)
    this.sprite.setAlpha(this.hurtCooldown > 0 && this.hurtCooldown % 6 < 3 ? 0.55 : 1)
  }

  teleport(x: number, y = this.y): void {
    resetFighterBody(this.body, x, y)
  }
  blink(other: Fighter): boolean {
    for (let distance = 128; distance >= 32; distance -= 16) {
      const next = Phaser.Math.Clamp(this.x + this.facing * distance, 32, WORLD.width - 32)
      if (Math.abs(next - other.x) < WIDTH + 8 && Math.abs(this.y - other.y) < HEIGHT) continue
      this.teleport(next)
      return true
    }
    return false
  }
  hit(damage: number, direction: -1 | 1, force = 1): { x: number; y: number; blocked: boolean } {
    if (this.shieldFrames > 0) return { x: 0, y: 0, blocked: true }
    this.hp = Math.max(0, this.hp - damage)
    const resistance = CHARACTERS[this.loadout.character].knockback
    const x = direction * 330 * resistance * force
    const y = -205 * resistance * force
    this.body.setVelocity(x, y)
    this.stunFrames = 13
    this.hurtCooldown = 30
    this.dashFrames = 0
    return { x, y, blocked: false }
  }
  applyHit(hp: number, x: number, y: number, blocked = false): void {
    this.hp = Math.max(0, Math.min(this.maxHp, hp))
    if (blocked) return
    this.body.setVelocity(x, y)
    this.stunFrames = 13
    this.hurtCooldown = 30
    this.dashFrames = 0
  }
  frame(): Frame {
    return { x: Math.round(this.x * 10) / 10, y: Math.round(this.y * 10) / 10,
      vx: Math.round(this.body.velocity.x), vy: Math.round(this.body.velocity.y), facing: this.facing,
      attackFrame: this.attackFrame, attackId: this.attackId, dash: this.dashFrames > 0 }
  }
  state(): FighterState {
    return { ...this.frame(), hp: this.hp, hurtCooldown: this.hurtCooldown, echoCooldown: this.echoCooldown,
      dashCooldown: this.dashCooldown, skillCooldown: this.skillCooldown, shieldFrames: this.shieldFrames,
      grounded: this.grounded, airJumpsUsed: this.airJumpsUsed }
  }
  applyState(state: FighterState, snapPosition: boolean): void {
    if (snapPosition) this.sprite.setPosition(state.x, state.y)
    this.body.setVelocity(state.vx, state.vy)
    this.hp = state.hp; this.hurtCooldown = state.hurtCooldown; this.facing = state.facing
    this.attackFrame = state.attackFrame; this.attackId = state.attackId
    this.echoCooldown = state.echoCooldown; this.dashCooldown = state.dashCooldown
    this.skillCooldown = state.skillCooldown; this.shieldFrames = state.shieldFrames
    this.airJumpsUsed = state.airJumpsUsed ?? 0
    this.sprite.setFlipX(this.facing < 0)
  }
  interpolateTo(state: FighterState, factor: number): void {
    this.sprite.setPosition(Phaser.Math.Linear(this.x, state.x, factor), Phaser.Math.Linear(this.y, state.y, factor))
    this.body.updateFromGameObject()
    this.facing = state.facing; this.attackFrame = state.attackFrame; this.attackId = state.attackId
    this.hp = state.hp; this.hurtCooldown = state.hurtCooldown; this.shieldFrames = state.shieldFrames
    this.airJumpsUsed = state.airJumpsUsed ?? 0
    this.sprite.setFlipX(this.facing < 0)
  }
  record(): void { this.recorder.push(this.frame()) }
  stopRoundMotion(): void {
    this.body.setVelocityX(0)
    this.body.setAccelerationX(0)
    this.dashFrames = 0
    this.attackFrame = 0
  }
  private syncArt(): void {
    placeWeapon(this.weaponSprite, this.x, this.y, this.facing, this.loadout.weapon, this.loadout.attack, this.attackFrame)
    this.weaponSprite.setAlpha(this.sprite.alpha)
    this.hatSprite.setPosition(this.x, this.y).setFlipX(this.facing < 0).setAlpha(this.sprite.alpha)
  }
  reset(): void {
    this.hp = this.maxHp
    this.facing = this.slot === 1 ? 1 : -1
    this.attackFrame = 0; this.attackId = 0; this.dashFrames = 0; this.dashCooldown = 0
    this.echoCooldown = 0; this.skillCooldown = 0; this.shieldFrames = 0
    this.dropFrames = 0; this.stunFrames = 0; this.hurtCooldown = 0
    this.airJumpsUsed = 0
    this.recorder.clear()
    this.teleport(this.slot === 1 ? 210 : 750, WORLD.floorY - HEIGHT / 2)
  }
  destroy(): void {
    this.sprite.scene.events.off(Phaser.Scenes.Events.POST_UPDATE, this.syncArt, this)
    this.weaponSprite.destroy(); this.hatSprite.destroy(); this.sprite.destroy()
  }
}
