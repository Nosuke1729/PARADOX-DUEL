import Phaser from 'phaser'
import { BattleScene } from './game/BattleScene'
import { CHARACTERS, SKILLS, WEAPONS } from './game/balance'
import { BOT_LOADOUT, WORLD, type Character, type Loadout, type Skill, type Weapon } from './game/types'
import { soundFX } from './game/SoundFX'
import { RoomManager } from './network/RoomManager'
import './style.css'

const app = document.querySelector<HTMLDivElement>('#app')!
app.innerHTML = `
  <div class="shell">
    <header class="masthead"><span class="mark">P<span>∥</span>D</span><span class="edition">PARADOX / 001</span></header>
    <main class="menu" id="menu">
      <div class="hero">
        <p class="eyebrow">2D ONLINE ECHO COMBAT</p>
        <h1>PARADOX<br><em>DUEL</em></h1>
        <p class="tagline">過去の自分と、いま戦う。</p>
        <p class="intro">直前４秒の行動を Echo に再生させる、１対１のアクション対戦。</p>
      </div>
      <div class="menu-panel">
        <div class="loadout-heading"><span>BUILD YOUR FIGHTER</span><small>各1つ選択 / 対戦中は変更不可</small></div>
        <div class="selection"><label for="character">CHARACTER</label><select id="character" aria-describedby="character-description">${Object.entries(CHARACTERS).map(([id, config], index) => `<option value="${id}">${String(index + 1).padStart(2, '0')} / ${config.name} — ${config.subtitle}</option>`).join('')}</select><p id="character-description" class="selection-description"></p><small id="character-ratings" class="ratings"></small></div>
        <div class="selection"><label for="weapon">WEAPON</label><select id="weapon" aria-describedby="weapon-description">${Object.entries(WEAPONS).map(([id, config], index) => `<option value="${id}">${String(index + 1).padStart(2, '0')} / ${config.name} — ${config.subtitle}</option>`).join('')}</select><p id="weapon-description" class="selection-description"></p></div>
        <div class="selection"><label for="skill">SKILL <span>I キー</span></label><select id="skill" aria-describedby="skill-description">${Object.entries(SKILLS).map(([id, config], index) => `<option value="${id}">${String(index + 1).padStart(2, '0')} / ${config.name} — ${config.subtitle}</option>`).join('')}</select><p id="skill-description" class="selection-description"></p></div>
        <button id="practice" class="button primary">PRACTICE <span>→</span></button>
        <button id="create" class="button secondary">CREATE ROOM <span>→</span></button>
        <div class="join-row"><input id="room-code" maxlength="6" autocomplete="off" spellcheck="false" aria-label="ルームコード" placeholder="ROOM CODE"><button id="join" class="button secondary">JOIN</button></div>
        <p id="menu-status" class="status" role="status"></p>
      </div>
    </main>
    <section id="lobby" class="lobby hidden" aria-live="polite">
      <p class="eyebrow">PRIVATE MATCH</p>
      <h2 id="lobby-title">ROOM CREATED</h2>
      <p class="lobby-hint">このコードを対戦相手に共有してください</p>
      <div class="code" id="lobby-code"></div>
      <p id="lobby-status" class="waiting">相手を待っています…</p>
      <button id="lobby-back" class="button secondary">RETURN TO MENU</button>
    </section>
    <section id="arena" class="arena hidden"><div id="game"></div><button id="arena-back" class="arena-back" aria-label="対戦を終了してメニューへ戻る">EXIT MATCH</button><div id="dialog" class="dialog hidden"><h2 id="dialog-title"></h2><p id="dialog-copy"></p><div class="dialog-actions"><button id="rematch" class="button primary">REMATCH</button><button id="leave" class="button secondary">RETURN TO MENU</button></div></div></section>
    <footer class="footer"><span>RECORD → REPLAY → OUTPLAY</span><span>A D MOVE / SPACE JUMP / J ATTACK / K DASH / L ECHO / I SKILL</span></footer>
  </div>
`

const byId = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T
const menu = byId<HTMLElement>('menu')
const lobby = byId<HTMLElement>('lobby')
const arena = byId<HTMLElement>('arena')
const dialog = byId<HTMLElement>('dialog')
const menuStatus = byId<HTMLElement>('menu-status')
const lobbyStatus = byId<HTMLElement>('lobby-status')
let room: RoomManager | undefined
let game: Phaser.Game | undefined
let battle: BattleScene | undefined
let starting = false

