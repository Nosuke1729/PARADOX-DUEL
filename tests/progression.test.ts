import assert from 'node:assert/strict'
import test from 'node:test'
import { attackCycleFrames, attackFor, CHARACTERS, damageFor, isLoadout, nextAirJumpUse, winnerByHealth } from '../src/game/balance'
import { STORY_CHAPTERS } from '../src/story/chapters'
import { challengeFor, EchoChallengeTracker } from '../src/story/challenges'
import { StoryAI } from '../src/story/StoryAI'
import { awardStoryVictory, canUse, hydrateProgress, isChapterAvailable, loadProgress, newProgress, PROGRESS_KEY, sanitizeLoadout, saveProgress, selectTitle, storyReward, xpForNextLevel } from '../src/progression/progress'

test('new pilots start with only NORMAL, SWORD, BLINK and BASIC SLASH', () => {
  const progress = newProgress()
  assert.deepEqual(progress.unlockedCharacters, ['standard'])
  assert.deepEqual(progress.unlockedWeapons, ['sword'])
  assert.deepEqual(progress.unlockedSkills, ['blink'])
  assert.deepEqual(progress.unlockedAttacks, ['basic_slash'])
  assert.equal(canUse(progress, 'character', 'light'), false)
  assert.equal(canUse(progress, 'weapon', 'blaster'), false)
  assert.equal(isChapterAvailable(progress, 1), true)
  assert.equal(isChapterAvailable(progress, 2), false)
  assert.deepEqual(sanitizeLoadout(progress, { character: 'light', weapon: 'blaster', skill: 'shield', attack: 'blaster_shot' }),
    { character: 'standard', weapon: 'sword', skill: 'blink', attack: 'basic_slash', color: 'default', hat: 'none' })
})

test('XP thresholds grow and first two story victories unlock LIGHT', () => {
  const progress = newProgress()
  assert.equal(xpForNextLevel(1), 100)
  assert.equal(xpForNextLevel(2), 150)
  assert.equal(xpForNextLevel(3), 200)
  const chapter1 = awardStoryVictory(progress, 1, 'standard')
  assert.ok(chapter1.some(event => event.kind === 'level' && event.detail.includes('1 → 2')))
  assert.equal(progress.playerLevel, 2)
  assert.equal(progress.currentXp, 20)
  assert.equal(progress.coins, 60)
  assert.equal(isChapterAvailable(progress, 2), true)
  assert.equal(canUse(progress, 'character', 'light'), false)
  const chapter2 = awardStoryVictory(progress, 2, 'standard')
  assert.ok(chapter2.some(event => event.kind === 'unlock' && event.detail.includes('LIGHT')))
  assert.equal(progress.playerLevel, 3)
  assert.equal(progress.currentXp, 50)
  assert.equal(progress.coins, 160)
  assert.equal(canUse(progress, 'character', 'light'), true)
  assert.equal(canUse(progress, 'weapon', 'spear'), true)
  progress.selectedLoadout = sanitizeLoadout(progress, { character: 'light', weapon: 'sword', skill: 'blink', attack: 'basic_slash' })
  assert.equal(progress.selectedLoadout.character, 'light')
})

test('clears, unlocks and loadout survive storage reload; tampered locked choices are rejected', () => {
  const store = new Map<string, string>()
  const storage = { getItem: (key: string) => store.get(key) ?? null, setItem: (key: string, value: string) => { store.set(key, value) } }
  const progress = newProgress()
  awardStoryVictory(progress, 1, 'standard')
  awardStoryVictory(progress, 2, 'standard')
  progress.selectedLoadout = sanitizeLoadout(progress, { character: 'light', weapon: 'sword', skill: 'blink', attack: 'basic_slash' })
  saveProgress(progress, storage)
  const restored = loadProgress(storage)
  assert.equal(restored.selectedLoadout.character, 'light')
  assert.equal(canUse(restored, 'character', 'light'), true)
  assert.deepEqual(restored.storyProgress.clearedChapters, [1, 2])
  assert.equal(restored.coins, 160)
  assert.ok(store.has(PROGRESS_KEY))
  const forged = hydrateProgress({ selectedLoadout: { character: 'heavy', weapon: 'blaster', skill: 'echo_swap', attack: 'blaster_shot' } })
  assert.equal(forged.selectedLoadout.character, 'standard')
  assert.equal(forged.selectedLoadout.weapon, 'sword')
  assert.equal(forged.selectedLoadout.skill, 'blink')
})

