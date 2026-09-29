import assert from 'node:assert/strict'
import test from 'node:test'
import { attackFor, CHARACTERS, damageFor, isLoadout, SKILLS } from '../src/game/balance'
import { attackRect, hurtRect, overlaps } from '../src/game/CombatMath'
import { awardStoryVictory, canUse, hydrateProgress, newProgress, sanitizeLoadout, syncUnlocks } from '../src/progression/progress'
import { GEAR_CAPSULE_ITEMS } from '../src/progression/catalog'
import { CAPSULE_COLORS, CAPSULE_PRICE, DUPLICATE_REFUND_PERCENT, GEAR_CAPSULE_PRICE, SHOP_COLORS, buyColor, buyHat, drawCapsule, drawGearCapsule, gearCapsulePool } from '../src/shop/catalog'
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
  assert.equal(canUse(progress, 'weapon', 'yoyo'), true)
  assert.equal(canUse(progress, 'weapon', 'whip'), true)
  assert.equal(canUse(progress, 'attack', 'yoyo_high'), true)
  assert.equal(canUse(progress, 'attack', 'whip_sweep'), true)
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
  assert.ok(attackFor('yoyo').reach > attackFor('sword').reach)
  assert.ok(attackFor('yoyo').damage < attackFor('sword').damage)
  assert.ok(attackFor('whip').height > attackFor('spear').height)
  assert.ok(attackFor('whip').startup > attackFor('spear').startup)
  assert.ok(overlaps(attackRect(100, 400, 1, 'whip'), hurtRect(230, 400)))
  assert.equal(isLoadout({ character: 'standard', weapon: 'yoyo', attack: 'whip_snap', skill: 'blink' }), false)
  assert.ok(SKILLS.spring.cooldown > SKILLS.blink.cooldown)
  for (const chapter of STORY_CHAPTERS) {
    const rise = WORLD.floorY - (chapter.arena?.platformY ?? WORLD.platformY)
    for (const fighter of Object.values(CHARACTERS)) assert.ok(fighter.jumpSpeed ** 2 / (2 * WORLD.gravity) >= rise + 28)
  }
})

test('new stages unlock their weapons, alternate attacks, and survive a reload', () => {
  const progress = newProgress()
  for (const chapter of STORY_CHAPTERS.slice(0, 11)) awardStoryVictory(progress, chapter.id, 'standard')
  assert.equal(canUse(progress, 'weapon', 'yoyo'), false)
  assert.equal(canUse(progress, 'weapon', 'whip'), false)
  awardStoryVictory(progress, 12, 'standard')
  assert.equal(canUse(progress, 'weapon', 'yoyo'), true)
  assert.equal(canUse(progress, 'attack', 'yoyo_toss'), true)
  assert.equal(canUse(progress, 'weapon', 'whip'), false)
  awardStoryVictory(progress, 13, 'standard')
  assert.equal(canUse(progress, 'weapon', 'whip'), true)
  assert.equal(canUse(progress, 'attack', 'yoyo_high'), true)
  assert.equal(canUse(progress, 'attack', 'whip_sweep'), false)
  awardStoryVictory(progress, 14, 'standard')
  assert.equal(canUse(progress, 'attack', 'whip_sweep'), true)
  progress.selectedLoadout = sanitizeLoadout(progress, { character: 'standard', weapon: 'whip', attack: 'whip_sweep', skill: 'blink' })
  const restored = hydrateProgress(JSON.parse(JSON.stringify(progress)))
  assert.equal(restored.selectedLoadout.weapon, 'whip')
  assert.equal(restored.selectedLoadout.attack, 'whip_sweep')
  assert.ok(restored.storyProgress.defeatedBosses.includes('arena_champion'))
})

test('YO-YO can be drawn early and enables its matching basic attack', () => {
  const progress = newProgress()
  progress.coins = GEAR_CAPSULE_PRICE
  const pool = gearCapsulePool(progress)
  const index = pool.findIndex(item => item.kind === 'weapon' && item.id === 'yoyo')
  assert.ok(index >= 0)
  assert.deepEqual(drawGearCapsule(progress, () => (index + 0.1) / pool.length),
    { ok: true, item: { kind: 'weapon', id: 'yoyo' }, duplicate: false, refund: 0 })
  assert.equal(canUse(progress, 'weapon', 'yoyo'), true)
  assert.equal(canUse(progress, 'attack', 'yoyo_toss'), true)
  assert.equal(sanitizeLoadout(progress, { character: 'standard', weapon: 'yoyo', skill: 'blink' }).attack, 'yoyo_toss')
})

