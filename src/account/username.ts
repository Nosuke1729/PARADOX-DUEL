import { RANKED_CONFIG } from '../ranked/config'

export function normalizeUsername(value: string): string { return value.trim() }
export function validUsername(value: string): boolean {
  const username = normalizeUsername(value)
  return username.length >= RANKED_CONFIG.usernameMin &&
    username.length <= RANKED_CONFIG.usernameMax && /^[A-Za-z0-9_]+$/.test(username)
}
