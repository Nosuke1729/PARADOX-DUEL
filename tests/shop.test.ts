import assert from 'node:assert/strict'
import test from 'node:test'
import { attackFor, CHARACTERS, damageFor, isLoadout, SKILLS } from '../src/game/balance'
import { attackRect, hurtRect, overlaps } from '../src/game/CombatMath'
import { awardStoryVictory, canUse, hydrateProgress, newProgress, sanitizeLoadout, syncUnlocks } from '../src/progression/progress'
import { GEAR_CAPSULE_ITEMS } from '../src/progression/catalog'
import { CAPSULE_COLORS, CAPSULE_PRICE, GEAR_CAPSULE_PRICE, buyColor, drawCapsule, drawGearCapsule, gearCapsuleCandidates } from '../src/shop/catalog'
import { STORY_CHAPTERS } from '../src/story/chapters'
import { WORLD } from '../src/game/types'

test('new weapons and attacks unlock through stages and affect combat', () => {
  const progress = newProgress()
  for (const chapter of STORY_CHAPTERS) awardStoryVictory(progress, chapter.id, 'standard')
  assert.equal(canUse(progress, 'weapon', 'dagger'), true)
  assert.equal(canUse(progress, 'weapon', 'hammer'), true)
  assert.equal(canUse(progress, 'attack', 'dagger_lunge'), true)
  assert.equal(canUse(progress, 'attack', 'hammer_upper'), true)
  assert.equal(canUse(progress, 'weapon', 'fan'), true)
  assert.equal(canUse(progress, 'skill', 'spring'), true)
  assert.equal(canUse(progress, 'attack', 'fan_gust'), true)
  assert.ok(attackFor('dagger').total < attackFor('sword').total)
  assert.ok(damageFor({ character: 'standard', weapon: 'hammer', skill: 'blink' }) >
    damageFor({ character: 'standard', weapon: 'sword', skill: 'blink' }))
  assert.ok(overlaps(attackRect(100, 400, 1, 'dagger', 'dagger_lunge'), hurtRect(200, 400)))
  assert.equal(isLoadout({ character: 'standard', weapon: 'hammer', attack: 'dagger_stab', skill: 'blink' }), false)
  assert.equal(sanitizeLoadout(newProgress(), { character: 'standard', weapon: 'hammer', attack: 'hammer_smash', skill: 'blink' }).weapon, 'sword')
  assert.ok(attackFor('fan').height > attackFor('sword').height)
  assert.ok(attackFor('fan').damage < attackFor('sword').damage)
  assert.equal(overlaps(attackRect(100, 400, 1, 'sword'), hurtRect(155, 330)), false)
  assert.equal(overlaps(attackRect(100, 400, 1, 'fan'), hurtRect(155, 330)), true)
  assert.ok(attackFor('fan', 'fan_gust').startup > attackFor('fan').startup)
  assert.ok(attackFor('fan', 'fan_gust').damage < attackFor('fan').damage)
  assert.ok(SKILLS.spring.cooldown > SKILLS.blink.cooldown)
  for (const chapter of STORY_CHAPTERS) {
    const rise = WORLD.floorY - (chapter.arena?.platformY ?? WORLD.platformY)
    for (const fighter of Object.values(CHARACTERS)) assert.ok(fighter.jumpSpeed ** 2 / (2 * WORLD.gravity) >= rise + 28)
  }
})

test('gear capsule unlocks usable equipment, skips duplicates and survives reload', () => {
  const progress = newProgress()
  progress.coins = 1000
  assert.equal(gearCapsuleCandidates(progress).some(item => item.id === 'fan_gust'), false)
  const candidates = gearCapsuleCandidates(progress)
  const fanIndex = candidates.findIndex(item => item.id === 'fan')
  assert.ok(fanIndex >= 0)
  assert.deepEqual(drawGearCapsule(progress, () => (fanIndex + 0.1) / candidates.length),
    { ok: true, item: { kind: 'weapon', id: 'fan' } })
  assert.equal(progress.coins, 1000 - GEAR_CAPSULE_PRICE)
  assert.equal(canUse(progress, 'weapon', 'fan'), true)
  assert.equal(canUse(progress, 'attack', 'fan_swat'), true)
  assert.equal(gearCapsuleCandidates(progress).some(item => item.id === 'fan'), false)
  assert.equal(gearCapsuleCandidates(progress).some(item => item.id === 'fan_gust'), true)
  const restored = hydrateProgress(JSON.parse(JSON.stringify(progress)))
  assert.equal(canUse(restored, 'weapon', 'fan'), true)
  assert.equal(sanitizeLoadout(restored, { character: 'standard', weapon: 'fan', attack: 'fan_swat', skill: 'blink' }).weapon, 'fan')
  restored.coins = GEAR_CAPSULE_PRICE - 1
  assert.equal(drawGearCapsule(restored, () => 0).ok, false)
  assert.equal(restored.coins, GEAR_CAPSULE_PRICE - 1)
  const complete = newProgress()
  complete.coins = GEAR_CAPSULE_PRICE
  complete.ownedGear = GEAR_CAPSULE_ITEMS.map(item => `${item.kind}:${item.id}`)
  syncUnlocks(complete)
  assert.equal(gearCapsuleCandidates(complete).length, 0)
  assert.equal(drawGearCapsule(complete, () => 0).ok, false)
  assert.equal(complete.coins, GEAR_CAPSULE_PRICE)
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
