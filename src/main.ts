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
    <header class="masthead"><span class="mark">P<span>∥</span>D</span><span class="edition">PARADOX / 001</span></header>
    <main class="menu" id="menu">
      <div class="hero"><p class="eyebrow">2D ONLINE ECHO COMBAT</p><h1>PARADOX<br><em>DUEL</em></h1>
        <p class="tagline">過去の自分と、いま戦う。</p><p class="intro">直前４秒の行動を Echo に再生させる、１対１のアクション対戦。</p>
        <p class="level-strip" id="menu-level"></p>
      </div>
      <nav class="menu-panel" aria-label="メインメニュー">
        <div class="loadout-heading"><span>PLAY</span><small>STORY → GROW → DUEL</small></div>
        <button id="menu-story" class="button primary">STORY <span>→</span></button>
        <button id="menu-online" class="button secondary">ONLINE <span>→</span></button>
        <button id="practice" class="button secondary">PRACTICE <span>→</span></button>
        <div class="loadout-heading menu-group"><span>FIGHTER DATA</span></div>
        <button id="menu-fighter" class="button secondary">FIGHTER <span>→</span></button>
        <button id="menu-profile" class="button secondary">PROFILE <span>→</span></button>
        <button id="menu-account" class="button secondary">ACCOUNT <span>→</span></button>
        <button id="menu-ranking" class="button secondary">RANKING <span>→</span></button>
        <div class="coming-row"><span>SHOP / COMING SOON</span></div>
        <p id="menu-status" class="status" role="status"></p>
      </nav>
    </main>
    <section id="story" class="page hidden"><div class="page-head"><div><p class="eyebrow">CAMPAIGN / PvE</p><h2>STORY</h2><p>AIを倒し、機体と戦術を解放する。</p></div><button class="button secondary back-menu">← MENU</button></div>
      <div class="story-toolbar"><label for="difficulty">DIFFICULTY</label><select id="difficulty"><option value="recommended" selected>RECOMMENDED</option><option value="easy">EASY</option><option value="normal">NORMAL</option><option value="hard">HARD</option></select><span>Chapter固有の推奨難易度で開始。ここで変更可能。</span></div>
      <div id="chapter-list" class="chapter-grid"></div></section>
    <section id="fighter" class="page hidden"><div class="page-head"><div><p class="eyebrow">SYSTEM / LOADOUT</p><h2>FIGHTER</h2><p>解放した装備を選び、Story・Practice・Onlineで使用する。</p></div><button class="button secondary back-menu">← MENU</button></div>
      <div class="fighter-grid">
        <div class="fighter-fields">
          <div class="selection"><label for="character">CHARACTER</label><select id="character"></select><p id="character-description" class="selection-description"></p><small id="character-ratings" class="ratings"></small></div>
          <div class="selection"><label for="weapon">WEAPON</label><select id="weapon"></select><p id="weapon-description" class="selection-description"></p></div>
          <div class="selection"><label for="attack">ATTACK STYLE</label><select id="attack"></select><p id="attack-description" class="selection-description"></p></div>
          <div class="selection"><label for="skill">SKILL / I KEY</label><select id="skill"></select><p id="skill-description" class="selection-description"></p></div>
          <div class="selection"><label for="color">COLOR</label><select id="color"></select><p id="color-description" class="selection-description"></p></div>
          <div class="selection"><label>COSMETICS</label><p class="selection-description">Echo Color・Skin・Title は今後追加予定</p></div>
        </div><div class="inventory-panel"><p class="eyebrow">UNLOCK DATABASE</p><div id="unlock-list"></div></div>
      </div></section>
    <section id="profile" class="page hidden"><div class="page-head"><div><p class="eyebrow">PILOT RECORD</p><h2>PROFILE</h2><p>戦績と機体熟練度。ログイン中はCloudに保存されます。</p></div><button class="button secondary back-menu">← MENU</button></div><div id="profile-data" class="profile-grid"></div>
      <p class="profile-future">ACHIEVEMENTS / TITLES / MATCH HISTORY — COMING SOON</p></section>
    <section id="account" class="page hidden"><div class="page-head"><div><p class="eyebrow">IDENTITY / CLOUD LINK</p><h2>ACCOUNT</h2><p>別端末でも同じProgressionを使用できます。</p></div><button class="button secondary back-menu">← MENU</button></div>
      <div class="account-panel"><div id="account-signed-out"><h3>NOT SIGNED IN</h3><div class="account-switch"><button id="auth-signup-mode" class="button secondary">CREATE ACCOUNT</button><button id="auth-login-mode" class="button secondary">LOG IN</button></div>
        <form id="auth-form"><label for="auth-email">EMAIL</label><input id="auth-email" type="email" required autocomplete="email">
          <label for="auth-password">PASSWORD</label><input id="auth-password" type="password" required minlength="6" autocomplete="current-password">
          <div id="auth-username-field" class="hidden"><label for="auth-username">USERNAME / 3–16</label><input id="auth-username" type="text" minlength="3" maxlength="16" pattern="[A-Za-z0-9_]{3,16}" autocomplete="username"></div>
          <button id="auth-submit" class="button primary" type="submit">LOG IN →</button></form></div>
        <div id="account-signed-in" class="hidden"><h3>AUTHENTICATION COMPLETE</h3><div id="account-summary" class="account-summary"></div>
          <div class="account-switch"><input id="username-edit" maxlength="16" placeholder="USERNAME" aria-label="Username"><button id="username-save" class="button secondary">SAVE USERNAME</button></div>
          <button id="account-profile" class="button secondary">PROFILE →</button><button id="account-logout" class="button secondary">LOG OUT</button></div>
        <p id="account-status" class="status" role="status"></p></div></section>
    <section id="ranking" class="page hidden"><div class="page-head"><div><p class="eyebrow">GLOBAL / SEASON S1</p><h2>RANKING</h2><p>TOP 100と自分の順位。公開するのはUsername・Rating・Winsのみです。</p></div><button class="button secondary back-menu">← MENU</button></div>
      <div id="ranking-content" class="ranking-panel"></div></section>
    <section id="online" class="page hidden"><div class="page-head"><div><p class="eyebrow">NETWORK / PvP</p><h2>ONLINE</h2><p>選択したFIGHTERで対戦。永続成長によるHP・攻撃力・速度の補正はありません。</p></div><button class="button secondary back-menu">← MENU</button></div>
      <div class="online-panel"><p>CASUAL / COMING SOON</p><button id="ranked-start" class="button primary">RANKED <span>→</span></button><h3>PRIVATE ROOM</h3>
        <button id="create" class="button primary">CREATE ROOM <span>→</span></button>
        <div class="join-row"><input id="room-code" maxlength="6" autocomplete="off" spellcheck="false" aria-label="ルームコード" placeholder="ROOM CODE"><button id="join" class="button secondary">JOIN</button></div>
        <p id="online-status" class="status" role="status"></p>
      </div></section>
    <section id="ranked-search" class="lobby hidden"><p class="eyebrow">RANKED / SEASON S1</p><h2 id="ranked-search-title">SEARCHING FOR OPPONENT</h2>
      <p id="ranked-search-status" class="waiting">Ratingが近い相手を探しています…</p><button id="ranked-cancel" class="button secondary">CANCEL SEARCH</button></section>
    <section id="lobby" class="lobby hidden" aria-live="polite"><p class="eyebrow">PRIVATE MATCH</p><h2 id="lobby-title">ROOM CREATED</h2>
      <p class="lobby-hint">このコードを対戦相手に共有してください</p><div class="code" id="lobby-code"></div>
      <p id="lobby-status" class="waiting">相手を待っています…</p><button id="lobby-back" class="button secondary">RETURN TO MENU</button></section>
    <section id="arena" class="arena hidden"><div id="game"></div><button id="arena-back" class="arena-back" aria-label="対戦を終了してメニューへ戻る">EXIT MATCH</button>
      <div id="dialog" class="dialog hidden"><h2 id="dialog-title"></h2><p id="dialog-copy"></p><div id="reward-events" class="reward-events"></div><div class="dialog-actions">
        <button id="rematch" class="button primary">REMATCH</button><button id="leave" class="button secondary">RETURN TO MENU</button></div></div></section>
    <footer class="footer"><span>RECORD → REPLAY → OUTPLAY</span><span>A D MOVE / SPACE JUMP / J ATTACK / K DASH / L ECHO / I SKILL</span></footer>
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
  byId('menu-level').textContent = `PLAYER LV.${progress.playerLevel}  /  ${progress.currentXp} / ${xpForNextLevel(progress.playerLevel)} XP  /  ${progress.coins} COINS  /  ${cloud.identity?.username ?? 'LOCAL PILOT'}`
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
    option.textContent = `${config.name}${unlocked ? '' : '  🔒 ' + lockHint(kind, key)}${compatible ? '' : ' / OTHER WEAPON'}`
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
    const heading = document.createElement('h3'); heading.textContent = kind.toUpperCase(); list.append(heading)
    for (const [id, config] of Object.entries(catalog)) {
      const item = document.createElement('p')
      const unlocked = canUse(progress, kind, id)
      item.className = unlocked ? 'unlock-owned' : 'unlock-locked'
      item.textContent = `${unlocked ? '◆' : '🔒'} ${config.name}  ${unlocked ? 'UNLOCKED' : lockHint(kind, id)}`
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
    const eyebrow = document.createElement('p'); eyebrow.className = 'eyebrow'; eyebrow.textContent = `CHAPTER ${String(chapter.id).padStart(2, '0')} / ${chapter.boss ? 'BOSS' : 'MISSION'}`
    const title = document.createElement('h3'); title.textContent = chapter.title
    const briefing = document.createElement('p'); briefing.textContent = chapter.briefing
    const enemy = document.createElement('p'); enemy.className = 'chapter-meta'; enemy.textContent = `ENEMY / ${chapter.enemyName}  ·  ${chapter.rewardXp} XP  ·  ${chapter.rewardCoins} COINS`
    const button = document.createElement('button'); button.className = 'button ' + (isChapterAvailable(progress, chapter.id) ? 'primary' : 'secondary')
    button.disabled = !isChapterAvailable(progress, chapter.id)
    button.textContent = progress.storyProgress.clearedChapters.includes(chapter.id) ? 'REPLAY →' : button.disabled ? `🔒 CLEAR CHAPTER ${chapter.id - 1}` : 'START →'
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
    ['USERNAME', cloud.identity?.username ?? 'NOT SIGNED IN'],
    ['RANK', stats ? rankTier(stats.rating) : '—'],
    ['RATING', stats ? String(stats.rating) : '—'],
    ['RANKED RECORD', stats ? `${stats.wins}W / ${stats.losses}L` : '—'],
    ['WIN RATE', stats && stats.matches ? `${Math.round(stats.wins / stats.matches * 100)}%` : stats ? '0%' : '—'],
    ['HIGHEST RATING', stats ? String(stats.highest_rating) : '—'],
    ['PLAYER LEVEL', `LV.${progress.playerLevel}`], ['XP', `${progress.currentXp} / ${xpForNextLevel(progress.playerLevel)}`],
    ['TOTAL XP', String(progress.totalXp)], ['COINS', String(progress.coins)],
    ['ONLINE WINS', String(progress.onlineWins)], ['ONLINE LOSSES', String(progress.onlineLosses)],
    ['STORY PROGRESS', `${progress.storyProgress.clearedChapters.length} / ${STORY_CHAPTERS.length} CHAPTERS`],
    ['FAVORITE CHARACTER', CHARACTERS[favoriteCharacter(progress)].name],
    ...(['standard', 'light', 'heavy'] as Character[]).map(character =>
      [`${CHARACTERS[character].name} MASTERY`, `LV.${progress.characterMastery[character].level}`] as [string, string]),
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
  byId<HTMLButtonElement>('auth-submit').textContent = mode === 'signup' ? 'CREATE ACCOUNT →' : 'LOG IN →'
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
  for (const value of [`USERNAME / ${identity.username ?? 'SET USERNAME'}`,
    `PLAYER LEVEL / ${progress.playerLevel}`, `RANK / ${rankTier(rating)}`, `RATING / ${rating}`]) {
    const row = document.createElement('p'); row.textContent = value; byId('account-summary').append(row)
  }
  byId<HTMLInputElement>('username-edit').value = identity.username ?? ''
}
async function renderRanking(): Promise<void> {
  const content = byId('ranking-content'); content.replaceChildren()
  if (!cloud.identity?.username) {
    content.textContent = 'ACCOUNTでログインし、USERNAMEを設定してください。'
    return
  }
  content.textContent = 'RANKINGを同期しています…'
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
        const label = document.createElement('strong'); label.textContent = 'YOUR RANK'; content.append(label)
      }
      table.append(row)
    }
    content.append(table)
  } catch (error) {
    content.textContent = error instanceof Error ? error.message : 'RANKING UNAVAILABLE'
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
    byId('dialog-title').textContent = 'RESULT DISPUTED'
    byId('dialog-copy').textContent = '結果が一致しなかったためRatingは変更されません。'
    dialog.classList.remove('hidden')
    return
  }
  if (match.status !== 'completed' || after === null) return
  const delta = after - before
  byId('dialog-title').textContent = match.winner === null ? 'DRAW' :
    match.winner === cloud.identity.userId ? 'VICTORY' : 'DEFEAT'
  byId('dialog-copy').textContent = `RATING  ${before} → ${after}   ${delta >= 0 ? '+' : ''}${delta}`
  const events: ProgressEvent[] = [{ kind: 'level', title: 'RATING UPDATED', detail: `${rankTier(after)} / ${after}` }]
  if (rankTier(before) !== rankTier(after) && delta > 0)
    events.push({ kind: 'unlock', title: 'RANK UP', detail: `${rankTier(before)} → ${rankTier(after)}` })
  renderEvents(events)
  dialog.classList.remove('hidden')
}
function startDisconnectChecks(): void {
  if (!activeRanked || disconnectTimer) return
  const matchId = activeRanked.id
  disconnectTimer = window.setInterval(() => {
    void ranked.claimDisconnect(matchId).then(renderRankedResult).catch(error => {
      if (error instanceof Error && error.message.includes('still reconnect')) return
      byId('dialog-copy').textContent = 'NETWORK CONNECTION LOST / Resultを確認中'
    })
  }, 5000)
}
async function beginRankedMatch(match: RankedMatch): Promise<void> {
  if (!cloud.identity) return
  const attempt = ++roomAttempt
  activeRanked = match
  rankedResultReported = false
  byId('ranked-search-title').textContent = 'MATCH FOUND'
  byId('ranked-search-status').textContent = '対戦を同期しています…'
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
        byId('ranked-search-status').textContent = 'NETWORK CONNECTION LOST / 再接続中…'
    }
    await joined.connect()
  } catch (error) {
    if (attempt !== roomAttempt) return
    if (joined) { await joined.close(); if (room === joined) room = undefined }
    byId('ranked-search-status').textContent = error instanceof Error ? error.message : 'MATCH CONNECTION FAILED'
    byId<HTMLButtonElement>('ranked-cancel').disabled = false
  }
}
function startRankedSearch(): void {
  if (!cloud.identity?.username) {
    onlineStatus.textContent = 'RANKEDにはACCOUNTとUSERNAMEが必要です。'
    return
  }
  byId('ranked-search-title').textContent = 'SEARCHING FOR OPPONENT'
  byId('ranked-search-status').textContent = 'Ratingが近い相手を探しています…'
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
      byId('dialog-title').textContent = mode === 'ranked' ? 'RATING UPDATE PENDING' : mode === 'story' && result === 'win' ? 'CHAPTER CLEARED' : message
      byId('dialog-copy').textContent = mode === 'ranked' ? '両プレイヤーの結果確認を待っています…' : mode === 'story'
        ? result === 'win' ? `CHAPTER ${story?.id} / ${story?.title} 完了` : '再挑戦して敵AIを突破しよう。'
        : room ? '再戦するには両者が REMATCH を押してください。' : 'もう一度対戦できます。'
      renderEvents(events)
      byId<HTMLButtonElement>('rematch').textContent = mode === 'story' ? 'RETRY' : 'REMATCH'
      byId<HTMLButtonElement>('rematch').classList.toggle('hidden', mode === 'ranked')
      byId<HTMLButtonElement>('rematch').disabled = mode === 'ranked'
      byId<HTMLButtonElement>('leave').textContent = mode === 'story' ? 'RETURN TO STORY' : 'RETURN TO MENU'
      dialog.classList.remove('hidden')
      if (mode === 'ranked' && activeRanked && cloud.identity) {
        rankedResultReported = true
        void ranked.report(activeRanked, result, cloud.identity.userId)
          .then(renderRankedResult)
          .catch(error => { byId('dialog-copy').textContent = error instanceof Error ? error.message : 'RATING UPDATE FAILED' })
      }
    },
    onNewMatch() { dialog.classList.add('hidden') },
    onDisconnect() {
      byId('dialog-title').textContent = mode === 'ranked' ? 'OPPONENT DISCONNECTED' : '接続が切れました'
      byId('dialog-copy').textContent = mode === 'ranked' ? '復帰を待機中。接続が戻らなければResultを確定します。' : '対戦相手が退出しました。ロビーへ戻ってください。'
      renderEvents([])
      byId<HTMLButtonElement>('rematch').disabled = true
      dialog.classList.remove('hidden')
      if (mode === 'ranked') startDisconnectChecks()
    },
    onReconnect() {
      clearDisconnectChecks()
      if (mode === 'ranked' && byId('dialog-title').textContent === 'OPPONENT DISCONNECTED')
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
    byId('lobby-title').textContent = action === 'create' ? 'ROOM CREATED' : 'ROOM JOINED'
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
    catch (error) { menuStatus.textContent = error instanceof Error ? error.message : 'RANKED EXIT FAILED' }
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
  status.textContent = 'AUTHENTICATING…'
  void (async () => {
    try {
      status.textContent = authMode === 'signup'
        ? await cloud.signUp(email, password, username, progress)
        : (await cloud.logIn(email, password, progress), 'AUTHENTICATION COMPLETE / CLOUD LINK ESTABLISHED')
      byId<HTMLInputElement>('auth-password').value = ''
      void renderAccount()
    } catch (error) { status.textContent = error instanceof Error ? error.message : 'AUTHENTICATION FAILED' }
  })()
})
byId('username-save').addEventListener('click', () => {
  void cloud.setUsername(byId<HTMLInputElement>('username-edit').value)
    .then(() => { byId('account-status').textContent = 'USERNAME UPDATED'; void renderAccount() })
    .catch(error => { byId('account-status').textContent = error instanceof Error ? error.message : 'USERNAME FAILED' })
})
byId('account-logout').addEventListener('click', () => {
  void cloud.logOut()
    .then(() => { byId('account-status').textContent = 'LOGGED OUT / LOCAL SAVE ACTIVE'; void renderAccount() })
    .catch(error => { byId('account-status').textContent = error instanceof Error ? error.message : 'LOG OUT FAILED' })
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
    .catch(error => { byId('ranked-search-status').textContent = error instanceof Error ? error.message : 'CANCEL FAILED' })
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
