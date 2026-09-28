import { createClient, RealtimeChannel } from '@supabase/supabase-js'
import './style.css'

const SUPABASE_URL = 'https://mntqponnfxwuytziaiyx.supabase.co'
const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_56juHOb9SwnDcJSaChH1Mg_GJ7mQQ58'
const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY)

type PlayerState = {
  id: string
  x: number
  y: number
  vx: number
  vy: number
  dir: -1 | 1
  hp: number
  grounded: boolean
  attacking: boolean
  t: number
}

const root = document.querySelector<HTMLDivElement>('#app')!
const clientId = crypto.randomUUID()
let channel: RealtimeChannel | null = null
let roomCode = ''
let joined = false
let remote: PlayerState | null = null
let lastSent = 0
let lastHitAt = 0
let attackUntil = 0
let gameOver = false
let statusText = 'ルームを作成するか、コードを入力してください。'

const me: PlayerState = {
  id: clientId,
  x: 180,
  y: 360,
  vx: 0,
  vy: 0,
  dir: 1,
  hp: 100,
  grounded: true,
  attacking: false,
  t: Date.now(),
}

root.innerHTML = `
  <div class="shell">
    <header>
      <div>
        <p class="eyebrow">ONLINE 1v1 ACTION PROTOTYPE</p>
        <h1>PARADOX DUEL</h1>
      </div>
      <div id="connection" class="connection">OFFLINE</div>
    </header>

    <section id="lobby" class="panel lobby">
      <div>
        <h2>DUEL ROOM</h2>
        <p>友達と同じ6桁コードを使うだけで対戦できます。</p>
      </div>
      <div class="lobby-actions">
        <button id="create-room" type="button">ルームを作成</button>
        <div class="join-row">
          <input id="room-code" maxlength="6" autocomplete="off" spellcheck="false" placeholder="ABC123" aria-label="ルームコード" />
          <button id="join-room" type="button" class="secondary">参加</button>
        </div>
      </div>
      <p id="lobby-status" class="status"></p>
    </section>

    <section id="game" class="game-wrap hidden">
      <div class="hud">
        <div class="fighter">
          <span>YOU</span>
          <div class="hp"><i id="my-hp"></i></div>
        </div>
        <div class="room-badge">ROOM <strong id="room-label"></strong></div>
        <div class="fighter right">
          <span>RIVAL</span>
          <div class="hp"><i id="remote-hp"></i></div>
        </div>
      </div>
      <canvas id="arena" width="960" height="540" tabindex="0" aria-label="PARADOX DUEL arena"></canvas>
      <div class="controls">
        <span><kbd>A</kbd><kbd>D</kbd> 移動</span>
        <span><kbd>W</kbd> / <kbd>Space</kbd> ジャンプ</span>
        <span><kbd>J</kbd> 攻撃</span>
      </div>
      <p id="game-status" class="status"></p>
    </section>
  </div>
`

const lobby = document.querySelector<HTMLElement>('#lobby')!
const game = document.querySelector<HTMLElement>('#game')!
const connection = document.querySelector<HTMLElement>('#connection')!
const lobbyStatus = document.querySelector<HTMLElement>('#lobby-status')!
const gameStatus = document.querySelector<HTMLElement>('#game-status')!
const roomInput = document.querySelector<HTMLInputElement>('#room-code')!
const roomLabel = document.querySelector<HTMLElement>('#room-label')!
const myHp = document.querySelector<HTMLElement>('#my-hp')!
const remoteHp = document.querySelector<HTMLElement>('#remote-hp')!
const canvas = document.querySelector<HTMLCanvasElement>('#arena')!
const ctx = canvas.getContext('2d')!

const keys = new Set<string>()
const FLOOR = 438
const PLAYER_W = 44
const PLAYER_H = 70
const MOVE_SPEED = 280
const JUMP_SPEED = 610
const GRAVITY = 1600
const ATTACK_RANGE = 92
const ATTACK_DAMAGE = 20

function cleanRoom(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6)
}

function randomRoom() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

roomInput.addEventListener('input', () => {
  roomInput.value = cleanRoom(roomInput.value)
})