test('later unlocks use level, boss and mastery conditions without changing online base stats', () => {
  const progress = newProgress()
  progress.playerLevel = 12
  progress.characterMastery.standard.level = 3
  const restored = hydrateProgress(progress)
  assert.equal(canUse(restored, 'weapon', 'blaster'), true)
  assert.equal(canUse(restored, 'attack', 'heavy_slash'), true)
  assert.equal(canUse(restored, 'character', 'heavy'), false)
  assert.ok(damageFor({ character: 'standard', weapon: 'sword', skill: 'blink', attack: 'heavy_slash' }) >
    damageFor({ character: 'standard', weapon: 'sword', skill: 'blink', attack: 'basic_slash' }))
  assert.ok(attackFor('sword', 'heavy_slash').startup > attackFor('sword', 'basic_slash').startup)
  assert.equal(isLoadout({ character: 'standard', weapon: 'sword', skill: 'blink', attack: 'blaster_shot' }), false)
  assert.equal(winnerByHealth([100, 78],
    [{ character: 'standard', weapon: 'sword', skill: 'blink' }, { character: 'light', weapon: 'sword', skill: 'blink' }]), undefined)
})

test('HEAVY SLASH trades sustained damage and startup for a stronger single hit', () => {
  const basic = attackFor('sword', 'basic_slash')
  const heavy = attackFor('sword', 'heavy_slash')
  assert.ok(heavy.damage > basic.damage)
  assert.ok(heavy.damage <= basic.damage * 1.5)
  assert.ok(heavy.startup >= basic.startup * 2.5)
  assert.ok(heavy.damage / heavy.total < basic.damage / basic.total)
  assert.ok((heavy.knockback ?? 1) > (basic.knockback ?? 1))
})

test('HEAVY trades slower attack cycles for a modest damage and health advantage', () => {
  const standard = { character: 'standard' as const, weapon: 'spear' as const, skill: 'blink' as const }
  const heavy = { ...standard, character: 'heavy' as const }
  assert.equal(CHARACTERS.heavy.hp, 118)
  assert.ok(damageFor(heavy) > damageFor(standard))
  assert.ok(damageFor(heavy) < damageFor(standard) * 1.2)
  assert.equal(attackCycleFrames(heavy), attackCycleFrames(standard) + 10)
  assert.ok(damageFor(heavy) / attackCycleFrames(heavy) < damageFor(standard) / attackCycleFrames(standard))
  assert.ok(STORY_CHAPTERS[3].boss!.hpMultiplier < 1.5)
})

test('story AI waits for the HEAVY attack cycle before another strike', () => {
  const ai = new StoryAI('hard', undefined, () => 0)
  const bot = { x: 500, y: 400, hp: 118, maxHp: 118, attackFrame: 0, grounded: true, airJumpsUsed: 0,
    loadout: { character: 'heavy' as const, weapon: 'spear' as const }, echoCooldown: 0, skillCooldown: 0,
    recorder: { ready: () => false } }
  const player = { ...bot, x: 450, loadout: { character: 'standard' as const, weapon: 'sword' as const } }
  assert.equal(ai.input(bot, player, 1).pressed.attack, true)
  assert.equal(ai.input(bot, player, 55).pressed.attack, false)
  assert.equal(ai.input({ ...bot, attackFrame: 12 }, player, 67).pressed.attack, false)
  assert.equal(ai.input(bot, player, 67).pressed.attack, true)
})

test('later story replays pay a useful but capped coin reward', () => {
  assert.deepEqual(storyReward(STORY_CHAPTERS[0], true), { xp: 120, coins: 60 })
  assert.deepEqual(storyReward(STORY_CHAPTERS[0], false), { xp: 30, coins: 12 })
  assert.deepEqual(storyReward(STORY_CHAPTERS[13], false), { xp: 263, coins: 120 })
  const progress = newProgress()
  awardStoryVictory(progress, 1, 'standard')
  awardStoryVictory(progress, 1, 'standard')
  assert.equal(progress.coins, 72)
})

test('fifteen story stages are configured and AI range adapts to weapon', () => {
  assert.equal(STORY_CHAPTERS.length, 15)
  const ai = new StoryAI('normal', undefined, () => 0.99)
  const fighter = (weapon: 'sword' | 'blaster' | 'whip' | 'yoyo') => ({
    x: 500, y: 400, hp: 100, maxHp: 100, attackFrame: 0, grounded: true, airJumpsUsed: 0,
    loadout: { character: 'standard' as const, weapon }, echoCooldown: 0, skillCooldown: 0, recorder: { ready: () => false },
  })
  const player = fighter('sword'); player.x = 350
  assert.equal(ai.input(fighter('sword'), player, 13).held.left, true)
  const ranged = new StoryAI('normal', undefined, () => 0.99)
  assert.equal(ranged.input(fighter('blaster'), player, 13).held.right, true)
  player.x = 370
  const whip = new StoryAI('normal', undefined, () => 0.99)
  assert.equal(whip.input(fighter('whip'), player, 13).held.left, false)
  const yoyo = new StoryAI('normal', undefined, () => 0.99)
  assert.equal(yoyo.input(fighter('yoyo'), player, 13).held.left, true)
})

