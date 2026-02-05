/**
 * Audio Service for ChronoFlip
 *
 * Handles all audio playback for the timer application.
 * Uses Web Audio API for synthesized sounds by default.
 * Designed to easily support custom audio files in the future.
 */

export type SoundType = 'tick' | 'alert' | 'warning' | 'finish' | 'start' | 'pause';

export interface AudioServiceConfig {
  volume: number; // 0 to 1
  enabled: boolean;
  // Future: customSounds: Record<SoundType, string | null>; // URLs to custom audio files
}

class AudioService {
  private context: AudioContext | null = null;
  private volume: number = 0.5;
  private enabled: boolean = true;
  private customAudioCache: Map<string, AudioBuffer> = new Map();

  constructor() {
    // AudioContext is created lazily on first use (browser autoplay policy)
  }

  /**
   * Initialize or resume the audio context
   * Must be called from a user interaction (click, etc.)
   */
  private async getContext(): Promise<AudioContext> {
    if (!this.context) {
      this.context = new (window.AudioContext || (window as any).webkitAudioContext)();
    }

    if (this.context.state === 'suspended') {
      await this.context.resume();
    }

    return this.context;
  }

  /**
   * Set the master volume (0 to 1)
   */
  setVolume(vol: number): void {
    this.volume = Math.max(0, Math.min(1, vol));
  }

  /**
   * Get current volume
   */
  getVolume(): number {
    return this.volume;
  }

  /**
   * Enable or disable all sounds
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  /**
   * Check if audio is enabled
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Play a sound by type
   */
  async play(type: SoundType): Promise<void> {
    if (!this.enabled || this.volume === 0) return;

    try {
      const ctx = await this.getContext();

      switch (type) {
        case 'tick':
          await this.playTick(ctx);
          break;
        case 'alert':
          await this.playAlert(ctx);
          break;
        case 'warning':
          await this.playWarning(ctx);
          break;
        case 'finish':
          await this.playFinish(ctx);
          break;
        case 'start':
          await this.playStart(ctx);
          break;
        case 'pause':
          await this.playPause(ctx);
          break;
      }
    } catch (e) {
      console.warn('Audio playback failed:', e);
    }
  }

  /**
   * Tick sound - subtle mechanical click
   */
  private async playTick(ctx: AudioContext): Promise<void> {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    osc.type = 'square';
    osc.frequency.setValueAtTime(150, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(40, ctx.currentTime + 0.05);

    filter.type = 'lowpass';
    filter.frequency.value = 800;

    gain.gain.setValueAtTime(this.volume * 0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.05);
  }

  /**
   * Alert sound - attention-getting beep
   */
  private async playAlert(ctx: AudioContext): Promise<void> {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.value = 880; // A5

    gain.gain.setValueAtTime(this.volume * 0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.15);
  }

  /**
   * Warning sound - urgent double beep
   */
  private async playWarning(ctx: AudioContext): Promise<void> {
    const playBeep = (startTime: number, freq: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, startTime);
      osc.frequency.exponentialRampToValueAtTime(freq * 0.5, startTime + 0.1);

      gain.gain.setValueAtTime(this.volume * 0.25, startTime);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.1);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(startTime);
      osc.stop(startTime + 0.1);
    };

    playBeep(ctx.currentTime, 880);
    playBeep(ctx.currentTime + 0.15, 880);
  }

  /**
   * Finish sound - triumphant completion chime
   * This is the main "alarm" sound when timer completes
   */
  private async playFinish(ctx: AudioContext): Promise<void> {
    // Musical progression: C5 -> E5 -> G5 -> C6 (major chord arpeggio)
    const notes = [523.25, 659.25, 783.99, 1046.50];
    const noteDuration = 0.2;

    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      const startTime = ctx.currentTime + (i * noteDuration);

      osc.type = 'triangle';
      osc.frequency.value = freq;

      gain.gain.setValueAtTime(0, startTime);
      gain.gain.linearRampToValueAtTime(this.volume * 0.4, startTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + noteDuration + 0.3);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(startTime);
      osc.stop(startTime + noteDuration + 0.3);
    });
  }

  /**
   * Start sound - subtle confirmation
   */
  private async playStart(ctx: AudioContext): Promise<void> {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(440, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.1);

    gain.gain.setValueAtTime(this.volume * 0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.15);
  }

  /**
   * Pause sound - descending tone
   */
  private async playPause(ctx: AudioContext): Promise<void> {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(660, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.15);

    gain.gain.setValueAtTime(this.volume * 0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.15);
  }

  /**
   * Play a custom audio file (for future use)
   * @param url URL to the audio file
   */
  async playCustom(url: string): Promise<void> {
    if (!this.enabled || this.volume === 0) return;

    try {
      const ctx = await this.getContext();

      // Check cache first
      let buffer = this.customAudioCache.get(url);

      if (!buffer) {
        const response = await fetch(url);
        const arrayBuffer = await response.arrayBuffer();
        buffer = await ctx.decodeAudioData(arrayBuffer);
        this.customAudioCache.set(url, buffer);
      }

      const source = ctx.createBufferSource();
      const gain = ctx.createGain();

      source.buffer = buffer;
      gain.gain.value = this.volume;

      source.connect(gain);
      gain.connect(ctx.destination);

      source.start();
    } catch (e) {
      console.warn('Custom audio playback failed:', e);
    }
  }

  /**
   * Preload a custom audio file for faster playback
   */
  async preload(url: string): Promise<void> {
    try {
      const ctx = await this.getContext();
      const response = await fetch(url);
      const arrayBuffer = await response.arrayBuffer();
      const buffer = await ctx.decodeAudioData(arrayBuffer);
      this.customAudioCache.set(url, buffer);
    } catch (e) {
      console.warn('Audio preload failed:', e);
    }
  }

  /**
   * Clear the audio cache
   */
  clearCache(): void {
    this.customAudioCache.clear();
  }
}

// Export singleton instance
export const audioService = new AudioService();

// Also export the class for testing or multiple instances
export { AudioService };
