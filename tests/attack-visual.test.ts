import assert from 'node:assert/strict'
import test from 'node:test'
import { weaponPose } from '../src/game/AttackVisual'
import { attackFor } from '../src/game/balance'

test('sword swing has a windup, a visible sweep and returns to its resting pose', () => {
  const attack = attackFor('sword', 'basic_slash')
  const windup = weaponPose('sword', 'basic_slash', attack.startup)
  const followThrough = weaponPose('sword', 'basic_slash', attack.startup + attack.active)
  assert.ok(windup.rotation < -0.4)
  assert.ok(followThrough.rotation > 0.4)
  assert.equal(weaponPose('sword', 'basic_slash', 0).rotation, 0)
  assert.equal(weaponPose('sword', 'basic_slash', attack.total).rotation, 0)
})

test('weapon styles have distinct movement, including a thrust and an upward swing', () => {
  const thrust = attackFor('spear', 'spear_thrust')
  assert.ok(weaponPose('spear', 'spear_thrust', thrust.startup + thrust.active).stretch > 1.1)
  const upper = attackFor('sword', 'upper_slash')
  assert.ok(weaponPose('sword', 'upper_slash', upper.startup + upper.active).rotation < -0.8)
  const hammer = attackFor('hammer', 'hammer_smash')
  assert.ok(weaponPose('hammer', 'hammer_smash', hammer.startup).rotation < -0.8)
})
