import assert from 'node:assert/strict'
import test from 'node:test'
import { EchoRecorder } from '../src/game/EchoRecorder'
import { HitLedger, attackRect, hurtRect, overlaps, projectileRect } from '../src/game/CombatMath'
import { CHARACTERS, SKILLS, WEAPONS, damageFor, isLoadout, winnerByHealth } from '../src/game/balance'
import { RULES, WORLD, type Frame } from '../src/game/types'

const frame = (x: number, attackFrame = 0): Frame => ({
  x, y: 400, vx: 0, vy: 0, facing: 1, attackFrame, attackId: attackFrame ? 1 : 0, dash: false,
})

test('Echo records exactly the newest four seconds and freezes a replay copy', () => {
  const recorder = new EchoRecorder()
  for (let n = 0; n < RULES.echoFrames - 1; n++) recorder.push(frame(n))
  assert.equal(recorder.ready(), false)
  assert.equal(recorder.remaining(), 1)
  recorder.push(frame(RULES.echoFrames - 1, 8))
  assert.equal(recorder.ready(), true)
  const replay = recorder.capture()
  recorder.push(frame(RULES.echoFrames))
  assert.equal(replay[0].x, 0)
  assert.equal(replay.at(-1)?.attackFrame, 8)
  assert.equal(recorder.capture()[0].x, 1)
  replay[0].x = 999
  assert.equal(recorder.capture()[0].x, 1)
})

test('Sword hitbox is directional and edges do not count as a hit', () => {
  assert.equal(new HitLedger().claim('front', attackRect(100, 400, 1), hurtRect(155, 400), false), true)
  assert.equal(new HitLedger().claim('behind', attackRect(100, 400, 1), hurtRect(55, 400), false), false)
  assert.equal(new HitLedger().claim('left', attackRect(100, 400, -1), hurtRect(45, 400), false), true)
  assert.equal(new HitLedger().claim('above', attackRect(100, 400, 1), hurtRect(155, 310), false), false)
})

test('A body or Echo attack hits a target once, then resets for a new round', () => {
  const ledger = new HitLedger()
  const attack = attackRect(100, 400, 1)
  const hurt = hurtRect(155, 400)
  assert.equal(ledger.claim('1:body:7:2', attack, hurt, false), true)
  assert.equal(ledger.claim('1:body:7:2', attack, hurt, false), false)
  assert.equal(ledger.claim('1:echo:22:7:2', attack, hurt, true), false)
  assert.equal(ledger.claim('1:echo:22:7:2', attack, hurt, false), true)
  assert.equal(ledger.claim('1:echo:22:7:2', attack, hurt, false), false)
  ledger.clear()
  assert.equal(ledger.claim('1:body:7:2', attack, hurt, false), true)
})

test('Character and weapon choices change real combat values while keeping one input layout', () => {
  assert.ok(CHARACTERS.light.moveSpeed > CHARACTERS.standard.moveSpeed)
  assert.ok(CHARACTERS.light.hp < CHARACTERS.standard.hp)
  assert.ok(CHARACTERS.heavy.hp > CHARACTERS.standard.hp)
  assert.ok(CHARACTERS.heavy.knockback < CHARACTERS.standard.knockback)
  assert.ok(WEAPONS.spear.startup > WEAPONS.sword.startup)
  assert.ok(WEAPONS.spear.reach > WEAPONS.sword.reach)
  assert.ok(WEAPONS.blaster.damage < WEAPONS.sword.damage)
  assert.ok(damageFor({ character: 'heavy', weapon: 'sword', skill: 'shield' }) >
    damageFor({ character: 'light', weapon: 'sword', skill: 'shield' }))
  assert.ok(overlaps(attackRect(100, 400, 1, 'spear'), hurtRect(220, 400)))
  assert.equal(overlaps(attackRect(100, 400, 1, 'sword'), hurtRect(220, 400)), false)
  assert.ok(overlaps(projectileRect(210, 400), hurtRect(220, 400)))
})

test('Online loadouts accept only available characters, weapons, and skills', () => {
  assert.equal(isLoadout({ character: 'light', weapon: 'blaster', skill: 'echo_swap' }), true)
  assert.equal(isLoadout({ character: 'light', weapon: 'laser', skill: 'echo_swap' }), false)
  assert.equal(isLoadout({ character: 'light', weapon: 'blaster', skill: 'teleport' }), false)
  assert.equal(SKILLS.shield.cooldown, 600)
  assert.equal(SKILLS.shockwave.cooldown, 720)
})

test('Timeout compares health ratios so full-health Light ties full-health Heavy', () => {
  const light = { character: 'light', weapon: 'sword', skill: 'blink' } as const
  const heavy = { character: 'heavy', weapon: 'spear', skill: 'shield' } as const
  assert.equal(winnerByHealth([78, 130], [light, heavy]), undefined)
  assert.equal(winnerByHealth([60, 130], [light, heavy]), 2)
  assert.equal(winnerByHealth([78, 100], [light, heavy]), 1)
})

test('Every character can jump above the stage platform with landing clearance', () => {
  const platformRise = WORLD.floorY - WORLD.platformY
  for (const [name, character] of Object.entries(CHARACTERS)) {
    const jumpApex = character.jumpSpeed ** 2 / (2 * WORLD.gravity)
    assert.ok(jumpApex >= platformRise + 30, `${name} apex ${jumpApex.toFixed(1)}px cannot clear the platform`)
  }
})
