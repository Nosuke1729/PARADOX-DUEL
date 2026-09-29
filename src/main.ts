import Phaser from 'phaser'
import { BattleScene } from './game/BattleScene'
import { ATTACKS, CHARACTERS, SKILLS, WEAPONS } from './game/balance'
import { BOT_LOADOUT, WORLD, type AttackStyle, type Character, type Loadout, type Skill, type Weapon } from './game/types'
import { soundFX } from './game/SoundFX'
import { RoomManager } from './network/RoomManager'
import { CloudProgress } from './progression/cloud'
import { COLORS, type UnlockKind } from './progression/catalog'
import { awardMatchResult, awardStoryVictory, canUse, favoriteCharacter, isChapterAvailable, loadProgress, lockHint, recordCharacterUse, sanitizeLoadout, xpForNextLevel, type ProgressEvent } from './progression/progress'
import { RankedService, type RankedMatch, type RankedStats } from './ranked/RankedService'
import { rankTier } from './ranked/rating'
import { STORY_CHAPTERS, type Difficulty, type StoryChapter } from './story/chapters'
import './style.css'

const app = document.querySelector<HTMLDivElement>('#app')!
app.innerHTML = `
  <div class="shell">
    <main class="menu" id="menu">
      <div class="hero"><h1>影分身<br><em>ファイターズ</em></h1>
        <p class="tagline">4秒前の自分が、ちょっと助けに来る。</p>
        <p class="intro">自分の動きを4秒間記録して、分身として呼び出せる2D対戦アクションです。分身も走って、跳んで、攻撃します。AIと練習したり、友だちやほかのプレイヤーと対戦したりできます。</p>
        <div class="how-to" aria-label="このゲームの遊び方"><span>① 動いて攻撃</span><span>② Lキーで分身</span><span>③ いっしょに挟み撃ち</span></div>
        <p class="level-strip" id="menu-level"></p>
      </div>
      <nav class="menu-panel" aria-label="メインメニュー">
        <div class="loadout-heading"><span>あそぶ</span></div>
        <button id="menu-story" class="button primary">ストーリー <span>→</span></button>
        <button id="menu-online" class="button secondary">オンライン対戦 <span>→</span></button>
        <button id="practice" class="button secondary">練習する <span>→</span></button>
        <div class="loadout-heading menu-group"><span>じゅんび</span></div>
        <button id="menu-fighter" class="button secondary">キャラと装備 <span>→</span></button>
        <button id="menu-profile" class="button secondary">プロフィール <span>→</span></button>
        <button id="menu-account" class="button secondary">アカウント <span>→</span></button>
        <button id="menu-ranking" class="button secondary">ランキング <span>→</span></button>
        <div class="coming-row"><span>ショップは準備中です</span></div>
        <p id="menu-status" class="status" role="status"></p>
      </nav>
    </main>
    <section id="story" class="page hidden"><div class="page-head"><div><h2>ストーリー</h2><p>AIと戦って、キャラや武器を少しずつ増やそう。</p></div><button class="button secondary back-menu">← メニュー</button></div>
      <div class="story-toolbar"><label for="difficulty">むずかしさ</label><select id="difficulty"><option value="recommended" selected>おまかせ</option><option value="easy">やさしい</option><option value="normal">ふつう</option><option value="hard">むずかしい</option></select><span>各ステージのおすすめ設定で始めます。ここで変更できます。</span></div>
      <div id="chapter-list" class="chapter-grid"></div></section>
    <section id="fighter" class="page hidden"><div class="page-head"><div><h2>キャラと装備</h2><p>使うキャラ、武器、攻撃、スキルを選びます。</p></div><button class="button secondary back-menu">← メニュー</button></div>
      <div class="fighter-grid">
        <div class="fighter-fields">
          <div class="selection"><label for="character">キャラ</label><select id="character"></select><p id="character-description" class="selection-description"></p><small id="character-ratings" class="ratings"></small></div>
          <div class="selection"><label for="weapon">武器</label><select id="weapon"></select><p id="weapon-description" class="selection-description"></p></div>
          <div class="selection"><label for="attack">攻撃</label><select id="attack"></select><p id="attack-description" class="selection-description"></p></div>
          <div class="selection"><label for="skill">スキル（Iキー）</label><select id="skill"></select><p id="skill-description" class="selection-description"></p></div>
          <div class="selection"><label for="color">色</label><select id="color"></select><p id="color-description" class="selection-description"></p></div>
          <div class="selection"><label>見た目アイテム</label><p class="selection-description">分身の色・スキン・称号は今後追加予定です。</p></div>
        </div><div class="inventory-panel"><p class="eyebrow">使えるもの・まだ使えないもの</p><div id="unlock-list"></div></div>
      </div></section>
    <section id="profile" class="page hidden"><div class="page-head"><div><h2>プロフィール</h2><p>レベルや戦績のまとめです。ログイン中はクラウドにも保存されます。</p></div><button class="button secondary back-menu">← メニュー</button></div><div id="profile-data" class="profile-grid"></div>
      <p class="profile-future">実績・称号・対戦履歴は準備中です。</p></section>
    <section id="account" class="page hidden"><div class="page-head"><div><h2>アカウント</h2><p>ログインすると、別の端末でも同じ続きから遊べます。</p></div><button class="button secondary back-menu">← メニュー</button></div>
      <div class="account-panel"><div id="account-signed-out"><h3>ログインしていません</h3><div class="account-switch"><button id="auth-signup-mode" class="button secondary">新規登録</button><button id="auth-login-mode" class="button secondary">ログイン</button></div>
        <form id="auth-form"><label for="auth-email">メールアドレス</label><input id="auth-email" type="email" required autocomplete="email">
          <label for="auth-password">パスワード</label><input id="auth-password" type="password" required minlength="6" autocomplete="current-password">
          <div id="auth-username-field" class="hidden"><label for="auth-username">ユーザー名（英数字・_、3〜16文字）</label><input id="auth-username" type="text" minlength="3" maxlength="16" pattern="[A-Za-z0-9_]{3,16}" autocomplete="username"></div>
          <button id="auth-submit" class="button primary" type="submit">ログイン →</button></form></div>
        <div id="account-signed-in" class="hidden"><h3>ログイン中</h3><div id="account-summary" class="account-summary"></div>
          <div class="account-switch"><input id="username-edit" maxlength="16" placeholder="ユーザー名" aria-label="ユーザー名"><button id="username-save" class="button secondary">ユーザー名を保存</button></div>
          <button id="account-profile" class="button secondary">プロフィール →</button><button id="account-logout" class="button secondary">ログアウト</button></div>
        <p id="account-status" class="status" role="status"></p></div></section>
    <section id="ranking" class="page hidden"><div class="page-head"><div><h2>ランキング</h2><p>レート上位100人と自分の順位です。</p></div><button class="button secondary back-menu">← メニュー</button></div>
      <div id="ranking-content" class="ranking-panel"></div></section>
    <section id="online" class="page hidden"><div class="page-head"><div><h2>オンライン対戦</h2><p>ランク戦では、レベルでHPや速さが増えることはありません。</p></div><button class="button secondary back-menu">← メニュー</button></div>
      <div class="online-panel"><p>気軽なマッチングは準備中です</p><button id="ranked-start" class="button primary">ランク戦 <span>→</span></button><h3>友だちと対戦</h3>
        <button id="create" class="button primary">部屋をつくる <span>→</span></button>
        <div class="join-row"><input id="room-code" maxlength="6" autocomplete="off" spellcheck="false" aria-label="ルームコード" placeholder="部屋コード"><button id="join" class="button secondary">参加</button></div>
        <p id="online-status" class="status" role="status"></p>
      </div></section>
    <section id="ranked-search" class="lobby hidden"><h2 id="ranked-search-title">相手を探しています</h2>
      <p id="ranked-search-status" class="waiting">近いレートの相手を探しています…</p><button id="ranked-cancel" class="button secondary">検索をやめる</button></section>
    <section id="lobby" class="lobby hidden" aria-live="polite"><h2 id="lobby-title">部屋をつくりました</h2>
      <p class="lobby-hint">このコードを対戦相手に共有してください</p><div class="code" id="lobby-code"></div>
      <p id="lobby-status" class="waiting">相手を待っています…</p><button id="lobby-back" class="button secondary">メニューに戻る</button></section>
    <section id="arena" class="arena hidden"><div id="game"></div><button id="arena-back" class="arena-back" aria-label="対戦を終了してメニューへ戻る">対戦をやめる</button>
      <div id="dialog" class="dialog hidden"><h2 id="dialog-title"></h2><p id="dialog-copy"></p><div id="reward-events" class="reward-events"></div><div class="dialog-actions">
        <button id="rematch" class="button primary">もう一戦</button><button id="leave" class="button secondary">メニューに戻る</button></div></div></section>
    <footer class="footer"><span>A / D：移動　Space：ジャンプ　J：攻撃　K：ダッシュ　L：分身　I：スキル</span></footer>
  </div>`

