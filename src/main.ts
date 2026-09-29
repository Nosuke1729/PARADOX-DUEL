import Phaser from 'phaser'
import { BattleScene } from './game/BattleScene'
import { ATTACKS, CHARACTERS, SKILLS, WEAPONS } from './game/balance'
import { BOT_LOADOUT, WORLD, type AttackStyle, type Character, type Loadout, type Skill, type Weapon } from './game/types'
import { soundFX } from './game/SoundFX'
import { RoomManager } from './network/RoomManager'
import { COLORS, type UnlockKind } from './progression/catalog'
import { awardMatchResult, awardStoryVictory, canUse, favoriteCharacter, isChapterAvailable, loadProgress, lockHint, recordCharacterUse, sanitizeLoadout, saveProgress, xpForNextLevel, type ProgressEvent } from './progression/progress'
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
        <div class="coming-row"><span>RANKING / COMING SOON</span><span>SHOP / COMING SOON</span></div>
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
    <section id="profile" class="page hidden"><div class="page-head"><div><p class="eyebrow">PILOT RECORD</p><h2>PROFILE</h2><p>戦績と機体熟練度。進行状況はこのブラウザーに保存されます。</p></div><button class="button secondary back-menu">← MENU</button></div><div id="profile-data" class="profile-grid"></div>
      <p class="profile-future">ACHIEVEMENTS / TITLES / RANK / MATCH HISTORY — COMING SOON</p></section>
    <section id="online" class="page hidden"><div class="page-head"><div><p class="eyebrow">NETWORK / PvP</p><h2>ONLINE</h2><p>選択したFIGHTERで対戦。永続成長によるHP・攻撃力・速度の補正はありません。</p></div><button class="button secondary back-menu">← MENU</button></div>
      <div class="online-panel"><p>CASUAL / COMING SOON</p><p>RANKED / COMING SOON</p><h3>PRIVATE ROOM</h3>
        <button id="create" class="button primary">CREATE ROOM <span>→</span></button>
        <div class="join-row"><input id="room-code" maxlength="6" autocomplete="off" spellcheck="false" aria-label="ルームコード" placeholder="ROOM CODE"><button id="join" class="button secondary">JOIN</button></div>
        <p id="online-status" class="status" role="status"></p>
      </div></section>
    <section id="lobby" class="lobby hidden" aria-live="polite"><p class="eyebrow">PRIVATE MATCH</p><h2 id="lobby-title">ROOM CREATED</h2>
      <p class="lobby-hint">このコードを対戦相手に共有してください</p><div class="code" id="lobby-code"></div>
      <p id="lobby-status" class="waiting">相手を待っています…</p><button id="lobby-back" class="button secondary">RETURN TO MENU</button></section>
    <section id="arena" class="arena hidden"><div id="game"></div><button id="arena-back" class="arena-back" aria-label="対戦を終了してメニューへ戻る">EXIT MATCH</button>
      <div id="dialog" class="dialog hidden"><h2 id="dialog-title"></h2><p id="dialog-copy"></p><div id="reward-events" class="reward-events"></div><div class="dialog-actions">
        <button id="rematch" class="button primary">REMATCH</button><button id="leave" class="button secondary">RETURN TO MENU</button></div></div></section>
    <footer class="footer"><span>RECORD → REPLAY → OUTPLAY</span><span>A D MOVE / SPACE JUMP / J ATTACK / K DASH / L ECHO / I SKILL</span></footer>
  </div>`

const byId = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T
const screens = ['menu', 'story', 'fighter', 'profile', 'online', 'lobby', 'arena'] as const
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

function showScreen(screen: Screen): void {
  for (const id of screens) byId(id).classList.toggle('hidden', id !== screen)
  if (screen === 'menu') renderMenu()
  if (screen === 'story') renderStory()
  if (screen === 'fighter') renderFighter()
  if (screen === 'profile') renderProfile()
}
function persist(): void { saveProgress(progress) }
function currentLoadout(): Loadout {
  progress.selectedLoadout = sanitizeLoadout(progress, progress.selectedLoadout)
  persist()
  return progress.selectedLoadout
}
function renderMenu(): void {
  byId('menu-level').textContent = `PLAYER LV.${progress.playerLevel}  /  ${progress.currentXp} / ${xpForNextLevel(progress.playerLevel)} XP  /  ${progress.coins} COINS`
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
function renderProfile(): void {
  const data = byId('profile-data'); data.replaceChildren()
  const fields: [string, string][] = [
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
function renderEvents(events: ProgressEvent[]): void {
  const container = byId('reward-events'); container.replaceChildren()
  for (const event of events) {
    const row = document.createElement('div'); row.className = 'reward-row ' + event.kind
    const title = document.createElement('strong'); title.textContent = event.title
    const detail = document.createElement('span'); detail.textContent = event.detail
    row.append(title, detail); container.append(row)
  }
}
function startBattle(mode: 'practice' | 'online' | 'story', loadouts: [Loadout, Loadout], story?: StoryChapter): void {
  if (starting) return
  soundFX.unlock()
  starting = true
  activeStory = story
  const mine = loadouts[room?.slot === 2 ? 1 : 0]
  recordCharacterUse(progress, mine.character); persist()
  dialog.classList.add('hidden')
  showScreen('arena')
  battle = new BattleScene({
    mode, room, story, loadouts,
    onMatchEnd(message, result) {
      const events = mode === 'story' && story && result === 'win'
        ? awardStoryVictory(progress, story.id, mine.character)
        : mode !== 'story' ? awardMatchResult(progress, mode, result, mine.character) : []
      persist()
      byId('dialog-title').textContent = mode === 'story' && result === 'win' ? 'CHAPTER CLEARED' : message
      byId('dialog-copy').textContent = mode === 'story'
        ? result === 'win' ? `CHAPTER ${story?.id} / ${story?.title} 完了` : '再挑戦して敵AIを突破しよう。'
        : room ? '再戦するには両者が REMATCH を押してください。' : 'もう一度対戦できます。'
      renderEvents(events)
      byId<HTMLButtonElement>('rematch').textContent = mode === 'story' ? 'RETRY' : 'REMATCH'
      byId<HTMLButtonElement>('rematch').disabled = false
      byId<HTMLButtonElement>('leave').textContent = mode === 'story' ? 'RETURN TO STORY' : 'RETURN TO MENU'
      dialog.classList.remove('hidden')
    },
    onNewMatch() { dialog.classList.add('hidden') },
    onDisconnect() {
      byId('dialog-title').textContent = '接続が切れました'
      byId('dialog-copy').textContent = '対戦相手が退出しました。ロビーへ戻ってください。'
      renderEvents([])
      byId<HTMLButtonElement>('rematch').disabled = true
      dialog.classList.remove('hidden')
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
byId('practice').addEventListener('click', () => startBattle('practice', [currentLoadout(), BOT_LOADOUT]))
for (const button of document.querySelectorAll<HTMLButtonElement>('.back-menu')) button.addEventListener('click', () => showScreen('menu'))
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