function selectedLoadout(): Loadout {
  return {
    character: byId<HTMLSelectElement>('character').value as Character,
    weapon: byId<HTMLSelectElement>('weapon').value as Weapon,
    skill: byId<HTMLSelectElement>('skill').value as Skill,
  }
}
function describeLoadout(): void {
  const loadout = selectedLoadout()
  byId('character-description').textContent = CHARACTERS[loadout.character].description
  byId('character-ratings').textContent = CHARACTERS[loadout.character].ratings
  byId('weapon-description').textContent = WEAPONS[loadout.weapon].description
  byId('skill-description').textContent = SKILLS[loadout.skill].description
}
for (const id of ['character', 'weapon', 'skill']) byId(id).addEventListener('change', describeLoadout)
describeLoadout()

function show(element: HTMLElement): void { element.classList.remove('hidden') }
function hide(element: HTMLElement): void { element.classList.add('hidden') }

function startBattle(mode: 'practice' | 'online', loadouts: [Loadout, Loadout]): void {
  if (starting) return
  soundFX.unlock()
  starting = true
  hide(menu)
  hide(lobby)
  hide(dialog)
  show(arena)
  battle = new BattleScene({
    mode, room, loadouts,
    onMatchEnd(message) {
      byId('dialog-title').textContent = message
      byId('dialog-copy').textContent = room ? '再戦するには両者が REMATCH を押してください。' : 'もう一度対戦できます。'
      byId<HTMLButtonElement>('rematch').disabled = false
      show(dialog)
    },
    onNewMatch() { hide(dialog) },
    onDisconnect() {
      byId('dialog-title').textContent = '接続が切れました'
      byId('dialog-copy').textContent = '対戦相手が退出しました。ロビーへ戻ってください。'
      byId<HTMLButtonElement>('rematch').disabled = true
      show(dialog)
    },
  })
  game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game',
    width: 960,
    height: 540,
    backgroundColor: '#090d17',
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    physics: { default: 'arcade', arcade: { gravity: { x: 0, y: WORLD.gravity }, fixedStep: true, fps: 60, debug: false } },
    scene: [battle],
  })
}

async function enterRoom(action: 'create' | 'join'): Promise<void> {
  soundFX.unlock()
  if (!RoomManager.configured()) {
    menuStatus.textContent = 'オンライン設定がありません。README の手順で Supabase を設定してください。'
    return
  }
  menuStatus.textContent = '接続中…'
  try {
    const loadout = selectedLoadout()
    room = action === 'create'
      ? await RoomManager.create(loadout)
      : await RoomManager.join(byId<HTMLInputElement>('room-code').value, loadout)
    byId('lobby-title').textContent = action === 'create' ? 'ROOM CREATED' : 'ROOM JOINED'
    byId('lobby-code').textContent = room.code
    lobbyStatus.textContent = '相手を待っています…'
    hide(menu)
    show(lobby)
    room.onPresence = roster => {
      if (roster[1] && roster[2]) startBattle('online', [roster[1], roster[2]])
      else lobbyStatus.textContent = '相手を待っています…'
    }
    room.onConnection = connected => {
      if (!connected) lobbyStatus.textContent = '接続が切れました。再接続しています…'
    }
    await room.connect()
    menuStatus.textContent = ''
  } catch (error) {
    menuStatus.textContent = error instanceof Error ? error.message : '接続に失敗しました'
    if (room) { await room.close(); room = undefined }
    hide(lobby)
    show(menu)
  }
}

async function returnToMenu(): Promise<void> {
  starting = false
  if (game) { game.destroy(true); game = undefined; battle = undefined }
  if (room) { await room.close(); room = undefined }
  hide(arena)
  hide(lobby)
  hide(dialog)
  show(menu)
}

byId('practice').addEventListener('click', () => startBattle('practice', [selectedLoadout(), BOT_LOADOUT]))
byId('create').addEventListener('click', () => void enterRoom('create'))
byId('join').addEventListener('click', () => void enterRoom('join'))
byId<HTMLInputElement>('room-code').addEventListener('keydown', event => {
  if (event.key === 'Enter') void enterRoom('join')
})
byId('lobby-back').addEventListener('click', () => void returnToMenu())
byId('arena-back').addEventListener('click', () => void returnToMenu())
byId('leave').addEventListener('click', () => void returnToMenu())
byId('rematch').addEventListener('click', () => {
  battle?.requestRematch()
  byId<HTMLButtonElement>('rematch').disabled = true
  byId('dialog-copy').textContent = '相手の再戦を待っています…'
})
