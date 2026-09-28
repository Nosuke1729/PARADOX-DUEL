import { RULES, type Frame } from './types'

export class EchoRecorder {
  private frames: Frame[] = []

  push(frame: Frame): void {
    this.frames.push({ ...frame })
    if (this.frames.length > RULES.echoFrames) this.frames.shift()
  }

  ready(): boolean { return this.frames.length === RULES.echoFrames }

  capture(): Frame[] { return this.frames.map(frame => ({ ...frame })) }

  clear(): void { this.frames = [] }

  remaining(): number { return Math.max(0, RULES.echoFrames - this.frames.length) }
}
