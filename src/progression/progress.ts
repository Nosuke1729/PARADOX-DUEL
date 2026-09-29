import { ATTACKS, CHARACTERS, DEFAULT_ATTACK, SKILLS, WEAPONS } from '../game/balance'
import { DEFAULT_LOADOUT, type AttackStyle, type Character, type Loadout, type Skill, type Weapon } from '../game/types'
import { chapterById, STORY_CHAPTERS, type StoryChapter } from '../story/chapters'
import { COLORS, GEAR_CAPSULE_ITEMS, HATS, STARTER_UNLOCKS, UNLOCK_RULES, unlockRule, type UnlockCondition, type UnlockKind } from './catalog'

export const PROGRESS_KEY = 'paradox-duel:progress:v1'
export interface MasteryProgress { level: number; currentXp: number; totalXp: number }
export interface PlayerProgress {
  version: 1
  playerLevel: number; currentXp: number; totalXp: number; coins: number
  unlockedCharacters: Character[]; unlockedWeapons: Weapon[]; unlockedSkills: Skill[]; unlockedAttacks: AttackStyle[]
  unlockedColors: string[]; selectedLoadout: Loadout
  ownedCosmetics: string[]
  ownedGear: string[]
  storyProgress: { clearedChapters: number[]; defeatedBosses: string[] }
  characterMastery: Record<Character, MasteryProgress>
  onlineWins: number; onlineLosses: number
  characterUses: Record<Character, number>
}
export type ProgressEvent = { kind: 'level' | 'mastery' | 'unlock'; title: string; detail: string }

const masteryStart = (level = 0): MasteryProgress => ({ level, currentXp: 0, totalXp: 0 })
export function newProgress(): PlayerProgress {
  return {
    version: 1, playerLevel: 1, currentXp: 0, totalXp: 0, coins: 0,
    unlockedCharacters: [...STARTER_UNLOCKS.character], unlockedWeapons: [...STARTER_UNLOCKS.weapon],
    unlockedSkills: [...STARTER_UNLOCKS.skill], unlockedAttacks: [...STARTER_UNLOCKS.attack],
    unlockedColors: [...STARTER_UNLOCKS.color], ownedCosmetics: [], ownedGear: [], selectedLoadout: { ...DEFAULT_LOADOUT },
    storyProgress: { clearedChapters: [], defeatedBosses: [] },
    characterMastery: { standard: masteryStart(1), light: masteryStart(), heavy: masteryStart() },
    onlineWins: 0, onlineLosses: 0, characterUses: { standard: 0, light: 0, heavy: 0 },
  }
}
export function xpForNextLevel(level: number): number { return 100 + Math.max(0, level - 1) * 50 }
export function masteryXpForNext(level: number): number { return 60 + Math.max(0, level - 1) * 40 }
const nonnegative = (value: unknown, fallback = 0): number => typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.floor(value)) : fallback
const record = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
const names = (value: unknown): string[] => Array.isArray(value) ? value.filter((id): id is string => typeof id === 'string') : []

export function hydrateProgress(raw: unknown): PlayerProgress {
  const source = record(raw)
  const progress = newProgress()
  progress.playerLevel = Math.min(1000, Math.max(1, nonnegative(source.playerLevel, 1)))
  progress.currentXp = Math.min(nonnegative(source.currentXp), xpForNextLevel(progress.playerLevel) - 1)
  progress.totalXp = nonnegative(source.totalXp)
  progress.coins = nonnegative(source.coins)
  progress.onlineWins = nonnegative(source.onlineWins)
  progress.onlineLosses = nonnegative(source.onlineLosses)
  progress.ownedCosmetics = [...new Set(names(source.ownedCosmetics).filter(id =>
    id in COLORS && id !== 'default' && id !== 'arc_cyan' || id.startsWith('hat:') && Object.hasOwn(HATS, id.slice(4)) && id !== 'hat:none'))]
  const gearKeys = new Set(GEAR_CAPSULE_ITEMS.map(item => `${item.kind}:${item.id}`))
  progress.ownedGear = [...new Set(names(source.ownedGear).filter(id => gearKeys.has(id)))]
  const story = record(source.storyProgress)
  progress.storyProgress.clearedChapters = [...new Set((Array.isArray(story.clearedChapters) ? story.clearedChapters : [])
    .filter((id): id is number => Number.isInteger(id) && Boolean(chapterById(id as number))))].sort((a, b) => a - b)
  const bossIds = new Set(STORY_CHAPTERS.flatMap(chapter => chapter.boss ? [chapter.boss.id] : []))
  progress.storyProgress.defeatedBosses = [...new Set(names(story.defeatedBosses).filter(id => bossIds.has(id)))]
  const mastery = record(source.characterMastery)
  const uses = record(source.characterUses)
  for (const character of Object.keys(CHARACTERS) as Character[]) {
    const entry = record(mastery[character])
    progress.characterMastery[character] = {
      level: Math.min(1000, nonnegative(entry.level, character === 'standard' ? 1 : 0)),
      currentXp: nonnegative(entry.currentXp), totalXp: nonnegative(entry.totalXp),
    }
    progress.characterUses[character] = nonnegative(uses[character])
  }
  syncUnlocks(progress)
  progress.selectedLoadout = sanitizeLoadout(progress, source.selectedLoadout)
  return progress
}
export function loadProgress(storage: Pick<Storage, 'getItem'> = localStorage): PlayerProgress {
  try { const json = storage.getItem(PROGRESS_KEY); return hydrateProgress(json ? JSON.parse(json) : undefined) }
  catch { return newProgress() }
}
export function saveProgress(progress: PlayerProgress, storage: Pick<Storage, 'setItem'> = localStorage): void {
  storage.setItem(PROGRESS_KEY, JSON.stringify(progress))
}

