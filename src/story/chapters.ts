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
  { id: 9, title: 'とんでる相手に扇', subtitle: '上下に広い攻撃', briefing: '扇使いはジャンプした相手を狙います。横から近づくか、分身を先に出してみよう。', enemyName: '扇使い',
    enemy: { character: 'standard', weapon: 'fan', skill: 'blink', attack: 'fan_swat' }, difficulty: 'normal', rewardXp: 620, rewardCoins: 380,
    arena: { platformX: 145, platformY: 327, platformWidth: 235, accent: 0x97d9c2 } },
  { id: 10, title: '跳びすぎ注意', subtitle: '空中から来る相手', briefing: 'SPRINGで急に高く跳ぶ相手。着地先を読んで待ち受けよう。', enemyName: '跳ねるファイター',
    enemy: { character: 'light', weapon: 'sword', skill: 'spring', attack: 'upper_slash' }, difficulty: 'hard',
    boss: { id: 'spring_fighter', hpMultiplier: 1.45, phaseAt: 0.45, special: 'dash_burst' }, rewardXp: 700, rewardCoins: 420,
    arena: { platformX: 568, platformY: 348, platformWidth: 240, accent: 0x8fc9f1 } },
  { id: 11, title: '扇と分身で大混乱', subtitle: '間合いを見極めよう', briefing: '押し出す扇と分身を組み合わせてきます。近づきすぎず、攻撃後の隙を狙おう。', enemyName: '扇の達人',
    enemy: { character: 'standard', weapon: 'fan', skill: 'echo_swap', attack: 'fan_gust' }, difficulty: 'hard',
    boss: { id: 'fan_master', hpMultiplier: 1.55, phaseAt: 0.5, special: 'echo_pressure' }, rewardXp: 780, rewardCoins: 500,
    arena: { platformX: 352, platformY: 322, platformWidth: 255, accent: 0xf0b3df } },
  { id: 12, title: 'ヨーヨー名人', subtitle: '届く時間を見よう', briefing: '投げたヨーヨーがしばらく前に残ります。空振りを誘ってから近づこう。クリアでYO-YOが使えます。', enemyName: 'ヨーヨー名人',
    enemy: { character: 'light', weapon: 'yoyo', skill: 'blink', attack: 'yoyo_toss' }, difficulty: 'normal', rewardXp: 850, rewardCoins: 530,
    arena: { platformX: 178, platformY: 343, platformWidth: 208, accent: 0xe1c373 } },
  { id: 13, title: 'ムチの間合い', subtitle: '遠くても油断しない', briefing: 'ムチは広く届きますが、振った後に大きな隙があります。分身で挟むのも有効。クリアでWHIPが使えます。', enemyName: 'ムチ使い',
    enemy: { character: 'standard', weapon: 'whip', skill: 'shield', attack: 'whip_snap' }, difficulty: 'hard', rewardXp: 920, rewardCoins: 570,
    arena: { platformX: 553, platformY: 324, platformWidth: 222, accent: 0xef9a83 } },
  { id: 14, title: 'ごちゃまぜチャンピオン', subtitle: '新しい武器の総仕上げ', briefing: 'ムチと分身を組み合わせる相手です。跳ぶ・近づく・待つを使い分けよう。クリアで新しいムチ技が使えます。', enemyName: 'チャンピオン',
    enemy: { character: 'heavy', weapon: 'whip', skill: 'echo_swap', attack: 'whip_sweep' }, difficulty: 'hard',
    boss: { id: 'arena_champion', hpMultiplier: 1.6, phaseAt: 0.48, special: 'echo_pressure' }, rewardXp: 1050, rewardCoins: 650,
    arena: { platformX: 359, platformY: 318, platformWidth: 242, accent: 0xc2a8ee } },
]

export function chapterById(id: number): StoryChapter | undefined { return STORY_CHAPTERS.find(chapter => chapter.id === id) }
