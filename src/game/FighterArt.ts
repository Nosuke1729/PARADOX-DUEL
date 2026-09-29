import type Phaser from 'phaser'
import type { Character, Loadout, Weapon } from './types'

const BODY_W = 36
const BODY_H = 56
const DETAIL_W = 220
const DETAIL_H = 90

function canvas(width: number, height: number): HTMLCanvasElement {
  const result = document.createElement('canvas')
  result.width = width; result.height = height
  return result
}

function paint(color: number): string { return `#${color.toString(16).padStart(6, '0')}` }
function blend(color: number, target: number, weight: number): string {
  const channel = (shift: number) => Math.round(((color >> shift) & 255) * (1 - weight) + ((target >> shift) & 255) * weight)
  return `rgb(${channel(16)},${channel(8)},${channel(0)})`
}
function box(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, fill: string): void {
  ctx.fillStyle = fill; ctx.fillRect(x, y, w, h)
}
function poly(ctx: CanvasRenderingContext2D, points: [number, number][], fill: string): void {
  ctx.fillStyle = fill; ctx.beginPath(); ctx.moveTo(...points[0])
  for (const point of points.slice(1)) ctx.lineTo(...point)
  ctx.closePath(); ctx.fill()
}
function stroke(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, width: number, color: string): void {
  ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineCap = 'round'
  ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke()
}

function bodyCanvas(character: Character, color: number): HTMLCanvasElement {
  const result = canvas(BODY_W, BODY_H)
  const ctx = result.getContext('2d')!
  const light = blend(color, 0xffffff, 0.38)
  const shade = blend(color, 0x102132, 0.5)
  const outline = '#101a28'
  if (character === 'light') {
    // A narrow runner with a swept scarf and slim boots.
    poly(ctx, [[11, 25], [2, 27], [7, 32], [1, 38], [14, 33]], light)
    box(ctx, 10, 43, 6, 12, outline); box(ctx, 21, 43, 6, 12, outline)
    box(ctx, 11, 44, 4, 9, shade); box(ctx, 22, 44, 4, 9, shade)
    box(ctx, 8, 20, 21, 27, outline); box(ctx, 11, 22, 15, 23, paint(color))
    poly(ctx, [[10, 22], [25, 22], [22, 38], [13, 38]], light)
    box(ctx, 10, 2, 17, 19, outline); box(ctx, 12, 4, 13, 15, paint(color))
    box(ctx, 10, 9, 19, 5, '#142638'); box(ctx, 13, 10, 13, 2, '#e8faff')
    poly(ctx, [[21, 2], [26, 0], [25, 7]], light)
  } else if (character === 'heavy') {
    // Wide shoulders, a plated chest and large boots identify the tank.
    box(ctx, 3, 47, 13, 9, outline); box(ctx, 20, 47, 13, 9, outline)
    box(ctx, 5, 49, 9, 5, shade); box(ctx, 22, 49, 9, 5, shade)
    box(ctx, 1, 21, 34, 29, outline); box(ctx, 4, 24, 28, 23, paint(color))
    box(ctx, 0, 24, 8, 15, light); box(ctx, 28, 24, 8, 15, light)
    box(ctx, 8, 26, 20, 16, shade); box(ctx, 11, 28, 14, 7, light)
    box(ctx, 6, 2, 24, 21, outline); box(ctx, 9, 4, 18, 18, paint(color))
    box(ctx, 9, 10, 18, 7, '#132334'); box(ctx, 11, 12, 14, 3, '#edfaff')
    box(ctx, 4, 0, 5, 8, shade); box(ctx, 27, 0, 5, 8, shade)
  } else if (character === 'hopper') {
    // Spring shoes and an angled visor keep this jumper distinct from LIGHT.
    box(ctx, 4, 49, 13, 7, outline); box(ctx, 20, 49, 13, 7, outline)
    box(ctx, 6, 51, 11, 3, light); box(ctx, 22, 51, 11, 3, light)
    box(ctx, 7, 44, 6, 5, shade); box(ctx, 23, 44, 6, 5, shade)
    box(ctx, 9, 45, 4, 2, light); box(ctx, 23, 45, 4, 2, light)
    box(ctx, 6, 22, 24, 24, outline); box(ctx, 9, 24, 18, 20, paint(color))
    poly(ctx, [[10, 27], [18, 33], [24, 27], [24, 31], [18, 38], [10, 31]], light)
    box(ctx, 8, 4, 20, 18, outline); box(ctx, 10, 6, 16, 14, paint(color))
    box(ctx, 9, 11, 19, 5, '#162a36'); box(ctx, 12, 12, 13, 2, '#effcff')
    poly(ctx, [[13, 4], [16, 0], [19, 4], [22, 0], [24, 5]], light)
  } else {
    // The balanced fighter has a jacket, separate arms and a clear face.
    box(ctx, 7, 46, 8, 10, outline); box(ctx, 22, 46, 8, 10, outline)
    box(ctx, 8, 47, 6, 7, shade); box(ctx, 23, 47, 6, 7, shade)
    // The far arm is part of the body; the near arm belongs to the weapon pose.
    box(ctx, 2, 25, 7, 19, outline)
    box(ctx, 4, 26, 4, 14, paint(color))
    box(ctx, 7, 22, 23, 27, outline); box(ctx, 9, 24, 19, 22, paint(color))
    box(ctx, 11, 25, 4, 16, light); box(ctx, 20, 25, 4, 16, shade)
    box(ctx, 8, 3, 20, 19, outline); box(ctx, 10, 5, 16, 16, light)
    box(ctx, 10, 11, 16, 5, '#172638'); box(ctx, 12, 12, 12, 2, '#f1fdff')
  }
  return result
}