document.querySelector<HTMLButtonElement>('#create-room')!.addEventListener('click', () => {
  void connectToRoom(randomRoom())
})

document.querySelector<HTMLButtonElement>('#join-room')!.addEventListener('click', () => {
  const code = cleanRoom(roomInput.value)
  if (code.length !== 6) {
    lobbyStatus.textContent = '6桁のルームコードを入力してください。'
    return
  }
  void connectToRoom(code)
})

async function connectToRoom(code: string) {
  if (channel) await supabase.removeChannel(channel)
  roomCode = code
  remote = null
  gameOver = false
  me.hp = 100
  me.x = 180
  me.y = FLOOR - PLAYER_H
  me.vx = 0
  me.vy = 0
  roomLabel.textContent = code
  lobbyStatus.textContent = '接続中…'

  channel = supabase.channel(`duel:${code}`, {
    config: {
      presence: { key: clientId },
      broadcast: { self: false, ack: false },
    },
  })

  channel
    .on('presence', { event: 'sync' }, () => {
      if (!channel) return
      const state = channel.presenceState()
      const players = Object.values(state).flat() as Array<{ id?: string; joinedAt?: number }>
      if (players.length > 2) {
        statusText = 'このルームは満員です。'
      } else if (players.length === 1) {
        statusText = '相手を待っています…'
      } else {
        statusText = '対戦相手が接続しました。'
      }
    })
    .on('presence', { event: 'leave' }, ({ leftPresences }) => {
      const left = leftPresences as Array<{ id?: string }>
      if (left.some((p) => p.id === remote?.id)) remote = null
      statusText = '対戦相手との接続が切れました。'
    })
    .on('broadcast', { event: 'state' }, ({ payload }) => {
      const next = payload as PlayerState
      if (!next || next.id === clientId) return
      remote = next
    })
    .on('broadcast', { event: 'attack' }, ({ payload }) => {
      const attack = payload as { id: string; x: number; y: number; dir: -1 | 1; t: number }
      if (!attack || attack.id === clientId || gameOver) return
      const targetCenterX = me.x + PLAYER_W / 2
      const attackerFrontX = attack.x + PLAYER_W / 2 + attack.dir * 30
      const sameHeight = Math.abs((attack.y + PLAYER_H / 2) - (me.y + PLAYER_H / 2)) < 65
      const inRange = Math.abs(targetCenterX - attackerFrontX) <= ATTACK_RANGE
      const facingMe = attack.dir === 1 ? targetCenterX >= attack.x : targetCenterX <= attack.x
      if (sameHeight && inRange && facingMe && Date.now() - lastHitAt > 320) {
        lastHitAt = Date.now()
        me.hp = Math.max(0, me.hp - ATTACK_DAMAGE)
        me.vx = attack.dir * 340
        me.vy = -180
        if (me.hp === 0) {
          gameOver = true
          statusText = 'YOU LOSE — ページを更新して再戦'
        }
        sendState(true)
      }
    })
    .subscribe(async (status) => {
      if (status === 'SUBSCRIBED' && channel) {
        joined = true
        connection.textContent = 'ONLINE'
        connection.classList.add('online')
        lobby.classList.add('hidden')
        game.classList.remove('hidden')
        canvas.focus()
        await channel.track({ id: clientId, joinedAt: Date.now() })
        sendState(true)
      }
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        lobbyStatus.textContent = '接続に失敗しました。もう一度試してください。'
      }
    })
}

window.addEventListener('keydown', (event) => {
  if (!joined || gameOver) return
  if (['KeyA', 'KeyD', 'KeyW', 'Space', 'KeyJ'].includes(event.code)) event.preventDefault()
  keys.add(event.code)
  if ((event.code === 'KeyW' || event.code === 'Space') && me.grounded) {
    me.vy = -JUMP_SPEED
    me.grounded = false
  }
  if (event.code === 'KeyJ') attack()
})

window.addEventListener('keyup', (event) => keys.delete(event.code))

