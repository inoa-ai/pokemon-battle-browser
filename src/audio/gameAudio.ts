import type { BattleFxEvent, ElementType } from '../game/types';

type AudioScene = 'roster' | 'battle';
type UiSound = 'tap' | 'confirm' | 'back';

const typeFrequencies: Record<ElementType, number> = {
  Normal: 392,
  Fire: 196,
  Water: 247,
  Electric: 740,
  Grass: 330,
  Ice: 880,
  Fighting: 220,
  Poison: 277,
  Rock: 147,
  Ground: 165,
  Flying: 587,
  Psychic: 659,
  Ghost: 185,
  Dragon: 294,
  Dark: 208,
  Steel: 523,
  Fairy: 880,
};

const rosterMelody = [72, 76, 79, 76, 74, 76, 72, 67, 69, 72, 76, 81, 79, 76, 74, 72];
const battleMelody = [72, 79, 76, 84, 79, 76, 74, 79, 72, 79, 81, 84, 83, 79, 76, 74];
const battleBass = [36, 36, 43, 43, 41, 41, 38, 38];

class GameAudio {
  private context?: AudioContext;
  private masterGain?: GainNode;
  private bgmGain?: GainNode;
  private sfxGain?: GainNode;
  private bgmTimer?: number;
  private nextNoteAt = 0;
  private step = 0;
  private enabled = true;
  private scene: AudioScene = 'roster';
  private playedEventIds = new Set<number>();

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) {
      this.stopBgm();
      this.fadeMaster(0);
      return;
    }

    if (this.context) {
      this.fadeMaster(1);
      this.startBgm();
    }
  }

  setScene(scene: AudioScene): void {
    if (this.scene === scene) return;
    this.scene = scene;
    this.step = 0;
    if (this.context) this.startBgm();
  }

  async unlock(): Promise<void> {
    if (!this.enabled) return;
    const context = this.ensureContext();
    if (context.state === 'suspended') {
      await context.resume();
    }
    this.fadeMaster(1);
    this.startBgm();
  }

  playUi(kind: UiSound = 'tap'): void {
    this.withRunningContext((context) => {
      const now = context.currentTime;
      if (kind === 'confirm') {
        this.tone(523, 0.08, { start: now, volume: 0.12, type: 'triangle' });
        this.tone(784, 0.12, { start: now + 0.08, volume: 0.1, type: 'triangle' });
        return;
      }
      if (kind === 'back') {
        this.tone(392, 0.08, { start: now, volume: 0.1, type: 'triangle' });
        this.tone(262, 0.1, { start: now + 0.06, volume: 0.08, type: 'triangle' });
        return;
      }
      this.tone(660, 0.055, { start: now, volume: 0.08, type: 'square' });
    });
  }

  playEvent(event: BattleFxEvent): void {
    if (this.playedEventIds.has(event.id)) return;
    this.playedEventIds.add(event.id);
    if (this.playedEventIds.size > 120) {
      this.playedEventIds = new Set([...this.playedEventIds].slice(-60));
    }

    this.withRunningContext((context) => {
      const now = context.currentTime;
      const typeTone = event.moveType ? typeFrequencies[event.moveType] : 440;

      switch (event.kind) {
        case 'turn':
          this.tone(392, 0.07, { start: now, volume: 0.07, type: 'triangle' });
          this.tone(523, 0.09, { start: now + 0.07, volume: 0.06, type: 'triangle' });
          break;
        case 'move-start':
          this.tone(typeTone, 0.16, { start: now, volume: 0.11, type: 'sawtooth', glideTo: typeTone * 1.45 });
          this.noise(0.14, { start: now + 0.03, volume: 0.035, filter: event.moveType === 'Water' ? 420 : 1200 });
          break;
        case 'hit':
          this.noise(0.16, { start: now, volume: event.critical ? 0.16 : 0.1, filter: 900 });
          this.tone(typeTone * 0.55, 0.12, { start: now, volume: 0.12, type: 'square', glideTo: typeTone * 0.35 });
          if (event.effectiveness === 'super') this.tone(988, 0.12, { start: now + 0.09, volume: 0.1, type: 'triangle' });
          if (event.effectiveness === 'resist') this.tone(196, 0.14, { start: now + 0.05, volume: 0.08, type: 'sine' });
          if (event.critical) this.tone(1319, 0.16, { start: now + 0.14, volume: 0.09, type: 'triangle' });
          break;
        case 'miss':
          this.tone(440, 0.12, { start: now, volume: 0.08, type: 'triangle', glideTo: 220 });
          break;
        case 'switch':
          this.tone(330, 0.08, { start: now, volume: 0.08, type: 'triangle' });
          this.tone(494, 0.12, { start: now + 0.07, volume: 0.08, type: 'triangle' });
          break;
        case 'faint':
          this.tone(330, 0.15, { start: now, volume: 0.09, type: 'sine', glideTo: 147 });
          this.tone(220, 0.24, { start: now + 0.13, volume: 0.07, type: 'sine', glideTo: 110 });
          break;
        case 'heal':
          this.tone(523, 0.1, { start: now, volume: 0.08, type: 'triangle' });
          this.tone(659, 0.1, { start: now + 0.08, volume: 0.08, type: 'triangle' });
          this.tone(784, 0.16, { start: now + 0.16, volume: 0.08, type: 'triangle' });
          break;
        case 'status':
          this.tone(277, 0.22, { start: now, volume: 0.08, type: 'sawtooth', glideTo: 330 });
          break;
        case 'boost':
          this.tone(392, 0.08, { start: now, volume: 0.08, type: 'triangle' });
          this.tone(587, 0.1, { start: now + 0.08, volume: 0.08, type: 'triangle' });
          this.tone(880, 0.14, { start: now + 0.17, volume: 0.08, type: 'triangle' });
          break;
        case 'win':
          [523, 659, 784, 1047].forEach((freq, index) => {
            this.tone(freq, 0.22, { start: now + index * 0.12, volume: 0.1, type: 'triangle' });
          });
          break;
      }
    });
  }

  private ensureContext(): AudioContext {
    if (this.context) return this.context;
    const AudioContextCtor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const context = new AudioContextCtor();
    this.context = context;

    this.masterGain = context.createGain();
    this.masterGain.gain.value = this.enabled ? 1 : 0;

    this.bgmGain = context.createGain();
    this.bgmGain.gain.value = 0.1;

    this.sfxGain = context.createGain();
    this.sfxGain.gain.value = 0.42;

    this.bgmGain.connect(this.masterGain);
    this.sfxGain.connect(this.masterGain);
    this.masterGain.connect(context.destination);
    return context;
  }

  private withRunningContext(callback: (context: AudioContext) => void): void {
    if (!this.enabled || !this.context || this.context.state !== 'running') return;
    callback(this.context);
  }

  private startBgm(): void {
    if (!this.enabled || !this.context || this.context.state !== 'running') return;
    if (this.bgmTimer) window.clearInterval(this.bgmTimer);
    this.nextNoteAt = this.context.currentTime + 0.05;
    this.bgmTimer = window.setInterval(() => this.scheduleBgm(), 90);
    this.scheduleBgm();
  }

  private stopBgm(): void {
    if (!this.bgmTimer) return;
    window.clearInterval(this.bgmTimer);
    this.bgmTimer = undefined;
  }

  private scheduleBgm(): void {
    if (!this.context || !this.bgmGain || !this.enabled) return;
    const context = this.context;
    const lookAhead = 0.9;
    const bpm = this.scene === 'battle' ? 128 : 96;
    const stepLength = 60 / bpm / 2;
    const melody = this.scene === 'battle' ? battleMelody : rosterMelody;
    const bgmVolume = this.scene === 'battle' ? 0.052 : 0.038;

    while (this.nextNoteAt < context.currentTime + lookAhead) {
      const note = melody[this.step % melody.length];
      this.tone(midiToFrequency(note), 0.16, {
        start: this.nextNoteAt,
        volume: bgmVolume,
        type: this.scene === 'battle' ? 'square' : 'triangle',
        destination: this.bgmGain,
      });

      if (this.step % 4 === 0) {
        const bass = this.scene === 'battle' ? battleBass[Math.floor(this.step / 4) % battleBass.length] : 48;
        this.tone(midiToFrequency(bass), 0.22, {
          start: this.nextNoteAt,
          volume: this.scene === 'battle' ? 0.055 : 0.035,
          type: 'sine',
          destination: this.bgmGain,
        });
      }

      this.step += 1;
      this.nextNoteAt += stepLength;
    }
  }

  private tone(
    frequency: number,
    duration: number,
    options: {
      start: number;
      volume: number;
      type: OscillatorType;
      glideTo?: number;
      destination?: AudioNode;
    },
  ): void {
    if (!this.context) return;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    const destination = options.destination ?? this.sfxGain;
    if (!destination) return;

    oscillator.type = options.type;
    oscillator.frequency.setValueAtTime(frequency, options.start);
    if (options.glideTo) oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, options.glideTo), options.start + duration);

    gain.gain.setValueAtTime(0.0001, options.start);
    gain.gain.linearRampToValueAtTime(options.volume, options.start + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, options.start + duration);

    oscillator.connect(gain);
    gain.connect(destination);
    oscillator.start(options.start);
    oscillator.stop(options.start + duration + 0.04);
  }

  private noise(duration: number, options: { start: number; volume: number; filter: number }): void {
    if (!this.context || !this.sfxGain) return;
    const sampleCount = Math.max(1, Math.floor(this.context.sampleRate * duration));
    const buffer = this.context.createBuffer(1, sampleCount, this.context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let index = 0; index < sampleCount; index += 1) {
      const fade = 1 - index / sampleCount;
      data[index] = (Math.random() * 2 - 1) * fade;
    }

    const source = this.context.createBufferSource();
    const filter = this.context.createBiquadFilter();
    const gain = this.context.createGain();
    source.buffer = buffer;
    filter.type = 'bandpass';
    filter.frequency.value = options.filter;
    filter.Q.value = 2.8;
    gain.gain.setValueAtTime(options.volume, options.start);
    gain.gain.exponentialRampToValueAtTime(0.0001, options.start + duration);

    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);
    source.start(options.start);
    source.stop(options.start + duration);
  }

  private fadeMaster(value: number): void {
    if (!this.context || !this.masterGain) return;
    this.masterGain.gain.cancelScheduledValues(this.context.currentTime);
    this.masterGain.gain.setTargetAtTime(value, this.context.currentTime, 0.08);
  }
}

function midiToFrequency(note: number): number {
  return 440 * 2 ** ((note - 69) / 12);
}

export const gameAudio = new GameAudio();
