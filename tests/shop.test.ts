import assert from 'node:assert/strict'
import test from 'node:test'
import { attackFor, CHARACTERS, damageFor, isLoadout } from '../src/game/balance'
import { attackRect, hurtRect, overlaps } from '../src/game/CombatMath'
import { awardStoryVictory, canUse, hydrateProgress, newProgress, sanitizeLoadout } from '../src/progression/progress'
import { CAPSULE_COLORS, CAPSULE_PRICE, buyColor, drawCapsule } from '../src/shop/catalog'
import { STORY_CHAPTERS } from '../src/story/chapters'
import { WORLD } from '../src/game/types'

test('new weapons and attacks unlock through stages and affect combat', () => {
  const progress = newProgress()
  for (const chapter of STORY_CHAPTERS) awardStoryVictory(progress, chapter.id, 'standard')
  assert.equal(canUse(progress, 'weapon', 'dagger'), true)
  assert.equal(canUse(progress, 'weapon', 'hammer'), true)
  assert.equal(canUse(progress, 'attack', 'dagger_lunge'), true)
  assert.equal(canUse(progress, 'attack', 'hammer_upper'), true)
  assert.ok(attackFor('dagger').total < attackFor('sword').total)
  assert.ok(damageFor({ character: 'standard', weapon: 'hammer', skill: 'blink' }) >
    damageFor({ character: 'standard', weapon: 'sword', skill: 'blink' }))
  assert.ok(overlaps(attackRect(100, 400, 1, 'dagger', 'dagger_lunge'), hurtRect(200, 400)))
  assert.equal(isLoadout({ character: 'standard', weapon: 'hammer', attack: 'dagger_stab', skill: 'blink' }), false)
  assert.equal(sanitizeLoadout(newProgress(), { character: 'standard', weapon: 'hammer', attack: 'hammer_smash', skill: 'blink' }).weapon, 'sword')
  for (const chapter of STORY_CHAPTERS) {
    const rise = WORLD.floorY - (chapter.arena?.platformY ?? WORLD.platformY)
    for (const fighter of Object.values(CHARACTERS)) assert.ok(fighter.jumpSpeed ** 2 / (2 * WORLD.gravity) >= rise + 28)
  }
})

test('shop spends coins once, capsule gives only unowned cosmetics, and save hydration keeps them', () => {
  const progress = newProgress()
  progress.coins = 1000
  assert.deepEqual(buyColor(progress, 'mint'), { ok: true, color: 'mint' })
  assert.equal(progress.coins, 860)
  assert.equal(buyColor(progress, 'mint').ok, false)
  assert.equal(progress.coins, 860)
  assert.equal(drawCapsule(progress, () => 0).ok, true)
  assert.equal(progress.coins, 860 - CAPSULE_PRICE)
  assert.equal(drawCapsule(progress, () => 0).ok, true)
  assert.equal(new Set(progress.ownedCosmetics).size, 3)
  const restored = hydrateProgress(JSON.parse(JSON.stringify(progress)))
  assert.equal(canUse(restored, 'color', 'mint'), true)
  assert.equal(canUse(restored, 'color', CAPSULE_COLORS[0]), true)
  assert.equal(sanitizeLoadout(restored, { ...restored.selectedLoadout, color: CAPSULE_COLORS[0] }).color, CAPSULE_COLORS[0])
  while (CAPSULE_COLORS.some(id => !progress.unlockedColors.includes(id))) drawCapsule(progress, () => 0)
  const coins = progress.coins
  assert.equal(drawCapsule(progress, () => 0).ok, false)
  assert.equal(progress.coins, coins)
})
