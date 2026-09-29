import assert from 'node:assert/strict'
import test from 'node:test'
import { clampFighterPosition, resetFighterBody } from '../src/game/position'
import { WORLD } from '../src/game/types'

test('Echo replay positions remain in the arena after a ground-level swap', () => {
  assert.equal(clampFighterPosition(420, WORLD.floorY + 120).y, WORLD.floorY - 28)
  assert.equal(clampFighterPosition(-200, 200).x, 18)
  assert.equal(clampFighterPosition(1200, 200).x, WORLD.width - 18)
})

test('teleport resets the physics body at a safe position', () => {
  const positions: { x: number; y: number }[] = []
  resetFighterBody({ reset: (x, y) => { positions.push({ x, y }) } }, 450, WORLD.floorY + 120)
  assert.deepEqual(positions, [{ x: 450, y: WORLD.floorY - 28 }])
})
