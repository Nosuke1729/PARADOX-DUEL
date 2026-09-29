import type { Loadout } from '../game/types'

export type Difficulty = 'easy' | 'normal' | 'hard'
export interface BossConfig {
  id: string
  hpMultiplier: number
  phaseAt: number
  special: 'dash_burst' | 'iron_guard' | 'echo_pressure'
}
export interface StoryChapter {
  id: number
  title: string
  subtitle: string
  briefing: string
  enemyName: string
  enemy: Loadout
  difficulty: Difficulty
  boss?: BossConfig
  rewardXp: number
  rewardCoins: number
}

export const STORY_CHAPTERS: readonly StoryChapter[] = [
  { id: 1, title: 'AWAKENING', subtitle: 'Echo起動', briefing: 'NORMAL型の訓練機と戦い、移動・攻撃・Echoの基本を覚える。', enemyName: 'TRAINING UNIT',
    enemy: { character: 'standard', weapon: 'sword', skill: 'blink', attack: 'basic_slash' }, difficulty: 'easy', rewardXp: 120, rewardCoins: 60 },
  { id: 2, title: 'SPEED', subtitle: '速度の試練', briefing: '高速移動とDashを操るLIGHTを倒し、新たな機体を解放する。', enemyName: 'LIGHT / BOSS',
    enemy: { character: 'light', weapon: 'sword', skill: 'blink', attack: 'basic_slash' }, difficulty: 'normal',
    boss: { id: 'light', hpMultiplier: 1.55, phaseAt: 0.5, special: 'dash_burst' }, rewardXp: 180, rewardCoins: 100 },
  { id: 3, title: 'RANGE', subtitle: '射線の支配', briefing: '距離を保って撃つBLASTER型AIに、Echoで接近する。', enemyName: 'RANGE UNIT',
    enemy: { character: 'standard', weapon: 'blaster', skill: 'shield', attack: 'blaster_shot' }, difficulty: 'normal', rewardXp: 240, rewardCoins: 130 },
  { id: 4, title: 'POWER', subtitle: '重量の壁', briefing: '高耐久のHEAVYを崩す。後半はガードがさらに堅くなる。', enemyName: 'HEAVY / BOSS',
    enemy: { character: 'heavy', weapon: 'spear', skill: 'shield', attack: 'spear_thrust' }, difficulty: 'hard',
    boss: { id: 'heavy', hpMultiplier: 1.65, phaseAt: 0.45, special: 'iron_guard' }, rewardXp: 300, rewardCoins: 170 },
  { id: 5, title: 'ECHO', subtitle: '残像との決闘', briefing: 'Echoを積極的に使う最後の試練。時間差攻撃を見切る。', enemyName: 'ECHO MASTER / BOSS',
    enemy: { character: 'standard', weapon: 'sword', skill: 'echo_swap', attack: 'heavy_slash' }, difficulty: 'hard',
    boss: { id: 'echo_master', hpMultiplier: 1.75, phaseAt: 0.5, special: 'echo_pressure' }, rewardXp: 360, rewardCoins: 220 },
]

export function chapterById(id: number): StoryChapter | undefined { return STORY_CHAPTERS.find(chapter => chapter.id === id) }
