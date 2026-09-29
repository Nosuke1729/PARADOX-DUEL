import Phaser from 'phaser'
import { attackFor } from './balance'
import { type AttackStyle, type Character, type EchoPacket, type Frame, type Slot, type Weapon } from './types'
import { clampFighterPosition } from './position'
import { ensureFighterArt } from './FighterArt'

export class Echo {
  readonly packet: EchoPacket
  readonly sprite: Phaser.GameObjects.Sprite
  private readonly weaponSprite: Phaser.GameObjects.Sprite
  private readonly hatSprite: Phaser.GameObjects.Sprite
  private readonly outline: Phaser.GameObjects.Graphics
  readonly owner: Slot
  readonly weapon: Weapon
  readonly attack?: AttackStyle
  private index = 0
  private current: Frame
  private offsetX = 0
  private offsetY = 0
  constructor(scene: Phaser.Scene, packet: EchoPacket, weapon: Weapon, character: Character, attack?: AttackStyle, private readonly color = packet.owner === 1 ? 0x58e5e1 : 0xff6b6f, hat = 'none') {
    this.packet = packet; this.owner = packet.owner; this.weapon = weapon; this.attack = attack
    this.current = packet.frames[0]
    const art = ensureFighterArt(scene, { character, weapon, hat }, this.color)
    this.sprite = scene.add.sprite(this.current.x, this.current.y, art.body).setAlpha(0.38).setDepth(4)
    this.weaponSprite = scene.add.sprite(this.current.x, this.current.y, art.weapon).setAlpha(0.38).setDepth(5)
    this.hatSprite = scene.add.sprite(this.current.x, this.current.y, art.hat).setAlpha(0.38).setDepth(6)
    this.outline = scene.add.graphics().setDepth(5)
    this.drawOutline()
  }
  get x(): number { return clampFighterPosition(this.current.x + this.offsetX, this.current.y + this.offsetY).x }
  get y(): number { return clampFighterPosition(this.current.x + this.offsetX, this.current.y + this.offsetY).y }
  get facing(): -1 | 1 { return this.current.facing }
  get attackId(): number { return this.current.attackId }
  get isAttacking(): boolean {
    const config = attackFor(this.weapon, this.attack)
    return this.current.attackFrame >= config.startup + 1 && this.current.attackFrame <= config.startup + config.active
  }
  get firesProjectile(): boolean { return this.weapon === 'blaster' && this.current.attackFrame === attackFor(this.weapon, this.attack).startup + 1 }
  get finished(): boolean { return this.index >= this.packet.frames.length }
  step(): void {
    if (this.finished) return
    this.current = this.packet.frames[this.index++]
    this.syncArt()
    this.drawOutline()
  }
  seek(index: number): void { this.index = Phaser.Math.Clamp(index, 0, this.packet.frames.length); if (!this.finished) this.step() }
  relocate(x: number, y: number): void {
    this.offsetX = x - this.current.x; this.offsetY = y - this.current.y
    this.syncArt()
    this.drawOutline()
  }
  private syncArt(): void {
    for (const part of [this.sprite, this.weaponSprite, this.hatSprite])
      part.setPosition(this.x, this.y).setFlipX(this.current.facing < 0)
  }
  private drawOutline(): void {
    const color = this.color
    this.outline.clear().lineStyle(2, color, 0.85).strokeRoundedRect(this.x - 22, this.y - 32, 44, 64, 5)
    this.outline.fillStyle(color, 0.65).fillTriangle(this.x - 5, this.y - 43, this.x + 5, this.y - 43, this.x, this.y - 35)
  }
  destroy(): void { this.sprite.destroy(); this.weaponSprite.destroy(); this.hatSprite.destroy(); this.outline.destroy() }
}