const byId = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T
const screens = ['menu', 'story', 'fighter', 'profile', 'account', 'ranking', 'online', 'ranked-search', 'lobby', 'arena'] as const
type Screen = typeof screens[number]
const menuStatus = byId<HTMLElement>('menu-status')
const onlineStatus = byId<HTMLElement>('online-status')
const lobbyStatus = byId<HTMLElement>('lobby-status')
const dialog = byId<HTMLElement>('dialog')
let progress = loadProgress()
let room: RoomManager | undefined
let game: Phaser.Game | undefined
let battle: BattleScene | undefined
let starting = false
let activeStory: StoryChapter | undefined
let roomAttempt = 0
let activeRanked: RankedMatch | undefined
let rankedNames: [string, string] | undefined
let rankedResultReported = false
let disconnectTimer: number | undefined
let currentScreen: Screen = 'menu'
let authMode: 'signup' | 'login' = 'login'
const ranked = new RankedService()
const cloud = new CloudProgress(
  loaded => { progress = loaded; if (currentScreen === 'menu') renderMenu(); if (currentScreen === 'fighter') renderFighter(); if (currentScreen === 'profile') void renderProfile() },
  message => { menuStatus.textContent = message; byId('account-status').textContent = message },
  () => { if (currentScreen === 'account') void renderAccount(); if (currentScreen === 'profile') void renderProfile() },
)

