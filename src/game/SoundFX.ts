type Cue = 'attack' | 'hit' | 'dash' | 'echo' | 'skill' | 'countdown' | 'round' | 'match'

class SoundFX {
  private context?: AudioContext

  unlock(): void {
    try {
      this.context ??= new AudioContext()
      void this.context.resume()
    } catch { /* audio is optional when the browser has no output */ }
  }

  play(cue: Cue): void {
    const context = this.context
    if (!context || context.state !== 'running') return
    const settings: Record<Cue, [number, number, number, OscillatorType]> = {
      attack: [390, 190, 0.09, 'sawtooth'],
      hit: [130, 55, 0.16, 'square'],
      dash: [340, 680, 0.09, 'triangle'],
      echo: [600, 170, 0.26, 'sine'],
      skill: [240, 930, 0.15, 'triangle'],
      countdown: [420, 420, 0.08, 'sine'],
      round: [210, 90, 0.36, 'triangle'],
      match: [340, 720, 0.46, 'sine'],
    }
    const [start, end, duration, type] = settings[cue]
    const oscillator = context.createOscillator()
    const gain = context.createGain()
    oscillator.type = type
    oscillator.frequency.setValueAtTime(start, context.currentTime)
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(end, 1), context.currentTime + duration)
    gain.gain.setValueAtTime(0.0001, context.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.09, context.currentTime + 0.015)
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + duration)
    oscillator.connect(gain).connect(context.destination)
    oscillator.start()
    oscillator.stop(context.currentTime + duration + 0.01)
  }
}

export const soundFX = new SoundFX()
