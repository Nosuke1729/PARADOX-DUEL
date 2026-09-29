import type Phaser from 'phaser'
import { attackFor } from './balance'
import type { AttackStyle, Weapon } from './types'

export interface WeaponPose { rotation: number; stretch: number }

const mix = (from: number, to: number, amount: number): number => from + (to - from) * Math.max(0, Math.min(1, amount))

// Angles are for a fighter facing right. The whole arm and weapon rotate around
// the shoulder; its screen position is corrected below so the arm stays joined.
export function weaponPose(weapon: Weapon, attack: AttackStyle | undefined, frame: number): WeaponPose {
  if (frame <= 0) return { rotation: 0, stretch: 1 }
  const timing = attackFor(weapon, attack)
  const startup = Math.min(1, frame / timing.startup)
  const swing = Math.min(1, Math.max(0, (frame - timing.startup - 1) / Math.max(1, timing.active - 1)))
  const recovery = Math.min(1, Math.max(0, (frame - timing.startup - timing.active) /
    Math.max(1, timing.total - timing.startup - timing.active)))
  const upper = attack === 'upper_slash' || attack === 'hammer_upper'
  const sweep = attack === 'spear_sweep'
  const wide = attack === 'heavy_slash' || weapon === 'hammer'
  const windup = upper ? 0.65 : wide ? -1.05 : sweep ? -0.6 : weapon === 'fan' ? -0.8 : -0.5
  const follow = upper ? -1.0 : wide ? 0.85 : sweep ? 0.55 : weapon === 'fan' ? 0.7 : 0.45
  if (weapon === 'blaster') {
    const recoil = frame <= timing.startup ? 0 : frame <= timing.startup + timing.active ? 1 : 1 - recovery
    return { rotation: mix(0, -0.1, recoil), stretch: 1 - 0.08 * recoil }
  }
  if (weapon === 'spear' && !sweep || weapon === 'dagger') {
    const thrust = frame <= timing.startup ? mix(0, -0.14, startup) :
      frame <= timing.startup + timing.active ? mix(-0.14, 0.1, swing) : mix(0.1, 0, recovery)
    const extension = frame <= timing.startup ? mix(1, 0.9, startup) :
      frame <= timing.startup + timing.active ? mix(0.9, weapon === 'spear' ? 1.22 : 1.16, swing) :
        mix(weapon === 'spear' ? 1.22 : 1.16, 1, recovery)
    return { rotation: thrust, stretch: extension }
  }
  const rotation = frame <= timing.startup ? mix(0, windup, startup) :
    frame <= timing.startup + timing.active ? mix(windup, follow, swing) : mix(follow, 0, recovery)
  return { rotation, stretch: 1 }
}

export function placeWeapon(sprite: Phaser.GameObjects.Sprite, x: number, y: number, facing: -1 | 1,
  weapon: Weapon, attack: AttackStyle | undefined, frame: number): void {
  const pose = weaponPose(weapon, attack, frame)
  const angle = pose.rotation * facing
  const shoulderX = facing * 10
  const shoulderY = -4
  const scaledX = shoulderX * pose.stretch
  const rotatedX = scaledX * Math.cos(angle) - shoulderY * Math.sin(angle)
  const rotatedY = scaledX * Math.sin(angle) + shoulderY * Math.cos(angle)
  sprite.setPosition(x + shoulderX - rotatedX, y + shoulderY - rotatedY)
    .setFlipX(facing < 0).setRotation(angle).setScale(pose.stretch, 1)
}
