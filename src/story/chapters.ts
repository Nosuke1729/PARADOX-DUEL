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
  arena?: { platformX: number; platformY: number; platformWidth: number; accent: number }
}

export const STORY_CHAPTERS: readonly StoryChapter[] = [
  { id: 1, title: 'まずは練習', subtitle: '分身の出し方', briefing: '動いて、攻撃して、Lキーで分身を出してみよう。相手は練習用のAIです。', enemyName: '練習相手',
    enemy: { character: 'standard', weapon: 'sword', skill: 'blink', attack: 'basic_slash' }, difficulty: 'easy', rewardXp: 120, rewardCoins: 60 },
  { id: 2, title: 'すばしっこい相手', subtitle: 'LIGHTと対戦', briefing: 'よく走るLIGHTとの対戦。勝つとLIGHTを使えるようになります。', enemyName: 'LIGHT',
    enemy: { character: 'light', weapon: 'sword', skill: 'blink', attack: 'basic_slash' }, difficulty: 'normal',
    boss: { id: 'light', hpMultiplier: 1.55, phaseAt: 0.5, special: 'dash_burst' }, rewardXp: 180, rewardCoins: 100 },
  { id: 3, title: '遠くから来るやつ', subtitle: '飛び道具に注意', briefing: '遠くから撃ってくる相手。分身と一緒に近づこう。', enemyName: '遠距離AI',
    enemy: { character: 'standard', weapon: 'blaster', skill: 'shield', attack: 'blaster_shot' }, difficulty: 'normal', rewardXp: 240, rewardCoins: 130 },
  { id: 4, title: 'でっかい相手', subtitle: 'HEAVYと対戦', briefing: '大きくて硬いHEAVY。後半は守りがさらに強くなります。', enemyName: 'HEAVY',
    enemy: { character: 'heavy', weapon: 'spear', skill: 'shield', attack: 'spear_thrust' }, difficulty: 'hard',
    boss: { id: 'heavy', hpMultiplier: 1.65, phaseAt: 0.45, special: 'iron_guard' }, rewardXp: 300, rewardCoins: 170 },
  { id: 5, title: '分身どうしで大騒ぎ', subtitle: '最後の対戦', briefing: '相手も分身を使います。ごちゃごちゃする前に、落ち着いて対処しよう。', enemyName: '分身使い',
    enemy: { character: 'standard', weapon: 'sword', skill: 'echo_swap', attack: 'heavy_slash' }, difficulty: 'hard',
    boss: { id: 'echo_master', hpMultiplier: 1.75, phaseAt: 0.5, special: 'echo_pressure' }, rewardXp: 360, rewardCoins: 220 },
  { id: 6, title: 'ちょこまか短剣', subtitle: '短剣を使ってみよう', briefing: '短剣使いは近くまで素早く来ます。足場の位置にも気をつけよう。クリアでDAGGERが使えます。', enemyName: '短剣使い',
    enemy: { character: 'light', weapon: 'dagger', skill: 'blink', attack: 'dagger_stab' }, difficulty: 'normal', rewardXp: 420, rewardCoins: 240,
    arena: { platformX: 195, platformY: 336, platformWidth: 250, accent: 0x69c9ae } },
  { id: 7, title: 'どっしりハンマー', subtitle: '振りかぶりを見てよけよう', briefing: '一発が痛いハンマー使い。空振りしたところを狙おう。クリアでHAMMERが使えます。', enemyName: 'ハンマー使い',
    enemy: { character: 'heavy', weapon: 'hammer', skill: 'shield', attack: 'hammer_smash' }, difficulty: 'hard', rewardXp: 480, rewardCoins: 280,
    arena: { platformX: 515, platformY: 348, platformWidth: 245, accent: 0xf1bb72 } },
  { id: 8, title: 'いろいろ総当たり', subtitle: '分身と新しい技のまとめ', briefing: '短剣の踏み込みと分身を使う相手。覚えた動きを試してみよう。', enemyName: '欲張りファイター',
    enemy: { character: 'standard', weapon: 'dagger', skill: 'echo_swap', attack: 'dagger_lunge' }, difficulty: 'hard',
    boss: { id: 'mix_master', hpMultiplier: 1.6, phaseAt: 0.45, special: 'echo_pressure' }, rewardXp: 550, rewardCoins: 340,
    arena: { platformX: 352, platformY: 315, platformWidth: 255, accent: 0xb5a5ec } },
]

export function chapterById(id: number): StoryChapter | undefined { return STORY_CHAPTERS.find(chapter => chapter.id === id) }