function showScreen(screen: Screen): void {
  currentScreen = screen
  for (const id of screens) byId(id).classList.toggle('hidden', id !== screen)
  if (screen === 'menu') renderMenu()
  if (screen === 'story') renderStory()
  if (screen === 'fighter') renderFighter()
  if (screen === 'profile') void renderProfile()
  if (screen === 'account') void renderAccount()
  if (screen === 'ranking') void renderRanking()
}
function persist(): void { cloud.schedule(progress) }
function currentLoadout(): Loadout {
  progress.selectedLoadout = sanitizeLoadout(progress, progress.selectedLoadout)
  persist()
  return progress.selectedLoadout
}
function renderMenu(): void {
  byId('menu-level').textContent = `レベル ${progress.playerLevel}  ·  ${progress.currentXp} / ${xpForNextLevel(progress.playerLevel)} XP  ·  ${progress.coins} コイン  ·  ${cloud.identity?.username ?? 'ゲスト'}`
}
const groupNames: Record<UnlockKind, string> = {
  character: 'キャラ', weapon: '武器', attack: '攻撃', skill: 'スキル', color: '色',
}
function addOptions(id: string, kind: UnlockKind, catalog: Record<string, { name: string; description: string }>, selected: string, weapon?: Weapon): void {
  const select = byId<HTMLSelectElement>(id)
  select.replaceChildren()
  for (const [key, config] of Object.entries(catalog)) {
    const option = document.createElement('option')
    option.value = key
    const compatible = !weapon || kind !== 'attack' || ATTACKS[key as AttackStyle].weapon === weapon
    const unlocked = canUse(progress, kind, key)
    option.disabled = !unlocked || !compatible
    option.textContent = `${config.name}${unlocked ? '' : '  🔒 ' + lockHint(kind, key)}${compatible ? '' : ' / 別の武器用'}`
    select.append(option)
  }
  select.value = selected
}
function renderFighter(): void {
  const selected = currentLoadout()
  addOptions('character', 'character', CHARACTERS, selected.character)
  addOptions('weapon', 'weapon', WEAPONS, selected.weapon)
  addOptions('attack', 'attack', ATTACKS, selected.attack ?? 'basic_slash', selected.weapon)
  addOptions('skill', 'skill', SKILLS, selected.skill)
  addOptions('color', 'color', COLORS, selected.color ?? 'default')
  byId('character-description').textContent = CHARACTERS[selected.character].description
  byId('character-ratings').textContent = CHARACTERS[selected.character].ratings
  byId('weapon-description').textContent = WEAPONS[selected.weapon].description
  byId('attack-description').textContent = ATTACKS[selected.attack!].description
  byId('skill-description').textContent = SKILLS[selected.skill].description
  byId('color-description').textContent = COLORS[selected.color ?? 'default'].description
  const list = byId('unlock-list')
  list.replaceChildren()
  const groups: [UnlockKind, Record<string, { name: string }>][] = [
    ['character', CHARACTERS], ['weapon', WEAPONS], ['attack', ATTACKS], ['skill', SKILLS], ['color', COLORS],
  ]
  for (const [kind, catalog] of groups) {
    const heading = document.createElement('h3'); heading.textContent = groupNames[kind]; list.append(heading)
    for (const [id, config] of Object.entries(catalog)) {
      const item = document.createElement('p')
      const unlocked = canUse(progress, kind, id)
      item.className = unlocked ? 'unlock-owned' : 'unlock-locked'
      item.textContent = `${unlocked ? '◆' : '🔒'} ${config.name}  ${unlocked ? '使えます' : lockHint(kind, id)}`
      list.append(item)
    }
  }
}
for (const id of ['character', 'weapon', 'attack', 'skill', 'color'] as const) {
  byId<HTMLSelectElement>(id).addEventListener('change', () => {
    const candidate: Loadout = { ...progress.selectedLoadout,
      character: byId<HTMLSelectElement>('character').value as Character,
      weapon: byId<HTMLSelectElement>('weapon').value as Weapon,
      attack: byId<HTMLSelectElement>('attack').value as AttackStyle,
      skill: byId<HTMLSelectElement>('skill').value as Skill,
      color: byId<HTMLSelectElement>('color').value }
    progress.selectedLoadout = sanitizeLoadout(progress, candidate)
    persist()
    renderFighter()
  })
}
function renderStory(): void {
  const list = byId('chapter-list')
  list.replaceChildren()
  for (const chapter of STORY_CHAPTERS) {
    const card = document.createElement('article'); card.className = 'chapter-card'
    const eyebrow = document.createElement('p'); eyebrow.className = 'eyebrow'; eyebrow.textContent = `ステージ ${chapter.id}${chapter.boss ? ' ・ ボス戦' : ''}`
    const title = document.createElement('h3'); title.textContent = chapter.title
    const briefing = document.createElement('p'); briefing.textContent = chapter.briefing
    const enemy = document.createElement('p'); enemy.className = 'chapter-meta'; enemy.textContent = `相手：${chapter.enemyName}  ·  報酬：${chapter.rewardXp} XP / ${chapter.rewardCoins} コイン`
    const button = document.createElement('button'); button.className = 'button ' + (isChapterAvailable(progress, chapter.id) ? 'primary' : 'secondary')
    button.disabled = !isChapterAvailable(progress, chapter.id)
    button.textContent = progress.storyProgress.clearedChapters.includes(chapter.id) ? 'もう一度 →' : button.disabled ? `🔒 先にステージ ${chapter.id - 1} をクリア` : 'はじめる →'
    button.addEventListener('click', () => {
      const selectedDifficulty = byId<HTMLSelectElement>('difficulty').value
      const difficulty: Difficulty = selectedDifficulty === 'recommended' ? chapter.difficulty : selectedDifficulty as Difficulty
      startBattle('story', [currentLoadout(), chapter.enemy], { ...chapter, difficulty })
    })
    card.append(eyebrow, title, briefing, enemy, button); list.append(card)
  }
}
async function renderProfile(): Promise<void> {
  let stats: RankedStats | undefined
  if (cloud.identity?.username) {
    try { stats = await ranked.stats(cloud.identity.userId) }
    catch { /* Local progression remains visible when the network is unavailable. */ }
  }
  if (currentScreen !== 'profile') return
  const data = byId('profile-data'); data.replaceChildren()
  const fields: [string, string][] = [
    ['ユーザー名', cloud.identity?.username ?? '未ログイン'],
    ['ランク', stats ? rankTier(stats.rating) : '—'],
    ['レート', stats ? String(stats.rating) : '—'],
    ['ランク戦の勝敗', stats ? `${stats.wins}勝 / ${stats.losses}敗` : '—'],
    ['勝率', stats && stats.matches ? `${Math.round(stats.wins / stats.matches * 100)}%` : stats ? '0%' : '—'],
    ['最高レート', stats ? String(stats.highest_rating) : '—'],
    ['レベル', `${progress.playerLevel}`], ['XP', `${progress.currentXp} / ${xpForNextLevel(progress.playerLevel)}`],
    ['累計XP', String(progress.totalXp)], ['コイン', String(progress.coins)],
    ['オンライン勝利', String(progress.onlineWins)], ['オンライン敗北', String(progress.onlineLosses)],
    ['ストーリー進行', `${progress.storyProgress.clearedChapters.length} / ${STORY_CHAPTERS.length} ステージ`],
    ['よく使うキャラ', CHARACTERS[favoriteCharacter(progress)].name],
    ...(['standard', 'light', 'heavy'] as Character[]).map(character =>
      [`${CHARACTERS[character].name} の熟練度`, `レベル ${progress.characterMastery[character].level}`] as [string, string]),
  ]
  for (const [label, value] of fields) {
    const cell = document.createElement('div'); cell.className = 'profile-cell'
    const name = document.createElement('span'); name.textContent = label
    const amount = document.createElement('strong'); amount.textContent = value
    cell.append(name, amount); data.append(cell)
  }
}
function setAuthMode(mode: 'signup' | 'login'): void {
  authMode = mode
  byId('auth-username-field').classList.toggle('hidden', mode !== 'signup')
  byId<HTMLInputElement>('auth-username').required = mode === 'signup'
  byId<HTMLInputElement>('auth-password').autocomplete = mode === 'signup' ? 'new-password' : 'current-password'
  byId<HTMLButtonElement>('auth-submit').textContent = mode === 'signup' ? '登録する →' : 'ログイン →'
  byId('auth-signup-mode').classList.toggle('primary', mode === 'signup')
  byId('auth-login-mode').classList.toggle('primary', mode === 'login')
}
async function renderAccount(): Promise<void> {
  const identity = cloud.identity
  byId('account-signed-out').classList.toggle('hidden', Boolean(identity))
  byId('account-signed-in').classList.toggle('hidden', !identity)
  if (!identity) return
  let rating = 1000
  try { rating = (await ranked.stats(identity.userId)).rating } catch { /* show local identity */ }
  if (currentScreen !== 'account') return
  byId('account-summary').replaceChildren()
  for (const value of [`ユーザー名：${identity.username ?? '未設定'}`,
    `レベル：${progress.playerLevel}`, `ランク：${rankTier(rating)}`, `レート：${rating}`]) {
    const row = document.createElement('p'); row.textContent = value; byId('account-summary').append(row)
  }
  byId<HTMLInputElement>('username-edit').value = identity.username ?? ''
}
async function renderRanking(): Promise<void> {
  const content = byId('ranking-content'); content.replaceChildren()
  if (!cloud.identity?.username) {
    content.textContent = 'ランキングを見るには、ログインしてユーザー名を設定してください。'
    return
  }
  content.textContent = 'ランキングを読み込み中…'
  try {
    const entries = await ranked.rankings()
    if (currentScreen !== 'ranking') return
    content.replaceChildren()
    const table = document.createElement('div'); table.className = 'ranking-table'
    for (const entry of entries) {
      if (entry.rank_position === 101 && !entry.is_self) continue
      const row = document.createElement('div'); row.className = entry.is_self ? 'ranking-row self' : 'ranking-row'
      for (const value of [String(entry.rank_position).padStart(2, '0'), entry.username,
        rankTier(entry.rating), String(entry.rating), `${entry.wins} W`]) {
        const cell = document.createElement('span'); cell.textContent = value; row.append(cell)
      }
      if (entry.is_self && entry.rank_position > 100) {
        const label = document.createElement('strong'); label.textContent = '自分の順位'; content.append(label)
      }
      table.append(row)
    }
    content.append(table)
  } catch (error) {
    content.textContent = error instanceof Error ? error.message : 'ランキングを読み込めませんでした。'
  }
}
function renderEvents(events: ProgressEvent[]): void {
  const container = byId('reward-events'); container.replaceChildren()
  for (const event of events) {
    const row = document.createElement('div'); row.className = 'reward-row ' + event.kind
    const title = document.createElement('strong'); title.textContent = event.title
    const detail = document.createElement('span'); detail.textContent = event.detail
    row.append(title, detail); container.append(row)
  }
}
function clearDisconnectChecks(): void {
  if (disconnectTimer) window.clearInterval(disconnectTimer)
  disconnectTimer = undefined
}
function renderRankedResult(match: RankedMatch): void {
  if (match.status === 'active') return
  activeRanked = match
  clearDisconnectChecks()
  if (currentScreen !== 'arena' || !cloud.identity) return
  game?.scene.getScenes(true).forEach(scene => scene.scene.pause())
  const first = cloud.identity.userId === match.player1
  const before = first ? match.rating1 : match.rating2
  const after = first ? match.rating_after1 : match.rating_after2
  if (match.status === 'disputed') {
    byId('dialog-title').textContent = '結果を確認できませんでした'
    byId('dialog-copy').textContent = '結果が一致しなかったためRatingは変更されません。'
    dialog.classList.remove('hidden')
    return
  }
  if (match.status !== 'completed' || after === null) return
  const delta = after - before
  byId('dialog-title').textContent = match.winner === null ? '引き分け' :
    match.winner === cloud.identity.userId ? '勝ち！' : '負け！'
  byId('dialog-copy').textContent = `レート  ${before} → ${after}   ${delta >= 0 ? '+' : ''}${delta}`
  const events: ProgressEvent[] = [{ kind: 'level', title: 'レート更新', detail: `${rankTier(after)} / ${after}` }]
  if (rankTier(before) !== rankTier(after) && delta > 0)
    events.push({ kind: 'unlock', title: 'ランクアップ！', detail: `${rankTier(before)} → ${rankTier(after)}` })
  renderEvents(events)
  dialog.classList.remove('hidden')
}
function startDisconnectChecks(): void {
  if (!activeRanked || disconnectTimer) return
  const matchId = activeRanked.id
  disconnectTimer = window.setInterval(() => {
    void ranked.claimDisconnect(matchId).then(renderRankedResult).catch(error => {
      if (error instanceof Error && error.message.includes('still reconnect')) return
      byId('dialog-copy').textContent = '接続を確認中です。少しお待ちください。'
    })
  }, 5000)
}
async function beginRankedMatch(match: RankedMatch): Promise<void> {
  if (!cloud.identity) return
  const attempt = ++roomAttempt
  activeRanked = match
  rankedResultReported = false
  byId('ranked-search-title').textContent = '相手が見つかりました！'
  byId('ranked-search-status').textContent = '対戦の準備中…'
  byId<HTMLButtonElement>('ranked-cancel').disabled = true
  let joined: RoomManager | undefined
  try {
    const names = await ranked.names(match.id)
    rankedNames = [names.player1_name, names.player2_name]
    joined = await RoomManager.ranked(match)
    if (attempt !== roomAttempt) { await joined.close(); return }
    room = joined
    joined.onPresence = roster => {
      if (attempt !== roomAttempt || room !== joined || starting) return
      if (roster[1] && roster[2]) {
        startBattle('ranked', [match.loadout1, match.loadout2])
        ranked.watchMatch(match.id, renderRankedResult)
      }
    }
    joined.onConnection = connected => {
      if (attempt === roomAttempt && !connected && currentScreen === 'ranked-search')
        byId('ranked-search-status').textContent = '接続が切れました。再接続中…'
    }
    await joined.connect()
  } catch (error) {
    if (attempt !== roomAttempt) return
    if (joined) { await joined.close(); if (room === joined) room = undefined }
    byId('ranked-search-status').textContent = error instanceof Error ? error.message : '対戦に接続できませんでした。'
    byId<HTMLButtonElement>('ranked-cancel').disabled = false
  }
}
function startRankedSearch(): void {
  if (!cloud.identity?.username) {
    onlineStatus.textContent = 'ランク戦にはログインとユーザー名の設定が必要です。'
    return
  }
  byId('ranked-search-title').textContent = '相手を探しています'
  byId('ranked-search-status').textContent = '近いレートの相手を探しています…'
  byId<HTMLButtonElement>('ranked-cancel').disabled = false
  showScreen('ranked-search')
  ranked.startSearch(currentLoadout(),
    status => { byId('ranked-search-status').textContent = status },
    match => void beginRankedMatch(match),
    message => { byId('ranked-search-status').textContent = message })
}
function startBattle(mode: 'practice' | 'online' | 'story' | 'ranked', loadouts: [Loadout, Loadout], story?: StoryChapter): void {
  if (starting) return
  soundFX.unlock()
  starting = true
  activeStory = story
  const mine = loadouts[room?.slot === 2 ? 1 : 0]
  recordCharacterUse(progress, mine.character); persist()
  dialog.classList.add('hidden')
  showScreen('arena')
  battle = new BattleScene({
    mode: mode === 'ranked' ? 'online' : mode, room, story, loadouts, playerNames: mode === 'ranked' ? rankedNames : undefined,
    onMatchEnd(message, result) {
      const events = mode === 'story' && story && result === 'win'
        ? awardStoryVictory(progress, story.id, mine.character)
        : mode !== 'story' ? awardMatchResult(progress, mode === 'ranked' ? 'online' : mode, result, mine.character) : []
      persist()
      byId('dialog-title').textContent = mode === 'ranked' ? '結果を確認中' : mode === 'story' && result === 'win' ? 'ステージクリア！' : message
      byId('dialog-copy').textContent = mode === 'ranked' ? '両プレイヤーの結果確認を待っています…' : mode === 'story'
        ? result === 'win' ? `ステージ ${story?.id}「${story?.title}」クリア` : 'もう一度やってみよう。'
        : room ? 'もう一戦するには、両方でボタンを押してください。' : 'もう一度対戦できます。'
      renderEvents(events)
      byId<HTMLButtonElement>('rematch').textContent = mode === 'story' ? 'もう一度挑戦' : 'もう一戦'
      byId<HTMLButtonElement>('rematch').classList.toggle('hidden', mode === 'ranked')
      byId<HTMLButtonElement>('rematch').disabled = mode === 'ranked'
      byId<HTMLButtonElement>('leave').textContent = mode === 'story' ? 'ステージ選択へ' : 'メニューに戻る'
      dialog.classList.remove('hidden')
      if (mode === 'ranked' && activeRanked && cloud.identity) {
        rankedResultReported = true
        void ranked.report(activeRanked, result, cloud.identity.userId)
          .then(renderRankedResult)
          .catch(error => { byId('dialog-copy').textContent = error instanceof Error ? error.message : 'レートを更新できませんでした。' })
      }
    },
    onNewMatch() { dialog.classList.add('hidden') },
    onDisconnect() {
      byId('dialog-title').textContent = mode === 'ranked' ? '相手の接続が切れました' : '接続が切れました'
      byId('dialog-copy').textContent = mode === 'ranked' ? '少し待ちます。戻らなければ対戦を終了します。' : '対戦相手が退出しました。メニューへ戻ってください。'
      renderEvents([])
      byId<HTMLButtonElement>('rematch').disabled = true
      dialog.classList.remove('hidden')
      if (mode === 'ranked') startDisconnectChecks()
    },
    onReconnect() {
      clearDisconnectChecks()
      if (mode === 'ranked' && byId('dialog-title').textContent === '相手の接続が切れました')
        dialog.classList.add('hidden')
    },
  })
  game = new Phaser.Game({
    type: Phaser.AUTO, parent: 'game', width: 960, height: 540, backgroundColor: '#090d17',
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    physics: { default: 'arcade', arcade: { gravity: { x: 0, y: WORLD.gravity }, fixedStep: true, fps: 60, debug: false } },
    scene: [battle],
  })
}
async function enterRoom(action: 'create' | 'join'): Promise<void> {
  soundFX.unlock()
  if (!RoomManager.configured()) { onlineStatus.textContent = 'オンライン設定がありません。README の手順で Supabase を設定してください。'; return }
  const attempt = ++roomAttempt
  onlineStatus.textContent = '接続中…'
  let joined: RoomManager | undefined
  try {
    const loadout = currentLoadout()
    joined = action === 'create' ? await RoomManager.create(loadout) : await RoomManager.join(byId<HTMLInputElement>('room-code').value, loadout)
    if (attempt !== roomAttempt) { await joined.close(); return }
    room = joined
    byId('lobby-title').textContent = action === 'create' ? '部屋をつくりました' : '部屋に入りました'
    byId('lobby-code').textContent = joined.code
    lobbyStatus.textContent = '相手を待っています…'
    showScreen('lobby')
    joined.onPresence = roster => {
      if (attempt !== roomAttempt || room !== joined) return
      if (roster[1] && roster[2]) startBattle('online', [roster[1], roster[2]])
      else lobbyStatus.textContent = '相手を待っています…'
    }
    joined.onConnection = connected => {
      if (attempt === roomAttempt && room === joined && !connected) lobbyStatus.textContent = '接続が切れました。再接続しています…'
    }
    await joined.connect()
    if (attempt !== roomAttempt) return
    onlineStatus.textContent = ''
  } catch (error) {
    if (attempt !== roomAttempt) return
    onlineStatus.textContent = error instanceof Error ? error.message : '接続に失敗しました'
    if (joined) { await joined.close(); room = undefined }
    showScreen('online')
  }
}
async function leave(): Promise<void> {
  roomAttempt++
  const returnStory = Boolean(activeStory)
  clearDisconnectChecks()
  if (activeRanked?.status === 'active' && !rankedResultReported) {
    try { await ranked.forfeit(activeRanked.id) }
    catch (error) { menuStatus.textContent = error instanceof Error ? error.message : 'ランク戦を終了できませんでした。' }
  }
  ranked.stop()
  activeRanked = undefined
  rankedResultReported = false
  rankedNames = undefined
  starting = false
  if (game) { game.destroy(true); game = undefined; battle = undefined }
  if (room) { await room.close(); room = undefined }
  activeStory = undefined
  dialog.classList.add('hidden')
  showScreen(returnStory ? 'story' : 'menu')
}

