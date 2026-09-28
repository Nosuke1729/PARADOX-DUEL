import Phaser from 'phaser'
import { EMPTY_CONTROLS, type Controls } from './types'

export class InputManager {
  private keys: Record<string, Phaser.Input.Keyboard.Key>
  private previous: Controls = { ...EMPTY_CONTROLS }
  private pending: Controls = { ...EMPTY_CONTROLS }

  constructor(scene: Phaser.Scene) {
    const keyboard = scene.input.keyboard
    if (!keyboard) throw new Error('Keyboard is unavailable')
    this.keys = keyboard.addKeys('A,D,S,W,SPACE,J,K,L,I') as Record<string, Phaser.Input.Keyboard.Key>
    keyboard.addCapture(['SPACE', 'UP', 'DOWN'])
    const actionKeys: Array<[string, keyof Controls]> = [
      ['W', 'jump'], ['SPACE', 'jump'], ['J', 'attack'], ['K', 'dash'], ['L', 'echo'], ['I', 'skill'],
    ]
    for (const [key, action] of actionKeys) this.keys[key].on('down', () => { this.pending[action] = true })
  }

  read(): { held: Controls; pressed: Controls } {
    const down = (key: string) => this.keys[key].isDown
    const held: Controls = {
      left: down('A'), right: down('D'), down: down('S'), jump: down('SPACE') || down('W'),
      attack: down('J'), dash: down('K'), echo: down('L'), skill: down('I'),
    }
    const pressed = { ...EMPTY_CONTROLS }
    for (const key of Object.keys(held) as (keyof Controls)[]) pressed[key] = this.pending[key] || (held[key] && !this.previous[key])
    this.previous = held
    this.pending = { ...EMPTY_CONTROLS }
    return { held, pressed }
  }
}