function weaponCanvas(weapon: Weapon, color: number): HTMLCanvasElement {
  const result = canvas(DETAIL_W, DETAIL_H)
  const ctx = result.getContext('2d')!
  ctx.translate(DETAIL_W / 2, DETAIL_H / 2)
  const edge = '#0b1824'
  const steel = '#d9eaf1'
  const shine = '#ffffff'
  const accent = paint(color)
  // The arm starts at the jacket's shoulder, bends at the elbow, then grips the hilt.
  stroke(ctx, 10, -4, 17, 3, 9, edge)
  stroke(ctx, 10, -4, 17, 3, 6, accent)
  stroke(ctx, 17, 3, 25, -5, 8, edge)
  stroke(ctx, 17, 3, 25, -5, 5, accent)
  box(ctx, 21, -9, 9, 8, edge); box(ctx, 23, -8, 5, 5, steel)
  switch (weapon) {
    case 'sword':
      stroke(ctx, 26, -5, 38, -5, 6, '#374456')
      stroke(ctx, 34, -12, 34, 2, 4, accent)
      poly(ctx, [[37, -10], [61, -10], [72, -5], [61, 0], [37, 0]], edge)
      poly(ctx, [[39, -8], [61, -8], [68, -5], [39, -5]], steel)
      stroke(ctx, 42, -7, 60, -7, 1, shine)
      break
    case 'spear':
      stroke(ctx, 25, -5, 91, -5, 5, edge)
      stroke(ctx, 26, -5, 91, -5, 2, '#b3a17a')
      poly(ctx, [[89, -11], [105, -5], [89, 1]], edge)
      poly(ctx, [[91, -9], [102, -5], [91, -5]], steel)
      break
    case 'blaster':
      box(ctx, 25, -13, 32, 17, edge); box(ctx, 28, -11, 27, 13, '#647d8d')
      box(ctx, 52, -8, 15, 7, edge); box(ctx, 55, -7, 11, 4, steel)
      box(ctx, 32, -8, 13, 4, accent); box(ctx, 31, 4, 9, 12, edge)
      break
    case 'dagger':
      stroke(ctx, 26, -5, 36, -5, 5, '#4a6072')
      stroke(ctx, 35, -11, 35, 1, 3, accent)
      poly(ctx, [[37, -10], [58, -5], [37, 0]], edge)
      poly(ctx, [[39, -8], [53, -5], [39, -5]], steel)
      break
    case 'hammer':
      stroke(ctx, 26, -5, 56, -16, 6, edge)
      stroke(ctx, 28, -5, 56, -16, 3, '#b9a887')
      box(ctx, 49, -30, 19, 24, edge); box(ctx, 52, -28, 13, 20, '#90a4b2')
      box(ctx, 53, -26, 12, 4, accent)
      break
    case 'fan':
      stroke(ctx, 26, -5, 36, -12, 5, edge)
      poly(ctx, [[33, -12], [41, -35], [56, -28], [67, -14], [37, -8]], edge)
      poly(ctx, [[37, -13], [43, -31], [55, -26], [63, -15]], accent)
      stroke(ctx, 37, -12, 44, -29, 2, steel)
      stroke(ctx, 37, -12, 55, -25, 2, steel)
      break
    case 'yoyo':
      stroke(ctx, 26, -5, 38, -5, 5, edge)
      stroke(ctx, 34, -5, 69, -7, 2, steel)
      ctx.fillStyle = edge; ctx.beginPath(); ctx.arc(76, -7, 13, 0, Math.PI * 2); ctx.fill()
      ctx.fillStyle = accent; ctx.beginPath(); ctx.arc(76, -7, 10, 0, Math.PI * 2); ctx.fill()
      ctx.fillStyle = steel; ctx.beginPath(); ctx.arc(76, -7, 4, 0, Math.PI * 2); ctx.fill()
      break
    case 'whip':
      stroke(ctx, 26, -5, 40, -5, 6, edge)
      stroke(ctx, 29, -5, 39, -5, 3, '#a98765')
      stroke(ctx, 40, -5, 56, -17, 5, edge)
      stroke(ctx, 56, -17, 73, -8, 4, '#b69c72')
      stroke(ctx, 73, -8, 92, -16, 3, '#b69c72')
      stroke(ctx, 92, -16, 105, -10, 2, accent)
      break
  }
  return result
}