function attack() {
  const now = Date.now()
  if (!channel || now < attackUntil - 120) return
  attackUntil = now + 220
  me.attacking = true
  void channel.send({
    type: 'broadcast',
    event: 'attack',
    payload: { id: clientId, x: me.x, y: me.y, dir: me.dir, t: now },
  })
}

function sendState(force = false) {
  const now = performance.now()
  if (!channel || (!force && now - lastSent < 70)) return
  lastSent = now
  me.t = Date.now()
  void channel.send({ type: 'broadcast', event: 'state', payload: me })
}

function update(dt: number) {
  if (!joined || gameOver) return

  let move = 0
  if (keys.has('KeyA')) move -= 1
  if (keys.has('KeyD')) move += 1
  if (move !== 0) me.dir = move < 0 ? -1 : 1

  const targetVx = move * MOVE_SPEED
  me.vx += (targetVx - me.vx) * Math.min(1, dt * 14)
  if (move === 0) me.vx *= Math.pow(0.0004, dt)

  me.vy += GRAVITY * dt
  me.x += me.vx * dt
  me.y += me.vy * dt

  me.x = Math.max(32, Math.min(canvas.width - 32 - PLAYER_W, me.x))
  if (me.y + PLAYER_H >= FLOOR) {
    me.y = FLOOR - PLAYER_H
    me.vy = 0
    me.grounded = true
  }

  if (Date.now() >= attackUntil) me.attacking = false
  sendState()
}

function roundedRect(x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.roundRect(x, y, w, h, rr)
}

function drawPlayer(p: PlayerState, mine: boolean) {
  ctx.save()
  ctx.translate(p.x + PLAYER_W / 2, p.y + PLAYER_H / 2)
  if (p.dir < 0) ctx.scale(-1, 1)

  ctx.fillStyle = mine ? '#f4f4f5' : '#8f9bad'
  roundedRect(-PLAYER_W / 2, -PLAYER_H / 2, PLAYER_W, PLAYER_H, 11)
  ctx.fill()

  ctx.fillStyle = mine ? '#111318' : '#1a1e25'
  ctx.fillRect(7, -19, 12, 5)

  if (p.attacking) {
    ctx.strokeStyle = mine ? '#ffffff' : '#aeb8c7'
    ctx.lineWidth = 8
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(17, -2)
    ctx.lineTo(66, -2)
    ctx.stroke()
  }
  ctx.restore()
}

function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height)

  const g = ctx.createLinearGradient(0, 0, 0, canvas.height)
  g.addColorStop(0, '#11151d')
  g.addColorStop(1, '#080a0f')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  ctx.strokeStyle = 'rgba(255,255,255,.045)'
  ctx.lineWidth = 1
  for (let x = 0; x <= canvas.width; x += 48) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, FLOOR); ctx.stroke()
  }
  for (let y = 0; y <= FLOOR; y += 48) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke()
  }

  ctx.fillStyle = '#1a1f29'
  ctx.fillRect(0, FLOOR, canvas.width, canvas.height - FLOOR)
  ctx.fillStyle = '#333b49'
  ctx.fillRect(0, FLOOR, canvas.width, 3)

  if (remote) drawPlayer(remote, false)
  drawPlayer(me, true)

  if (!remote) {
    ctx.fillStyle = 'rgba(255,255,255,.72)'
    ctx.font = '600 24px system-ui'
    ctx.textAlign = 'center'
    ctx.fillText('WAITING FOR RIVAL', canvas.width / 2, 190)
    ctx.font = '15px system-ui'
    ctx.fillStyle = 'rgba(255,255,255,.42)'
    ctx.fillText(`ROOM ${roomCode}`, canvas.width / 2, 220)
  }

  myHp.style.width = `${me.hp}%`
  remoteHp.style.width = `${remote?.hp ?? 100}%`
  gameStatus.textContent = statusText
}

let previous = performance.now()
function loop(now: number) {
  const dt = Math.min((now - previous) / 1000, 0.033)
  previous = now
  update(dt)
  render()
  requestAnimationFrame(loop)
}
requestAnimationFrame(loop)

window.addEventListener('beforeunload', () => {
  if (channel) void supabase.removeChannel(channel)
})
