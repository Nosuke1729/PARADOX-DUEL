import type { Loadout } from '../game/types'
import { supabaseClient } from '../network/client'
import { RANKED_CONFIG } from './config'

export interface RankedMatch {
  id: string; room_id: string; player1: string; player2: string
  loadout1: Loadout; loadout2: Loadout
  rating1: number; rating2: number; rating_after1: number | null; rating_after2: number | null
  winner: string | null; status: 'active' | 'completed' | 'cancelled' | 'disputed'
  started_at: string
}
export interface RankedStats {
  rating: number; wins: number; losses: number; matches: number; highest_rating: number; season_id: string
}
export interface RankingEntry {
  rank_position: number; username: string; rating: number; wins: number; is_self: boolean
}
export interface MatchNames { player1_name: string; player2_name: string }

export class RankedService {
  private searchTimer?: number
  private matchTimer?: number
  private heartbeatTimer?: number
  private generation = 0
  private polling = false
  activeMatch?: RankedMatch

  async stats(userId: string): Promise<RankedStats> {
    const { data, error } = await supabaseClient().from('ranked_stats')
      .select('rating,wins,losses,matches,highest_rating,season_id').eq('user_id', userId).maybeSingle()
    if (error) throw error
    return data ?? { rating: RANKED_CONFIG.initialRating, wins: 0, losses: 0, matches: 0,
      highest_rating: RANKED_CONFIG.initialRating, season_id: 'S1' }
  }

  async rankings(): Promise<RankingEntry[]> {
    const { data, error } = await supabaseClient().rpc('get_rankings')
    if (error) throw error
    return (data ?? []) as RankingEntry[]
  }

  async names(matchId: string): Promise<MatchNames> {
    const { data, error } = await supabaseClient().rpc('get_ranked_match_names', { p_match: matchId })
    if (error) throw error
    return data as MatchNames
  }

  startSearch(loadout: Loadout, onStatus: (status: string) => void,
    onMatch: (match: RankedMatch) => void, onError: (message: string) => void): void {
    this.stopSearchTimer()
    const generation = ++this.generation
    const poll = async () => {
      if (generation !== this.generation || this.polling) return
      this.polling = true
      try {
        const { data, error } = await supabaseClient().rpc('join_ranked_queue', { p_loadout: loadout })
        if (error) throw error
        if (generation !== this.generation) return
        if (data?.status === 'matched' && data.match) {
          this.stopSearchTimer()
          this.activeMatch = data.match as RankedMatch
          onStatus('MATCH FOUND')
          onMatch(this.activeMatch)
        } else onStatus('SEARCHING FOR OPPONENT')
      } catch (error) {
        if (generation !== this.generation) return
        this.stopSearchTimer()
        onError(error instanceof Error ? error.message : 'MATCHMAKING FAILED')
      } finally { this.polling = false }
    }
    this.searchTimer = window.setInterval(() => void poll(), RANKED_CONFIG.pollIntervalMs)
    void poll()
  }

  async cancelSearch(): Promise<void> {
    this.stopSearchTimer()
    this.generation++
    const { error } = await supabaseClient().rpc('cancel_ranked_queue')
    if (error) throw error
  }

  watchMatch(matchId: string, onUpdate: (match: RankedMatch) => void): void {
    this.stopMatchTimers()
    const heartbeat = async () => {
      const { error } = await supabaseClient().rpc('ranked_heartbeat', { p_match: matchId })
      if (error) return
    }
    const poll = async () => {
      const { data, error } = await supabaseClient().from('ranked_matches').select('*').eq('id', matchId).maybeSingle()
      if (error || !data) return
      this.activeMatch = data as RankedMatch
      onUpdate(this.activeMatch)
      if (data.status !== 'active') this.stopMatchTimers()
    }
    void heartbeat()
    this.heartbeatTimer = window.setInterval(() => void heartbeat(), RANKED_CONFIG.heartbeatIntervalMs)
    this.matchTimer = window.setInterval(() => void poll(), RANKED_CONFIG.pollIntervalMs)
  }

  async report(match: RankedMatch, result: 'win' | 'loss' | 'draw', userId: string): Promise<RankedMatch> {
    const firstIsMe = match.player1 === userId
    const claim = result === 'draw' ? 'draw' : result === 'win' ? firstIsMe ? 'p1' : 'p2' : firstIsMe ? 'p2' : 'p1'
    const { data, error } = await supabaseClient().rpc('submit_ranked_result', { p_match: match.id, p_result: claim })
    if (error) throw error
    this.activeMatch = data as RankedMatch
    return this.activeMatch
  }

  async claimDisconnect(matchId: string): Promise<RankedMatch> {
    const { data, error } = await supabaseClient().rpc('claim_ranked_disconnect', { p_match: matchId })
    if (error) throw error
    this.activeMatch = data as RankedMatch
    return this.activeMatch
  }

  async forfeit(matchId: string): Promise<RankedMatch> {
    const { data, error } = await supabaseClient().rpc('forfeit_ranked_match', { p_match: matchId })
    if (error) throw error
    this.activeMatch = data as RankedMatch
    return this.activeMatch
  }

  stop(): void { this.stopSearchTimer(); this.stopMatchTimers(); this.generation++; this.activeMatch = undefined }
  private stopSearchTimer(): void { if (this.searchTimer) window.clearInterval(this.searchTimer); this.searchTimer = undefined }
  private stopMatchTimers(): void {
    if (this.heartbeatTimer) window.clearInterval(this.heartbeatTimer)
    if (this.matchTimer) window.clearInterval(this.matchTimer)
    this.heartbeatTimer = undefined; this.matchTimer = undefined
  }
}
