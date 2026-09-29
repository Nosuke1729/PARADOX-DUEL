import assert from 'node:assert/strict'
import test from 'node:test'
import { attackFor, damageFor, isLoadout, winnerByHealth } from '../src/game/balance'
import { STORY_CHAPTERS } from '../src/story/chapters'
import { StoryAI } from '../src/story/StoryAI'
import { awardStoryVictory, canUse, hydrateProgress, isChapterAvailable, loadProgress, newProgress, PROGRESS_KEY, sanitizeLoadout, saveProgress, xpForNextLevel } from '../src/progression/progress'

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

test('eleven story stages are configured and AI range adapts to weapon', () => {
  assert.equal(STORY_CHAPTERS.length, 11)
  const ai = new StoryAI('normal', undefined, () => 0.99)
  const fighter = (weapon: 'sword' | 'blaster') => ({
    x: 500, y: 400, hp: 100, maxHp: 100, attackFrame: 0, grounded: true,
    loadout: { weapon }, echoCooldown: 0, skillCooldown: 0, recorder: { ready: () => false },
  })
  const player = fighter('sword'); player.x = 350
  assert.equal(ai.input(fighter('sword'), player, 13).held.left, true)
  const ranged = new StoryAI('normal', undefined, () => 0.99)
  assert.equal(ranged.input(fighter('blaster'), player, 13).held.right, true)
})
