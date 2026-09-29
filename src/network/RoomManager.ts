import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js'
import { isLoadout } from '../game/balance'
import type { Controls, Loadout, MatchEvent, Slot, Snapshot } from '../game/types'
import { supabaseClient } from './client'

export interface InputPacket {
  matchId: string
  round: number
  seq: number
  tick: number
  held: Controls
  pressed: Controls
}

interface RoomRow { room_id: string; room_code: string; host_id: string; guest_id: string | null }

export class RoomManager {
  readonly client: SupabaseClient
  readonly userId: string
  readonly roomId: string
  readonly code: string
  readonly slot: Slot
  readonly loadout: Loadout
  private channel: RealtimeChannel
  private closed = false
  onInput?: (input: InputPacket) => void
  onSnapshot?: (snapshot: Snapshot) => void
  onEvent?: (event: MatchEvent) => void
  onPresence?: (roster: Partial<Record<Slot, Loadout>>) => void
  onConnection?: (connected: boolean) => void

  private constructor(client: SupabaseClient, userId: string, row: RoomRow, slot: Slot, loadout: Loadout) {
    this.client = client
    this.userId = userId
    this.roomId = row.room_id
    this.code = row.room_code
    this.slot = slot
    this.loadout = loadout
    this.channel = client.channel(`duel:${row.room_id}`, {
      config: { private: true, presence: { key: userId } },
    })
  }

  static configured(): boolean {
    return Boolean(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY)
  }

  private static async session(): Promise<{ client: SupabaseClient; userId: string }> {
    const client = supabaseClient()
    const existing = await client.auth.getUser()
    if (existing.data.user) {
      await client.realtime.setAuth()
      return { client, userId: existing.data.user.id }
    }
    const result = await client.auth.signInAnonymously()
    if (result.error || !result.data.user) throw new Error(result.error?.message ?? '匿名サインインに失敗しました')
    await client.realtime.setAuth()
    return { client, userId: result.data.user.id }
  }

  static async create(loadout: Loadout): Promise<RoomManager> {
    const { client, userId } = await this.session()
    for (let attempt = 0; attempt < 4; attempt++) {
      const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
      const random = crypto.getRandomValues(new Uint8Array(6))
      const code = Array.from(random, byte => alphabet[byte % alphabet.length]).join('')
      const { data, error } = await client.rpc('create_duel_room', { p_code: code })
      if (!error && data?.[0]) return new RoomManager(client, userId, data[0] as RoomRow, 1, loadout)
      if (error?.code !== '23505') throw new Error(error?.message ?? 'ルームを作成できませんでした')
    }
    throw new Error('ルームコードを発行できませんでした。もう一度お試しください。')
  }

  static async join(code: string, loadout: Loadout): Promise<RoomManager> {
    const { client, userId } = await this.session()
    const clean = code.trim().toUpperCase()
    if (!/^[A-Z2-9]{6}$/.test(clean)) throw new Error('6 文字のルームコードを入力してください')
    const { data, error } = await client.rpc('join_duel_room', { p_code: clean })
    if (error || !data?.[0]) throw new Error(error?.message ?? 'ルームが見つからないか、満員です')
    const row = data[0] as RoomRow
    return new RoomManager(client, userId, row, row.host_id === userId ? 1 : 2, loadout)
  }

  static async ranked(row: { room_id: string; player1: string; player2: string; loadout1: Loadout; loadout2: Loadout }): Promise<RoomManager> {
    const { client, userId } = await this.session()
    if (userId !== row.player1 && userId !== row.player2) throw new Error('Ranked match membership is invalid')
    const slot: Slot = userId === row.player1 ? 1 : 2
    const loadout = slot === 1 ? row.loadout1 : row.loadout2
    return new RoomManager(client, userId, {
      room_id: row.room_id, room_code: 'RANKED', host_id: row.player1, guest_id: row.player2,
    }, slot, loadout)
  }

  roster(): Partial<Record<Slot, Loadout>> {
    const roster: Partial<Record<Slot, Loadout>> = {}
    const state = this.channel.presenceState() as Record<string, Array<Record<string, unknown>>>
    for (const entries of Object.values(state)) for (const entry of entries) {
      if ((entry.slot === 1 || entry.slot === 2) && isLoadout(entry.loadout)) roster[entry.slot] = entry.loadout
    }
    return roster
  }

  async connect(): Promise<void> {
    const channel = this.channel
    channel
      .on('broadcast', { event: 'input' }, ({ payload }) => this.onInput?.(payload as InputPacket))
      .on('broadcast', { event: 'snapshot' }, ({ payload }) => this.onSnapshot?.(payload as Snapshot))
      .on('broadcast', { event: 'game_event' }, ({ payload }) => this.onEvent?.(payload as MatchEvent))
      .on('presence', { event: 'sync' }, () => {
        this.onPresence?.(this.roster())
      })
    await new Promise<void>((resolve, reject) => {
      let settled = false
      const timeout = window.setTimeout(() => {
        if (!settled) { settled = true; reject(new Error('ルームへの接続がタイムアウトしました')) }
      }, 20000)
      channel.subscribe(async (status) => {
        if (this.closed) return
        if (status === 'SUBSCRIBED') {
          this.onConnection?.(true)
          const tracked = await channel.track({ userId: this.userId, slot: this.slot, loadout: this.loadout })
          if (!settled) {
            settled = true
            window.clearTimeout(timeout)
            tracked === 'ok' ? resolve() : reject(new Error('Presence を開始できませんでした'))
          }
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          this.onConnection?.(false)
        } else if (status === 'CLOSED') {
          this.onConnection?.(false)
          if (!settled) { settled = true; window.clearTimeout(timeout); reject(new Error('Realtime 接続に失敗しました')) }
        }
      })
    })
  }

  sendInput(input: InputPacket): void { void this.channel.send({ type: 'broadcast', event: 'input', payload: input }) }
  sendSnapshot(snapshot: Snapshot): void { void this.channel.send({ type: 'broadcast', event: 'snapshot', payload: snapshot }) }
  sendEvent(event: MatchEvent): void { void this.channel.send({ type: 'broadcast', event: 'game_event', payload: event }) }

  async close(): Promise<void> {
    if (this.closed) return
    this.closed = true
    await this.client.removeChannel(this.channel)
    await this.client.rpc('leave_duel_room', { p_room_id: this.roomId })
  }
}
