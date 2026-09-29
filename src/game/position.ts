import { WORLD } from './types'

const HALF_SPRITE_WIDTH = 18
const HALF_FIGHTER_HEIGHT = 28

export function clampFighterPosition(x: number, y: number): { x: number; y: number } {
  return {
    x: Math.max(HALF_SPRITE_WIDTH, Math.min(WORLD.width - HALF_SPRITE_WIDTH, x)),
    y: Math.max(30, Math.min(WORLD.floorY - HALF_FIGHTER_HEIGHT, y)),
  }
}

export function resetFighterBody(body: { reset(x: number, y: number): void }, x: number, y: number): void {
  const position = clampFighterPosition(x, y)
  body.reset(position.x, position.y)
}