test('gear capsule can unlock equipment or refund half its price on a duplicate', () => {
  const progress = newProgress()
  progress.coins = 1000
  assert.equal(gearCapsulePool(progress).some(item => item.id === 'fan_gust'), false)
  assert.equal(gearCapsulePool(progress).some(item => item.id === 'yoyo_high'), false)
  const pool = gearCapsulePool(progress)
  const fanIndex = pool.findIndex(item => item.id === 'fan')
  assert.ok(fanIndex >= 0)
  const pickFan = () => {
    const current = gearCapsulePool(progress)
    return (current.findIndex(item => item.id === 'fan') + 0.1) / current.length
  }
  assert.deepEqual(drawGearCapsule(progress, pickFan),
    { ok: true, item: { kind: 'weapon', id: 'fan' }, duplicate: false, refund: 0 })
  assert.equal(progress.coins, 1000 - GEAR_CAPSULE_PRICE)
  assert.equal(canUse(progress, 'weapon', 'fan'), true)
  assert.equal(canUse(progress, 'attack', 'fan_swat'), true)
  assert.equal(gearCapsulePool(progress).some(item => item.id === 'fan'), true)
  assert.equal(gearCapsulePool(progress).some(item => item.id === 'fan_gust'), true)
  assert.deepEqual(drawGearCapsule(progress, pickFan),
    { ok: true, item: { kind: 'weapon', id: 'fan' }, duplicate: true, refund: GEAR_CAPSULE_PRICE / 2 })
  assert.equal(progress.coins, 1000 - GEAR_CAPSULE_PRICE * 2 + GEAR_CAPSULE_PRICE / 2)
  assert.equal(progress.ownedGear.filter(id => id === 'weapon:fan').length, 1)
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
  assert.ok(gearCapsulePool(complete).length > 0)
  assert.equal(drawGearCapsule(complete, () => 0).ok, true)
  assert.equal(complete.coins, GEAR_CAPSULE_PRICE / 2)
})

test('color capsule uses a fixed pool, returns half on duplicates, and hats survive save reload', () => {
  const progress = newProgress()
  progress.coins = 2000
  assert.equal(DUPLICATE_REFUND_PERCENT, 50)
  assert.deepEqual(buyColor(progress, 'mint'), { ok: true, color: 'mint', duplicate: false, refund: 0 })
  assert.equal(progress.coins, 1780)
  assert.equal(buyColor(progress, 'mint').ok, false)
  assert.equal(progress.coins, 1780)
  assert.deepEqual(drawCapsule(progress, () => 0), { ok: true, color: CAPSULE_COLORS[0], duplicate: false, refund: 0 })
  assert.deepEqual(drawCapsule(progress, () => 0), { ok: true, color: CAPSULE_COLORS[0], duplicate: true, refund: CAPSULE_PRICE / 2 })
  assert.equal(progress.coins, 1780 - CAPSULE_PRICE * 2 + CAPSULE_PRICE / 2)
  for (let index = 1; index < CAPSULE_COLORS.length; index++)
    assert.equal(drawCapsule(progress, () => (index + 0.1) / CAPSULE_COLORS.length).ok, true)
  assert.equal(new Set(progress.ownedCosmetics).size, 1 + CAPSULE_COLORS.length)
  assert.deepEqual(buyHat(progress, 'cap'), { ok: true, hat: 'cap' })
  const afterHat = progress.coins
  assert.equal(buyHat(progress, 'cap').ok, false)
  assert.equal(progress.coins, afterHat)
  progress.selectedLoadout = sanitizeLoadout(progress, { ...progress.selectedLoadout, hat: 'cap' })
  const restored = hydrateProgress(JSON.parse(JSON.stringify(progress)))
  assert.equal(canUse(restored, 'color', 'mint'), true)
  assert.equal(canUse(restored, 'color', CAPSULE_COLORS[0]), true)
  assert.equal(canUse(restored, 'hat', 'cap'), true)
  assert.equal(restored.selectedLoadout.hat, 'cap')
  assert.equal(sanitizeLoadout(restored, { ...restored.selectedLoadout, hat: 'crown' }).hat, 'none')
  assert.equal(buyHat(restored, 'constructor').ok, false)
  assert.equal(hydrateProgress({ ownedCosmetics: ['hat:constructor'] }).ownedCosmetics.length, 0)
  assert.equal(sanitizeLoadout(restored, { ...restored.selectedLoadout, color: CAPSULE_COLORS[0] }).color, CAPSULE_COLORS[0])
  const coins = progress.coins
  assert.deepEqual(drawCapsule(progress, () => 0), { ok: true, color: CAPSULE_COLORS[0], duplicate: true, refund: CAPSULE_PRICE / 2 })
  assert.equal(progress.coins, coins - CAPSULE_PRICE / 2)
})

test('shop offers a reachable early capsule and a longer-term cosmetic goal', () => {
  assert.ok(CAPSULE_PRICE <= STORY_CHAPTERS[0].rewardCoins + STORY_CHAPTERS[1].rewardCoins)
  assert.ok(GEAR_CAPSULE_PRICE > STORY_CHAPTERS[0].rewardCoins + STORY_CHAPTERS[1].rewardCoins)
  assert.ok(SHOP_COLORS.some(item => item.id === 'gold' && item.price >= 800))
  const progress = newProgress()
  progress.coins = 850
  assert.deepEqual(buyColor(progress, 'gold'), { ok: true, color: 'gold', duplicate: false, refund: 0 })
  assert.equal(progress.coins, 0)
  assert.equal(canUse(hydrateProgress(JSON.parse(JSON.stringify(progress))), 'color', 'gold'), true)
  progress.coins = 1200
  assert.deepEqual(buyHat(progress, 'cat_ears'), { ok: true, hat: 'cat_ears' })
  assert.equal(canUse(hydrateProgress(JSON.parse(JSON.stringify(progress))), 'hat', 'cat_ears'), true)
})