function hatCanvas(hat: string, color: number): HTMLCanvasElement {
  const result = canvas(DETAIL_W, DETAIL_H)
  const ctx = result.getContext('2d')!
  ctx.translate(DETAIL_W / 2, DETAIL_H / 2)
  if (hat === 'cap') {
    box(ctx, -15, -37, 29, 10, '#152638'); box(ctx, -13, -39, 25, 10, paint(color))
    box(ctx, 3, -31, 24, 5, '#152638'); box(ctx, 5, -30, 20, 3, '#f1f8fa')
  } else if (hat === 'beanie') {
    box(ctx, -15, -40, 30, 14, '#142737'); box(ctx, -12, -41, 24, 12, '#ea87b4')
    box(ctx, -17, -29, 34, 6, '#f5c0d6'); box(ctx, -3, -45, 6, 6, '#f5c0d6')
  } else if (hat === 'crown') {
    poly(ctx, [[-15, -38], [-10, -30], [-5, -41], [0, -31], [6, -43], [11, -31], [16, -38], [13, -25], [-13, -25]], '#62481c')
    poly(ctx, [[-12, -36], [-8, -29], [-4, -38], [0, -29], [6, -40], [10, -29], [13, -36], [11, -27], [-11, -27]], '#f5d56b')
    box(ctx, -3, -29, 6, 3, '#e8778b')
  } else if (hat === 'cat_ears') {
    box(ctx, -15, -29, 30, 5, '#222536')
    poly(ctx, [[-15, -29], [-14, -50], [-1, -31]], '#222536')
    poly(ctx, [[15, -29], [14, -50], [1, -31]], '#222536')
    poly(ctx, [[-11, -34], [-10, -44], [-4, -33]], '#f5a0be')
    poly(ctx, [[11, -34], [10, -44], [4, -33]], '#f5a0be')
  }
  return result
}

export function ensureFighterArt(scene: Phaser.Scene, loadout: Pick<Loadout, 'character' | 'weapon' | 'hat'>, color: number): { body: string; weapon: string; hat: string } {
  const colorId = color.toString(16)
  const body = `body-${loadout.character}-${colorId}`
  const weapon = `weapon-${loadout.weapon}-${colorId}`
  const hat = `hat-${loadout.hat ?? 'none'}-${colorId}`
  if (!scene.textures.exists(body)) scene.textures.addCanvas(body, bodyCanvas(loadout.character, color))
  if (!scene.textures.exists(weapon)) scene.textures.addCanvas(weapon, weaponCanvas(loadout.weapon, color))
  if (!scene.textures.exists(hat)) scene.textures.addCanvas(hat, hatCanvas(loadout.hat ?? 'none', color))
  return { body, weapon, hat }
}

export function drawFighterPreview(canvasElement: HTMLCanvasElement, loadout: Loadout, color: number): void {
  const ctx = canvasElement.getContext('2d')!
  const { width, height } = canvasElement
  ctx.clearRect(0, 0, width, height)
  ctx.fillStyle = '#102230'; ctx.fillRect(0, 0, width, height)
  ctx.fillStyle = '#1b3441'; ctx.fillRect(0, height - 22, width, 22)
  ctx.fillStyle = '#5c8b9c'; ctx.fillRect(0, height - 23, width, 2)
  const scale = Math.min(2.25, (height - 28) / 75, width / 180)
  const centerX = Math.round(width * 0.38)
  const centerY = height - 23 - 28 * scale
  ctx.imageSmoothingEnabled = false
  ctx.drawImage(bodyCanvas(loadout.character, color), centerX - 18 * scale, centerY - 28 * scale, BODY_W * scale, BODY_H * scale)
  ctx.drawImage(weaponCanvas(loadout.weapon, color), centerX - DETAIL_W / 2 * scale, centerY - DETAIL_H / 2 * scale, DETAIL_W * scale, DETAIL_H * scale)
  ctx.drawImage(hatCanvas(loadout.hat ?? 'none', color), centerX - DETAIL_W / 2 * scale, centerY - DETAIL_H / 2 * scale, DETAIL_W * scale, DETAIL_H * scale)
}
