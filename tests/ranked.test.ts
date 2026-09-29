import assert from 'node:assert/strict'
import test from 'node:test'
import { validUsername } from '../src/account/username'
import { canMatch, eloResult, rankTier, ratingRange } from '../src/ranked/rating'

test('username validation rejects empty, invalid and oversized names', () => {
  assert.equal(validUsername('Zero_01'), true)
  assert.equal(validUsername('a'), false)
  assert.equal(validUsername('a'.repeat(17)), false)
  assert.equal(validUsername('bad name'), false)
  assert.equal(validUsername(''), false)
})
test('Elo rewards an upset and conserves rating before zero floor', () => {
  assert.deepEqual(eloResult(1000, 1000, 1), [1016, 984])
  const [winner, loser] = eloResult(900, 1200, 1)
  assert.ok(winner - 900 > 16)
  assert.equal(winner + loser, 2100)
})
test('tier boundaries and widening matchmaking are configurable', () => {
  assert.equal(rankTier(899), 'BRONZE')
  assert.equal(rankTier(1000), 'SILVER')
  assert.equal(rankTier(1100), 'GOLD')
  assert.equal(rankTier(1700), 'MASTER')
  assert.equal(ratingRange(0), 150)
  assert.equal(ratingRange(10), 300)
  assert.equal(canMatch('a', 'a', 1000, 1000, 30, 30), false)
  assert.equal(canMatch('a', 'b', 1000, 1300, 0, 0), false)
  assert.equal(canMatch('a', 'b', 1000, 1300, 10, 0), true)
})