test('HOPPER has one extra air jump and unlocks after its story boss', () => {
  assert.equal(nextAirJumpUse('standard', false, 0), undefined)
  assert.equal(nextAirJumpUse('hopper', true, 0), 0)
  assert.equal(nextAirJumpUse('hopper', false, 0), 1)
  assert.equal(nextAirJumpUse('hopper', false, 1), undefined)
  assert.ok(CHARACTERS.hopper.moveSpeed < CHARACTERS.standard.moveSpeed)
  assert.ok(CHARACTERS.hopper.airSpeed > CHARACTERS.standard.airSpeed)
  assert.ok(damageFor({ character: 'hopper', weapon: 'sword', skill: 'blink' }) <
    damageFor({ character: 'standard', weapon: 'sword', skill: 'blink' }))
  const ai = new StoryAI('hard', STORY_CHAPTERS[14].boss, () => 0)
  const bot = { x: 500, y: 400, hp: 90, maxHp: 90, attackFrame: 0, grounded: true, airJumpsUsed: 0,
    loadout: { character: 'hopper' as const, weapon: 'fan' as const }, echoCooldown: 0, skillCooldown: 0,
    recorder: { ready: () => false } }
  const player = { ...bot, x: 420, loadout: { character: 'standard' as const, weapon: 'sword' as const } }
  assert.equal(ai.input(bot, player, 1).pressed.jump, true)
  assert.equal(ai.input({ ...bot, grounded: false }, player, 26).pressed.jump, true)
  assert.equal(ai.input({ ...bot, grounded: false, airJumpsUsed: 1 }, player, 52).pressed.jump, false)
  const progress = newProgress()
  for (const chapter of STORY_CHAPTERS.slice(0, 14)) awardStoryVictory(progress, chapter.id, 'standard')
  assert.equal(canUse(progress, 'character', 'hopper'), false)
  assert.equal(isChapterAvailable(progress, 15), true)
  assert.ok(awardStoryVictory(progress, 15, 'standard').some(event => event.detail.includes('HOPPER')))
  assert.equal(canUse(progress, 'character', 'hopper'), true)
  progress.selectedLoadout = sanitizeLoadout(progress, { character: 'hopper', weapon: 'sword', skill: 'blink' })
  const restored = hydrateProgress(JSON.parse(JSON.stringify(progress)))
  assert.equal(restored.selectedLoadout.character, 'hopper')
  assert.equal(restored.characterMastery.hopper.level, 1)
  assert.equal(sanitizeLoadout(newProgress(), { character: 'hopper', weapon: 'sword', skill: 'blink' }).character, 'standard')
})

test('Echo title challenges track actual summons and hits within the time window', () => {
  const first = new EchoChallengeTracker(challengeFor(1)!)
  assert.equal(first.complete, false)
  first.recordEchoSummon()
  assert.equal(first.complete, true)
  first.reset()
  assert.equal(first.complete, false)

  const strike = new EchoChallengeTracker(challengeFor(3)!)
  strike.recordHit('body', 20)
  assert.equal(strike.complete, false)
  strike.recordHit('echo', 30)
  assert.equal(strike.complete, true)

  const partner = new EchoChallengeTracker(challengeFor(5)!)
  partner.recordHit('body', 10)
  partner.recordHit('echo', 131)
  assert.equal(partner.complete, false)
  partner.recordHit('body', 250)
  assert.equal(partner.complete, true)
  partner.reset()
  partner.recordHit('echo', 100)
  partner.recordHit('body', 220)
  assert.equal(partner.complete, true)
})

test('story titles and bonus coins are granted once and survive reload', () => {
  const progress = newProgress()
  awardStoryVictory(progress, 1, 'standard')
  assert.deepEqual(progress.earnedTitles, [])
  const events = awardStoryVictory(progress, 1, 'standard', true)
  assert.ok(events.some(event => event.kind === 'title' && event.detail.includes('分身デビュー')))
  assert.equal(progress.coins, 60 + 12 + 30)
  assert.deepEqual(progress.earnedTitles, ['first_echo'])
  assert.equal(progress.selectedTitle, 'first_echo')
  awardStoryVictory(progress, 1, 'standard', true)
  assert.equal(progress.coins, 60 + 12 + 30 + 12)
  assert.equal(selectTitle(progress, 'not_a_title'), false)
  assert.equal(selectTitle(progress, null), true)
  assert.equal(selectTitle(progress, 'first_echo'), true)
  const restored = hydrateProgress(JSON.parse(JSON.stringify(progress)))
  assert.deepEqual(restored.earnedTitles, ['first_echo'])
  assert.equal(restored.selectedTitle, 'first_echo')
  assert.equal(hydrateProgress({ earnedTitles: ['not_a_title'], selectedTitle: 'not_a_title' }).selectedTitle, null)
})