byId('menu-story').addEventListener('click', () => showScreen('story'))
byId('menu-online').addEventListener('click', () => showScreen('online'))
byId('menu-fighter').addEventListener('click', () => showScreen('fighter'))
byId('menu-profile').addEventListener('click', () => showScreen('profile'))
byId('menu-account').addEventListener('click', () => showScreen('account'))
byId('menu-ranking').addEventListener('click', () => showScreen('ranking'))
byId('practice').addEventListener('click', () => startBattle('practice', [currentLoadout(), BOT_LOADOUT]))
for (const button of document.querySelectorAll<HTMLButtonElement>('.back-menu')) button.addEventListener('click', () => showScreen('menu'))
byId('auth-signup-mode').addEventListener('click', () => setAuthMode('signup'))
byId('auth-login-mode').addEventListener('click', () => setAuthMode('login'))
byId<HTMLFormElement>('auth-form').addEventListener('submit', event => {
  event.preventDefault()
  const email = byId<HTMLInputElement>('auth-email').value.trim()
  const password = byId<HTMLInputElement>('auth-password').value
  const username = byId<HTMLInputElement>('auth-username').value.trim()
  const status = byId('account-status')
  status.textContent = '確認中…'
  void (async () => {
    try {
      status.textContent = authMode === 'signup'
        ? await cloud.signUp(email, password, username, progress)
        : (await cloud.logIn(email, password, progress), 'ログインしました。セーブデータを読み込みました。')
      byId<HTMLInputElement>('auth-password').value = ''
      void renderAccount()
    } catch (error) { status.textContent = error instanceof Error ? error.message : 'ログインできませんでした。' }
  })()
})
byId('username-save').addEventListener('click', () => {
  void cloud.setUsername(byId<HTMLInputElement>('username-edit').value)
    .then(() => { byId('account-status').textContent = 'ユーザー名を保存しました。'; void renderAccount() })
    .catch(error => { byId('account-status').textContent = error instanceof Error ? error.message : 'ユーザー名を保存できませんでした。' })
})
byId('account-logout').addEventListener('click', () => {
  void cloud.logOut()
    .then(() => { byId('account-status').textContent = 'ログアウトしました。この端末のセーブを使います。'; void renderAccount() })
    .catch(error => { byId('account-status').textContent = error instanceof Error ? error.message : 'ログアウトできませんでした。' })
})
byId('account-profile').addEventListener('click', () => showScreen('profile'))
byId('ranked-start').addEventListener('click', startRankedSearch)
byId('ranked-cancel').addEventListener('click', () => {
  roomAttempt++
  void (async () => {
    if (activeRanked?.status === 'active' && starting) await ranked.forfeit(activeRanked.id)
    await ranked.cancelSearch()
    if (room) { await room.close(); room = undefined }
  })()
    .then(() => { ranked.stop(); activeRanked = undefined; showScreen('online') })
    .catch(error => { byId('ranked-search-status').textContent = error instanceof Error ? error.message : '検索をやめられませんでした。' })
})
byId('create').addEventListener('click', () => void enterRoom('create'))
byId('join').addEventListener('click', () => void enterRoom('join'))
byId<HTMLInputElement>('room-code').addEventListener('keydown', event => { if (event.key === 'Enter') void enterRoom('join') })
byId('lobby-back').addEventListener('click', () => void leave())
byId('arena-back').addEventListener('click', () => void leave())
byId('leave').addEventListener('click', () => void leave())
byId('rematch').addEventListener('click', () => {
  battle?.requestRematch()
  if (room) {
    byId<HTMLButtonElement>('rematch').disabled = true
    byId('dialog-copy').textContent = '相手の再戦を待っています…'
  }
})
renderMenu()
setAuthMode('login')
void cloud.initialize(progress)
