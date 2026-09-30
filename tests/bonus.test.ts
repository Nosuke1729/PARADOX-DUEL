import assert from 'node:assert/strict'
import test from 'node:test'
import { attackFor, CHARACTERS, echoCooldownFrames, SKILLS } from '../src/game/balance'
import { RULES } from '../src/game/types'
import { canUse, awardStoryVictory, beginBonusAttempt, finishBonusAttempt, hydrateProgress, newProgress, sanitizeLoadout } from '../src/progression/progress'
import { BONUS_CHAPTER, BONUS_CONFIG, eligibleForBonus, groundPulseHits } from '../src/story/bonus'

test('rare encounter starts after stage 5 with a guaranteed appearance by the configured pity count', () => {
  assert.equal(eligibleForBonus(4, 0, 11, 3, 0), false)
  assert.equal(eligibleForBonus(5, 1, 11, 3, 0), false)
  assert.equal(eligibleForBonus(5, 0, 11, 0, 0), false)
  assert.equal(eligibleForBonus(5, 0, 0, 3, BONUS_CONFIG.spawnChance), false)
  assert.equal(eligibleForBonus(5, 0, 0, 3, BONUS_CONFIG.spawnChance - 0.001), true)
  const progress = newProgress()
  for (let id = 1; id < 5; id++) awardStoryVictory(progress, id, 'standard', false, () => 0)
  assert.equal(progress.bonus.attempts, 0)
  for (let n = 1; n < BONUS_CONFIG.pityAfter; n++) {
    awardStoryVictory(progress, 5, 'standard', false, () => 0.99)
    assert.equal(progress.bonus.attempts, 0)
  }
  const events = awardStoryVictory(progress, 5, 'standard', false, () => 0.99)
  assert.equal(progress.bonus.attempts, BONUS_CONFIG.attempts)
  assert.ok(events.some(event => event.kind === 'bonus'))
  awardStoryVictory(progress, 5, 'standard', false, () => 0)
  assert.equal(progress.bonus.attempts, BONUS_CONFIG.attempts)
})

test('attempts are consumed before battle, cannot start twice, and reload cannot replay an active result', () => {
  const progress = newProgress()
  progress.bonus.attempts = BONUS_CONFIG.attempts
  assert.equal(beginBonusAttempt(progress), true)
  assert.equal(beginBonusAttempt(progress), false)
  const restored = hydrateProgress(JSON.parse(JSON.stringify(progress)))
  assert.equal(restored.bonus.active, false)
  assert.equal(restored.bonus.attempts, BONUS_CONFIG.attempts - 1)
  assert.deepEqual(finishBonusAttempt(restored, true, 'standard'), [])
  assert.equal(restored.coins, 0)
  assert.deepEqual(finishBonusAttempt(progress, false, 'standard'), [])
  assert.equal(progress.bonus.attempts, BONUS_CONFIG.attempts - 1)
  assert.equal(beginBonusAttempt(progress), true)
})

test('each bonus win grants one missing reward and can never grant it twice', () => {
  const progress = newProgress()
  for (const [index, kind, id] of [
    [0, 'character', 'shade'], [1, 'weapon', 'scythe'], [2, 'skill', 'echo_charge'],
  ] as const) {
    progress.bonus.attempts = 1
    assert.equal(beginBonusAttempt(progress), true)
    const beforeXp = progress.totalXp
    const beforeCoins = progress.coins
    const events = finishBonusAttempt(progress, true, 'standard', () => 0)
    assert.equal(progress.totalXp - beforeXp, BONUS_CHAPTER.rewardXp)
    assert.equal(progress.coins - beforeCoins, BONUS_CHAPTER.rewardCoins)
    assert.equal(progress.bonus.rewards[index], id)
    assert.equal(canUse(progress, kind, id), true)
    assert.ok(events.some(event => event.detail.includes(id.toUpperCase().replace('_', ' '))))
    assert.deepEqual(finishBonusAttempt(progress, true, 'standard'), [])
  }
  assert.equal(progress.bonus.rewards.length, 3)
  assert.equal(eligibleForBonus(5, 0, 11, 0, 0), false)
  assert.equal(beginBonusAttempt(progress), false)
  const restored = hydrateProgress(JSON.parse(JSON.stringify(progress)))
  assert.deepEqual(restored.bonus.rewards, ['shade', 'scythe', 'echo_charge'])
  assert.equal(sanitizeLoadout(restored, { character: 'shade', weapon: 'scythe', attack: 'scythe_sweep', skill: 'echo_charge' }).character, 'shade')
  assert.equal(canUse(restored, 'attack', 'scythe_sweep'), true)
})

test('bonus equipment remains a tradeoff and the boss pulse can be jumped or outranged', () => {
  const fresh = newProgress()
  assert.equal(canUse(fresh, 'character', 'shade'), false)
  assert.equal(canUse(fresh, 'weapon', 'scythe'), false)
  assert.equal(canUse(fresh, 'skill', 'echo_charge'), false)
  assert.equal(sanitizeLoadout(fresh, { character: 'shade', weapon: 'scythe', attack: 'scythe_sweep', skill: 'echo_charge' }).weapon, 'sword')
  assert.ok(CHARACTERS.shade.hp < CHARACTERS.standard.hp)
  assert.ok(CHARACTERS.shade.power < CHARACTERS.standard.power)
  assert.ok(echoCooldownFrames('shade') < RULES.echoCooldown)
  assert.ok(attackFor('scythe').startup > attackFor('sword').startup)
  assert.ok(attackFor('scythe').damage / attackFor('scythe').total < attackFor('sword').damage / attackFor('sword').total)
  assert.ok(SKILLS.echo_charge.cooldown > SKILLS.blink.cooldown)
  assert.equal(groundPulseHits(500, 400, 500, 480), true)
  assert.equal(groundPulseHits(500, 360, 500, 480), false)
  assert.equal(groundPulseHits(500 + BONUS_CONFIG.pulseRadius, 400, 500, 480), false)
})
