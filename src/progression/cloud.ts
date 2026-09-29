import type { User } from '@supabase/supabase-js'
import { validUsername } from '../account/username'
import { supabaseClient } from '../network/client'
import { hydrateProgress, newProgress, PROGRESS_KEY, saveProgress, type PlayerProgress } from './progress'

const OWNER_KEY = 'paradox-duel:local-owner:v1'
const GUEST_BACKUP_KEY = 'paradox-duel:guest-backup:v1'
const userBackupKey = (userId: string): string => `paradox-duel:backup:${userId}:v1`

export interface AccountIdentity { userId: string; email: string; username?: string }
export interface CloudChoice { progress: PlayerProgress; migrate: boolean }

export function chooseCloudProgress(cloud: unknown, local: PlayerProgress, canMigrate: boolean): CloudChoice {
  if (cloud && typeof cloud === 'object') return { progress: hydrateProgress(cloud), migrate: false }
  return { progress: canMigrate ? hydrateProgress(local) : newProgress(), migrate: true }
}

export class CloudProgress {
  identity?: AccountIdentity
  private revision = 0
  private pending?: PlayerProgress
  private saving?: Promise<void>
  private timer?: number
  constructor(private readonly onProgress: (progress: PlayerProgress) => void,
    private readonly onStatus: (message: string) => void,
    private readonly onIdentity: (identity?: AccountIdentity) => void) {}

  async initialize(local: PlayerProgress): Promise<void> {
    if (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY) return
    try {
      const { data: { session } } = await supabaseClient().auth.getSession()
      if (!session) return
      const { data: { user }, error } = await supabaseClient().auth.getUser()
      if (error) throw error
      if (user && !user.is_anonymous) await this.link(user, local)
    } catch (error) { this.onStatus(error instanceof Error ? error.message : 'アカウントに接続できませんでした。') }
  }

  async signUp(email: string, password: string, username: string, local: PlayerProgress): Promise<string> {
    if (!validUsername(username)) throw new Error('USERNAME は3〜16文字の英数字と _ を使用してください')
    const { data, error } = await supabaseClient().auth.signUp({
      email, password, options: {
        data: { preferred_username: username },
        emailRedirectTo: `${window.location.origin}${import.meta.env.BASE_URL}`,
      },
    })
    if (error) throw error
    if (data.session && data.user) {
      await this.link(data.user, local)
      return '登録できました。セーブデータを読み込みました。'
    }
    return '確認メールを送りました。メールを開いてからログインしてください。'
  }

  async logIn(email: string, password: string, local: PlayerProgress): Promise<void> {
    const { data, error } = await supabaseClient().auth.signInWithPassword({ email, password })
    if (error) throw error
    await this.link(data.user, local)
  }

  async setUsername(username: string): Promise<void> {
    if (!this.identity) throw new Error('Login required')
    if (!validUsername(username)) throw new Error('USERNAME は3〜16文字の英数字と _ を使用してください')
    const client = supabaseClient()
    const query = this.identity.username
      ? client.from('profiles').update({ username: username.trim(), updated_at: new Date().toISOString() })
        .eq('user_id', this.identity.userId)
      : client.from('profiles').insert({ user_id: this.identity.userId, username: username.trim() })
    const { error } = await query
    if (error) throw new Error(error.code === '23505' ? 'このUSERNAMEは使用済みです' : error.message)
    this.identity = { ...this.identity, username: username.trim() }
    this.onIdentity(this.identity)
  }

  async logOut(): Promise<void> {
    await this.flush()
    const userId = this.identity?.userId
    if (userId) {
      const current = localStorage.getItem(PROGRESS_KEY)
      if (current) localStorage.setItem(userBackupKey(userId), current)
    }
    const { error } = await supabaseClient().auth.signOut()
    if (error) throw error
    this.identity = undefined
    this.revision = 0
    const guest = localStorage.getItem(GUEST_BACKUP_KEY)
    let restored = newProgress()
    if (guest) {
      try { restored = hydrateProgress(JSON.parse(guest)) } catch { /* Start with a clean local backup. */ }
    }
    saveProgress(restored)
    localStorage.setItem(OWNER_KEY, 'guest_migrated')
    this.onProgress(restored)
    this.onIdentity(undefined)
  }

  schedule(progress: PlayerProgress): void {
    saveProgress(progress)
    if (!this.identity) {
      const owner = localStorage.getItem(OWNER_KEY)
      if (!owner || owner === 'guest_migrated') localStorage.setItem(OWNER_KEY, 'guest_fresh')
      return
    }
    localStorage.setItem(userBackupKey(this.identity.userId), JSON.stringify(progress))
    this.pending = hydrateProgress(progress)
    if (this.timer) window.clearTimeout(this.timer)
    this.timer = window.setTimeout(() => { this.timer = undefined; void this.flush() }, 350)
  }

  async flush(): Promise<void> {
    if (this.timer) { window.clearTimeout(this.timer); this.timer = undefined }
    if (this.saving) {
      try { await this.saving } catch { /* the active flush reports its own failure */ }
    }
    if (!this.identity || !this.pending) return
    const userId = this.identity.userId
    const snapshot = this.pending
    this.pending = undefined
    this.saving = (async () => {
      const { data, error } = await supabaseClient().rpc('save_player_progress', {
        p_data: snapshot, p_expected_revision: this.revision,
      })
      if (error) throw error
      if (this.identity?.userId === userId) this.revision = Number(data)
    })()
    try {
      await this.saving
    } catch {
      this.onStatus('クラウドに保存できませんでした。この端末にはバックアップを残しました。')
    } finally { this.saving = undefined }
    if (this.pending) await this.flush()
  }

  private async link(user: User, local: PlayerProgress): Promise<void> {
    await this.flush()
    const client = supabaseClient()
    const { data: profile, error: profileError } = await client.from('profiles')
      .select('username').eq('user_id', user.id).maybeSingle()
    if (profileError) throw profileError
    const { data: cloud, error: cloudError } = await client.from('player_progress')
      .select('data,revision').eq('user_id', user.id).maybeSingle()
    if (cloudError) throw cloudError
    const owner = localStorage.getItem(OWNER_KEY)
    if (!owner || owner === 'guest_fresh') {
      localStorage.setItem(GUEST_BACKUP_KEY, JSON.stringify(local))
    }
    const choice = chooseCloudProgress(cloud?.data, local, !owner || owner === 'guest_fresh')
    this.identity = { userId: user.id, email: user.email ?? '', username: profile?.username }
    this.revision = cloud?.revision ?? 0
    localStorage.setItem(OWNER_KEY, user.id)
    saveProgress(choice.progress)
    this.onProgress(choice.progress)
    if (!profile?.username && typeof user.user_metadata?.preferred_username === 'string' &&
      validUsername(user.user_metadata.preferred_username)) {
      try { await this.setUsername(user.user_metadata.preferred_username) } catch { /* username can be chosen in Account */ }
    }
    this.onIdentity(this.identity)
    if (choice.migrate) {
      this.pending = choice.progress
      await this.flush()
    }
    this.onStatus('セーブデータを読み込みました。')
  }
}