function conditionMet(progress: PlayerProgress, condition: UnlockCondition): boolean {
  switch (condition.type) {
    case 'level': return progress.playerLevel >= condition.level
    case 'chapter': return progress.storyProgress.clearedChapters.includes(condition.chapter)
    case 'boss': return progress.storyProgress.defeatedBosses.includes(condition.id)
    case 'mastery': return progress.characterMastery[condition.character].level >= condition.level
    case 'weapon': return progress.unlockedWeapons.includes(condition.weapon)
  }
}
export function canUse(progress: PlayerProgress, kind: UnlockKind, id: string): boolean {
  if ((STARTER_UNLOCKS[kind] as string[]).includes(id)) return true
  if (kind === 'color' && id in COLORS && progress.ownedCosmetics.includes(id)) return true
  if (kind === 'hat' && Object.hasOwn(HATS, id) && progress.ownedCosmetics.includes(`hat:${id}`)) return true
  if (progress.ownedGear.includes(`${kind}:${id}`)) return true
  const rule = unlockRule(kind, id)
  return Boolean(rule && rule.anyOf.some(condition => conditionMet(progress, condition)))
}
export function lockHint(kind: UnlockKind, id: string): string {
  const hint = unlockRule(kind, id)?.hint ?? 'まだ使えません'
  return GEAR_CAPSULE_ITEMS.some(item => item.kind === kind && item.id === id) ? `${hint} / 装備カプセル` : hint
}
export function syncUnlocks(progress: PlayerProgress): ProgressEvent[] {
  const before = new Set<string>([
    ...progress.unlockedCharacters.map(id => `character:${id}`), ...progress.unlockedWeapons.map(id => `weapon:${id}`),
    ...progress.unlockedSkills.map(id => `skill:${id}`), ...progress.unlockedAttacks.map(id => `attack:${id}`),
    ...progress.unlockedColors.map(id => `color:${id}`),
    ...Object.keys(HATS).filter(id => canUse(progress, 'hat', id)).map(id => `hat:${id}`),
  ])
  // Rules are ordered so weapon-based attack unlocks resolve after weapons.
  progress.unlockedCharacters = (Object.keys(CHARACTERS) as Character[]).filter(id => canUse(progress, 'character', id))
  for (const character of Object.keys(CHARACTERS) as Character[]) {
    if (progress.unlockedCharacters.includes(character)) progress.characterMastery[character].level = Math.max(1, progress.characterMastery[character].level)
    else if (character !== 'standard') progress.characterMastery[character] = masteryStart()
  }
  progress.unlockedWeapons = (Object.keys(WEAPONS) as Weapon[]).filter(id => canUse(progress, 'weapon', id))
  progress.unlockedSkills = (Object.keys(SKILLS) as Skill[]).filter(id => canUse(progress, 'skill', id))
  progress.unlockedAttacks = (Object.keys(ATTACKS) as AttackStyle[]).filter(id => canUse(progress, 'attack', id))
  progress.unlockedColors = Object.keys(COLORS).filter(id => canUse(progress, 'color', id))
  progress.selectedLoadout = sanitizeLoadout(progress, progress.selectedLoadout)
  return UNLOCK_RULES.filter(rule => canUse(progress, rule.kind, rule.id) && !before.has(`${rule.kind}:${rule.id}`))
    .map(rule => ({ kind: 'unlock', title: '使えるものが増えました！', detail: `${rule.name} / ${rule.kind === 'character' ? 'キャラ' : rule.kind === 'weapon' ? '武器' : rule.kind === 'attack' ? '攻撃' : rule.kind === 'skill' ? 'スキル' : rule.kind === 'hat' ? '帽子' : '色'}` }))
}
export function sanitizeLoadout(progress: PlayerProgress, value: unknown): Loadout {
  const input = record(value)
  const character = typeof input.character === 'string' && input.character in CHARACTERS && canUse(progress, 'character', input.character)
    ? input.character as Character : DEFAULT_LOADOUT.character
  const weapon = typeof input.weapon === 'string' && input.weapon in WEAPONS && canUse(progress, 'weapon', input.weapon)
    ? input.weapon as Weapon : DEFAULT_LOADOUT.weapon
  const skill = typeof input.skill === 'string' && input.skill in SKILLS && canUse(progress, 'skill', input.skill)
    ? input.skill as Skill : DEFAULT_LOADOUT.skill
  const attack = typeof input.attack === 'string' && input.attack in ATTACKS &&
    ATTACKS[input.attack as AttackStyle].weapon === weapon && canUse(progress, 'attack', input.attack)
    ? input.attack as AttackStyle : DEFAULT_ATTACK[weapon]
  const color = typeof input.color === 'string' && input.color in COLORS && canUse(progress, 'color', input.color)
    ? input.color : 'default'
  const hat = typeof input.hat === 'string' && Object.hasOwn(HATS, input.hat) && canUse(progress, 'hat', input.hat)
    ? input.hat : 'none'
  return { character, weapon, skill, attack, color, hat }
}
export function isChapterAvailable(progress: PlayerProgress, chapterId: number): boolean {
  return Boolean(chapterById(chapterId) && (chapterId === 1 || progress.storyProgress.clearedChapters.includes(chapterId - 1)))
}
function awardXp(progress: PlayerProgress, amount: number): ProgressEvent[] {
  const events: ProgressEvent[] = []
  progress.totalXp += amount
  progress.currentXp += amount
  while (progress.currentXp >= xpForNextLevel(progress.playerLevel)) {
    const previous = progress.playerLevel
    progress.currentXp -= xpForNextLevel(previous)
    progress.playerLevel++
    events.push({ kind: 'level', title: 'レベルアップ！', detail: `レベル ${previous} → ${progress.playerLevel}` })
  }
  return events
}
export function awardMastery(progress: PlayerProgress, character: Character, amount: number): ProgressEvent[] {
  const entry = progress.characterMastery[character]
  entry.totalXp += amount
  entry.currentXp += amount
  const events: ProgressEvent[] = []
  while (entry.currentXp >= masteryXpForNext(entry.level)) {
    const previous = entry.level
    entry.currentXp -= masteryXpForNext(previous)
    entry.level++
    events.push({ kind: 'mastery', title: '使いこなしてきた！', detail: `${CHARACTERS[character].name} 熟練度 ${previous} → ${entry.level}` })
  }
  return events
}
export function storyReward(chapter: Pick<StoryChapter, 'rewardXp' | 'rewardCoins'>, firstClear: boolean): { xp: number; coins: number } {
  return firstClear ? { xp: chapter.rewardXp, coins: chapter.rewardCoins } :
    { xp: Math.max(25, Math.round(chapter.rewardXp * 0.25)),
      coins: Math.max(10, Math.min(120, Math.round(chapter.rewardCoins * 0.2))) }
}
export function awardStoryVictory(progress: PlayerProgress, chapterId: number, character: Character): ProgressEvent[] {
  const chapter = chapterById(chapterId)
  if (!chapter || !isChapterAvailable(progress, chapterId)) return []
  const firstClear = !progress.storyProgress.clearedChapters.includes(chapterId)
  if (firstClear) progress.storyProgress.clearedChapters.push(chapterId)
  if (chapter.boss && !progress.storyProgress.defeatedBosses.includes(chapter.boss.id)) progress.storyProgress.defeatedBosses.push(chapter.boss.id)
  const { xp, coins } = storyReward(chapter, firstClear)
  progress.coins += coins
  const events: ProgressEvent[] = [
    { kind: 'unlock', title: firstClear ? 'ステージクリア！' : 'もう一度クリア！', detail: `+${xp} XP / +${coins} コイン` },
    ...awardXp(progress, xp), ...awardMastery(progress, character, firstClear ? 75 + chapterId * 15 : 25),
  ]
  events.push(...syncUnlocks(progress))
  return events
}
export function awardMatchResult(progress: PlayerProgress, mode: 'practice' | 'online', result: 'win' | 'loss' | 'draw', character: Character): ProgressEvent[] {
  if (mode === 'online') {
    if (result === 'win') progress.onlineWins++
    if (result === 'loss') progress.onlineLosses++
    progress.coins += result === 'win' ? 25 : 5
  }
  const events = awardMastery(progress, character, mode === 'online' ? result === 'win' ? 45 : 20 : 15)
  events.push(...syncUnlocks(progress))
  return events
}
export function recordCharacterUse(progress: PlayerProgress, character: Character): void { progress.characterUses[character]++ }
export function favoriteCharacter(progress: PlayerProgress): Character {
  return (Object.keys(CHARACTERS) as Character[]).sort((a, b) => progress.characterUses[b] - progress.characterUses[a])[0]
}
