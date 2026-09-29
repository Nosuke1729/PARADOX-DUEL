import assert from 'node:assert/strict'
import test from 'node:test'
import { chooseCloudProgress } from '../src/progression/cloud'
import { hydrateProgress, newProgress, PROGRESS_KEY, saveProgress } from '../src/progression/progress'

test('cloud is primary and does not add local XP or coins twice', () => {
  const local = newProgress()
  local.totalXp = 140
  local.coins = 50
  const remote = { ...newProgress(), totalXp: 200, coins: 90 }
  const choice = chooseCloudProgress(remote, local, true)
  assert.equal(choice.migrate, false)
  assert.equal(choice.progress.totalXp, 200)
  assert.equal(choice.progress.coins, 90)
})

test('first account link migrates local progress; another account starts fresh', () => {
  const local = newProgress()
  local.totalXp = 140
  local.coins = 50
  assert.equal(chooseCloudProgress(null, local, true).progress.totalXp, 140)
  assert.equal(chooseCloudProgress(null, local, true).migrate, true)
  const other = chooseCloudProgress(null, local, false)
  assert.equal(other.progress.totalXp, 0)
  assert.equal(other.progress.coins, 0)
})

test('progress can be serialized and hydrated after a reload', () => {
  const current = newProgress()
  current.totalXp = 120
  current.playerLevel = 2
  current.currentXp = 20
  current.coins = 77
  current.ownedCosmetics.push('hat:cap')
  current.selectedLoadout.hat = 'cap'
  let stored = ''
  saveProgress(current, { setItem(key, value) { assert.equal(key, PROGRESS_KEY); stored = value } })
  const restored = hydrateProgress(JSON.parse(stored))
  assert.equal(restored.playerLevel, 2)
  assert.equal(restored.currentXp, 20)
  assert.equal(restored.coins, 77)
  assert.deepEqual(restored.ownedCosmetics, ['hat:cap'])
  assert.deepEqual(restored.selectedLoadout, { ...current.selectedLoadout, color: 'default' })
})
